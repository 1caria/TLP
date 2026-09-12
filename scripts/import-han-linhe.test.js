const assert = require("node:assert/strict")
const test = require("node:test")

const {
    normalizeTranslations,
    validateTranslations,
} = require("./import-han-linhe")

test("normalizes map and array input formats", () => {
    assert.deepEqual(normalizeTranslations({ sections: { 1: "甲" } }), {
        1: "甲",
    })
    assert.deepEqual(
        normalizeTranslations({ sections: [{ label: "1", text: "甲" }] }),
        { 1: "甲" }
    )
})

test("rejects duplicate labels in array input", () => {
    assert.throws(
        () =>
            normalizeTranslations({
                sections: [
                    { label: "1", text: "甲" },
                    { label: "1", text: "乙" },
                ],
            }),
        /重复编号/
    )
})

test("requires every non-empty Tractatus section and rejects extras", () => {
    const sections = [
        { label: "1", ger: "eins" },
        { label: "2", ger: "zwei" },
        { label: "6.021", ger: "" },
    ]
    assert.deepEqual(validateTranslations({ 1: "甲", 2: "乙" }, sections), {
        1: "甲",
        2: "乙",
    })
    assert.throws(
        () => validateTranslations({ 1: "甲", 3: "丙" }, sections),
        /缺少或为空：2[\s\S]*未知编号：3/
    )
})
