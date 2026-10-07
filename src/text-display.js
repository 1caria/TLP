export function displaySectionText(panelBody, text, panelId) {
    // Translation fragments are HTML, never URLs to pass to jQuery.load().
    panelBody.children(".text-display-li").remove()
    const body = $("<div>").addClass("text-display-li").html(text || "").appendTo(panelBody)
    body.find(".centered").filter(function () {
        return $(this).hasClass("formula") || $(this).find(".formula").length > 0
    }).wrap('<div class="formula-scroll"></div>')
    // The source also contains displayed equations between explicit line
    // breaks without a centered block. Keep each such line intact on resize.
    body.children("span.formula").each(function () {
        const before = this.previousSibling
        const after = this.nextSibling
        if (before && before.nodeName === "BR" &&
            (!after || after.nodeName === "BR" ||
                (after.nodeType === 3 && /^[。.,，\s]*$/.test(after.textContent)))) {
            $(this).wrap('<div class="formula-scroll"><div class="formula-line"></div></div>')
        }
    })
    if (typeof MathJax !== "undefined" && MathJax.Hub) {
        MathJax.Hub.Queue(["Typeset", MathJax.Hub, panelId])
    }
}
