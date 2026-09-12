const fs = require("fs")
const path = require("path")
const childProcess = require("child_process")

const root = path.resolve(__dirname, "..")
const sections = JSON.parse(
    fs.readFileSync(path.join(root, "src", "data", "sections.json"), "utf8")
).sections
const expectedLabels = sections
    .filter((section) => section.ger && section.ger.trim())
    .map((section) => section.label)

const epubPath = path.join(
    root,
    "逻辑哲学论 ([奥地利] 路德维希·维特根斯坦贺绍甲) (z-library.sk, 1lib.sk, z-lib.sk).epub"
)
const pdfPath = path.join(
    root,
    "逻辑哲学论 (Ludwig Wittgenstein (路德维希·维特根斯坦)) (z-library.sk, 1lib.sk, z-lib.sk).pdf"
)
const pdfTextPath = path.join(root, "tmp", "han-linhe-ocr.txt")
const epubHtmlPath = path.join(
    root,
    "tmp",
    "translation-source",
    "epub",
    "OEBPS",
    "text00007.html"
)

function decodeEntities(value) {
    return value
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
}

function cleanEpubHtml(value) {
    return decodeEntities(value)
        .replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, "")
        .replace(/<sup>\s*<\/sup>/gi, "")
        .replace(/\s+/g, " ")
        .replace(/>\s+</g, "><")
        .replace(/([\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])/g, "$1")
        .replace(/\s+([，。！？；：、）】》])/g, "$1")
        .trim()
}

