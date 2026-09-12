const fs = require("fs")
const path = require("path")
const childProcess = require("child_process")

const root = path.resolve(__dirname, "..")
const sections = JSON.parse(
    fs.readFileSync(path.join(root, "src", "data", "sections.json"), "utf8")
).sections
const expectedLabels = sections
    .filter((section) => section.ger && section.ger.trim())
    .map((section) => section.label)

const epubPath = path.join(
    root,
    "逻辑哲学论 ([奥地利] 路德维希·维特根斯坦贺绍甲) (z-library.sk, 1lib.sk, z-lib.sk).epub"
)
const pdfPath = path.join(
    root,
    "逻辑哲学论 (Ludwig Wittgenstein (路德维希·维特根斯坦)) (z-library.sk, 1lib.sk, z-lib.sk).pdf"
)
const pdfTextPath = path.join(root, "tmp", "han-linhe-ocr.txt")
const epubHtmlPath = path.join(
    root,
    "tmp",
    "translation-source",
    "epub",
    "OEBPS",
    "text00007.html"
)

function decodeEntities(value) {
    return value
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
}

function cleanEpubHtml(value) {
    return decodeEntities(value)
        .replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, "")
        .replace(/<sup>\s*<\/sup>/gi, "")
        .replace(/\s+/g, " ")
        .replace(/>\s+</g, "><")
        .replace(/([\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])/g, "$1")
        .replace(/\s+([，。！？；：、）】》])/g, "$1")
        .trim()
}

function stripEpubLabel(content, rawLabel) {
    const escapedLabel = rawLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return content
        .replace(
            new RegExp(
                `^\\s*${escapedLabel}(?:\\s*<sup>[\\s\\S]*?<\\/sup>)?\\s*`
            ),
            ""
        )
        .trim()
}

function parseEpub() {
    ensureSourceFiles()
    const html = fs.readFileSync(epubHtmlPath, "utf8")
    const paragraphPattern = /<p\b[^>]*class="([^"]+)"[^>]*>([\s\S]*?)<\/p>/gi
    const parsed = []
    let match
    let current

    while ((match = paragraphPattern.exec(html))) {
        const className = match[1]
        const content = cleanEpubHtml(match[2])
        if (className.includes("left-content")) {
            const plain = content.replace(/<[^>]+>/g, " ")
            const labelMatch = plain.match(/^\s*([0-9]+(?:\.[0-9]+)*)/)
            if (!labelMatch) continue
            const rawLabel = labelMatch[1]
            const label = rawLabel === "2.20" ? "2.2" : rawLabel
            current = { label, parts: [stripEpubLabel(content, rawLabel)] }
            parsed.push(current)
        } else if (current && className.includes("content") && !className.includes("chapter")) {
            if (content) current.parts.push(content)
        }
    }

    const result = {}
    parsed.forEach((item) => {
        if (expectedLabels.includes(item.label) && !result[item.label]) {
            result[item.label] = item.parts.join("<br />")
        }
    })
    assertComplete(result, "贺绍甲")
    return result
}

function parseEpubLabelsInOrder() {
    ensureSourceFiles()
    const html = fs.readFileSync(epubHtmlPath, "utf8")
    const labels = []
    const paragraphPattern = /<p\b[^>]*class="([^"]+)"[^>]*>([\s\S]*?)<\/p>/gi
    let match
    while ((match = paragraphPattern.exec(html))) {
        if (!match[1].includes("left-content")) continue
        const plain = cleanEpubHtml(match[2]).replace(/<[^>]+>/g, " ")
        const labelMatch = plain.match(/^\s*([0-9]+(?:\.[0-9]+)*)/)
        if (!labelMatch) continue
        const label = labelMatch[1] === "2.20" ? "2.2" : labelMatch[1]
        if (expectedLabels.includes(label) && !labels.includes(label)) labels.push(label)
    }
    if (labels.length !== expectedLabels.length) {
        throw new Error(`EPUB 编号不完整：找到 ${labels.length}/${expectedLabels.length} 条。`)
    }
    return labels
}

function flexibleLabelPattern(label) {
    let pattern = "^\\s*"
    for (const character of label) {
        pattern += character === "." ? "[.·\\-\\s]*" : `${character}\\s*`
    }
    if (!label.includes(".")) pattern += "[*.·\\-]?\\s*"
    return new RegExp(pattern + "(?=\\s|$)")
}

function isPdfHeading(line, label) {
    const text = line.replace(/\f/g, "").trim()
    if (!flexibleLabelPattern(label).test(text)) return false
    if (/^\d$/.test(label)) {
        const titles = {
            1: "世界是所有实际情况",
            2: "实际情况",
            3: "事实的逻辑图像是思想",
            4: "思想是有意义的命题",
            5: "一个命题是诸基本命题",
            6: "真值函项的一般形式",
            7: "对于不可言说的东西",
        }
        return text.replace(/\s+/g, "").includes(titles[label].replace(/\s+/g, ""))
    }
    return true
}

