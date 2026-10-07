const cheerio = require("cheerio")

// 6.1203 was checked against BOTH Chinese EPUBs, not inferred from the
// generated translation. See docs/logical-diagram-sources.md for the five
// source pictures, the independently transcribed truth table, and the only
// typographic difference (quotation marks in He Shaojia's third diagram).
// Coordinates use the clean German edition's drawing as a layout ruler.
// These curve instructions are rendered as CSS borders; no graphical image
// element, SVG document, canvas, or external drawing resource is produced.
const pairs = [
    { id: "WW", inputs: ["W", "W"] },
    { id: "WF", inputs: ["W", "F"] },
    { id: "FW", inputs: ["F", "W"] },
    { id: "FF", inputs: ["F", "F"] },
]

function pairNodes(left, right, rightX = 113.811) {
    return [
        { id: `${left}W`, text: "W", x: 0, y: 0 },
        { id: left, text: left, x: 14.226, y: 0, variable: true },
        { id: `${left}F`, text: "F", x: 27.03, y: 0 },
        { id: `${right}W`, text: "W", x: rightX, y: 0 },
        { id: right, text: right, x: rightX + 14.226, y: 0, variable: true },
        { id: `${right}F`, text: "F", x: rightX + 27.03, y: 0 },
    ]
}