function normalizeTranslationMarkup(value) {
    return value
        // EPUB image references are relative to the EPUB OEBPS directory. In
        // the web app they live in dist/images instead.
        .replace(/src=\"(?:\.\.\/)?(?:images\/)?(Image\d+\.jpg)\"/gi, 'src="images/$1"')
        .replace(/\s+\/?>/g, (match) => match)
        .trim()
}

function math(content) {
    return `<span class="mathmode">${content}</span>`
}

function variable(name) {
    return `<var>${name}</var>`
}

function relation(symbol) {
    return `<span class="mathrel">${symbol}</span>`
}

function figureMarkup(name, width, height, alt) {
    return `<!-- noindent --><div class="centered"><object data="images/${name}.svg" type="image/svg+xml" width="${width}" height="${height}"><img src="images/${name}.png" alt="${alt}" /></object></div> <!-- noindent -->`
}

function subscript(base, value) {
    return base
        ? `${variable(base)}<sub>${variable(value)}</sub>`
        : `<sub>${variable(value)}</sub>`
}

function translatedTruthTable(isHan) {
    const rows = [
        ['W','W','W','W',`${isHan ? '同语反复式' : '重言式'}（如果 {p}，那么 {p}；并且如果 {q}，那么 {q}。）`,''],
        ['F','W','W','W','用话来说：','非 {p} 且 {q} 两者皆成立。'],
        ['W','F','W','W','”','如果 {q}，那么 {p}。'],
        ['W','W','F','W','”','如果 {p}，那么 {q}。'],
        ['W','W','W','F','”','或者 {p}，或者 {q}。'],
        ['F','F','W','W','”','非 {q}。'],
        ['F','W','F','W','”','非 {p}。'],
        ['F','W','W','F','”','{p} 或者 {q}，但并非二者皆成立。'],
        ['W','F','F','W','”','如果 {p}，那么 {q}；并且如果 {q}，那么 {p}。'],
        ['W','F','W','F','”','{p}。'],
        ['W','W','F','F','”','{q}。'],
        ['F','F','F','W','”','既非 {p}，也非 {q}。'],
        ['F','F','W','F','”','{p} 并且非 {q}。'],
        ['F','W','F','F','”','{q} 并且非 {p}。'],
        ['W','F','F','F','”','{q} 并且 {p}。'],
        ['F','F','F','F','矛盾式','{p} 并且非 {p}；并且 {q} 并且非 {q}。'],
    ]
    const renderText = (text) => text
        .replace(/\{p\}/g, math(variable('p')))
        .replace(/\{q\}/g, math(variable('q')))
    const renderFormula = (text) => math(text
        .replace(/\{p\}/g, variable('p'))
        .replace(/\{q\}/g, variable('q'))
        .replace(/⊃/g, relation('<span class="symbol">⊃</span>'))
        .replace(/·/g, relation('.'))
        .replace(/∨/g, relation('<span class="symbol">∨</span>'))
        .replace(/≡/g, relation('<span class="symbol">≡</span>'))
        .replace(/\|/g, relation('|'))
        .replace(/[～~]/g, '<span class="mathop">~</span>'))
    const renderRow = (row) => {
        const [a, b, c, d, note, description] = row
        const formulas = [
            '{p}⊃{p}·{q}⊃{q}', '~({p}·{q})', '{q}⊃{p}', '{p}⊃{q}', '{p}∨{q}', '~{q}', '~{p}', '{p}·~{q}:∨:{q}·~{p}', '{p}≡{q}', '{p}', '{q}', '~{p}·~{q} 或 {p}|{q}', '{p}·~{q}', '{q}·~{p}', '{q}·{p}', '{p}·~{p}·{q}·~{q}'
        ]
        const formula = renderFormula(formulas[rows.indexOf(row)])
        return `<tr><td class="righttight">(</td><td class="centertight">${a}</td><td class="centertight">${b}</td><td class="centertight">${c}</td><td class="centertight">${d}</td><td class="lefttight">)</td><td class="leftcell">${math(`(${variable('p')},&nbsp;${variable('q')})`)}&nbsp;&nbsp;</td><td class="leftcell">${renderText(note)}</td><td>${renderText(description)}&nbsp;&nbsp;${formula}</td></tr>`
    }
    return `<table class="fnlist">${rows.map(renderRow).join('')}</table>`
}

function applyFormatOverrides(result, translator) {
    const isHan = translator === "韩林合"
    result["5.02"] = isHan
        ? `人们很容易将函项的主目与名称的标号混淆在一起。因为我从主目和标号中都能认出包含着它们的符号的所指。比如，在罗素的“${math(`${relation('+')}${subscript('','c')}`)}”中，“${math(subscript('','c'))}”就是一个标号，它表示，这个整个符号是基数的加法符号。但是，这种表示方式是以任意的约定为基础的，人们也可以不使用“${math(`${relation('+')}${subscript('','c')}`)}”，而选择一个简单符号；但是，在“${math('<span class="mathop">~</span>'+variable('p'))}”中 ${math(variable('p'))} 并不是一个标号，而是一个主目：在未理解 ${math(variable('p'))} 的意义之前，我们是不能理解 ${math('<span class="mathop">~</span>'+variable('p'))} 的意义的。<br />（在儒略・恺撒这个名称中，“儒略”是一个标号。一个标号总是构成了关于这样一个对象的描述的一个部分，我们将该标号附加在它的名称之上。比如，儒略氏族的那个恺撒。）<br />如果我没有弄错的话，弗雷格关于命题和函项的所指的理论就是建立在主目和标号的混淆基础之上的。对于弗雷格来说，诸逻辑命题是名称，而其主目就是这些名称的标号。`
        : `函项的主目很容易和名称的附标相混淆。因为从主目和附标我都能看出包含它们的那些记号的指谓。<br />例如，当罗素写“${math(`${relation('+')}${subscript('','c')}`)}”时，其中 ${math(subscript('','c'))} 就是一个附标，它指明整个记号是用于基数的加号。但是这种标记法是一种任意约定的结果，因而完全可能选择一个简单的记号来代替“${math(`${relation('+')}${subscript('','c')}`)}”；可是，在“${math('<span class="mathop">~</span>'+variable('p'))}”中，${math(variable('p'))} 不是附标而是主目：除非已经先理解了 ${math(variable('p'))} 的意义，“${math('<span class="mathop">~</span>'+variable('p'))}”的意义就<u>不可能</u>理解。<br />（在名称尤利乌斯・恺撒中，“尤利乌斯”是一个附标。附标总是对对象的描述的一部分，我们把它附加到对象的名称上面：例如尤利乌斯家族中的<u>这位</u>恺撒。）<br />如果我没有弄错，弗雷格关于命题和函项的指谓理论，就是建立在混淆主目和附标的基础之上的。弗雷格认为逻辑命题是名称，而它们的主目则是这些名称的附标。`

    const truthIntro = isHan
        ? '每一给定数目的基本命题的诸种真值函项都可以写成如下形式的图式：'
        : '一定数目的基本命题的真值函项，可以按以下这种图式列出：'
    const truthEnd = isHan
        ? '我将一个命题的诸真值主目的诸种真值可能情况中那些使其为真的情况称作它的真值基础。'
        : '我将用命题的<u>真值基础</u>这个名称来称呼其真值主目使该命题为真的那些真值可能性。'
    result["5.101"] = `${truthIntro}<!-- noindent -->${translatedTruthTable(isHan)}<br />${truthEnd}`
    result["5.15"] = isHan
        ? `如果 ${math(subscript('W','r'))} 是命题“r”的真值基础的数目，${math(subscript('W','rs'))} 是命题“s”的这样的真值基础的数目，它们同时也是“r”的真值基础，那么我们便称比例 ${math(`${subscript('W','rs')}${relation('∶')}${subscript('W','r')}`)} 为命题“r”给予命题“s”的概率度。`
        : `如 ${math(subscript('w','r'))} 是命题“r”的真值基础数，${math(subscript('w','rs'))} 是同属命题“s”和“r”的真值基础数，则我们称比值 ${math(`${subscript('w','rs')}${relation('∶')}${subscript('w','r')}`)} 为命题“r”给予命题“s”的<u>概率</u>度。`
    result["5.151"] = isHan
        ? `在如上述5.101那样的图式中，设 ${math(subscript('W','r'))} 是命题r的“W”数，${math(subscript('W','rs'))} 是和命题r的那些“W”同列的命题s的“W”数。则命题r给命题s的概率为 ${math(`${subscript('W','rs')}${relation('∶')}${subscript('W','r')}`)}。`
        : `在如上述5.101那样的图式中，设 ${math(subscript('w','r'))} 是命题r的“w”数，${math(subscript('w','rs'))} 是和命题r的那些“w”同列的命题s的“w”数。则命题r给命题s以概率 ${math(`${subscript('w','rs')}${relation('∶')}${subscript('w','r')}`)}。`
    result["6.02"] = `由此我们便得到了数。我给出如下定义：<div class="centered"><table class="alignedmath"><tr><td class="righttight">${math(`${variable('x')}${relation('=')}`)}</td><td class="lefttight">${math(`<span class="mathop">Ω<sup>0</sup>’</span>${variable('x')}`)}&nbsp;&nbsp;Def.，并</td></tr><tr><td class="righttight">${math(`<span class="mathop">Ω’</span><span class="mathop">Ω<sup><var>ν</var></sup>’</span>${variable('x')}${relation('=')}`)}</td><td class="lefttight">${math(`<span class="mathop">Ω<sup><var>ν</var>+1</sup>’</span>${variable('x')}`)}&nbsp;&nbsp;Def.</td></tr></table></div>按照这些记号规则，我们写出系列<div class="centered">${math(`${variable('x')}，<span class="mathop">Ω’</span>${variable('x')}，<span class="mathop">Ω’</span><span class="mathop">Ω’</span>${variable('x')}，<span class="mathop">Ω’</span><span class="mathop">Ω’</span><span class="mathop">Ω’</span>${variable('x')}，<span class="mathrel">…</span>`)}</div>为：<div class="centered">${math(`<span class="mathop">Ω<sup>0</sup>’</span>${variable('x')}，<span class="mathop">Ω<sup>0+1</sup>’</span>${variable('x')}，<span class="mathop">Ω<sup>0+1+1</sup>’</span>${variable('x')}，<span class="mathop">Ω<sup>0+1+1+1</sup>’</span>${variable('x')}，<span class="mathrel">…</span>`)}</div>因此，我不写作“${math(`${variable('x')}，${variable('ξ')}，<span class="mathop">Ω’</span>${variable('ξ')}`)}”，而写作：<div class="centered">${math(`“<span class="mathop">Ω<sup>0</sup>’</span>${variable('x')}，<span class="mathop">Ω<sup><var>ν</var></sup>’</span>${variable('x')}，<span class="mathop">Ω<sup><var>ν</var>+1</sup>’</span>${variable('x')}]”`)}</div>而且我给出如下定义：<div class="centered"><table class="alignedmath"><tr><td class="lefttight">${math(`0+1=1`)}&nbsp;&nbsp;Def.</td></tr><tr><td class="lefttight">${math(`0+1+1=2`)}&nbsp;&nbsp;Def.</td></tr><tr><td class="lefttight">${math(`0+1+1+1=3`)}&nbsp;&nbsp;Def.</td></tr><tr><td class="lefttight">（以及依次类推）</td></tr></table></div>`
    if (!isHan) {
        result["6.02"] = result["6.02"]
            .replace("由此我们便得到了数。", "<u>由此</u> 我们就达到了数。")
            .replace("按照这些记号规则，我们写出系列", "这样，根据这些记号规则我把系列")
            .replace("为：", "写作：")
    }
    result["6.03"] = `整数的一般形式是：${math(`[0，${variable('ξ')}，${variable('ξ')}${relation('+')}1]`)}。`
    result["6.241"] = `因此，命题${math(`2 × 2${relation('=')}4`)}的证明进行如下：<div class="centered">${math(`<span class="mathop">(Ω<sup><var>ν</var></sup>)<sup><var>μ</var></sup>’</span>${variable('x')}${relation('=')}<span class="mathop">Ω<sup><var>ν</var>× <var>μ</var></sup>’</span>${variable('x')}`)} Def.<br />${math(`<span class="mathop">Ω<sup>2 × 2</sup>’</span>${variable('x')}${relation('=')}<span class="mathop">(Ω<sup>2</sup>)<sup>2</sup>’</span>${variable('x')}${relation('=')}<span class="mathop">(Ω<sup>2</sup>)<sup>1+1</sup>’</span>${variable('x')}${relation('=')}<span class="mathop">Ω<sup>2</sup>’</span><span class="mathop">Ω<sup>2</sup>’</span>${variable('x')}`)}<br />${math(`${relation('=')}<span class="mathop">Ω<sup>1+1</sup>’</span><span class="mathop">Ω<sup>1+1</sup>’</span>${variable('x')}${relation('=')}<span class="mathop">(Ω’Ω)’</span><span class="mathop">(Ω’Ω)’</span>${variable('x')}`)}<br />${math(`${relation('=')}<span class="mathop">Ω’</span><span class="mathop">Ω’</span><span class="mathop">Ω’</span><span class="mathop">Ω’</span>${variable('x')}${relation('=')}<span class="mathop">Ω<sup>1+1+1+1</sup>’</span>${variable('x')}${relation('=')}<span class="mathop">Ω<sup>4</sup>’</span>${variable('x')}`)}。</div>`
    result["6.36111"] = isHan
        ? `康德关于人们不能将其叠合在一起的左右手问题在平面上就已经存在了，甚至于在一维空间中也已经存在了，因为在这里我们也无法使${math(variable('a'))}和${math(variable('b'))}这两个全等的图形叠合在一起，除非我们把它们从这个空间中移出来。<!-- noindent --><div class="centeredsqueeze"><b>–&nbsp;–&nbsp;–&nbsp;<span class="tight"><span class="symbol">○</span>————<span class="nudgedown"><span class="symbol">✕</span></span></span>&nbsp;–&nbsp;–&nbsp;<span class="tight"><span class="nudgedown"><span class="symbol">✕</span></span>————<span class="symbol">○</span></span>&nbsp;–&nbsp;–&nbsp;–</b><br /><var class="smallvar">a</var>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<var class="smallvar">b</var></div>左右手实际上是完全全等的。人们不能使它们叠合在一起，这点与此无关。如果我们能在四维空间中将右手的手套翻转过来，那么我们便能将它戴在左手上。`
        : `康德的关于右手和左手不能使之重合的问题，在平面中就已经存在，甚至也存在于一维空间中：<!-- noindent --><div class="centeredsqueeze"><b>–&nbsp;–&nbsp;–&nbsp;<span class="tight"><span class="symbol">○</span>————<span class="nudgedown"><span class="symbol">✕</span></span></span>&nbsp;–&nbsp;–&nbsp;<span class="tight"><span class="nudgedown"><span class="symbol">✕</span></span>————<span class="symbol">○</span></span>&nbsp;–&nbsp;–&nbsp;–</b><br /><var class="smallvar">a</var>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<var class="smallvar">b</var></div>如其中两个全等的图形${math(variable('a'))}和${math(variable('b'))}，除非越出这个空间，就不能使之重合。右手和左手事实上是真正地全等的，人们不能使它们重合与这一事实没有关系。<br />假如能够在四维空间中旋转，右手套就可以戴到左手上面。`

    const cube = figureMarkup("thecube", "200", "200", "立方体图示")
    const eye = figureMarkup("theeye", "200", "120", "视域图示")
    result["5.5423"] = isHan
        ? `知觉一个复合物就意味着知觉其构成成分是以如此这般的方式彼此关联在一起的。这点当然也解释了如下事实：人们可以以两种方式将下面这个图形看成立方体；以及所有类似的现象。${cube}因为我们实际上恰恰看到了两个不同的事实。（如果我首先看到的是诸a角，而只是快速地看了一下诸b角，那么出现在前面的将是诸a；反之，出现在前面的将是诸b。）`
        : `感知一个复合物的意思就是感知到它的各组成部分以如此这般的方式互相关联着。${cube}这也能很好地解释，为何有两种可能的方式把如下图形看成为立方体；以及所有类似的现象。因为我们确实看到两个不同的事实。<br />（如果我先看定诸a角，对诸b角只是瞥及，于是诸a角显得在前；反之则诸b角显得在前。）`
    result["5.6331"] = isHan
        ? `因为视野并没有比如这样一种形式：${eye}`
        : `视域肯定不具有如图这样的形式：${eye}`

    const figures = [
        figureMarkup("abfigureonegerman", 156, 69, "真值组合图"),
        figureMarkup("abfiguretwogerman", 156, 124, "真值关联图"),
        figureMarkup("abfigurethreegerman", 47, 75, "否定形式图"),
        figureMarkup("abfigurefourgerman", 156, 116, "合取形式图"),
        figureMarkup("abfigurefivegerman", 129, 168, "复合命题图"),
    ]
    result["6.1203"] = isHan
        ? `为了将一个同语反复式认作为同语反复式，在不含一般性符号的同语反复式的情况下，我们可以使用如下直观的方法：将“p”、“q”、“r”等等写成“WpF”、“WqF”、“WrF”等等。这时，诸种真值组合可以通过括弧加以表达，例如：${figures[0]}而整个命题的真或者假与诸真值主目的诸种真值组合的配合，则可以如下方式通过短线加以表达：${figures[1]}因此，这个符号将表示比如 ${math(`${variable('p')}${relation('<span class="symbol">⊃</span>')}${variable('q')}`)} 这样的命题。现在我要研究一下 ${math('<span class="mathop">~</span>('+variable('p')+relation('.')+'<span class="mathop">~</span>'+variable('p')+')')} 这个命题（即矛盾律）是否为同语反复式。在我们的记号系统中，公式“～ξ”将被写成：${figures[2]}形式“ξ・η”则写为：${figures[3]}因而，命题“～（p・～q）”就表为：${figures[4]}在此如果用“p”替换该公式中的“q”，并考察最外层的W和F与其最里层的W和F的结合情况，结果将是：整个命题的真被配合给了其主目的所有真值组合，而其假则没有被配合给任何真值组合。`
        : `为了看出一个表达式是重言式，在其中没有概括记号出现的情形下，可以应用如下的直观方法：我将“p”、“q”、“r”等等，写为“WpF”、“WqF”、“WrF”等等。用括号来表达真值组合，如：${figures[0]}并且用线段表示整个命题的真或假与其真值主目的真值组合之间的相关，方式如下：${figures[1]}这样，如上述这个记号就表述命题 ${math(`${variable('p')}${relation('<span class="symbol">⊃</span>')}${variable('q')}`)}。现在我想以举例的方式来考察一下命题 ${math('<span class="mathop">~</span>('+variable('p')+relation('.')+'<span class="mathop">~</span>'+variable('p')+')')}（矛盾律），看它是否为重言式。在我们的记号法中，形式“～ξ”写为：${figures[2]}形式“ξ・η”则写为：${figures[3]}因而，命题“～（p・～q）”就表为：${figures[4]}如果在这里我们用“p”代换“q”，并考察最外层的W和F与最里层的W和F的结合，那么就得出，整个命题的真相关于其主目的<u>一切</u>真值组合，而其假则不与其主目的任何真值组合相关。`

    return result
}

