const assert = require("node:assert/strict")
const test = require("node:test")

const {
    cleanPdfBlock,
    parseHanEpub,
    stripEpubLabel,
} = require("./generate-translations")

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

test("preserves EPUB paragraphs, lists, formula images, and diagrams", () => {
    const han = parseHanEpub()
    assert.equal((han["5.02"].match(/<br \/>/g) || []).length, 2)
    assert.equal((han["5.101"].match(/<br \/>/g) || []).length, 17)
    assert.match(han["5.101"], /同语反复式/)
    assert.doesNotMatch(han["5.101"], /重言式/)
    assert.match(han["5.15"], /W<sub>r<\/sub>/)
    assert.match(han["5.151"], /W<sub>rs<\/sub>/)
    for (const [label, image] of [
        ["4.27", "image01253.jpeg"],
        ["4.31", "image01254.jpeg"],
        ["4.42", "image01255.jpeg"],
        ["4.442", "image01256.jpeg"],
        ["5.5423", "image01258.jpeg"],
        ["5.6331", "image01259.jpeg"],
        ["6.36111", "image01268.jpeg"],
    ]) {
        assert.match(han[label], new RegExp(`images/han-${image}`))
    }
    assert.equal((han["6.1203"].match(/<img\b/g) || []).length, 5)
})

test("repairs formula glyph encodings without changing the translation", () => {
    const han = parseHanEpub()
    assert.match(han["4.013"], /♯和♭/)
    assert.match(han["4.1272"], /ℵ<sub>0<\/sub>/)
    assert.match(han["4.442"], /⊢/)
    assert.match(han["6.02"], /Ω<sup>0<\/sup>’x/)
    assert.match(han["6.02"], /Ω<sup>ν\+1<\/sup>’x/)
    assert.match(han["6.241"], /（Ων）<sup>μ<\/sup>’x/)
    assert.match(han["6.241"], /<div class="centered">/)
    assert.equal((han["6.241"].match(/<br \/>/g) || []).length, 3)
    assert.doesNotMatch(Object.values(han).join(""), /[�□\uE000-\uF8FF]/)
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
