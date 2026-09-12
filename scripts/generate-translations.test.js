const assert = require("node:assert/strict")
const test = require("node:test")

const { cleanPdfBlock, stripEpubLabel } = require("./generate-translations")

test("keeps web formatting for formulas, tables, paragraphs, and figures", () => {
    const sections = require("../src/data/sections.json").sections
    const han = require("../src/data/hanLinhe.json").sections
    const he = require("../src/data/heShaojia.json").sections

    for (const translations of [han, he]) {
        assert.match(translations["5.15"], /<sub><var>r<\/var><\/sub>/)
        assert.match(translations["5.151"], /<sub><var>rs<\/var><\/sub>/)
        assert.match(translations["5.101"], /<table class="fnlist">/)
        assert.equal(
            (translations["5.101"].match(/<tr>/g) || []).length,
            16
        )
        assert.match(translations["6.02"], /<table class="alignedmath">/)
        assert.equal(
            (translations["6.241"].match(/<br \/>/g) || []).length,
            3
        )
        assert.match(translations["6.36111"], /class="centeredsqueeze"/)
        assert.match(translations["5.5423"], /thecube\.svg/)
        assert.match(translations["5.6331"], /theeye\.svg/)
        assert.match(translations["6.1203"], /abfigurefivegerman\.svg/)
    }

    assert.match(han["5.101"], /同语反复式/)
    assert.doesNotMatch(han["5.101"], /重言式/)

    const external = sections.find((section) => section.label === "5.15")
    assert.ok(external.pmc.includes("<sub><var>r</var></sub>"))
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
