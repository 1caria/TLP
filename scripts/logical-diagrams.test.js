const assert = require("node:assert/strict")
const test = require("node:test")
const cheerio = require("cheerio")
const { applyLogicalDiagrams, renderLogicalDiagram, diagrams } = require("./logical-diagrams")

// These predicates are the logical definitions, independent of the drawing
// and its transcription. In diagram five the printed inputs are q, p.
const expectedValue = {
    implication: ([p, q]) => !p || q,
    negation: ([xi]) => !xi,
    conjunction: ([xi, eta]) => xi && eta,
    compound: ([q, p]) => !(p && !q),
}

test("the visible routes obey implication, negation, conjunction and nested negation", () => {
    for (const diagram of diagrams) {
        if (diagram.id === "combinations") continue
        const inputs = new Set()
        for (const route of diagram.routes) {
            const value = expectedValue[diagram.id](route.inputs.map(input => input === "W"))
            assert.equal(route.output, value ? "W" : "F", `${diagram.id} ${route.id}`)
            assert.ok(!inputs.has(route.inputs.join("")), "No duplicate truth-value combination")
            inputs.add(route.inputs.join(""))
            assert.ok(diagram.curves.some(([id]) => id === route.id), "Each truth-value combination has a visible connection")
        }
        assert.equal(inputs.size, diagram.id === "negation" ? 2 : 4)
    }
    assert.deepEqual(new Set(diagrams[0].routes.map(route => route.inputs.join(""))), new Set(["WW", "WF", "FW", "FF"]))
})

test("all five diagrams contain selectable symbols and CSS lines, with no image mechanism", () => {
    const expectedNodeCounts = [6, 8, 5, 8, 12]
    for (const translator of ["han", "he"]) {
        for (let i = 0; i < 5; i++) {
            const html = renderLogicalDiagram(i, translator)
            const q = cheerio.load(html)
            assert.doesNotMatch(html, /<(?:img|svg|canvas|object|embed|iframe)\b|(?:background(?:-image)?|mask(?:-image)?)\s*:|url\s*\(/i)
            assert.equal(q(".logical-node").length, expectedNodeCounts[i] + (i === 2 && translator === "he" ? 2 : 0))
            assert.ok(q(".logical-line").length >= diagrams[i].curves.length)
            assert.ok(q(".logical-diagram").attr("data-copy-text"))
            q(".logical-line").each((_, element) => {
                assert.doesNotMatch(q(element).attr("style"), /NaN|Infinity/)
                assert.equal(q(element).text(), "")
            })
        }
    }
    assert.equal(cheerio.load(renderLogicalDiagram(2, "han"))(".logical-node").text(), "WξFWF")
    assert.equal(cheerio.load(renderLogicalDiagram(2, "he"))(".logical-node").text(), "WξFWF„“")
})

test("compound copying preserves both intermediate operations and every outer route", () => {
    const q = cheerio.load(renderLogicalDiagram(4, "han"))
    const copy = q(".logical-diagram").attr("data-copy-text")
    for (const fragment of ["～（p·～q）", "WqF，WpF", "W,W→W", "W,F→W", "F,W→F", "F,F→W", "q=W→F", "q=F→W", "内层W→F", "内层F→W"]) {
        assert.ok(copy.includes(fragment), `Copy retains ${fragment}`)
    }
    assert.equal(q('[data-node="q"]').text(), "q")
    assert.equal(q('[data-node="p"]').text(), "p")
})

test("source image replacement keeps surrounding Chinese and uses all five original figures", () => {
    for (const translator of ["han", "he"]) {
        const filenames = [0, 1, 2, 3, 4].map(i => translator === "han" ? `han-image012${i + 63}.jpeg` : `Image000${i + 24}.jpg`)
        const raw = `前文<br />${filenames.map((name, i) => `<div class="centered"><img src="images/${name}" alt="image"/></div>中间${i}`).join("<br />")}<br />后文`
        const sections = { "6.1203": raw, "6": "另一个条目" }
        applyLogicalDiagrams(sections, translator)
        const q = cheerio.load(sections["6.1203"])
        assert.doesNotMatch(sections["6.1203"], /<span\b[^>]*\/>/)
        assert.equal(q(".logical-diagram").length, 5)
        q(".logical-line").each((_, element) => {
            assert.equal(q(element).text(), "", "CSS line spans must remain empty in an HTML browser")
            assert.equal(q(element).children().length, 0)
        })
        assert.equal(q("img,object").length, 0)
        q(".logical-diagram").remove()
        const original = cheerio.load(raw)
        original("img").remove()
        assert.equal(q("body").html(), original("body").html())
        assert.equal(sections["6"], "另一个条目")
    }
})

test("missing original figures fail rather than silently erase a drawing", () => {
    assert.throws(() => applyLogicalDiagrams({ "6.1203": "<img src=\"images/Image00024.jpg\" />" }, "he"), /all five/)
})
