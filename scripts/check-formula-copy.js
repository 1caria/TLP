const fs = require("fs")
const path = require("path")

// Generate an isolated browser regression page from the real clipboard module
// and the current generated translations. It never changes the system clipboard
// or adds controls to the product site; copy events use an in-memory DataTransfer.
const root = path.resolve(__dirname, "..")
const han = JSON.parse(fs.readFileSync(path.join(root, "src/data/hanLinhe.json"), "utf8")).sections
const he = JSON.parse(fs.readFileSync(path.join(root, "src/data/heShaojia.json"), "utf8")).sections
const source = fs.readFileSync(path.join(root, "src/formula-copy.js"), "utf8")
const fixtures = [
    ["han6", "韩林合 6", han["6"]],
    ["han515", "韩林合 5.15", han["5.15"]],
    ["han502", "韩林合 5.02", han["5.02"]],
    ["han602", "韩林合 6.02", han["6.02"]],
    ["han6241", "韩林合 6.241", han["6.241"]],
    ["han442", "韩林合 4.42", han["4.42"]],
    ["han431", "韩林合 4.31", han["4.31"]],
    ["han4442", "韩林合 4.442", han["4.442"]],
    ["han61203", "韩林合 6.1203", han["6.1203"]],
    ["he5152", "贺绍甲 5.152", he["5.152"]],
]
const fixtureHtml = fixtures.map(([id, label, html]) => `<li class="text-display-li" id="${id}"><h3>${label}</h3><div class="fixture-content">${html}</div></li>`).join("\n")
const testSource = String.raw`
const copyModule = module.exports
copyModule.installFormulaCopy()
const results = []
const check = (condition, message) => { if (!condition) throw new Error(message) }
const selectContents = (node) => {
    check(node, "Missing fixture node")
    const range = document.createRange()
    range.selectNodeContents(node)
    return range
}
const firstText = (node) => {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
    return walker.nextNode()
}
const fragmentRange = (node, start, end) => {
    const text = firstText(node)
    check(text, "Missing fixture text")
    const range = document.createRange()
    range.setStart(text, start)
    range.setEnd(text, end)
    return range
}
const fixture = (id) => document.querySelector("#" + id + " .fixture-content")
const readCopy = (range) => {
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    const buffer = new DataTransfer()
    const event = new ClipboardEvent("copy", { bubbles: true, cancelable: true, clipboardData: buffer })
    document.dispatchEvent(event)
    check(event.defaultPrevented, "The installed copy event handler did not intercept the selection")
    const plain = buffer.getData("text/plain")
    const html = buffer.getData("text/html")
    check(plain && html, "Missing text/plain or text/html clipboard payload")
    const rich = new DOMParser().parseFromString(html, "text/html")
    check(!rich.querySelector("[data-latex],[data-copy-text],[id]"), "Internal formula metadata or source IDs leaked to rich text")
    return { plain, html, rich, intercepted: event.defaultPrevented }
}
const test = (name, callback) => {
    try {
        const detail = callback()
        results.push({ name, passed: true, detail: detail || "Native Range selection and copy event passed" })
    } catch (error) {
        results.push({ name, passed: false, detail: error.stack || error.message })
    }
}

test("6：完整公式的三个上划线与纯文本语义", () => {
    const node = fixture("han6").querySelector(".formula")
    const output = readCopy(selectContents(node))
    check(output.plain === "$[\\bar{p},\\bar{\\xi},N(\\bar{\\xi})]$", output.plain)
    const bars = output.rich.querySelectorAll(".overlined")
    check(bars.length === 3, "Missing one of the three rich-text bars")
    check(Array.from(bars).every((bar) => bar.style.textDecoration === "overline"), "Rich text lacks self-contained overline styling")
    return output.plain
})

test("6：只选择 p 仍保留其上划线", () => {
    const p = fixture("han6").querySelector(".overlined var")
    const output = readCopy(fragmentRange(p, 0, 1))
    check(output.plain === "\\bar{p}", output.plain)
    check(output.rich.querySelector(".overlined").style.textDecoration === "overline", "Partial p lost its rich overline")
    return output.plain
})

test("5.15：完整 W_r", () => {
    const node = Array.from(fixture("han515").querySelectorAll(".formula")).find((item) => item.dataset.latex === "W_{r}")
    const output = readCopy(selectContents(node))
    check(output.plain === "$W_{r}$", output.plain)
    check(output.rich.querySelector("sub").style.verticalAlign === "sub", "Missing rich-text subscript styling")
    return output.plain
})

test("5.15：只选择下标 r", () => {
    const sub = fixture("han515").querySelector("sub")
    const output = readCopy(fragmentRange(sub, 0, 1))
    check(output.plain === "_{r}", output.plain)
    check(output.rich.querySelector("sub").textContent === "r", "Partial selection lost its subscript shell")
    return output.plain
})

test("5.15：选择 W_rs 文字而不选择前面的逗号", () => {
    const sub = Array.from(fixture("han515").querySelectorAll("sub")).find((item) => item.textContent === "rs")
    const span = sub.closest(".formula")
    const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT)
    let start = walker.nextNode()
    while (start && !start.textContent.includes("W")) start = walker.nextNode()
    const end = firstText(sub)
    const range = document.createRange()
    range.setStart(start, start.textContent.indexOf("W"))
    range.setEnd(end, end.textContent.length)
    const output = readCopy(range)
    check(output.plain === "W_{rs}", output.plain)
    return output.plain
})

test("5.15：只选择 rs 的第二个字母", () => {
    const sub = Array.from(fixture("han515").querySelectorAll("sub")).find((item) => item.textContent === "rs")
    const output = readCopy(fragmentRange(sub, 1, 2))
    check(output.plain === "_{s}", output.plain)
    check(!output.plain.includes("rs"), "Partial selection copied the unselected r")
    return output.plain
})

test("5.15：完整比值不会重复复制嵌套公式", () => {
    const ratio = Array.from(fixture("han515").querySelectorAll(".formula")).find((item) => item.dataset.latex === "W_{rs}:W_{r}")
    const output = readCopy(selectContents(ratio))
    check(output.plain === "$W_{rs}:W_{r}$", output.plain)
    check(output.rich.querySelectorAll("sub").length === 2, "Ratio lost one of its rich subscripts")
    return output.plain
})

test("5.02：正文、公式与多个段落一起复制", () => {
    const output = readCopy(selectContents(fixture("han502")))
    check(output.plain.includes("人们很容易将函项的主目与名称的标号混淆在一起"), "Missing first paragraph")
    check(output.plain.includes("如果我没有弄错的话"), "Missing final paragraph")
    check(output.plain.split("\n").length >= 3, "Paragraph boundaries were lost")
    check(output.plain.includes("+_{c}"), "Addition label lost its subscript")
    check(output.rich.querySelectorAll("br").length === 2, "Rich text lost source paragraph breaks")
    return output.plain.slice(0, 100) + "…"
})

test("6.241：指数、乘积、定义标记与推导换行", () => {
    const equation = fixture("han6241").querySelector(".centered.formula")
    const output = readCopy(selectContents(equation))
    check(output.plain.includes("^{\\nu}") && output.plain.includes("^{\\mu}"), "Greek exponents were lost")
    check(output.plain.includes("^{4}") && output.plain.includes("\\mathrm{Def.}"), "Final exponent or upright definition marker was lost")
    check(output.plain.includes("\\\\"), "Source proof line breaks were lost")
    const scripts = output.rich.querySelectorAll("sup")
    check(scripts.length >= 10 && Array.from(scripts).every((node) => node.style.verticalAlign === "super"), "Rich exponents are not self-contained")
    check(scripts[0].textContent === "ν", "The first ν is no longer a superscript")
    return output.plain
})

test("6.02：第二个定义的 Def. 不被拆成变量或重复包装", () => {
    const definition = Array.from(fixture("han602").querySelectorAll(".centered")).find((node) => node.textContent.startsWith("和"))
    const output = readCopy(selectContents(definition.querySelector(".formula")))
    check(output.plain.includes("x\\mathrm{Def.}"), output.plain)
    check((output.plain.match(/\\mathrm\{Def\.\}/g) || []).length === 1, "Definition marker was omitted or wrapped twice")
    check(!Array.from(output.rich.querySelectorAll("var")).some((node) => node.textContent.includes("Def")), "Definition marker was italicized as a variable")
    return output.plain
})

test("4.42：求和上下限、二项式与富文本对齐", () => {
    const sum = fixture("han442").querySelector("table.possibilities")
    const output = readCopy(selectContents(sum))
    check(output.plain === "$\\sum_{k=0}^{K_n}\\binom{K_n}{k}=L_n$", output.plain)
    const table = output.rich.querySelector("table.possibilities")
    check(table.style.display === "inline-table", "Missing inline summation layout")
    check(table.querySelector(".largeop").style.fontSize === "200%", "Summation operator lost its scale")
    check(table.querySelectorAll("[rowspan='3']").length === 3, "Binomial alignment lost row spans")
    check(table.querySelector(".summationtop").style.verticalAlign === "bottom", "Upper sum limit lost alignment")
    return output.plain
})

test("贺 5.152：分数 1/2 的分子、分母与横线", () => {
    const fraction = fixture("he5152").querySelector(".formula")
    const output = readCopy(selectContents(fraction))
    check(output.plain === "$\\frac{1}{2}$", output.plain)
    check(output.rich.querySelector(".text-fraction").style.flexDirection === "column", "Fraction stack was lost")
    check(output.rich.querySelector(".fraction-top").style.borderBottom.includes("solid"), "Fraction bar was lost")
    return output.plain
})

test("4.31：真值表行序与独立的表格边线样式", () => {
    const table = fixture("han431").querySelector("table.truthtable")
    const output = readCopy(selectContents(table))
    check(output.plain.includes("\\begin{array}{ccc}") && output.plain.includes("F & W & W"), "Truth table semantics were flattened")
    const copied = output.rich.querySelector("table.truthtable")
    check(copied.querySelectorAll("tbody tr").length === 8, "Truth table row count changed")
    check(copied.querySelector("th").style.borderBottom.includes("double"), "Header double rule was lost")
    check(copied.querySelector("td").style.borderBottom.includes("solid"), "Row rules were lost")
    check(copied.querySelector("th.l").style.borderRight.includes("solid"), "Column rule was lost")
    return output.plain
})

test("4.442：复制后仍有明确的空真值单元格", () => {
    const output = readCopy(selectContents(fixture("han4442").querySelector("table.truthtable")))
    const empty = output.rich.querySelectorAll("tbody tr")[2].querySelectorAll("td")[2]
    check(empty && empty.textContent === "", "Deliberately empty truth-value cell was filled or lost")
    check(output.plain.includes("W & F & "), "Empty outcome was lost in plain array semantics")
    return output.plain
})

test("6.1203：完整复制五幅逻辑图的对应语义与 CSS 连线", () => {
    const source = fixture("han61203")
    const diagrams = Array.from(source.querySelectorAll(".logical-diagram"))
    check(diagrams.length === 5, "Missing logical diagram fixtures")
    const output = readCopy(selectContents(source))
    diagrams.forEach((diagram) => check(output.plain.includes(diagram.dataset.copyText), "Copy event omitted data-copy-text: " + diagram.dataset.logicalDiagram))
    check(output.plain.includes("为了将一个同语反复式认作为同语反复式"), "Original prose was omitted")
    check(output.rich.querySelectorAll(".logical-diagram").length === 5, "Rich text lost diagrams")
    const line = output.rich.querySelector(".logical-line")
    check(line && line.style.borderTop.includes("solid") && line.style.position === "absolute", "Rich text lost self-contained logical line styling")
    check(!output.rich.querySelector(".logical-line .logical-line"), "Invalid self-closing spans nested unrelated lines")
    check(!output.rich.querySelector("img,object,svg,canvas"), "Clipboard diagrams contain media")
    return diagrams.map((diagram) => diagram.dataset.copyText).join("\n")
})

test("希腊字母与相邻变量之间保持 LaTeX 命令边界", () => {
    check(copyModule.toLatex("Ωx") === "\\Omega x", copyModule.toLatex("Ωx"))
    check(copyModule.toLatex("ξp") === "\\xi p", copyModule.toLatex("ξp"))
    return "\\Omega x；\\xi p"
})

window.getSelection().removeAllRanges()
const passed = results.filter((item) => item.passed).length
const failed = results.length - passed
window.__formulaCopyCheckResult = { passed, failed, checks: results }
document.getElementById("summary").textContent = passed + "/" + results.length + " 通过，" + failed + " 失败"
document.getElementById("summary").className = failed ? "fail" : "pass"
document.getElementById("checks").innerHTML = results.map((item) => {
    const li = document.createElement("li")
    li.className = item.passed ? "pass" : "fail"
    const title = document.createElement("strong")
    title.textContent = (item.passed ? "通过：" : "失败：") + item.name
    const detail = document.createElement("pre")
    detail.textContent = item.detail
    li.append(title, detail)
    return li.outerHTML
}).join("")
document.getElementById("fixtures").open = false
document.documentElement.dataset.copyChecks = failed ? "failed" : "passed"
`

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>公式复制浏览器回归检查</title>
<link rel="stylesheet" href="../dist/css/main.css"><link rel="stylesheet" href="../dist/css/formulas.css"><link rel="stylesheet" href="../dist/css/logical-diagrams.css">
<style>body{margin:2em;background:#fff;color:#222;font:16px/1.6 sans-serif}#summary{font-size:1.5em;font-weight:bold}.pass{color:#175b2c}.fail{color:#a31515}#checks pre{white-space:pre-wrap;word-break:break-word;color:#444;font-size:13px}#checks li{margin-bottom:1em}#text-pane{width:560px;max-width:100%;display:block}#fixture-list{list-style:none;padding:0}#fixture-list li{border:1px solid #ccc;padding:1em;margin:1em 0;user-select:text}#fixture-list h3{font:600 14px sans-serif}.fixture-content{font:18px/1.65 serif}details{margin-top:2em}h1{font-size:1.4em}</style></head><body>
<h1>真实公式复制模块的浏览器回归检查</h1><p>从当前中文数据和 <code>src/formula-copy.js</code> 生成。每项通过浏览器 Range 选择与原生 copy 事件读取内存剪贴板数据；系统剪贴板不会被修改。</p>
<p id="summary">检查运行中…</p><ol id="checks"></ol><details id="fixtures" open><summary>查看当前数据夹具</summary><section id="text-pane"><ul id="fixture-list">${fixtureHtml}</ul></section></details>
<script>const module = {exports:{}};\n${source.replace(/<\/script/gi, "<\\/script")}\n${testSource}</script></body></html>`
const destination = path.join(root, "tmp/formula-copy-check.html")
fs.mkdirSync(path.dirname(destination), { recursive: true })
fs.writeFileSync(destination, html, "utf8")
console.log(`已生成浏览器复制回归页：${destination}`)
console.log("用开发服务器打开 /tmp/formula-copy-check.html，查看通过数量和各项剪贴板结果。")
