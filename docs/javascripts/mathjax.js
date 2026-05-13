// MathJax configuration: lets you write inline math with $...$ and block
// math with $$...$$ inside any .md page. Don't edit unless you need to
// customise math rendering.
window.MathJax = {
  tex: {
    inlineMath: [["\\(", "\\)"]],
    displayMath: [["\\[", "\\]"]],
    processEscapes: true,
    processEnvironments: true,
  },
  options: {
    ignoreHtmlClass: ".*|",
    processHtmlClass: "arithmatex",
  },
};