const diagrams = [
    {
        id: "combinations", bounds: [-9.193, -34.156, 157.476, 68.312],
        nodes: pairNodes("p", "q"),
        routes: pairs.map(({ id, inputs }) => ({ id, inputs, output: null })),
        curves: [
            ["WF", "M -3.40108 9.34445 C .72424 20.67848 11.2742 28.06563 23.33588 28.06563 L 94.46773 28.06563 C 97.62572 28.06563 100.15819 30.59810 100.15819 33.75609 C 100.15819 30.59810 102.69066 28.06563 105.84865 28.06563 L 114.38455 28.06563 C 126.44623 28.06563 136.99619 20.67848 141.12150 9.34445"],
            ["WW", "M 0 9.34445 C 3.76965 14.72815 9.74232 17.83743 16.31491 17.83743 L 44.76740 17.83781 C 47.92538 17.83781 50.45786 20.37029 50.45786 23.52827 C 50.45786 20.37029 52.99033 17.83781 56.14832 17.83781 L 96.75043 17.83781 C 103.32301 17.83781 109.29568 14.72853 113.06534 9.34555"],
            ["FF", "M 140.84099 -9.34445 C 136.71567 -20.67848 126.16571 -28.06563 114.10403 -28.06563 L 105.56813 -28.06563 C 102.41014 -28.06563 99.87767 -30.59810 99.87767 -33.75609 C 99.87767 -30.59810 97.34520 -28.06563 94.18721 -28.06563 L 51.50810 -28.06563 C 39.44643 -28.06563 28.89647 -20.67848 24.77115 -9.34445"],
            ["FW", "M 27.03001 -9.34445 C 30.79967 -14.72815 36.77234 -17.83743 43.34492 -17.83743 L 71.79741 -17.83781 C 74.95540 -17.83781 77.48787 -20.37029 77.48787 -23.52827 C 77.48787 -20.37029 80.02034 -17.83781 83.17833 -17.83781 L 97.40470 -17.83781 C 103.97728 -17.83781 109.94995 -14.72853 113.71960 -9.34445"],
        ],
    },
    {
        id: "implication", bounds: [-9.193, -61.416, 157.476, 123.395],
        nodes: pairNodes("p", "q").concat([
            { id: "resultF", text: "F", x: 76, y: 56 },
            { id: "resultW", text: "W", x: 86.023, y: -54.635 },
        ]),
        routes: pairs.map(({ id, inputs }) => ({ id, inputs, output: id === "WF" ? "F" : "W" })),
        curves: [
            ["WF", "M -3.40108 9.34445 C .72424 20.67848 11.2742 28.06563 23.33588 28.06563 L 57.47908 28.06563 C 60.63707 28.06563 63.16954 30.59810 63.16954 33.75609 L 71.70544 47.98245 M 63.16954 33.75609 C 63.16954 30.59810 65.70201 28.06563 68.86000 28.06563 L 114.38455 28.06563 C 126.44623 28.06563 136.99619 20.67848 141.12150 9.34445"],
            ["WW", "M 0 9.34445 C 3.76965 14.72815 9.74232 17.83743 16.31491 17.83743 L 39.07692 17.83781 C 42.23491 17.83781 44.76738 20.37029 44.76738 23.52827 L 78.91058 -47.60358 M 44.76738 23.52827 C 44.76738 20.37029 47.29985 17.83781 50.45784 17.83781 L 96.75041 17.83781 C 103.32300 17.83781 109.29567 14.72853 113.06532 9.34555"],
            ["FF", "M 140.84099 -9.34445 C 136.71567 -20.67848 126.16571 -28.06563 114.10403 -28.06563 L 102.72311 -28.06563 C 99.56512 -28.06563 97.03265 -30.59810 97.03265 -33.75609 L 91.34220 -46.55972 M 97.03265 -33.75609 C 97.03265 -30.59810 94.50018 -28.06563 91.34220 -28.06563 L 51.50853 -28.06563 C 39.44685 -28.06563 28.89690 -20.67848 24.77158 -9.34445"],
            ["FW", "M 27.03001 -9.34445 C 30.79967 -14.72815 36.77234 -17.83743 43.34492 -17.83743 L 68.95195 -17.83781 C 72.10994 -17.83781 74.64241 -20.37029 74.64241 -23.52827 L 86.02333 -46.29054 M 74.64241 -23.52827 C 74.64241 -20.37029 77.17488 -17.83781 80.33287 -17.83781 L 97.40468 -17.83781 C 103.97726 -17.83781 109.94994 -14.72853 113.71959 -9.34445"],
        ],
    },
    {
        id: "negation", bounds: [-12.190, -37.412, 48.832, 74.952],
        nodes: [
            { id: "ξW", text: "W", x: 0, y: 0 },
            { id: "ξ", text: "ξ", x: 14.226, y: 0, variable: true },
            { id: "ξF", text: "F", x: 27.03, y: 0 },
            { id: "resultW", text: "W", x: 3.769, y: 28.75 },
            { id: "resultF", text: "F", x: 23.261, y: -30.603 },
        ],
        routes: [
            { id: "F", inputs: ["F"], output: "W" },
            { id: "W", inputs: ["W"], output: "F" },
        ],
        curves: [
            ["F", "M 23.68571 9.18846 L 3.76889 23.41483"],
            ["W", "M 3.34430 -9.18846 L 23.26112 -23.41483"],
        ],
    },
    {
        id: "conjunction", bounds: [-9.193, -62.144, 157.476, 115.172],
        nodes: pairNodes("ξ", "η").concat([
            { id: "resultW", text: "W", x: 56.148, y: 44 },
            { id: "resultF", text: "F", x: 89, y: -55.657 },
        ]),
        routes: pairs.map(({ id, inputs }) => ({ id, inputs, output: id === "WW" ? "W" : "F" })),
        curves: [
            ["WF", "M -3.46114 -9.50946 C .66418 -20.84349 11.21414 -28.23064 23.27582 -28.23064 L 80.18130 -28.23064 C 83.33930 -28.23064 85.87177 -30.76310 85.87177 -33.92110 L 85.87177 -48.14746 M 85.87177 -33.92110 C 85.87177 -30.76310 88.40424 -28.23064 91.56223 -28.23064 L 114.32450 -28.23064 C 126.38617 -28.23064 136.93613 -20.84349 141.06145 -9.50946"],
            ["WW", "M 0 -9.50946 C 3.76965 -14.89316 9.74232 -18.00244 16.31491 -18.00244 L 44.76740 -18.00282 C 47.92538 -18.00282 50.45786 -20.53530 50.45786 -23.69328 L 56.14832 38.90266 M 50.45786 -23.69328 C 50.45786 -20.53530 52.99033 -18.00282 56.14832 -18.00282 L 96.75043 -18.00282 C 103.32301 -18.00282 109.29568 -14.89354 113.06534 -9.51056"],
            ["FF", "M 140.84099 9.34445 C 136.71567 20.67848 126.16571 28.06563 114.10403 28.06563 L 102.72311 28.06563 C 99.56512 28.06563 97.03265 30.59810 97.03265 33.75609 L 93.33366 -51.60214 M 97.03265 33.75609 C 97.03265 30.59810 94.50018 28.06563 91.34220 28.06563 L 51.50853 28.06563 C 39.44685 28.06563 28.89690 20.67848 24.77158 9.34445"],
            ["FW", "M 27.03001 9.50946 C 30.79967 14.89316 36.77234 18.00244 43.34492 18.00244 L 63.26149 18.00282 C 66.41948 18.00282 68.95195 20.53530 68.95195 23.69328 L 81.18642 -53.12903 M 68.95195 23.69328 C 68.95195 20.53530 71.48442 18.00282 74.64241 18.00282 L 97.40468 18.00282 C 103.97726 18.00282 109.94994 14.89354 113.71959 9.51056"],
        ],
    },
    {
        id: "compound", bounds: [-9.193, -82.093, 132.020, 167.777],
        nodes: pairNodes("q", "p", 85.358).concat([
            { id: "notqW", text: "W", x: 3.712, y: 28.752 },
            { id: "notqF", text: "F", x: 23.318, y: -30.915 },
            { id: "andW", text: "W", x: 64.771, y: 56.243 },
            { id: "andF", text: "F", x: 96.258, y: -55.395 },
            { id: "resultF", text: "F", x: 83.643, y: 76.739 },
            { id: "resultW", text: "W", x: 111.881, y: -73 },
        ]),
        // Inputs are ordered q, p, matching the printed left/right layout.
        routes: pairs.map(({ id, inputs }) => ({ id, inputs, output: id === "FW" ? "F" : "W" })),
        curves: [
            ["notq-F", "M 23.62894 9.34445 L 3.71211 23.57082"],
            ["notq-W", "M 3.40108 -9.34445 L 23.31790 -23.57082"],
            ["FW", "M 2.84544 36.98865 C 8.09451 40.94398 14.73578 42.05537 20.98653 40.02437 L 37.22221 34.74928 C 39.15912 34.08235 41.26222 34.49117 42.80821 35.83510 C 43.60695 36.52937 44.15988 37.36478 44.48688 38.37129 L 58.71283 52.59780 M 44.48647 38.37143 C 43.45833 35.38554 45.02838 32.16641 48.01427 31.13828 L 71.01590 23.66492 C 77.26665 21.63391 81.98602 16.83096 83.90762 10.54588"],
            ["FF", "M 0 39.83366 C 7.42577 49.33817 19.74230 53.10402 31.21352 49.37682 L 58.27393 40.58434 C 60.21083 39.91740 62.31393 40.32622 63.85992 41.67015 C 64.65866 42.36443 65.21160 43.19983 65.53859 44.20634 C 64.51045 41.22046 66.08050 38.00133 69.06639 36.97319 L 93.42000 29.06061 C 102.51205 26.10663 109.34306 19.03206 111.97794 9.84276"],
            ["WW", "M 25.60728 -36.98865 C 31.29915 -40.27478 38.02643 -40.56865 43.98299 -37.79095 L 49.13974 -35.38618 C 52.00180 -34.05162 55.36740 -35.27654 56.70197 -38.13860 C 55.36740 -35.27654 56.59232 -31.91093 59.45438 -30.57637 L 77.50520 -22.15970 C 82.59532 -18.59580 85.64565 -13.09233 85.97083 -6.88718"],
            ["WF", "M 22.76227 -39.83366 C 31.29079 -48.36218 43.97461 -50.59895 54.90617 -45.50156 L 85.85052 -31.07200 C 88.71259 -29.73744 92.07819 -30.96236 93.41275 -33.82442 L 96.25806 -48.05092 M 93.41261 -33.82455 C 92.07805 -30.96250 93.30296 -27.59690 96.16502 -26.26233 L 101.32248 -23.85770 C 106.91568 -19.94120 110.71890 -14.51035 112.48590 -7.91467"],
            ["andW-to-F", "M 70.09375 63.97871 L 78.62965 72.51462"],
            ["FF-to-andF", "M 65.53818 44.20648 C 46.59000 11.38763 57.71405 -30.12646 90.53290 -49.07465"],
            ["WW-to-andF", "M 56.70183 -38.13873 C 61.50310 -51.33037 75.53780 -58.63602 89.09775 -55.00279"],
            ["andF-to-W", "M 99.10350 -59.43184 L 107.63940 -67.96774"],
        ],
    },
]

