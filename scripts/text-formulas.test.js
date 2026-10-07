const assert = require("node:assert/strict")
const test = require("node:test")
const cheerio = require("cheerio")
const { parseEpub, parseHanEpub } = require("./generate-translations")
const { applyTextFormulas, annotateFormulaMarkup, latexFromMarkup } = require("./text-formulas")

const originalHan = parseHanEpub(false)
const originalHe = parseEpub(false)
const clone = (value) => JSON.parse(JSON.stringify(value))
const han = applyTextFormulas(clone(originalHan), "韩林合")
const he = applyTextFormulas(clone(originalHe), "贺绍甲")
const load = (html) => cheerio.load(`<root>${html}</root>`, { xmlMode: true, decodeEntities: true })

test("all 525 propositions keep their Chinese wording while scalar images become text", () => {
    for (const [source, output] of [[originalHan, han], [originalHe, he]]) {
        assert.deepEqual(Object.keys(output), Object.keys(source))
        assert.equal(Object.keys(output).length, 525)
        for (const label of Object.keys(source)) {
            const before = load(source[label])("root").text().match(/[\u4e00-\u9fff]/g) || []
            const after = load(output[label])("root").text().match(/[\u4e00-\u9fff]/g) || []
            assert.deepEqual(after, before, `Chinese prose changed at ${label}`)
        }
    }
    assert.doesNotMatch(Object.values(han).join(""), /han-image012(?:53|54|55|56|57|60|61|62)\.jpeg/)
    assert.doesNotMatch(Object.values(he).join(""), /Image000(?:09|10|11|12|13|14|15|16|19|20|21|22|23)\.jpg/)
})

test("proposition 6 has all three source bars and a complete copy representation", () => {
    for (const sections of [han, he]) {
        const $ = load(sections["6"])
        assert.equal($(".overlined").length, 3)
        assert.deepEqual($(".overlined").map((_, node) => $(node).text()).get(), ["p", "ξ", "ξ"])
        assert.equal($(".formula").first().attr("data-latex"), "[\\bar{p},\\bar{\\xi},N(\\bar{\\xi})]")
        assert.equal($("img,object,svg,canvas").length, 0)
    }
})

test("the two combination counts keep distinct indices and summation bounds", () => {
    assert.equal(load(han["4.27"])("table.formula").attr("data-latex"), "K_n=\\sum_{\\nu=0}^{n}\\binom{n}{\\nu}")
    assert.equal(load(han["4.42"])("table.possibilities").attr("data-latex"), "\\sum_{k=0}^{K_n}\\binom{K_n}{k}=L_n")
    assert.equal(load(he["4.42"])("table.possibilities").attr("data-latex"), "\\sum_{K=0}^{K_n}\\binom{K_n}{K}=L_n")
    assert.equal(load(he["5.152"])(".text-fraction").text(), "12")
    assert.equal(load(he["5.152"])(".formula").attr("data-latex"), "\\frac{1}{2}")
})

test("truth tables keep the source row order and the deliberately empty outcome", () => {
    for (const [sections, label] of [[han, "4.31"], [he, "4.42"]]) {
        const $ = load(sections[label])
        const tables = $(".truthtable")
        assert.equal(tables.length, 3)
        assert.deepEqual(tables.map((_, node) => $(node).find("tbody tr").length).get(), [8, 4, 2])
        assert.deepEqual($(tables[0]).find("tbody tr").map((_, row) => $(row).text()).get(), ["WWW", "FWW", "WFW", "WWF", "FFW", "FWF", "WFF", "FFF"])
    }
    for (const sections of [han, he]) {
        const $ = load(sections["4.442"])
        const cells = $("table.truthtable tbody tr").eq(2).find("td")
        assert.equal(cells.eq(0).text(), "W")
        assert.equal(cells.eq(1).text(), "F")
        assert.equal(cells.eq(2).text(), "")
    }
})

test("the proposition 6.03 bar difference between editions remains explicit", () => {
    assert.equal(load(han["6.03"])(".overlined").length, 0)
    assert.equal(load(he["6.03"])(".overlined").length, 2)
})

