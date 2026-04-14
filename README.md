# Markdown Viewer

A lightweight static Markdown viewer with a collapsible import sidebar and a full formatted reading pane.

## Features

- Drag and drop Markdown files directly into the import panel
- Open files manually with the centered file picker button
- Collapse the import area into a compact sticky sidebar while reading
- Clear the current document with the sidebar close button
- Render headings, lists, task lists, blockquotes, code fences, tables, links, and images
- Run entirely as static files with no build step or server requirement

## Project Files

- `index.html` contains the app shell and SEO metadata
- `styles.css` contains the sidebar layout, responsive behavior, and document styling
- `app.js` handles file import, sidebar state, and Markdown parsing
- `robots.txt` provides a basic crawl policy if the app is hosted

## Usage

1. Open `index.html` in a browser.
2. Drop a `.md`, `.markdown`, or `.txt` file into the import area, or use `Open file`.
3. When a document is loaded, use the `+` button to open another file, the arrow to expand the import panel, or `x` to clear the current document.

## Notes

- The app is fully client-side and reads files locally in the browser.
- SEO metadata is included for static hosting, but no canonical URL or sitemap is generated because no production domain is defined.