function stripEpubLabel(content, rawLabel) {
    const escapedLabel = rawLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return content
        .replace(
            new RegExp(
                `^\\s*${escapedLabel}(?:\\s*<sup>[\\s\\S]*?<\\/sup>)?\\s*`
            ),
            ""
        )
        .trim()
}

function parseEpub() {
    ensureSourceFiles()
    const html = fs.readFileSync(epubHtmlPath, "utf8")
    const paragraphPattern = /<p\b[^>]*class="([^"]+)"[^>]*>([\s\S]*?)<\/p>/gi
    const parsed = []
    let match
    let current

    while ((match = paragraphPattern.exec(html))) {
        const className = match[1]
        const content = cleanEpubHtml(match[2])
        if (className.includes("left-content")) {
            const plain = content.replace(/<[^>]+>/g, " ")
            const labelMatch = plain.match(/^\s*([0-9]+(?:\.[0-9]+)*)/)
            if (!labelMatch) continue
            const rawLabel = labelMatch[1]
            const label = rawLabel === "2.20" ? "2.2" : rawLabel
            current = { label, parts: [stripEpubLabel(content, rawLabel)] }
            parsed.push(current)
        } else if (current && className.includes("content") && !className.includes("chapter")) {
            if (content) current.parts.push(content)
        }
    }

    const result = {}
    parsed.forEach((item) => {
        if (expectedLabels.includes(item.label) && !result[item.label]) {
            result[item.label] = normalizeTranslationMarkup(item.parts.join("<br />"))
        }
    })
    applyFormatOverrides(result, "贺绍甲")
    assertComplete(result, "贺绍甲")
    return result
}