test("source defects in scripts and missing symbols are repaired at their own propositions", () => {
    const $han = load(han["6.241"])
    assert.equal($han("sup").first().text(), "ν")
    const $he = load(he["6.02"])
    $he("sup").each((_, node) => assert.doesNotMatch($he(node).text(), /[’′']/))
    assert.equal(($he("root").text().match(/并且/g) || []).length, 1)
    assert.match(load(he["5.15"])("root").text(), /wrs\s*∶wr/)
    assert.equal(load(he["5.15"])("sub").last().text(), "r")
    assert.equal(load(he["5.02"])("sub").length, 3)
    assert.match(load(he["4.1272"])("root").text(), /ℵ0/)
    assert.doesNotMatch(Object.values(he).join(""), /Ǝ/)
    assert.match(load(he["6.241"])("root").text(), /Ω2\s*’Ω2\s*’χ/)
})

test("formula punctuation is visible without being swallowed by formula metadata", () => {
    for (const sections of [han, he]) {
        const $ = load(sections["6.01"])
        const equation = $(".centered .formula").first()
        assert.ok(equation[0].next && equation[0].next.data.startsWith("。"))
        assert.doesNotMatch(equation.attr("data-latex"), /。$/)
    }
    const $ = load(he["4.442"])
    assert.ok($("table.truthtable")[0].next.data.startsWith("。"))
})

test("all script markup has formula semantics and regeneration is idempotent", () => {
    for (const [translator, sections] of [["韩林合", han], ["贺绍甲", he]]) {
        for (const [label, html] of Object.entries(sections)) {
            const $ = load(html)
            $("sub,sup").each((_, node) => assert.ok($(node).parents(".formula").length, `${label} lacks script semantics`))
            $(".formula").each((_, node) => assert.ok($(node).attr("data-latex") || $(node).attr("data-copy-text"), `${label} lacks copy semantics`))
        }
        assert.deepEqual(applyTextFormulas(clone(sections), translator), sections)
    }
})

test("existing English style formula markup gains bars and script copy semantics", () => {
    const html = annotateFormulaMarkup('中文<span class="mathmode">[<span class="overlined"><var>p</var></span>,<var>W</var><sub>r</sub>,Ω<sup>ν</sup>]</span>正文')
    const $ = load(html)
    assert.equal($(".formula").attr("data-latex"), "[\\bar{p},W_{r},\\Omega ^{\\nu}]")
    assert.equal(latexFromMarkup('<span class="overlined"><var>ξ</var></span><sub>r</sub>'), "\\bar{\\xi}_{r}")
})

test("definition markers retain upright copy semantics across split script nodes", () => {
    const $ = load(han["6.02"])
    const secondDefinition = $(".centered").filter((_, node) => $(node).text().startsWith("和")).first()
    assert.match(secondDefinition.find(".formula").first().attr("data-latex"), /x\\mathrm\{Def\.\}/)
    const split = '<span class="formula" data-latex="xDef">xDef</span>.'
    assert.equal(latexFromMarkup(split), "x\\mathrm{Def.}")
    assert.equal(latexFromMarkup('<span class="formula" data-latex="x\\mathrm{Def.}">xDef.</span>'), "x\\mathrm{Def.}")
})

test("Chinese formula quotation marks and full stops retain text semantics in LaTeX", () => {
    assert.equal(latexFromMarkup('“Ω<sup>4</sup>′x”。'),
        "\\text{“}\\Omega ^{4}'x\\text{”}\\text{。}")
    const $ = load(han["6.241"])
    assert.match($(".centered.formula").attr("data-latex"), /\\text\{。\}\\end\{gathered\}$/)
})

test("source multiline equations copy as a valid gathered math environment", () => {
    for (const label of ["6.02", "6.241"]) {
        const $ = load(han[label])
        const blocks = $(".centered.formula").filter((_, node) => $(node).find("br").length > 0)
        assert.ok(blocks.length > 0)
        blocks.each((_, node) => {
            const latex = $(node).attr("data-latex")
            assert.match(latex, /^\\begin\{gathered\}/)
            assert.match(latex, /\\end\{gathered\}$/)
        })
    }
})
