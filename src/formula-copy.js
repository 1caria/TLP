// Copy from the original selection, preserving mathematical structure even
// when the selected text is inside an overline or a sub/superscript.
const mathCharacters = {
    "ξ": "\\xi", "η": "\\eta", "ν": "\\nu", "υ": "\\upsilon",
    "μ": "\\mu", "χ": "\\chi", "Ω": "\\Omega", "ℵ": "\\aleph",
    "∃": "\\exists", "∀": "\\forall", "⊃": "\\supset", "∨": "\\lor",
    "≡": "\\equiv", "∑": "\\sum", "×": "\\times", "⊢": "\\vdash",
    "≤": "\\le", "≥": "\\ge", "∞": "\\infty",
    "φ": "\\phi", "ψ": "\\psi", "θ": "\\theta", "λ": "\\lambda",
    "ε": "\\epsilon", "α": "\\alpha", "β": "\\beta", "γ": "\\gamma",
    "δ": "\\delta", "π": "\\pi", "σ": "\\sigma", "τ": "\\tau",
    "ζ": "\\zeta", "ω": "\\omega", "ρ": "\\rho", "κ": "\\kappa",
    "∶": ":", "＋": "+", "＝": "=", "～": "\\sim", "・": "\\cdot",
}

function toLatex(text) {
    return Array.from(text).map((character) => mathCharacters[character]
        ? mathCharacters[character] + " " : character).join("")
}

function textNodes(node) {
    if (node.nodeType === 3) return node.textContent ? [node] : []
    return Array.from(node.childNodes || []).reduce(
        (nodes, child) => nodes.concat(textNodes(child)), []
    )
}

function fullySelected(node, range) {
    const nodes = textNodes(node)
    return nodes.length > 0 &&
        range.comparePoint(nodes[0], 0) === 0 &&
        range.comparePoint(nodes[nodes.length - 1], nodes[nodes.length - 1].length) === 0
}

function selectedText(node, range) {
    if (range.comparePoint(node, node.length) < 0 || range.comparePoint(node, 0) > 0) {
        return ""
    }
    const start = range.startContainer === node ? range.startOffset : 0
    const end = range.endContainer === node ? range.endOffset : node.length
    return node.textContent.slice(start, end)
}

function serializeSelection(node, range, inFormula = false) {
    if (!range.intersectsNode(node)) return ""
    if (node.nodeType === 3) {
        const text = selectedText(node, range)
        return inFormula ? toLatex(text) : text
    }
    if (node.nodeType !== 1 && node.nodeType !== 11) return ""
    const tag = (node.tagName || "").toLowerCase()
    if (node.nodeType === 1) {
        if (node.getAttribute("aria-hidden") === "true") return ""
        const copyText = node.getAttribute("data-copy-text")
        const latex = node.getAttribute("data-latex")
        if ((copyText || latex) && fullySelected(node, range)) {
            if (copyText) return "\n" + copyText + "\n"
            return "$" + latex + "$"
        }
        if (tag === "br") return "\n"
        if (tag === "img") return "[" + (node.getAttribute("alt") || "图示") + "]"
    }
    const math = inFormula || (node.classList &&
        (node.classList.contains("formula") || node.classList.contains("mathmode")))
    const content = Array.from(node.childNodes).map(
        (child) => serializeSelection(child, range, math)
    ).join("")
    if (!content) return ""
    if (tag === "sub") return "_{" + content.trim() + "}"
    if (tag === "sup") return "^{" + content.trim() + "}"
    if (node.classList && node.classList.contains("overlined")) {
        return "\\bar{" + content.trim() + "}"
    }
    if (tag === "td" || tag === "th") return content + "\t"
    if (["div", "p", "tr", "table"].indexOf(tag) >= 0) return content + "\n"
    return content
}

