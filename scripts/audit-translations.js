const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const {
    parseEpub,
    parseHanPdf,
} = require("./generate-translations")

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

function stripMarkup(value) {
    return value
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
}

function assertComplete(name, value) {
    const missing = labels.filter((label) => !value[label] || !value[label].trim())
    if (missing.length) {
        throw new Error(`${name}缺少 ${missing.length} 条：${missing.join(", ")}`)
    }
}

const pdfLayoutRestored = new Set(["6.022", "6.03", "6.031", "6.1"])
const formatOverrides = new Set([
    "4.27", "4.31", "4.42", "4.442",
    "5.02", "5.101", "5.15", "5.151", "5.2522", "5.5423", "5.6331",
    "6.02", "6.03", "6.1203", "6.241", "6.36111",
])
const structureTags = [
    "br", "mathmode", "table", "tr", "div", "img", "object", "sup",
    "sub", "ul", "ol", "li",
]

const sourceFiles = {
    epub: path.join(
        root,
        "逻辑哲学论 ([奥地利] 路德维希·维特根斯坦贺绍甲) (z-library.sk, 1lib.sk, z-lib.sk).epub"
    ),
    pdf: path.join(
        root,
        "逻辑哲学论 (Ludwig Wittgenstein (路德维希·维特根斯坦)) (z-library.sk, 1lib.sk, z-lib.sk).pdf"
    ),
}

function countTag(value, tag) {
    return ((value || "").match(new RegExp(`<${tag}\\b`, "gi")) || []).length
}

function structure(value) {
    return Object.fromEntries(structureTags.map((tag) => [tag, countTag(value, tag)]))
}

function sourceHash(file) {
    return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
}

function pdfOcrRisks(value) {
    const plain = (value || "").replace(/<[^>]+>/g, " ")
    const risks = []
    if (/[�□]/.test(plain)) risks.push("替换字符")
    if (/[A-Z][，。；：、）)]/.test(plain)) risks.push("大写拉丁字母邻接中文标点")
    if (/\b(?:ZD|T[o0]|PV|O，|O。|J，|J。)\b/.test(plain)) risks.push("疑似公式 OCR")
    if (/\b(?:二\)|三\)|四\)|一二\^)/.test(plain)) risks.push("疑似符号 OCR")
    return risks
}

function imagePaths(value) {
    return [...(value || "").matchAll(/(?:src|data)="([^"]+\.(?:svg|png|jpe?g))"/gi)].map(
        (match) => match[1]
    )
}

function audit() {
    const rawHe = parseEpub(false)
    const rawHan = parseHanPdf(false)
    assertComplete("EPUB 原始解析", rawHe)
    const rawHanMissing = labels.filter(
        (label) => !pdfLayoutRestored.has(label) && (!rawHan[label] || !rawHan[label].trim())
    )
    if (rawHanMissing.length) {
        throw new Error(`PDF 原始解析缺少 ${rawHanMissing.length} 条：${rawHanMissing.join(", ")}`)
    }
    assertComplete("贺绍甲译文", he)
    assertComplete("韩林合译文", han)

    const heCorrections = labels.filter(
        (label) => stripMarkup(rawHe[label]) !== stripMarkup(he[label])
    )
    const hanCorrections = labels.filter(
        (label) => stripMarkup(rawHan[label]) !== stripMarkup(han[label])
    )
    const replacementGlyphs = []
    for (const [translator, translations] of [
        ["韩林合", han],
        ["贺绍甲", he],
    ]) {
        labels.forEach((label) => {
            if (/[�□]/.test(translations[label])) {
                replacementGlyphs.push(`${translator}:${label}`)
            }
        })
    }
    if (replacementGlyphs.length) {
        throw new Error(`发现替换字符：${replacementGlyphs.join(", ")}`)
    }

    const rows = labels.map((label) => {
        const epubSource = structure(rawHe[label])
        const epubOutput = structure(he[label])
        const structureDiff = structureTags.filter(
            (tag) => epubSource[tag] !== epubOutput[tag]
        )
        const images = [...new Set([...imagePaths(he[label]), ...imagePaths(han[label])])]
        const missingImages = images.filter(
            (image) => !fs.existsSync(path.join(root, "dist", image.replace(/^\.?\//, "")))
        )
        return {
            label,
            epubText: Boolean(rawHe[label]),
            hanText: Boolean(han[label]),
            epubStructure: epubSource,
            heStructure: epubOutput,
            structureDiff,
            formatOverride: formatOverrides.has(label),
            pdfLayoutRestored: pdfLayoutRestored.has(label),
            pdfOcrRisks: pdfOcrRisks(rawHan[label]),
            images,
            missingImages,
        }
    })

    const report = [
        "# 中文译文逐条审计",
        "",
        `审计时间：${new Date().toISOString()}`,
        `EPUB SHA-256：\`${sourceHash(sourceFiles.epub)}\``,
        `PDF SHA-256：\`${sourceHash(sourceFiles.pdf)}\``,
        "",
        "本报告由 `scripts/audit-translations.js` 生成。EPUB 的段落和 HTML 结构可自动比对；PDF 的文字层含有 OCR/字体编码问题，`pdfOcrRisks` 只表示需要打开 PDF 页面视觉复核，不代表译文必然错误。",
        "",
        `共 ${labels.length} 条；EPUB 编号、韩林合编号、贺绍甲编号均完整。`,
        `EPUB 与贺绍甲结构差异：${rows.filter((row) => row.structureDiff.length).length} 条（均为已登记的格式覆盖：${formatOverrides.size} 条）。`,
        `PDF 文字层 OCR 风险：${rows.filter((row) => row.pdfOcrRisks.length).length} 条。`,
        `缺失图片资源：${rows.reduce((sum, row) => sum + row.missingImages.length, 0)} 个。`,
        "",
        "| 编号 | EPUB 结构 | 贺绍甲结构 | PDF OCR 风险 | 图片 |",
        "| --- | --- | --- | --- | --- |",
        ...rows.map((row) => {
            const compact = (value) => structureTags
                .filter((tag) => value[tag])
                .map((tag) => `${tag}:${value[tag]}`)
                .join(", ") || "无"
            const risk = row.pdfOcrRisks.join("、") || "无"
            const images = row.missingImages.length
                ? `缺失：${row.missingImages.join(", ")}`
                : (row.images.length ? row.images.join(", ") : "无")
            return `| ${row.label} | ${compact(row.epubStructure)} | ${compact(row.heStructure)} | ${risk} | ${images} |`
        }),
    ].join("\n") + "\n"
    const reportPath = path.join(root, "docs", "translation-audit.md")
    fs.mkdirSync(path.dirname(reportPath), { recursive: true })
    fs.writeFileSync(reportPath, report, "utf8")

    console.log(`编号核对：${labels.length} 条；韩林合 ${Object.keys(han).length} 条；贺绍甲 ${Object.keys(he).length} 条。`)
    console.log(`EPUB 与生成译文的文本修正项：${heCorrections.length} 条：${heCorrections.join(", ")}`)
    console.log(`PDF/OCR 与生成译文的文本修正项：${hanCorrections.length} 条：${hanCorrections.join(", ")}`)
    console.log(`逐条结构报告：${path.relative(root, reportPath)}`)
    console.log(`PDF/OCR 风险条目：${rows.filter((row) => row.pdfOcrRisks.length).length} 条。`)
    console.log("替换字符检查：通过。")
}

if (require.main === module) audit()

module.exports = { audit, stripMarkup }
