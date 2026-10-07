const cheerio = require("cheerio")

// These are geometric illustrations, not mathematical formulas or truth
// diagrams. Each original figure remains at its source proposition.
const geometricImages = {
    han: {
        "5.5423": ["han-image01258.jpeg"],
        "5.6331": ["han-image01259.jpeg"],
        "6.36111": ["han-image01268.jpeg"],
    },
    he: {
        "5.5423": ["Image00017.jpg"],
        "5.6331": ["Image00018.jpg"],
    },
}

function validateFormulaCorpus(versions) {
    const failures = []
    const rows = []
    for (const [version, sections] of Object.entries(versions)) {
        for (const [label, html] of Object.entries(sections)) {
            const $ = cheerio.load(`<root>${html}</root>`, { xmlMode: true })
            const root = $("root")
            if (root.find("svg,canvas,object,iframe").length) failures.push(`${version} ${label}: 图像公式机制`)
            root.find("img").each((_, image) => {
                const name = ($(image).attr("src") || "").split("/").pop()
                if (!(geometricImages[version][label] || []).includes(name)) {
                    failures.push(`${version} ${label}: 公式图片 ${name}`)
                }
            })
            root.find(".formula").each((_, element) => {
                const formula = $(element)
                if (!formula.attr("data-latex") && !formula.attr("data-copy-text")) {
                    failures.push(`${version} ${label}: 公式缺复制结构`)
                }
                if (!formula.text().trim()) failures.push(`${version} ${label}: 公式没有真实文字`)
            })
            root.find("sub,sup,.overlined").each((_, element) => {
                if (!$(element).parents(".formula").length) {
                    failures.push(`${version} ${label}: 上下标或上划线缺复制结构`)
                }
            })
            if (/[�□\uE000-\uF8FF]/.test(root.text())) failures.push(`${version} ${label}: 乱码`)
            if (/url\s*\(|<img|<svg|<canvas|<object/i.test(root.find(".formula").toString())) {
                failures.push(`${version} ${label}: 公式中存在媒体`)
            }
            rows.push({ version, label, formulas: root.find(".formula").length,
                logicalDiagrams: root.find(".logical-diagram").length,
                geometricFigures: root.find("img").length })
        }
    }
    if (failures.length) throw new Error(failures.join("\n"))
    return rows
}

module.exports = { validateFormulaCorpus, geometricImages }
