const assert = require('node:assert/strict');
const { parseMarkdown, parseInline, normalizeMarkdown } = require('./app.js');
let checks = 0;
function check(name, test) { test(); checks += 1; console.log('PASS ' + name); }
check('Windows and classic Mac line endings normalize', () => assert.equal(normalizeMarkdown('a\r\nb\rc'), 'a\nb\nc'));
check('headings, emphasis and plain paragraphs render', () => {
  const output = parseMarkdown('# Read me\n\nA **strong** and *emphasized* paragraph.');
  assert.match(output, /<h1>Read me<\/h1>/);
  assert.match(output, /<strong>strong<\/strong>/);
  assert.match(output, /<em>emphasized<\/em>/);
});
check('task-list state is present and read-only', () => {
  const output = parseMarkdown('- [x] Complete\n- [ ] Pending');
  assert.match(output, /type="checkbox" disabled checked/);
  assert.match(output, /type="checkbox" disabled>/);
});
check('nested bullet list and numbered list render', () => {
  assert.match(parseMarkdown('- Parent\n  - Child'), /<ul><li>Parent<ul><li>Child/);
  assert.match(parseMarkdown('1. First\n2. Second'), /<ol><li>First<\/li><li>Second/);
});
check('tables preserve right and center alignment', () => {
  const output = parseMarkdown('| Item | Cost |\n| :---: | ---: |\n| Widget | 12 |');
  assert.match(output, /<th style="text-align:center">Item/);
  assert.match(output, /<td style="text-align:right">12/);
});
check('blockquotes, rules and fenced code render', () => {
  assert.match(parseMarkdown('> Quoted\n\n---\n\n```js\nconst x = "<ok>";\n```'), /<blockquote>/);
  assert.match(parseMarkdown('---'), /<hr>/);
  assert.match(parseMarkdown('```js\nconst x = "<ok>";\n```'), /class="language-js">const x = &quot;&lt;ok&gt;&quot;;/);
});
check('basic links and images render', () => {
  assert.match(parseInline('[Example](https://example.com)'), /href="https:\/\/example.com"/);
  assert.match(parseInline('![Example](https://example.com/image.png)'), /alt="Example"/);
});
check('raw HTML does not become active markup', () => {
  const output = parseMarkdown('<script>alert(1)</script>');
  assert.doesNotMatch(output, /<script>/);
  assert.match(output, /&lt;script&gt;/);
});
check('empty input produces an import prompt', () => assert.match(parseMarkdown('  \n'), /Drop a file/));
console.log(`${checks} existing functionality checks passed.`);
check('inline code escapes special characters exactly once', () => assert.equal(parseInline('`a < b & c`'), '<code>a &lt; b &amp; c</code>'));
check('link query strings and labels escape exactly once', () => {
  assert.equal(parseInline('[A & B](https://example.com/?a=1&b=2)'), '<a href="https://example.com/?a=1&amp;b=2" target="_blank" rel="noreferrer">A &amp; B</a>');
});
check('inline code in link labels is restored', () => {
  assert.equal(parseInline('[Read `a < b`](https://example.com)'), '<a href="https://example.com" target="_blank" rel="noreferrer">Read <code>a &lt; b</code></a>');
});
check('literal internal-token-like text stays visible', () => {
  assert.equal(parseInline('@@MDINLINE0@@ and `code`'), '@@MDINLINE0@@ and <code>code</code>');
});
check('executable, local-file and unsupported link schemes become plain text', () => {
  for (const scheme of ['javascript:payload', 'JaVaScRiPt:payload', 'vbscript:payload', 'data:text/html,hello', 'file:///secret', 'java\u0000script:payload']) {
    assert.equal(parseInline(`[Read](${scheme})`), 'Read');
  }
});
check('allowed link types remain available', () => {
  for (const url of ['HTTPS://example.com', 'mailto:hello@example.com', '#section', './notes.md', '/docs', '//example.com/docs']) {
    assert.match(parseInline(`[Read](${url})`), /<a href=/);
  }
});
check('unsafe image schemes are removed while their alt text remains', () => {
  assert.equal(parseInline('![A & B](data:image/svg+xml,payload)'), 'A &amp; B');
  assert.equal(parseInline('![Preview](file:///secret.png)'), 'Preview');
  assert.match(parseInline('![Preview](https://example.com/img.png)'), /<img src="https:\/\/example.com\/img.png"/);
});
console.log(`${checks} total parser checks passed.`);
