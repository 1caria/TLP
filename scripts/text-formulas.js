const cheerio = require("cheerio")

// Each replacement is transcribed from the named EPUB asset, not translated
// from the English edition. The few source defects are listed in the companion
// correction record and repaired only at the relevant proposition.
function attribute(value) {
    return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;")
        .replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function variable(value) { return `<var>${value}</var>` }
function overline(value) { return `<span class="overlined">${variable(value)}</span>` }
function sub(base, value) { return `${variable(base)}<sub>${variable(value)}</sub>` }
function formula(html, latex, className = "") {
    return `<span class="mathmode formula${className ? ` ${className}` : ""}" data-latex="${attribute(latex)}">${html}</span>`
}

function generalFormula(brackets = ["[", ",", "]"]) {
    const [open, comma, close] = brackets
    return formula(`${open}${overline("p")}${comma}${overline("ξ")}${comma}<span class="nop">N</span>(${overline("ξ")})${close}`,
        "[\\bar{p},\\bar{\\xi},N(\\bar{\\xi})]")
}

function operationFormula() {
    const xi = overline("ξ")
    const eta = overline("η")
    return formula(`[${xi},<span class="nop">N</span>(${xi})]’(${eta})(=[${eta},${xi},<span class="nop">N</span>(${xi})])`,
        "[\\bar{\\xi},N(\\bar{\\xi})]'(\\bar{\\eta})(=[\\bar{\\eta},\\bar{\\xi},N(\\bar{\\xi})])") + "。"
}

function sumFormula(second = false, he = false) {
    const upper = second ? sub("K", "n") : variable("n")
    const index = second ? (he ? "K" : "k") : "ν"
    const latex = second
        ? `\\sum_{${index}=0}^{K_n}\\binom{K_n}{${index}}=L_n`
        : "K_n=\\sum_{\\nu=0}^{n}\\binom{n}{\\nu}"
    const table = `<table class="possibilities formula" data-latex="${attribute(latex)}"><tbody><tr>` +
        (second ? "" : `<td rowspan="3" class="middleright">${sub("K", "n")} = </td>`) +
        `<td class="summationtop">${upper}</td><td rowspan="3" class="middleright"><span class="largeparen">(</span></td>` +
        `<td rowspan="3" class="middlecenter">${upper}<br />${variable(index)}</td>` +
        `<td rowspan="3" class="middleleft"><span class="largeparen">)</span>${second ? ` = ${sub("L", "n")}` : ""}</td></tr>` +
        `<tr><td class="summationmiddle"><span class="largeop">∑</span></td></tr>` +
        `<tr><td class="summationbottom"><span class="smallvar">${variable(index)} = 0</span></td></tr></tbody></table>`
    return table
}

const truthRows = [
    ["W", "W", "W"], ["F", "W", "W"], ["W", "F", "W"], ["W", "W", "F"],
    ["F", "F", "W"], ["F", "W", "F"], ["W", "F", "F"], ["F", "F", "F"],
]

function truthTable(headers, rows, quoted = false) {
    const cellClass = (index) => index === headers.length - 1 ? "e" : index === 0 ? "l" : "m"
    const latexHeaders = headers.join(" & ")
    const latex = `\\begin{array}{${"c".repeat(headers.length)}}${latexHeaders} \\\\ \\hline ${rows.map((row) => row.join(" & ")).join(" \\\\ ")}\\end{array}`
    const head = headers.map((header, index) =>
        `<th class="${cellClass(index)}">${quoted && index === 0 ? "“" : ""}${header ? variable(header) : ""}${quoted && index === headers.length - 1 ? "”" : ""}</th>`
    ).join("")
    const body = rows.map((row) => `<tr>${row.map((value, index) => `<td class="${cellClass(index)}">${value}</td>`).join("")}</tr>`).join("")
    return `<table class="truthtable formula" data-latex="${attribute(latex)}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

function truthPossibilities(he = false) {
    const three = truthTable(["p", "q", "r"], truthRows)
    const two = truthTable(["p", "q"], [["W", "W"], ["F", "W"], ["W", "F"], ["F", "F"]])
    const one = truthTable(["p"], [["W"], ["F"]])
    return `${three}<span class="padrthree">${he ? "，" : ""}</span>${two}<span class="padrthree">${he ? "，" : ""}</span>${one}${he ? "。" : ""}`
}

function propositionTable(he = false) {
    return truthTable(["p", "q", ""], [["W", "W", "W"], ["F", "W", "W"], ["W", "F", ""], ["F", "F", "W"]], he) + (he ? "。" : "")
}

function replaceImages(html, replacements) {
    return html.replace(/<img\b[^>]*\/?\s*>/gi, (tag) => {
        const match = tag.match(/src="(?:[^"/]*\/)*([^"/]+)"/i)
        return match && replacements[match[1]] || tag
    })
}

const greek = {
    "Ω": "\\Omega", "ξ": "\\xi", "η": "\\eta", "ν": "\\nu", "μ": "\\mu", "υ": "\\upsilon", "χ": "\\chi",
    "φ": "\\phi", "ψ": "\\psi", "θ": "\\theta", "λ": "\\lambda", "ε": "\\epsilon", "α": "\\alpha", "β": "\\beta", "γ": "\\gamma",
    "δ": "\\delta", "π": "\\pi", "σ": "\\sigma", "τ": "\\tau", "ζ": "\\zeta", "ω": "\\omega", "ρ": "\\rho", "κ": "\\kappa",
    "ℵ": "\\aleph", "∃": "\\exists", "Ǝ": "\\exists", "∨": "\\lor", "⊃": "\\supset", "≡": "\\equiv", "⊢": "\\vdash",
    "∑": "\\sum", "×": "\\times", "∶": ":", "＋": "+", "＝": "=", "～": "\\sim", "・": "\\cdot",
    "［": "[", "］": "]", "（": "(", "）": ")", "，": ",", "’": "'", "′": "'",
}

function latexText(text) {
    return text.replace(/[Ωξηνμυχφψθλεαβγδπστζωρκℵ∃Ǝ∨⊃≡⊢∑×∶＋＝～・［］（），’′]/g, (character) => {
        const value = greek[character]
        return /^\\[a-zA-Z]+$/.test(value) ? `${value} ` : value
    }).replace(/[。“”]/g, (character) => `\\text{${character}}`)
        .replace(/Def\./g, "\\mathrm{Def.}")
}

function latexFromMarkup(markup) {
    const $ = cheerio.load(`<root>${markup}</root>`, { xmlMode: true, decodeEntities: true })
    const walk = (node) => {
        if (node.type === "text") return latexText(node.data)
        if ($(node).hasClass("formula") && $(node).attr("data-latex")) return $(node).attr("data-latex")
        const content = (node.children || []).map(walk).join("")
        if (node.name === "sub") return `_{${content.trim()}}`
        if (node.name === "sup") return `^{${content.trim()}}`
        if (node.name === "br") return " \\\\ "
        if ($(node).hasClass("overlined")) return `\\bar{${content.trim()}}`
        return content
    }
    // A definition marker can straddle text nodes after a script is wrapped.
    // Normalize after joining as well, without wrapping an existing marker twice.
    return $("root").contents().toArray().map(walk).join("").trim()
        .replace(/\\mathrm\{Def\.\}|Def\./g, (value) => value === "Def." ? "\\mathrm{Def.}" : value)
}

function mergeInlineFormulas($, root) {
    // Keep a complete adjacent operation/ratio as one selectable semantic unit.
    // Tables have separately transcribed semantics and are never flattened.
    const characters = "A-Za-z0-9Α-Ωα-ωℵ∃∨⊃≡⊢∑×∶＋＝～・.+=,:;，()（）［］\\[\\]’′'|~\\-\\s"
    const tailPattern = new RegExp(`[${characters}]+$`)
    const headPattern = new RegExp(`^[${characters}]+`)
    root.find("span.formula").each((_, element) => {
        const node = $(element)
        if (!element.parent || node.parents(".formula").length) return
        const previous = element.prev
        const prefix = previous && previous.type === "text" ? (previous.data.match(tailPattern) || [""])[0] : ""
        let html = prefix + $.html(element)
        let next = element.next
        let merged = Boolean(prefix)
        const consumed = []
        while (next) {
            if (next.type === "text") {
                if (!next.data) {
                    consumed.push(next)
                    next = next.next
                    continue
                }
                const content = (next.data.match(headPattern) || [""])[0]
                if (!content) break
                html += content
                next.data = next.data.slice(content.length)
                merged = true
                if (next.data) break
                consumed.push(next)
            } else if (next.name === "span" && $(next).hasClass("formula") || next.name === "wbr") {
                html += $.html(next)
                consumed.push(next)
                merged = true
            } else break
            next = next.next
        }
        if (!merged) return
        if (prefix) previous.data = previous.data.slice(0, -prefix.length)
        consumed.forEach((item) => $(item).remove())
        node.replaceWith(formula(html, latexFromMarkup(html)))
    })
}

function styleVariables($, root) {
    const texts = []
    const collect = (node, inFormula, inVariable) => {
        if (node.type === "text") {
            if (inFormula && !inVariable) texts.push(node)
            return
        }
        const formulaAncestor = inFormula || $(node).hasClass("formula")
        const variableAncestor = inVariable || node.name === "var" || $(node).hasClass("nop")
        ;(node.children || []).forEach((child) => collect(child, formulaAncestor, variableAncestor))
    }
    collect(root[0], false, false)
    texts.forEach((node) => {
        const value = node.data.replace(/x(?=Def\.)|[A-Za-zΑ-Ωα-ω]+/g, (word) => {
            return /^[pqrsabcnwxyξηνμυχφψθλεαβγδπστζωρκ]+$/.test(word)
                ? variable(word) : word
        })
        if (value !== node.data) $(node).replaceWith(value)
    })
}

function annotateFormulaMarkup(html) {
    const $ = cheerio.load(`<root>${html}</root>`, { xmlMode: true, decodeEntities: false })
    const root = $("root")
    // A displayed equation stays one semantic formula, including its chained
    // superscripts and explicit source line breaks.
    root.find(".centered").each((_, element) => {
        const node = $(element)
        if (node.hasClass("formula") || node.parents(".formula").length || node.find(".formula,img,object").length) return
        const text = node.text()
        if (/[\u4e00-\u9fff]/.test(text) || !/[=＝Ωξ∃＋+]/.test(text)) return
        node.addClass("mathmode formula")
        const latex = latexFromMarkup(node.html() || "")
        node.attr("data-latex", node.find("br").length
            ? `\\begin{gathered}${latex}\\end{gathered}` : latex)
    })
    root.find(".mathmode").each((_, element) => {
        const node = $(element)
        if (node.hasClass("formula") || node.parents(".formula").length) return
        node.addClass("formula")
        node.attr("data-latex", latexFromMarkup(node.html() || ""))
    })
    root.find("sub,sup").each((_, element) => {
        if ($(element).parents(".formula").length) return
        const previous = element.prev
        const next = element.next
        const prefix = previous && previous.type === "text"
            ? (previous.data.match(/[A-Za-z0-9Α-Ωα-ωℵ=＋+×∶.(),，（）［］\[\]’′'\s-]+$/) || [""])[0]
            : ""
        let suffix = next && next.type === "text"
            ? (next.data.match(/^\s*[’′']?\s*[A-Za-z0-9Α-Ωα-ωℵ]*(?:Def\.)?/) || [""])[0]
            : ""
        if (/Def$/.test(suffix) && next.data[suffix.length] === ".") suffix += "."
        if (prefix) previous.data = previous.data.slice(0, -prefix.length)
        if (suffix) next.data = next.data.slice(suffix.length)
        const fragment = prefix + $.html(element) + suffix
        $(element).replaceWith(formula(fragment, latexFromMarkup(fragment)))
    })
    mergeInlineFormulas($, root)
    styleVariables($, root)
    return root.html()
}

function applyHan(result) {
    const replacements = {
        "han-image01253.jpeg": sumFormula(),
        "han-image01254.jpeg": truthPossibilities(),
        "han-image01255.jpeg": sumFormula(true),
        "han-image01256.jpeg": propositionTable(),
        "han-image01257.jpeg": formula(`(${overline("ξ")})`, "(\\bar{\\xi})"),
        "han-image01260.jpeg": formula(overline("ξ"), "\\bar{\\xi}"),
        "han-image01261.jpeg": formula(`(${overline("η")})`, "(\\bar{\\eta})"),
        "han-image01262.jpeg": operationFormula(),
    }
    // The EPUB h1 dropped p's bar. PDF page 128 (printed page 88) has it.
    result["6"] = result["6"].replace(/［p，<img\b[^>]*image01260\.jpeg[^>]*>，N<img\b[^>]*image01257\.jpeg[^>]*>］/, generalFormula(["［", "，", "］"]))
    result["6.241"] = result["6.241"].replace(/（Ων）/g, "（Ω<sup>ν</sup>）")
    Object.keys(result).forEach((label) => { result[label] = replaceImages(result[label], replacements) })
}

function applyHe(result) {
    const replacements = {
        "Image00009.jpg": sumFormula(),
        "Image00010.jpg": sumFormula(true, true),
        "Image00011.jpg": truthPossibilities(true),
        "Image00012.jpg": propositionTable(true),
        "Image00013.jpg": formula('<span class="text-fraction"><span class="fraction-top">1</span><span class="fraction-bottom">2</span></span>', "\\frac{1}{2}"),
        "Image00014.jpg": formula(overline("ξ"), "\\bar{\\xi}"),
        "Image00015.jpg": formula(overline("ξ"), "\\bar{\\xi}"),
        "Image00016.jpg": formula(overline("ξ"), "\\bar{\\xi}"),
        "Image00019.jpg": generalFormula(),
        "Image00020.jpg": formula(overline("ξ"), "\\bar{\\xi}"),
        "Image00021.jpg": formula(overline("η"), "\\bar{\\eta}"),
        "Image00022.jpg": operationFormula(),
        "Image00023.jpg": formula(`[0,${overline("ξ")},${overline("ξ")}+1]`, "[0,\\bar{\\xi},\\bar{\\xi}+1]"),
    }
    if (/Image00021/.test(result["6.01"])) {
        result["6.01"] = result["6.01"].replace(/Ω’(<img\b[^>]*Image00021\.jpg[^>]*>)）/, "Ω’（$1）")
    }
    result["5.02"] = result["5.02"].replace(/“＋c”/, "“＋<sub>c</sub>”")
        .replace(/其中“c”/, "其中“<sub>c</sub>”")
    result["5.15"] = result["5.15"].replace(/∶wr/, "∶w<sub>r</sub>")
    result["4.1272"] = result["4.1272"].replace(/χ0/, "ℵ<sub>0</sub>")
    result["4.442"] = result["4.442"].replace(/├/g, "⊢")
    if (/x Def\.Ω’/.test(result["6.02"])) {
        // The source has this conjunction after a malformed combined equation
        // paragraph; move that same word between the two definitions.
        result["6.02"] = result["6.02"].replace(/<br \/>并且<br \/>/, "<br />")
            .replace(/x Def\.Ω’/, "x Def.<br />并且<br />Ω’")
    }
    result["6.02"] = result["6.02"]
        .replace(/<sup>([^<]*?)[’′']<\/sup>/g, "<sup>$1</sup>’")
    result["6.241"] = result["6.241"]
        .replace(/<sup>v/g, "<sup>ν")
        .replace(/<sup>2×2，<\/sup>/, "<sup>2×2</sup>’")
        .replace(/Ω<sup>2<\/sup> ’Ω<sup>2<\/sup> ’＝/, "Ω<sup>2</sup> ’Ω<sup>2</sup> ’χ＝")
    Object.keys(result).forEach((label) => {
        result[label] = replaceImages(result[label], replacements).replace(/Ǝ/g, "∃")
    })
}

function applyTextFormulas(sections, translator) {
    if (translator === "韩林合") applyHan(sections)
    else if (translator === "贺绍甲") applyHe(sections)
    else throw new Error(`无文本公式规则的译本：${translator}`)
    Object.keys(sections).forEach((label) => {
        sections[label] = annotateFormulaMarkup(sections[label])
    })
    return sections
}

module.exports = { applyTextFormulas, annotateFormulaMarkup, latexFromMarkup }