function copyHtml(range, root) {
    const holder = document.createElement("div")
    let selected = range.cloneContents()
    let ancestor = range.commonAncestorContainer.nodeType === 1
        ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement
    // cloneContents omits enclosing nodes when the selection lies inside them.
    while (ancestor && ancestor !== root && root.contains(ancestor)) {
        const shell = ancestor.cloneNode(false)
        shell.appendChild(selected)
        selected = shell
        if (ancestor.classList.contains("text-display-li")) break
        ancestor = ancestor.parentElement
    }
    holder.appendChild(selected)
    holder.querySelectorAll("*").forEach((element) => {
        // Keep only self-contained content attributes, never IDs/event handlers
        // or the hidden source translations stored on panel bodies.
        Array.from(element.attributes).forEach((attribute) => {
            if (["class", "style", "rowspan", "colspan", "alt", "src"].indexOf(attribute.name) < 0) {
                element.removeAttribute(attribute.name)
            }
        })
        // A detached clone has no contextual computed style. Embed the essential
        // math rules explicitly for rich-text destinations without site CSS.
        if (element.classList.contains("overlined")) {
            element.style.textDecoration = "overline"
            element.style.display = "inline-block"
        }
        if (element.tagName === "VAR") element.style.fontStyle = "italic"
        if (element.tagName === "SUB") element.style.verticalAlign = "sub"
        if (element.tagName === "SUP") element.style.verticalAlign = "super"
        if (element.classList.contains("formula")) {
            element.style.fontFamily = '"Times New Roman", serif'
        }
        if (element.classList.contains("centered")) element.style.textAlign = "center"
        if (element.classList.contains("largeop")) element.style.fontSize = "200%"
        if (element.classList.contains("largeparen")) {
            element.style.fontSize = "250%"
            element.style.verticalAlign = "middle"
        }
        if (element.classList.contains("smallvar")) element.style.fontSize = "80%"
        if (element.classList.contains("padrthree")) element.style.paddingRight = "3em"
        if (element.matches("table.formula")) {
            element.style.borderCollapse = "collapse"
            element.style.verticalAlign = "middle"
            element.style.display = element.classList.contains("possibilities") ? "inline-table" : "inline-block"
        }
        if (element.matches(".formula td, .formula th")) {
            element.style.padding = ".1em .3em"
            element.style.whiteSpace = "nowrap"
            element.style.textAlign = "center"
            element.style.fontWeight = "normal"
        }
        if (element.matches(".truthtable td, .truthtable th")) {
            element.style.borderBottom = element.tagName === "TH" ? "3px double black" : "1px solid black"
            if (!element.classList.contains("e")) element.style.borderRight = "1px solid black"
        }
        if (element.classList.contains("middleright")) element.style.textAlign = "right"
        if (element.classList.contains("middleleft")) element.style.textAlign = "left"
        if (element.classList.contains("summationtop")) {
            element.style.verticalAlign = "bottom"
            element.style.paddingBottom = "0"
        }
        if (element.classList.contains("summationmiddle")) element.style.padding = "0 .3em"
        if (element.classList.contains("summationbottom")) element.style.paddingTop = "0"
        if (element.classList.contains("text-fraction")) {
            Object.assign(element.style, { display: "inline-flex", flexDirection: "column",
                verticalAlign: "middle", lineHeight: "1.1", textAlign: "center" })
        }
        if (element.classList.contains("fraction-top")) {
            element.style.borderBottom = ".065em solid currentColor"
            element.style.padding = "0 .16em .08em"
        }
        if (element.classList.contains("fraction-bottom")) element.style.padding = ".08em .16em 0"
        if (element.classList.contains("logical-diagram")) {
            Object.assign(element.style, {
                display: "inline-block", position: "relative", verticalAlign: "middle",
                lineHeight: "1", whiteSpace: "nowrap", margin: ".6em .25em",
            })
        }
        if (element.classList.contains("logical-node")) {
            Object.assign(element.style, {
                position: "absolute", display: "inline-block",
                transform: "translate(-50%, -50%)", lineHeight: "1", zIndex: "1",
            })
        }
        if (element.classList.contains("logical-line")) {
            Object.assign(element.style, {
                position: "absolute", display: "block", height: "0",
                borderTop: ".067em solid currentColor", transformOrigin: "0 0",
            })
        }
        if (element.classList.contains("logical-route")) element.style.position = "static"
    })
    return holder.innerHTML
}

function installFormulaCopy() {
    document.addEventListener("copy", function (event) {
        const selection = window.getSelection()
        if (!selection || selection.isCollapsed || !selection.rangeCount || !event.clipboardData) return
        const range = selection.getRangeAt(0)
        const pane = document.getElementById("text-pane")
        if (!pane || !pane.contains(range.startContainer) || !pane.contains(range.endContainer)) return
        const common = range.commonAncestorContainer
        const root = common.nodeType === 1 ? common : common.parentElement
        const math = root.closest(".formula, .mathmode, .overlined, sub, sup") ||
            (root.querySelector && root.querySelector(".formula, .mathmode, .overlined, sub, sup"))
        if (!math) return
        // Start at the pane so a partial selection retains its enclosing math.
        const plain = serializeSelection(pane, range)
            .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
        event.clipboardData.setData("text/plain", plain)
        event.clipboardData.setData("text/html", copyHtml(range, pane))
        event.preventDefault()
    })
}

module.exports = { installFormulaCopy, serializeSelection, fullySelected, toLatex }