function parseEpubLabelsInOrder() {
    ensureSourceFiles()
    const html = fs.readFileSync(epubHtmlPath, "utf8")
    const labels = []
    const paragraphPattern = /<p\b[^>]*class="([^"]+)"[^>]*>([\s\S]*?)<\/p>/gi
    let match
    while ((match = paragraphPattern.exec(html))) {
        if (!match[1].includes("left-content")) continue
        const plain = cleanEpubHtml(match[2]).replace(/<[^>]+>/g, " ")
        const labelMatch = plain.match(/^\s*([0-9]+(?:\.[0-9]+)*)/)
        if (!labelMatch) continue
        const label = labelMatch[1] === "2.20" ? "2.2" : labelMatch[1]
        if (expectedLabels.includes(label) && !labels.includes(label)) labels.push(label)
    }
    if (labels.length !== expectedLabels.length) {
        throw new Error(`EPUB 编号不完整：找到 ${labels.length}/${expectedLabels.length} 条。`)
    }
    return labels
}

function flexibleLabelPattern(label) {
    let pattern = "^\\s*"
    for (const character of label) {
        pattern += character === "." ? "[.·\\-\\s]*" : `${character}\\s*`
    }
    if (!label.includes(".")) pattern += "[*.·\\-]?\\s*"
    return new RegExp(pattern + "(?=\\s|$)")
}

