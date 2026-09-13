const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const cheerio = require("cheerio")
const { parseEpub, parseHanEpub } = require("./generate-translations")

const root = path.resolve(__dirname, "..")
const source = JSON.parse(
    fs.readFileSync(path.join(root, "src", "data", "sections.json"), "utf8")
).sections
const labels = source
    .filter((section) => section.ger && section.ger.trim())
    .map((section) => section.label)
const han = JSON.parse(
    fs.readFileSync(path.join(root, "src", "data", "hanLinhe.json"), "utf8")
).sections
const he = JSON.parse(
    fs.readFileSync(path.join(root, "src", "data", "heShaojia.json"), "utf8")
).sections

const sourceFiles = {
    hanEpub: path.join(
        root,
        "维特根斯坦文集（套装全8卷） (维特根斯坦) (z-library.sk, 1lib.sk, z-lib.sk).epub"
    ),
    heEpub: path.join(
        root,
        "逻辑哲学论 ([奥地利] 路德维希·维特根斯坦贺绍甲) (z-library.sk, 1lib.sk, z-lib.sk).epub"
    ),
}
const structureTags = ["br", "em", "sub", "sup", "table", "tr", "div", "img"]

function assertComplete(name, value) {
    const missing = labels.filter((label) => !value[label] || !value[label].trim())
    const extras = Object.keys(value).filter((label) => !labels.includes(label))
    if (missing.length || extras.length) {
        throw new Error(
            `${name}编号不一致；缺少：${missing.join(", ") || "无"}；多出：${extras.join(", ") || "无"}`
        )
    }
}

function sourceHash(file) {
    return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
}

function countTag(value, tag) {
    return ((value || "").match(new RegExp(`<${tag}\\b`, "gi")) || []).length
}

function structure(value) {
    return Object.fromEntries(structureTags.map((tag) => [tag, countTag(value, tag)]))
}

function paragraphCount(value) {
    return value ? countTag(value, "br") + 1 : 0
}

function imagePaths(value) {
    return [...(value || "").matchAll(/src="([^"]+\.(?:png|jpe?g|svg))"/gi)].map(
        (match) => match[1]
    )
}

function textContent(value) {
    const $ = cheerio.load(`<root>${value || ""}</root>`, {
        xmlMode: true,
        decodeEntities: false,
    })
    $("img").each((_, image) => {
        const node = $(image)
        node.replaceWith(`[图:${path.basename(node.attr("src") || "")}]`)
    })
    return $("root").text().replace(/\s+/g, " ").trim()
}

function compactStructure(value) {
    return structureTags
        .filter((tag) => value[tag])
        .map((tag) => `${tag}:${value[tag]}`)
        .join(", ") || "无"
}

function audit() {
    const hanSource = parseHanEpub()
    const heSource = parseEpub()
    assertComplete("韩林合 EPUB 解析", hanSource)
    assertComplete("韩林合生成译文", han)
    assertComplete("贺绍甲 EPUB 解析", heSource)
    assertComplete("贺绍甲生成译文", he)

    const exactHanMismatches = labels.filter((label) => hanSource[label] !== han[label])
    const exactHeMismatches = labels.filter((label) => heSource[label] !== he[label])
    if (exactHanMismatches.length || exactHeMismatches.length) {
        throw new Error(
            `生成译文与源解析不一致；韩林合：${exactHanMismatches.join(", ") || "无"}；贺绍甲：${exactHeMismatches.join(", ") || "无"}`
        )
    }

    const invalidGlyphs = []
    const rows = labels.map((label) => {
        const value = han[label]
        if (/[�□\uE000-\uF8FF]/.test(textContent(value))) invalidGlyphs.push(label)
        const images = [...new Set(imagePaths(value))]
        const missingImages = images.filter(
            (image) => !fs.existsSync(path.join(root, "dist", image.replace(/^\.?\//, "")))
        )
        return {
            label,
            paragraphs: paragraphCount(value),
            sourceTextMatches: textContent(hanSource[label]) === textContent(value),
            sourceStructure: structure(hanSource[label]),
            outputStructure: structure(value),
            images,
            missingImages,
        }
    })

    if (invalidGlyphs.length) {
        throw new Error(`韩林合译文含乱码或私用区字符：${invalidGlyphs.join(", ")}`)
    }
    const missingImages = rows.flatMap((row) => row.missingImages)
    if (missingImages.length) {
        throw new Error(`缺少 EPUB 图片资源：${missingImages.join(", ")}`)
    }

    const report = [
        "# 中文译文逐条审计",
        "",
        `审计时间：${new Date().toISOString()}`,
        `韩林合八卷本 EPUB SHA-256：\`${sourceHash(sourceFiles.hanEpub)}\``,
        `贺绍甲 EPUB SHA-256：\`${sourceHash(sourceFiles.heEpub)}\``,
        "",
        "本报告由 `scripts/audit-translations.js` 自动生成。韩林合译文逐条直接解析自指定八卷本 EPUB；审计对 525 条生成 HTML 做精确比对，并检查段落、强调、上下标、图片引用和图片文件。公式中的 EPUB 编码修复在生成器中统一执行，包括运算撇号、希腊字母、乐谱符号、逻辑判断符和阿列夫符号。",
        "",
        `编号完整性：${labels.length}/${labels.length} 条。`,
        `韩林合逐条精确 HTML 一致：${labels.length - exactHanMismatches.length}/${labels.length} 条。`,
        `韩林合逐条可见文本一致：${rows.filter((row) => row.sourceTextMatches).length}/${labels.length} 条。`,
        `包含多个段落或块的条目：${rows.filter((row) => row.paragraphs > 1).length} 条。`,
        `包含上下标的条目：${rows.filter((row) => row.sourceStructure.sub || row.sourceStructure.sup).length} 条。`,
        `包含公式或图示图片的条目：${rows.filter((row) => row.images.length).length} 条，共 ${rows.reduce((sum, row) => sum + row.images.length, 0)} 个不同引用。`,
        "乱码及 Unicode 私用区字符：0 个。",
        "缺失图片资源：0 个。",
        "",
        "| 编号 | 段落/块 | EPUB 结构 | 生成结构 | 图片 |",
        "| --- | ---: | --- | --- | --- |",
        ...rows.map((row) =>
            `| ${row.label} | ${row.paragraphs} | ${compactStructure(row.sourceStructure)} | ${compactStructure(row.outputStructure)} | ${row.images.join(", ") || "无"} |`
        ),
    ].join("\n") + "\n"

    const reportPath = path.join(root, "docs", "translation-audit.md")
    fs.mkdirSync(path.dirname(reportPath), { recursive: true })
    fs.writeFileSync(reportPath, report, "utf8")

    console.log(`编号核对：韩林合 ${labels.length}/${labels.length} 条；贺绍甲 ${labels.length}/${labels.length} 条。`)
    console.log(`韩林合 EPUB 逐条精确 HTML 比对：${labels.length}/${labels.length} 条。`)
    console.log("乱码及私用区字符：0；缺失图片资源：0。")
    console.log(`逐条结构报告：${path.relative(root, reportPath)}`)
}

if (require.main === module) audit()

module.exports = { audit, textContent }
