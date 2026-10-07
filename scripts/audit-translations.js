const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const childProcess = require("child_process")
const cheerio = require("cheerio")
const { parseEpub, parseHanEpub } = require("./generate-translations")
const { validateFormulaCorpus, geometricImages } = require("./formula-validation")

const root = path.resolve(__dirname, "..")
const labels = JSON.parse(fs.readFileSync(path.join(root, "src/data/sections.json"), "utf8"))
    .sections.filter(section => section.ger && section.ger.trim()).map(section => section.label)
const sources = {
    hanEpub: "维特根斯坦文集（套装全8卷） (维特根斯坦) (z-library.sk, 1lib.sk, z-lib.sk).epub",
    heEpub: "逻辑哲学论 ([奥地利] 路德维希·维特根斯坦贺绍甲) (z-library.sk, 1lib.sk, z-lib.sk).epub",
    hanPdf: "逻辑哲学论 (Ludwig Wittgenstein (路德维希·维特根斯坦)) (z-library.sk, 1lib.sk, z-lib.sk).pdf",
}
const structureTags = ["br", "p", "h1", "blockquote", "div", "table", "tr", "em", "sub", "sup", "img"]
const blockTags = new Set(["p", "h1", "div", "blockquote", "tr"])

function readCorpus(name) {
    return JSON.parse(fs.readFileSync(path.join(root, "src", "data", name), "utf8")).sections
}

function assertComplete(name, value) {
    const missing = labels.filter(label => !value[label] || !value[label].trim())
    const extras = Object.keys(value).filter(label => !labels.includes(label))
    if (missing.length || extras.length) {
        throw new Error(`${name}编号不一致；缺少：${missing.join(", ") || "无"}；多出：${extras.join(", ") || "无"}`)
    }
}

function sourceHash(relative) {
    const file = path.join(root, relative)
    if (!fs.existsSync(file)) throw new Error(`校对来源文件缺失：${relative}`)
    return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
}

function verifyExtractedText(file) {
    const version = file.includes("han-epub") ? "han" : "he"
    const entry = file.slice(file.indexOf("OEBPS/"))
    const original = childProcess.spawnSync("tar", ["-xOf", path.join(root, sources[`${version}Epub`]), entry], {
        maxBuffer: 16 * 1024 * 1024,
    })
    if (original.error || original.status !== 0) throw new Error(`无法读取 EPUB 原始章节 ${entry}：${original.error || original.stderr.toString()}`)
    const originalHash = crypto.createHash("sha256").update(original.stdout).digest("hex")
    const extractedHash = sourceHash(file)
    if (originalHash !== extractedHash) throw new Error(`解包章节与原始 EPUB 字节不一致：${file}`)
    return { file, hash: originalHash }
}

function document(value) {
    return cheerio.load(`<root>${value || ""}</root>`, { xmlMode: true })
}

function textContent(value) {
    const q = document(value)
    q(".formula,img,object,svg,canvas,script,style").remove()
    return q("root").text().replace(/\s+/g, " ").trim()
}

function hanCharacters(value) {
    return (String(value).match(/\p{Script=Han}/gu) || []).join("")
}

// Walk text and paragraph boundaries independently of the formula converter.
// Remove formula units, including data-copy-text diagram annotations, before
// gathering Chinese prose. Empty picture-only blocks do not invent prose.
function chineseParagraphs(value) {
    const q = document(value)
    q(".formula,img,object,svg,canvas,script,style").remove()
    const paragraphs = []
    let buffer = ""
    const flush = () => {
        const characters = hanCharacters(buffer)
        if (characters) paragraphs.push(characters)
        buffer = ""
    }
    const visit = node => {
        if (node.type === "text") { buffer += node.data; return }
        if (node.type === "comment") return
        if (node.name === "br") { flush(); return }
        const block = blockTags.has(node.name)
        if (block) flush()
        ;(node.children || []).forEach(visit)
        if (block) flush()
    }
    q("root").contents().each((_, node) => visit(node))
    flush()
    return paragraphs
}

function structure(value) {
    const q = document(value)
    return Object.fromEntries(structureTags.map(tag => [tag, q(`root ${tag}`).length]))
}

function paragraphStats(value) {
    const counts = structure(value)
    const tags = structureTags.filter(tag => counts[tag]).map(tag => `${tag}:${counts[tag]}`).join(", ") || "无"
    return `${counts.br + 1}段/${counts.div + counts.p + counts.h1 + counts.blockquote}块；${tags}`
}

function imagePaths(value) {
    const q = document(value)
    return q("img").map((_, image) => q(image).attr("src") || "").get()
}