function isPdfHeading(line, label) {
    const text = line.replace(/\f/g, "").trim()
    if (!flexibleLabelPattern(label).test(text)) return false
    if (/^\d$/.test(label)) {
        const titles = {
            1: "世界是所有实际情况",
            2: "实际情况",
            3: "事实的逻辑图像是思想",
            4: "思想是有意义的命题",
            5: "一个命题是诸基本命题",
            6: "真值函项的一般形式",
            7: "对于不可言说的东西",
        }
        return text.replace(/\s+/g, "").includes(titles[label].replace(/\s+/g, ""))
    }
    return true
}

function normalizePdfLine(line) {
    return line
        .replace(/\f/g, "")
        .replace(/\s+/g, " ")
        .replace(/\s+([，。！？；：、）】》])/g, "$1")
        .replace(/([（【《])\s+/g, "$1")
        .trim()
}

function cleanPdfBlock(lines, label) {
    const body = []
    let inFootnote = false
    const seenFootnoteMarkers = new Set()
    for (let line of lines) {
        const pageBreak = line.includes("\f")
        line = normalizePdfLine(line)
        if (!line) continue
        if (inFootnote && pageBreak) {
            inFootnote = false
            continue
        }
        if (label === "1" && /^\*/.test(line)) {
            inFootnote = true
            continue
        }
        const compactLine = line.replace(/\s+/g, "")
        if (/^\d+逻辑哲学论$/.test(compactLine) || /^逻辑哲学论\d+$/.test(compactLine)) continue
        if (/^\d+\s+[一二三四五六]$/.test(line)) continue
        if (/^(?:注释|附录|目录|编译前言|总序)/.test(line)) continue
        if (
            /^(?:[1-7]\s*[.·-]?\s*)?(?:实际情况|事实的逻辑图像是思想|思想是有意义的命题|一个命题是诸基本命题|真值函项的一般形式|对于不可言说的东西)/.test(
                line
            ) && !flexibleLabelPattern(label).test(line)
        )
            continue
        if (inFootnote) continue

        const leadingMarker = line.match(/^([①②③④⑤⑥⑦⑧⑨⑩])\s*(.*)$/)
        if (leadingMarker) {
            const marker = leadingMarker[1]
            const remainder = leadingMarker[2]
            const looksLikeFootnote =
                seenFootnoteMarkers.has(marker) ||
                /^(?:[“"「《]|参\s*见|这里|所提及|关于|维特根斯坦|罗素|弗雷格|[A-Z](?:\.|\s)|在\s*(?:19|奥|德|英|《|与)|这句话|原文)/.test(
                    remainder
                )
            if (remainder && looksLikeFootnote) {
                inFootnote = true
                continue
            }
            seenFootnoteMarkers.add(marker)
            line = remainder
            if (!line) continue
        }
        const inlineMarkers = line.match(/[①②③④⑤⑥⑦⑧⑨⑩]/g) || []
        inlineMarkers.forEach((marker) => seenFootnoteMarkers.add(marker))
        line = line.replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, "")
        body.push(line)
    }
    if (!body.length) return ""

    const first = body[0]
    const labelMatch = first.match(flexibleLabelPattern(label))
    if (labelMatch) body[0] = first.slice(labelMatch[0].length).trim()
    if (!label.includes(".")) body[0] = body[0].replace(/^[*.·\-\s]+/, "")
    return body
        .join(" ")
        .replace(/\s*(?:https?\s*:\s*\/\/|www\.|商务印书|定\s*价)[\s\S]*$/i, "")
        .replace(/事实，\s*是诸基本事态的存在\s*\d+/g, "")
        .replace(/([\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])/g, "$1")
        .replace(/([，。！？；：、])\s+/g, "$1")
        .replace(/\s+/g, " ")
        .replace(/\s+([，。！？；：、）】》])/g, "$1")
        .replace(/([（【《])\s+/g, "$1")
        .trim()
}

