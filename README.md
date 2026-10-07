# Markdown Viewer

A small static web app for opening a local Markdown document and reading a formatted preview. Built with HTML, CSS, and vanilla JavaScript, including a custom parser. No AI model, backend, package installation, or build step is required.

## Try it

1. Open `index.html` in a modern browser, or serve this folder with any static web server.
2. Choose **Open file** or drag a Markdown text file into the import area. The file picker suggests `.md`, `.markdown`, and `.txt`; drag-and-drop reads the first dropped file as text.
3. On desktop, importing a nonempty document collapses the import panel. Use **+** to open another file, the arrow to expand the panel, and **x** to clear the preview.

At widths of 960px or less, the import panel stays above the preview and the desktop sidebar controls are hidden. **Open file** remains available to replace the document.

## Supported preview features

- Headings, paragraphs, emphasis, strikethrough, and horizontal rules
- Ordered and unordered lists, simple nested lists, and read-only task checkboxes
- Blockquotes, backtick code fences, and inline code
- Pipe tables with column alignment
- Links and images

The preview title uses the first level-one heading, or the filename when no such heading is found.

## Data and content handling

Files are read in the browser with `FileReader`. The app has no upload endpoint, analytics, account system, or document persistence; reloading clears the imported document.

Raw HTML in Markdown is displayed as text. Links allow HTTP, HTTPS, mailto, and relative URLs; images allow HTTP, HTTPS, and relative URLs. Unsupported or executable schemes are removed, retaining the link label or image alt text. Control characters and backslashes in URLs are rejected.

Remote images can still make network requests when a document is previewed, and clicking links can open external sites. This is not a guarantee that arbitrary untrusted documents are private or harmless. Review their links and image sources before opening them.

## Scope and limitations

This is a compact custom parser, not a complete CommonMark or GitHub Flavored Markdown implementation. In particular, complex nested syntax, escaped pipe characters inside tables, URLs containing parentheses, alternate code fences, and indented code blocks are not comprehensively supported. Code blocks receive a language class but no syntax highlighting. Relative image/link paths resolve against the viewer's location, not the imported file's folder.

Only one document is open at a time. There is no editor, export, search, file-size limit, or visible file-read error handling. Very large files can slow the browser.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App shell, controls, and metadata |
| `styles.css` | Responsive layout and reading styles |
| `app.js` | File import, application state, and Markdown parsing |
| `favicon.svg` | App icon |
| `robots.txt` | Crawl policy for static hosting |
| `smoke-check.cjs` | Parser smoke checks and input/rendering regression checks |
| `state-check.cjs` | Import and control integration checks using a minimal DOM fixture |

## Checks

With Node.js installed, run:

```sh
node smoke-check.cjs
node state-check.cjs
```

These checks cover supported syntax, raw HTML escaping, URL restrictions, character escaping, import/reset behavior, and desktop sidebar state. The state fixture does not replace testing browser file pickers, drag-and-drop, or responsive layout.