function textDifference(before, after) {
    let index = 0
    while (index < Math.min(before.length, after.length) && before[index] === after[index]) index++
    return `第${index + 1}字；源「${before.slice(Math.max(0, index - 12), index + 16)}」；网页「${after.slice(Math.max(0, index - 12), index + 16)}」`
}

function audit() {
    // false bypasses every new formula/diagram converter. Using the defaults
    // would only compare the generator with itself and prove no fidelity.
    const sourceVersions = { han: parseHanEpub(false), he: parseEpub(false) }
    const versions = { han: readCorpus("hanLinhe.json"), he: readCorpus("heShaojia.json") }
    const names = { han: "韩林合", he: "贺绍甲" }
    Object.entries(versions).forEach(([version, sections]) => {
        assertComplete(`${names[version]}生成译文`, sections)
        assertComplete(`${names[version]}原始解析`, sourceVersions[version])
    })
    const formulaRows = validateFormulaCorpus(versions)
    const formulaLookup = new Map(formulaRows.map(row => [`${row.version}/${row.label}`, row]))
    const hashes = Object.entries(sources).map(([name, file]) => ({ name, file, hash: sourceHash(file) }))
    const extractedFiles = [
        ...Array.from({ length: 7 }, (_, index) => `tmp/han-epub/OEBPS/Text/part00${index + 21}.xhtml`),
        "tmp/translation-source/epub/OEBPS/text00007.html",
    ]
    const extractedHashes = extractedFiles.map(verifyExtractedText)
    const failures = []
    const rows = []

    for (const version of ["han", "he"]) {
        for (const label of labels) {
            const original = sourceVersions[version][label]
            const output = versions[version][label]
            const sourceChinese = hanCharacters(textContent(original))
            const outputChinese = hanCharacters(textContent(output))
            const sourceParagraphs = chineseParagraphs(original)
            const outputParagraphs = chineseParagraphs(output)
            const chineseMatches = sourceChinese === outputChinese
            const paragraphMatches = JSON.stringify(sourceParagraphs) === JSON.stringify(outputParagraphs)
            if (!chineseMatches) failures.push(`${names[version]} ${label} 中文正文改变：${textDifference(sourceChinese, outputChinese)}`)
            if (!paragraphMatches) failures.push(`${names[version]} ${label} 中文段落边界改变：${sourceParagraphs.length}→${outputParagraphs.length}`)

            const originalImages = imagePaths(original)
            const outputImages = imagePaths(output)
            for (const filename of geometricImages[version][label] || []) {
                if (!originalImages.some(image => path.basename(image) === filename)) failures.push(`${names[version]} ${label} 原解析缺少几何图 ${filename}`)
                if (!outputImages.some(image => path.basename(image) === filename)) failures.push(`${names[version]} ${label} 网页遗漏几何图 ${filename}`)
            }
            for (const image of outputImages) {
                if (!fs.existsSync(path.join(root, "dist", image))) failures.push(`${names[version]} ${label} 几何图文件缺失：${image}`)
            }
            for (const image of originalImages) {
                const name = path.basename(image)
                const originalPath = version === "han"
                    ? path.join(root, "tmp/han-epub/OEBPS/Images", name.replace(/^han-/, ""))
                    : path.join(root, "tmp/translation-source/epub/OEBPS", name)
                if (!fs.existsSync(originalPath)) failures.push(`${names[version]} ${label} 原始媒体证据缺失：${name}`)
            }
            rows.push({ version, label, sourceChinese, outputChinese, chineseMatches,
                paragraphMatches, sourceParagraphs, outputParagraphs,
                sourceStructure: paragraphStats(original), outputStructure: paragraphStats(output),
                originalImages, outputImages, ...formulaLookup.get(`${version}/${label}`) })
        }
    }

    const report = [
        "# 中文译文逐条自动审计", "",
        `审计时间：${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", dateStyle: "short", timeStyle: "medium" }).format(new Date())}（Asia/Shanghai）`, "",
        "本报告由 `scripts/audit-translations.js` 自动生成，共 1050 行（韩林合 525 条、贺绍甲 525 条）。正文基底明确使用 `parseHanEpub(false)` 和 `parseEpub(false)`，绕过文字公式及逻辑图转换；没有用转换后的默认解析结果与生成器自身精确比对。", "",
        "自动检查范围：编号完整性；移除公式、图示和媒体后的中文汉字顺序；含中文的段落边界；原解析与网页的段落、块、强调、上下标和媒体数量；公式复制结构及真实文字；公式媒体禁用；原媒体证据与保留几何图的文件存在性。中文汉字序列一致不等于所有标点、空格、数学符号和排版均已人工复核。", "",
        "原始解析基底仍执行原有脚注/编号移除、HTML 实体与空白归一化、韩版的明确编码修复（ν/撇号/ℵ/⊢ 等）以及第 6.241 条显示换行恢复。它不是 EPUB 字节或扫描页的逐字逐像素副本。原解析的段数为 br+1，块数为 div/p/h1/blockquote 数；含中文的段落边界另通过 DOM 遍历比较，忽略空的公式/图片专用段。公式转成文字表格后结构计数可以改变，不能把这种差异当作正文增加或删除。", "",
        "人工来源核对记录与自动检查分开：标量公式、真值表及源编码校订参见 [text-formula-corrections.md](text-formula-corrections.md)；五幅逻辑图的两译本原图、完整连线和真值语义参见 [logical-diagram-sources.md](logical-diagram-sources.md)。这些是列明公式来源的专项核对记录；本报告不声称 525 条或 1050 条已经完成逐句人工审读。", "",
        "## 原文件与解析来源指纹", "",
        "以下 8 个解包正文文件均通过 `tar -xOf 原始EPUB 章节路径` 重新读取原 EPUB 条目，逐文件比较 SHA-256；不是仅给工作目录缓存计算指纹。章节字节与原 EPUB 内条目一致。", "",
        "| 来源 | 文件 | SHA-256 |", "| --- | --- | --- |",
        ...hashes.map(item => `| ${item.name} | ${item.file} | \`${item.hash}\` |`),
        ...extractedHashes.map(item => `| 实际读取的 EPUB 解包正文 | ${item.file} | \`${item.hash}\` |`), "",
        "## 自动检查结果", "",
        ...["han", "he"].map(version => {
            const subset = rows.filter(row => row.version === version)
            return `${names[version]}：编号 ${subset.length}/${labels.length}；中文汉字序列 ${subset.filter(row => row.chineseMatches).length}/${labels.length}；含中文的段落边界 ${subset.filter(row => row.paragraphMatches).length}/${labels.length}；可复制文字公式 ${subset.reduce((total, row) => total + row.formulas, 0)} 个（含逻辑图）；逻辑图 ${subset.reduce((total, row) => total + row.logicalDiagrams, 0)} 幅；保留几何图 ${subset.reduce((total, row) => total + row.geometricFigures, 0)} 幅。`
        }), "",
        "`validateFormulaCorpus({han, he})` 已逐条执行：公式不得包含 img/svg/canvas/object/iframe 或 URL 图像资源；每个公式须含真实文字和 data-latex/data-copy-text；上下标与上划线须附有公式复制结构；检查乱码。几何图只允许明确列出的原图，另核对来源节点、网页节点及文件存在。",
        `额外正文/段落/资源检查失败：${failures.length}。`,
        ...(failures.length ? ["", ...failures.map(failure => `- ${failure}`)] : []), "",
        "## 两译本全部 1050 条", "",
        "| 译本 | 编号 | 中文字数 源→网页 | 汉字正文 | 中文段落 源→网页/边界 | 原解析 段/块与标签 | 网页 段/块与标签 | 文字公式/逻辑图 | 原媒体数→网页几何图 | 保留几何图 |",
        "| --- | --- | ---: | --- | --- | --- | --- | ---: | ---: | --- |",
        ...rows.map(row => `| ${names[row.version]} | ${row.label} | ${row.sourceChinese.length}→${row.outputChinese.length} | ${row.chineseMatches ? "一致" : "不一致"} | ${row.sourceParagraphs.length}→${row.outputParagraphs.length}/${row.paragraphMatches ? "一致" : "不一致"} | ${row.sourceStructure} | ${row.outputStructure} | ${row.formulas}/${row.logicalDiagrams} | ${row.originalImages.length}→${row.outputImages.length} | ${row.outputImages.join(", ") || "无"} |`),
    ].join("\n") + "\n"

    const reportPath = path.join(root, "docs", "translation-audit.md")
    fs.mkdirSync(path.dirname(reportPath), { recursive: true })
    fs.writeFileSync(reportPath, report, "utf8")
    if (failures.length) throw new Error(`逐条审计失败（报告已写入）：\n${failures.join("\n")}`)
    console.log(`两译本编号完整：${rows.length}/1050；绕过公式转换的中文汉字序列及中文段落边界：${rows.length}/1050。`)
    console.log(`真实文字公式：${rows.reduce((total, row) => total + row.formulas, 0)}；CSS 逻辑图：${rows.reduce((total, row) => total + row.logicalDiagrams, 0)}；保留几何图：${rows.reduce((total, row) => total + row.geometricFigures, 0)}。`)
    console.log("公式图片：0；图像公式机制：0；缺失来源/几何图文件：0；乱码：0。")
    console.log(`逐条自动报告：${path.relative(root, reportPath)}；人工公式校订记录与该报告分开保存。`)
    return rows
}

if (require.main === module) audit()

module.exports = { audit, textContent, chineseParagraphs }