function parseHanPdf() {
    ensureSourceFiles()
    const lines = fs.readFileSync(pdfTextPath, "utf8").split(/\r?\n/)
    const orderedLabels = parseEpubLabelsInOrder()
    const start = lines.findIndex(
        (line) =>
            line.includes("世界是所有实际情况") && !line.includes("...")
    )
    if (start < 0) throw new Error("无法在 PDF 文本中找到韩林合译文正文起点。")
    const result = {}
    let cursor = start
    for (let index = 0; index < orderedLabels.length; index++) {
        const label = orderedLabels[index]
        let heading = -1
        for (let lineIndex = cursor; lineIndex < lines.length; lineIndex++) {
            if (isPdfHeading(lines[lineIndex], label)) {
                heading = lineIndex
                break
            }
        }
        if (heading < 0) {
            throw new Error(`无法在韩林合 PDF 中定位命题 ${label}。`)
        }
        let next = lines.length
        for (let lineIndex = heading + 1; lineIndex < lines.length; lineIndex++) {
            const nextLabel = orderedLabels[index + 1]
            if (nextLabel && isPdfHeading(lines[lineIndex], nextLabel)) {
                next = lineIndex
                break
            }
        }
        result[label] = cleanPdfBlock(lines.slice(heading, next), label)
        cursor = next
    }
    // The PDF places the six short headings 6.021-6.11 before their text objects.
    // Restore their visible text from the same extracted page in visual order.
    result["6.022"] =
        "数概念只不过是所有数的共同之处，数的一般的形式。数概念是变动的数。数相同概念是所有特殊的数相同的一般的形式。"
    result["6.03"] = "整数的一般形式是：[0，ξ，ξ+1]。"
    result["6.031"] =
        "在数学中集合论完全是多余的。这点与如下事实是关联在一起的：我们在数学中所需要的那种一般性不是偶然性的。"
    result["6.1"] = "逻辑命题是同语反复式。"
    result["6.11"] = "因此，逻辑命题没有说出任何东西。（它们是分析命题。）"
    result["2.0121"] =
        "如下之点看起来好像是偶然的：一个物，本来可以独自存在，后来竟然有一个基本事态适合于它。如果诸物能出现在诸基本事态之中，那么这一点便已经包含于它们之中了。（合乎逻辑的东西不可能是仅仅-可能的。逻辑处理每一种可能性，所有可能性都是它的事实。）正如我们根本不能在空间之外设想空间对象，在时间之外设想时间对象一样，我们也不能在其与其他的对象的结合的可能性之外设想任何对象。如果我能在一个基本事态的联结之中设想一个对象，那么我就不能在这种联结的可能性之外设想它。"
    result["3.143"] = result["3.143"].replace(
        /名称[。！？；：、）】》]*$/,
        "名称。）"
    )
    result["4.014"] = result["4.014"]
        .replace("唱片，乐思、，乐谱，声波", "唱片、乐思、乐谱、声波")
        .replace(/东西[。！？；：、）】》]*$/, "东西。）")
    result["5.242"] =
        "从“p”制作出“q”的那个运算又从“q”制作出“r”，等等。这点只能表达在如下事实中：“p”、“q”、“r”等等是变项，它们一般性地表达出了某些形式关系。"
    result["5.43"] =
        "据说，对一个事实p而言，应该有无穷多个其它的事实，即～～p、～～～～p，等等，得自于它。的确，人们立即就会看出，这是难以置信的。同样令人惊异的是，无穷多个逻辑（数学）命题得自于半打“基本规律”。但是，所有逻辑命题都说出了相同的东西，即没有说出任何东西。"
    result["5.515"] =
        "如下之点必须显示自身于我们的记号之中：通过“∨”等等彼此结合在一起的东西必须是命题。事实上也的确如此，因为记号“p”和“q”本身实际上就已经预设了“∨”、“～”等等。如果出现于“p∨q”中的符号“p”所代表的不是一个复合的符号，那么就其自身而言它不可能具有意义；但是这时与“p”具有相同的意义的符号“p∨p”、“p·q”等等也不能具有意义。但是，如果“p∨p”没有意义，那么“p∨q”也不能具有意义。"
    result["6.02"] =
        "由此我们便得到了数。我给出如下定义：x = Ω<sup>0</sup>'x Def. 和 Ω'Ω<sup>v</sup>'x = Ω<sup>v+1</sup>'x Def。"
    result["5.641"] = result["5.641"].split("在与奥格登讨论")[0].trim()
    applyFormatOverrides(result, "韩林合")
    assertComplete(result, "韩林合")
    return result
}

