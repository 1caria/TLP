const assert = require("node:assert/strict")
const test = require("node:test")
const cheerio = require("cheerio")
const { validateFormulaCorpus } = require("./formula-validation")
const han = require("../src/data/hanLinhe.json").sections
const he = require("../src/data/heShaojia.json").sections

test("both Chinese corpora use real text for every formula and truth diagram", () => {
    assert.equal(Object.keys(han).length, 525)
    assert.equal(Object.keys(he).length, 525)
    const rows = validateFormulaCorpus({ han, he })
    assert.equal(rows.length, 1050)
    assert.equal(rows.filter(row => row.logicalDiagrams).length, 2)
    assert.equal(rows.reduce((count, row) => count + row.logicalDiagrams, 0), 10)
})

test("proposition 6 preserves all three bars and the entire general form", () => {
    for (const sections of [han, he]) {
        const $ = cheerio.load(sections["6"])
        assert.deepEqual($(".overlined").map((_, node) => $(node).text()).get(), ["p", "ξ", "ξ"])
        assert.equal($(".formula").attr("data-latex"), "[\\bar{p},\\bar{\\xi},N(\\bar{\\xi})]")
    }
})

test("the 4.42 summation uses K_n bounds, not the 4.27 n bounds", () => {
    for (const sections of [han, he]) {
        const $ = cheerio.load(sections["4.42"])
        const sums = $(".formula").map((_, node) => $(node).attr("data-latex")).get()
        assert.ok(sums.some(value => /\\sum_\{[kK]=0\}\^\{K_n\}\\binom\{K_n\}\{[kK]\}=L_n/.test(value)))
    }
})

test("source continuations and the translator-specific vocabulary are retained", () => {
    assert.match(han["5.101"], /同语反复式/)
    assert.doesNotMatch(han["5.101"], /重言式/)
    assert.match(he["5.101"], /重言式/)
    assert.match(he["6.36311"], /它是否会出来/)
    assert.match(he["6.423"], /而作为一种现象的意志只有心理学才感到兴趣/)
    assert.match(cheerio.load(he["4.022"]).text().replace(/\s+/g, ""), /而且宣称事情就是这样的/)
})
