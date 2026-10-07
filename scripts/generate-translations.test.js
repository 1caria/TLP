const assert = require("node:assert/strict")
const test = require("node:test")
const cheerio = require("cheerio")

const {
    cleanPdfBlock,
    parseHanEpub,
    stripEpubLabel,
} = require("./generate-translations")

const load = (html) => cheerio.load(`<root>${html}</root>`, { xmlMode: true, decodeEntities: true })

test("parses every displayed proposition from the Han Linhe EPUB", () => {
    const sections = require("../src/data/sections.json").sections
    const displayedLabels = sections.filter((section) => section.ger.trim())
    const han = parseHanEpub()
    assert.equal(Object.keys(han).length, 525)
    assert.deepEqual(Object.keys(han), displayedLabels.map((section) => section.label))
    assert.equal(han["1"], "世界是所有实际情况")
    assert.equal(han["7"], "对于不可言说的东西，人们必须以沉默待之")
    assert.doesNotMatch(han["6.02"], /6\.021/)
})

test("preserves EPUB paragraphs and lists while rendering formulas as selectable text", () => {
    const han = parseHanEpub()
    assert.equal(load(han["5.02"])("br").length, 2)
    assert.equal(load(han["5.101"])("br").length, 17)
    const truthFunctions = load(han["5.101"])("root").text()
    assert.match(truthFunctions, /同语反复式/)
    assert.doesNotMatch(truthFunctions, /重言式/)
    assert.equal((truthFunctions.match(/（[WF]{4}）（p，q）/g) || []).length, 16)
    for (const label of ["5.15", "5.151"]) {
        const $ = load(han[label])
        assert.deepEqual($("sub").map((_, node) => $(node).text()).get(), ["r", "rs", "rs", "r"])
        assert.ok($(".formula").toArray().some((node) => $(node).attr("data-latex") === "W_{rs}:W_{r}"))
    }
    for (const [label, image] of [
        ["5.5423", "image01258.jpeg"],
        ["5.6331", "image01259.jpeg"],
        ["6.36111", "image01268.jpeg"],
    ]) {
        assert.match(han[label], new RegExp(`images/han-${image}`))
    }
    const allowedGeometry = new Set(["images/han-image01258.jpeg", "images/han-image01259.jpeg", "images/han-image01268.jpeg"])
    for (const [label, html] of Object.entries(han)) {
        const $ = load(html)
        $("img").each((_, node) => assert.ok(allowedGeometry.has($(node).attr("src")), `${label} contains a formula image`))
        assert.equal($("object,svg,canvas").length, 0, `${label} uses media for formulas`)
    }
    assert.equal(load(han["4.31"])("table.truthtable").length, 3)
    assert.equal(load(han["4.442"])("table.truthtable tbody tr").length, 4)
    const diagrams = load(han["6.1203"])
    assert.equal(diagrams(".logical-diagram").length, 5)
    diagrams(".logical-diagram").each((_, node) => assert.ok(diagrams(node).attr("data-copy-text")))
})

test("repairs formula glyph encodings without changing the translation", () => {
    const han = parseHanEpub()
    assert.match(han["4.013"], /♯和♭/)
    assert.match(load(han["4.1272"])("root").text(), /ℵ0/)
    assert.match(load(han["4.442"])("root").text(), /⊢/)
    const definition = load(han["6.02"])
    assert.equal(definition("sup").first().text(), "0")
    assert.ok(definition("sup").toArray().some((node) => definition(node).text() === "ν+1"))
    definition("sup").each((_, node) => assert.doesNotMatch(definition(node).text(), /[’′']/))
    const proof = load(han["6.241"])
    assert.equal(proof("sup").first().text(), "ν")
    assert.equal(proof("sup").eq(1).text(), "μ")
    assert.equal(proof(".centered.formula").length, 1)
    assert.match(proof(".centered.formula").attr("data-latex"), /\(\\Omega \^\{\\nu\}\)\^\{\\mu\}/)
    assert.equal(proof("br").length, 3)
    for (const html of Object.values(han)) assert.doesNotMatch(load(html)("root").text(), /[�□\uE000-\uF8FF]/)
})

test("removes EPUB proposition labels and footnote anchors", () => {
    assert.equal(
        stripEpubLabel("1<sup></sup> 世界是一切发生的事情。", "1"),
        "世界是一切发生的事情。"
    )
    assert.equal(
        stripEpubLabel(
            "2.20<sup></sup> 数是运算的指数。",
            "2.20"
        ),
        "数是运算的指数。"
    )
})

test("keeps text after inline PDF footnote markers", () => {
    assert.equal(
        cleanPdfBlock(
            [
                "4.015 所有画像①的可能性，",
                "我们的表达方式的全部的图像性质的可能性，",
                "都在于描画的逻辑。",
            ],
            "4.015"
        ),
        "所有画像的可能性，我们的表达方式的全部的图像性质的可能性，都在于描画的逻辑。"
    )
})

test("skips PDF footnotes while retaining continued body text", () => {
    assert.equal(
        cleanPdfBlock(
            [
                "6.02 由此我们便得到了数。",
                "①我给出如下定义：",
                "x = 0。",
                "① 在 1923 年的讨论中……",
                "脚注续行",
                "\f90 逻辑哲学论",
                "因此正文继续。",
            ],
            "6.02"
        ),
        "由此我们便得到了数。我给出如下定义：x = 0。因此正文继续。"
    )
})