function normalizePdfLine(line) {
    return line
        .replace(/\f/g, "")
        .replace(/\s+/g, " ")
        .replace(/\s+([，。！？；：、）】》])/g, "$1")
        .replace(/([（【《])\s+/g, "$1")
        .trim()
}

function cleanPdfBlock(lines, label) {
    const body = []
    let inFootnote = false
    const seenFootnoteMarkers = new Set()
    for (let line of lines) {
        const pageBreak = line.includes("\f")
        line = normalizePdfLine(line)
        if (!line) continue
        if (inFootnote && pageBreak) {
            inFootnote = false
            continue
        }
        if (label === "1" && /^\*/.test(line)) {
            inFootnote = true
            continue
        }
        const compactLine = line.replace(/\s+/g, "")
        if (/^\d+逻辑哲学论$/.test(compactLine) || /^逻辑哲学论\d+$/.test(compactLine)) continue
        if (/^\d+\s+[一二三四五六]$/.test(line)) continue
        if (/^(?:注释|附录|目录|编译前言|总序)/.test(line)) continue
        if (
            /^(?:[1-7]\s*[.·-]?\s*)?(?:实际情况|事实的逻辑图像是思想|思想是有意义的命题|一个命题是诸基本命题|真值函项的一般形式|对于不可言说的东西)/.test(
                line
            ) && !flexibleLabelPattern(label).test(line)
        )
            continue
        if (inFootnote) continue

        const leadingMarker = line.match(/^([①②③④⑤⑥⑦⑧⑨⑩])\s*(.*)$/)
        if (leadingMarker) {
            const marker = leadingMarker[1]
            const remainder = leadingMarker[2]
            const looksLikeFootnote =
                seenFootnoteMarkers.has(marker) ||
                /^(?:[“"「《]|参\s*见|这里|所提及|关于|维特根斯坦|罗素|弗雷格|[A-Z](?:\.|\s)|在\s*(?:19|奥|德|英|《|与)|这句话|原文)/.test(
                    remainder
                )
            if (remainder && looksLikeFootnote) {
                inFootnote = true
                continue
            }
            seenFootnoteMarkers.add(marker)
            line = remainder
            if (!line) continue
        }
        const inlineMarkers = line.match(/[①②③④⑤⑥⑦⑧⑨⑩]/g) || []
        inlineMarkers.forEach((marker) => seenFootnoteMarkers.add(marker))
        line = line.replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, "")
        body.push(line)
    }
    if (!body.length) return ""

    const first = body[0]
    const labelMatch = first.match(flexibleLabelPattern(label))
    if (labelMatch) body[0] = first.slice(labelMatch[0].length).trim()
    if (!label.includes(".")) body[0] = body[0].replace(/^[*.·\-\s]+/, "")
    return body
        .join(" ")
        .replace(/\s*(?:https?\s*:\s*\/\/|www\.|商务印书|定\s*价)[\s\S]*$/i, "")
        .replace(/事实，\s*是诸基本事态的存在\s*\d+/g, "")
        .replace(/([\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])/g, "$1")
        .replace(/([，。！？；：、])\s+/g, "$1")
        .replace(/\s+/g, " ")
        .replace(/\s+([，。！？；：、）】》])/g, "$1")
        .replace(/([（【《])\s+/g, "$1")
        .trim()
}