function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

// Only absolute move, line and cubic instructions are accepted. Flattening
// with short CSS border segments keeps every bracket and branch visible at
// any font size. It never constructs or injects an SVG path.
function curveSegments(instructions) {
    const tokens = instructions.match(/[MLC]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []
    const result = []
    let point
    let index = 0
    while (index < tokens.length) {
        const kind = tokens[index++]
        if (kind === "M") point = [Number(tokens[index++]), Number(tokens[index++])]
        else if (kind === "L") {
            const next = [Number(tokens[index++]), Number(tokens[index++])]
            result.push([point, next])
            point = next
        } else if (kind === "C") {
            const a = [Number(tokens[index++]), Number(tokens[index++])]
            const b = [Number(tokens[index++]), Number(tokens[index++])]
            const end = [Number(tokens[index++]), Number(tokens[index++])]
            const start = point
            const length = Math.hypot(a[0] - start[0], a[1] - start[1])
                + Math.hypot(b[0] - a[0], b[1] - a[1])
                + Math.hypot(end[0] - b[0], end[1] - b[1])
            const steps = Math.max(6, Math.ceil(length / 1.5))
            for (let step = 1; step <= steps; step++) {
                const t = step / steps
                const u = 1 - t
                const next = [0, 1].map(axis => u ** 3 * start[axis]
                    + 3 * u ** 2 * t * a[axis] + 3 * u * t ** 2 * b[axis]
                    + t ** 3 * end[axis])
                result.push([point, next])
                point = next
            }
        } else throw new Error(`Invalid logical diagram curve instruction: ${kind}`)
    }
    return result
}

function diagramCopyText(diagram, translator) {
    const triplets = diagram.id === "conjunction" ? "WξF，WηF"
        : diagram.id === "compound" ? "WqF，WpF"
            : diagram.id === "negation" ? (translator === "he" ? "„WξF“" : "WξF")
                : "WpF，WqF"
    const formula = {
        combinations: "真值组合", implication: "p⊃q", negation: "～ξ",
        conjunction: "ξ·η", compound: "～（p·～q）",
    }[diagram.id]
    const routeText = diagram.routes.map(route => `${route.inputs.join(",")}${route.output ? `→${route.output}` : ""}`).join("；")
    const inner = diagram.id === "compound" ? "；内层～q：q=W→F，q=F→W；p·～q：p=W且q=F→W，其余→F；最外层否定：内层W→F，内层F→W" : ""
    return `${formula}：${triplets}；括弧/连线：${routeText}${inner}`
}

function renderLogicalDiagram(index, translator = "han") {
    const diagram = diagrams[index]
    if (!diagram) throw new Error(`Unknown logical diagram ${index}`)
    const [left, bottom, width, height] = diagram.bounds
    const top = bottom + height
    const em = value => `${(value / 12).toFixed(5)}em`
    let drawing = diagram.curves.map(([route, instructions]) => {
        const segments = curveSegments(instructions).map(([a, b]) => {
            const length = Math.hypot(b[0] - a[0], b[1] - a[1])
            const angle = Math.atan2(a[1] - b[1], b[0] - a[0]) * 180 / Math.PI
            return `<span class="logical-line" style="left:${em(a[0] - left)};top:${em(top - a[1])};width:${em(length + .045)};transform:rotate(${angle.toFixed(5)}deg)"></span>`
        }).join("")
        return `<span class="logical-route" data-route="${route}" aria-hidden="true">${segments}</span>`
    }).join("")
    let nodes = diagram.nodes
    if (diagram.id === "negation" && translator === "he") {
        nodes = nodes.concat([
            { id: "openquote", text: "„", x: -7, y: 0 },
            { id: "closequote", text: "“", x: 33, y: 0 },
        ])
    }
    drawing += nodes.map(node => `<span class="logical-node" data-node="${node.id}" style="left:${em(node.x - left)};top:${em(top - node.y)}">${node.variable ? `<var>${node.text}</var>` : node.text}</span>`).join("")
    const copy = escapeHtml(diagramCopyText(diagram, translator))
    return `<span class="formula logical-diagram" data-logical-diagram="${diagram.id}" data-copy-text="${copy}" style="width:${em(width)};height:${em(height)}" role="group" aria-label="${copy}">${drawing}</span>`
}

function applyLogicalDiagrams(sections, translator) {
    if (!sections["6.1203"]) throw new Error("6.1203 missing when applying logical diagrams")
    const q = cheerio.load(`<root>${sections["6.1203"]}</root>`, {
        xmlMode: true, decodeEntities: false,
    })
    const names = ["one", "two", "three", "four", "five"]
    const replaced = new Set()
    q("img,object").each((_, element) => {
        const item = q(element)
        const source = item.attr("src") || item.attr("data") || ""
        const name = source.split("/").pop()
        let index = names.findIndex(part => name === `abfigure${part}german.svg` || name === `abfigure${part}german.png`)
        const han = name.match(/^(?:han-)?image012(6[3-7])\.jpeg$/i)
        const he = name.match(/^Image000(2[4-8])\.jpg$/i)
        if (han) index = Number(han[1]) - 63
        if (he) index = Number(he[1]) - 24
        if (index < 0) return
        // A fallback img inside an object was already replaced with its
        // parent's diagram and must not yield a second diagram.
        if (!item.closest("root").length) return
        if (replaced.has(index)) throw new Error(`6.1203 has duplicate diagram ${index + 1}`)
        item.replaceWith(renderLogicalDiagram(index, translator))
        replaced.add(index)
    })
    if (replaced.size !== 5) throw new Error(`6.1203 must contain all five source diagrams; found ${replaced.size}`)
    // HTML does not permit self-closing span elements. XML serialization would
    // nest all the empty CSS line segments when the browser inserts the HTML.
    sections["6.1203"] = q("root").html().replace(/<span\b([^>]*?)\/>/g, "<span$1></span>")
    return sections
}

module.exports = { applyLogicalDiagrams, renderLogicalDiagram, diagramCopyText, diagrams }