function ensureSourceFiles() {
    if (!fs.existsSync(epubHtmlPath)) {
        fs.mkdirSync(path.dirname(epubHtmlPath), { recursive: true })
        try {
            childProcess.execFileSync(
                "tar",
                ["-xf", epubPath, "-C", path.dirname(path.dirname(epubHtmlPath))],
                { stdio: "inherit" }
            )
        } catch (error) {
            // Windows tar may report timestamp restoration warnings after extracting successfully.
            if (!fs.existsSync(epubHtmlPath)) throw error
        }
    }
    if (!fs.existsSync(pdfTextPath)) {
        fs.mkdirSync(path.dirname(pdfTextPath), { recursive: true })
        childProcess.execFileSync(
            "pdftotext",
            ["-raw", "-enc", "UTF-8", pdfPath, pdfTextPath],
            { stdio: "inherit" }
        )
    }
}

function assertComplete(result, translator) {
    const missing = expectedLabels.filter(
        (label) => !result[label] || !result[label].trim()
    )
    if (missing.length) {
        throw new Error(`${translator}译文缺少或为空：${missing.join(", ")}`)
    }
}

function writeJson(fileName, value) {
    const destination = path.join(root, "src", "data", fileName)
    fs.writeFileSync(destination, `${JSON.stringify(value, null, 4)}\n`, "utf8")
}

function main() {
    const he = parseEpub()
    const han = parseHanPdf()
    writeJson("heShaojia.json", {
        translator: "贺绍甲",
        source: "商务印书馆《逻辑哲学论》（EPUB，2009/2011）",
        sections: he,
    })
    writeJson("hanLinhe.json", {
        translator: "韩林合",
        source: "商务印书馆《维特根斯坦文集》第2卷《逻辑哲学论》（PDF，2019）",
        sections: han,
    })
    console.log(`已生成两套译文：${expectedLabels.length} 条/套。`)
}

if (require.main === module) main()

module.exports = {
    cleanEpubHtml,
    cleanPdfBlock,
    flexibleLabelPattern,
    parseEpub,
    parseEpubLabelsInOrder,
    parseHanPdf,
    stripEpubLabel,
}
