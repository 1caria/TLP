const fs = require("fs")
const path = require("path")

const repositoryRoot = path.resolve(__dirname, "..")
const sectionsPath = path.join(repositoryRoot, "src", "data", "sections.json")
const outputPath = path.join(repositoryRoot, "src", "data", "hanLinhe.json")

function normalizeTranslations(input) {
    const rawSections = input && input.sections !== undefined ? input.sections : input
    const translations = {}

    if (Array.isArray(rawSections)) {
        rawSections.forEach((section) => {
            if (!section || section.label === undefined) {
                throw new Error("数组中的每一项都必须包含 label。")
            }
            const label = String(section.label)
            if (Object.prototype.hasOwnProperty.call(translations, label)) {
                throw new Error(`存在重复编号：${label}`)
            }
            translations[label] = section.text !== undefined ? section.text : section.han
        })
        return translations
    }

    if (!rawSections || typeof rawSections !== "object") {
        throw new Error("译文文件必须是编号到译文的对象，或包含 label/text 的数组。")
    }

    Object.keys(rawSections).forEach((label) => {
        const value = rawSections[label]
        translations[label] =
            value && typeof value === "object"
                ? value.text !== undefined
                    ? value.text
                    : value.han
                : value
    })
    return translations
}

function validateTranslations(translations, sections) {
    const expectedLabels = sections
        .filter((section) => section.ger && section.ger.trim())
        .map((section) => section.label)
    const expected = new Set(expectedLabels)
    const providedLabels = Object.keys(translations)
    const missing = expectedLabels.filter((label) => {
        const text = translations[label]
        return typeof text !== "string" || !text.trim()
    })
    const extra = providedLabels.filter((label) => !expected.has(label))

    if (missing.length || extra.length) {
        const details = []
        const summarize = (labels) => {
            const shown = labels.slice(0, 20).join(", ")
            const remaining = labels.length - 20
            return remaining > 0 ? `${shown}（另有 ${remaining} 条）` : shown
        }
        if (missing.length) details.push(`缺少或为空：${summarize(missing)}`)
        if (extra.length) details.push(`未知编号：${summarize(extra)}`)
        throw new Error(details.join("\n"))
    }

    return expectedLabels.reduce((result, label) => {
        result[label] = translations[label]
        return result
    }, {})
}

function importTranslation(inputPath, validateOnly = false) {
    if (!inputPath) {
        throw new Error(
            "请提供译文 JSON 文件路径，例如：npm run translation:import -- D:\\资料\\han-linhe.json"
        )
    }

    const resolvedInput = path.resolve(inputPath)
    const input = JSON.parse(fs.readFileSync(resolvedInput, "utf8"))
    const sections = JSON.parse(fs.readFileSync(sectionsPath, "utf8")).sections
    const translations = validateTranslations(normalizeTranslations(input), sections)

    if (!validateOnly) {
        const output = {
            translator: "韩林合",
            source: input.source || "",
            sections: translations,
        }
        const temporaryPath = `${outputPath}.tmp`
        fs.writeFileSync(temporaryPath, `${JSON.stringify(output, null, 4)}\n`, "utf8")
        fs.renameSync(temporaryPath, outputPath)
    }

    return Object.keys(translations).length
}

if (require.main === module) {
    const args = process.argv.slice(2)
    const validateOnly = args[0] === "--validate-only"
    const inputPath = validateOnly ? args[1] : args[0]
    try {
        const count = importTranslation(inputPath, validateOnly)
        console.log(`${validateOnly ? "校验通过" : "导入完成"}：${count} 条译文。`)
    } catch (error) {
        console.error(error.message)
        process.exitCode = 1
    }
}

module.exports = {
    importTranslation,
    normalizeTranslations,
    validateTranslations,
}