function parseHanPdf() {
    ensureSourceFiles()
    const lines = fs.readFileSync(pdfTextPath, "utf8").split(/\r?\n/)
    const orderedLabels = parseEpubLabelsInOrder()
    const start = lines.findIndex(
        (line) =>
            line.includes("世界是所有实际情况") && !line.includes("...")
    )
    if (start < 0) throw new Error("无法在 PDF 文本中找到韩林合译文正文起点。")
    const result = {}
    let cursor = start
    for (let index = 0; index < orderedLabels.length; index++) {
        const label = orderedLabels[index]
        let heading = -1
        for (let lineIndex = cursor; lineIndex < lines.length; lineIndex++) {
            if (isPdfHeading(lines[lineIndex], label)) {
                heading = lineIndex
                break
            }
        }
        if (heading < 0) {
            throw new Error(`无法在韩林合 PDF 中定位命题 ${label}。`)
        }
        let next = lines.length
        for (let lineIndex = heading + 1; lineIndex < lines.length; lineIndex++) {
            const nextLabel = orderedLabels[index + 1]
            if (nextLabel && isPdfHeading(lines[lineIndex], nextLabel)) {
                next = lineIndex
                break
            }
        }
        result[label] = cleanPdfBlock(lines.slice(heading, next), label)
        cursor = next
    }
    // The PDF places the six short headings 6.021-6.11 before their text objects.
    // Restore their visible text from the same extracted page in visual order.
    result["6.022"] =
        "数概念只不过是所有数的共同之处，数的一般的形式。数概念是变动的数。数相同概念是所有特殊的数相同的一般的形式。"
    result["6.03"] = "整数的一般形式是：[0，ξ，ξ+1]。"
    result["6.031"] =
        "在数学中集合论完全是多余的。这点与如下事实是关联在一起的：我们在数学中所需要的那种一般性不是偶然性的。"
    result["6.1"] = "逻辑命题是同语反复式。"
    result["6.11"] = "因此，逻辑命题没有说出任何东西。（它们是分析命题。）"
    result["2.0121"] =
        "如下之点看起来好像是偶然的：一个物，本来可以独自存在，后来竟然有一个基本事态适合于它。如果诸物能出现在诸基本事态之中，那么这一点便已经包含于它们之中了。（合乎逻辑的东西不可能是仅仅-可能的。逻辑处理每一种可能性，所有可能性都是它的事实。）正如我们根本不能在空间之外设想空间对象，在时间之外设想时间对象一样，我们也不能在其与其他的对象的结合的可能性之外设想任何对象。如果我能在一个基本事态的联结之中设想一个对象，那么我就不能在这种联结的可能性之外设想它。"
    result["3.143"] = result["3.143"].replace(
        /名称[。！？；：、）】》]*$/,
        "名称。）"
    )
    result["4.014"] = result["4.014"]
        .replace("唱片，乐思、，乐谱，声波", "唱片、乐思、乐谱、声波")
        .replace(/东西[。！？；：、）】》]*$/, "东西。）")
    result["5.242"] =
        "从“p”制作出“q”的那个运算又从“q”制作出“r”，等等。这点只能表达在如下事实中：“p”、“q”、“r”等等是变项，它们一般性地表达出了某些形式关系。"
    result["5.43"] =
        "据说，对一个事实p而言，应该有无穷多个其它的事实，即～～p、～～～～p，等等，得自于它。的确，人们立即就会看出，这是难以置信的。同样令人惊异的是，无穷多个逻辑（数学）命题得自于半打“基本规律”。但是，所有逻辑命题都说出了相同的东西，即没有说出任何东西。"
    result["5.515"] =
        "如下之点必须显示自身于我们的记号之中：通过“∨”等等彼此结合在一起的东西必须是命题。事实上也的确如此，因为记号“p”和“q”本身实际上就已经预设了“∨”、“～”等等。如果出现于“p∨q”中的符号“p”所代表的不是一个复合的符号，那么就其自身而言它不可能具有意义；但是这时与“p”具有相同的意义的符号“p∨p”、“p·q”等等也不能具有意义。但是，如果“p∨p”没有意义，那么“p∨q”也不能具有意义。"
    result["6.02"] =
        "由此我们便得到了数。我给出如下定义：x = Ω<sup>0</sup>'x Def. 和 Ω'Ω<sup>v</sup>'x = Ω<sup>v+1</sup>'x Def。"
    result["5.641"] = result["5.641"].split("在与奥格登讨论")[0].trim()
    assertComplete(result, "韩林合")
    return result
}

function ensureSourceFiles() {
    if (!fs.existsSync(epubHtmlPath)) {
        fs.mkdirSync(path.dirname(epubHtmlPath), { recursive: true })
        try {
            childProcess.execFileSync(
                "tar",
                ["-xf", epubPath, "-C", path.dirname(path.dirname(epubHtmlPath))],
                { stdio: "inherit" }
            )
        } catch (error) {
            // Windows tar may report timestamp restoration warnings after extracting successfully.
            if (!fs.existsSync(epubHtmlPath)) throw error
        }
    }
    if (!fs.existsSync(pdfTextPath)) {
        fs.mkdirSync(path.dirname(pdfTextPath), { recursive: true })
        childProcess.execFileSync(
            "pdftotext",
            ["-raw", "-enc", "UTF-8", pdfPath, pdfTextPath],
            { stdio: "inherit" }
        )
    }
}

function assertComplete(result, translator) {
    const missing = expectedLabels.filter(
        (label) => !result[label] || !result[label].trim()
    )
    if (missing.length) {
        throw new Error(`${translator}译文缺少或为空：${missing.join(", ")}`)
    }
}

function writeJson(fileName, value) {
    const destination = path.join(root, "src", "data", fileName)
    fs.writeFileSync(destination, `${JSON.stringify(value, null, 4)}\n`, "utf8")
}

function main() {
    const he = parseEpub()
    const han = parseHanPdf()
    writeJson("heShaojia.json", {
        translator: "贺绍甲",
        source: "商务印书馆《逻辑哲学论》（EPUB，2009/2011）",
        sections: he,
    })
    writeJson("hanLinhe.json", {
        translator: "韩林合",
        source: "商务印书馆《维特根斯坦文集》第2卷《逻辑哲学论》（PDF，2019）",
        sections: han,
    })
    console.log(`已生成两套译文：${expectedLabels.length} 条/套。`)
}

if (require.main === module) main()

module.exports = {
    cleanEpubHtml,
    cleanPdfBlock,
    flexibleLabelPattern,
    parseEpub,
    parseEpubLabelsInOrder,
    parseHanPdf,
    stripEpubLabel,
}
