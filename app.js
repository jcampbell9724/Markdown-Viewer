function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function normalizeMarkdown(markdown) {
  return markdown.replace(/\r\n?/g, "\n");
}

function isHorizontalRule(line) {
  return /^\s{0,3}((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})\s*$/.test(line);
}

function isTableSeparator(line) {
  if (!line.includes("|")) {
    return false;
  }

  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }

  const normalized = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  return normalized
    .split("|")
    .map((segment) => segment.trim())
    .every((segment) => /^:?-{1,}:?$/.test(segment));
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function getAlignmentToken(segment) {
  const trimmed = segment.trim();
  if (trimmed.startsWith(":") && trimmed.endsWith(":")) {
    return "center";
  }
  if (trimmed.endsWith(":")) {
    return "right";
  }
  if (trimmed.startsWith(":")) {
    return "left";
  }
  return "";
}

function parseInline(markdown) {
  const protectedTokens = [];
  let html = escapeHtml(markdown);

  function protect(fragment) {
    const token = `@@INLINE${protectedTokens.length}@@`;
    protectedTokens.push(fragment);
    return token;
  }

  html = html.replace(/`([^`]+?)`/g, (_, code) => {
    return protect(`<code>${escapeHtml(code)}</code>`);
  });

  html = html.replace(/!\[([^\]]*?)\]\((\S+?)(?:\s+"(.*?)")?\)/g, (_, alt, src, title = "") => {
    const titleAttribute = title ? ` title="${escapeAttribute(title)}"` : "";
    return protect(`<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}"${titleAttribute}>`);
  });

  html = html.replace(/\[([^\]]+?)\]\((\S+?)(?:\s+"(.*?)")?\)/g, (_, text, href, title = "") => {
    const titleAttribute = title ? ` title="${escapeAttribute(title)}"` : "";
    return protect(`<a href="${escapeAttribute(href)}"${titleAttribute} target="_blank" rel="noreferrer">${parseInline(text)}</a>`);
  });

  html = html.replace(/(^|[^\w])\*\*(.+?)\*\*(?!\*)/g, (_, prefix, text) => `${prefix}<strong>${text}</strong>`);
  html = html.replace(/(^|[^\w])__(.+?)__(?!_)/g, (_, prefix, text) => `${prefix}<strong>${text}</strong>`);
  html = html.replace(/(^|[^\w])\*(.+?)\*(?!\*)/g, (_, prefix, text) => `${prefix}<em>${text}</em>`);
  html = html.replace(/(^|[^\w])_(.+?)_(?!_)/g, (_, prefix, text) => `${prefix}<em>${text}</em>`);
  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");

  html = html.replace(/@@INLINE(\d+)@@/g, (_, index) => protectedTokens[Number(index)] || "");
  return html;
}

function createParagraph(lines) {
  const text = lines.join(" ").trim();
  if (!text) {
    return "";
  }
  return `<p>${parseInline(text)}</p>`;
}

function parseTable(lines, startIndex) {
  const headerCells = splitTableRow(lines[startIndex]);
  const alignments = splitTableRow(lines[startIndex + 1]).map(getAlignmentToken);
  const bodyLines = [];
  let cursor = startIndex + 2;

  while (cursor < lines.length) {
    const line = lines[cursor];
    if (!line.trim() || !line.includes("|")) {
      break;
    }
    bodyLines.push(line);
    cursor += 1;
  }

  const thead = `<thead><tr>${headerCells
    .map((cell, index) => {
      const align = alignments[index] ? ` style="text-align:${alignments[index]}"` : "";
      return `<th${align}>${parseInline(cell)}</th>`;
    })
    .join("")}</tr></thead>`;

  const tbody = `<tbody>${bodyLines
    .map((line) => {
      const cells = splitTableRow(line);
      return `<tr>${headerCells
        .map((_, index) => {
          const value = cells[index] ?? "";
          const align = alignments[index] ? ` style="text-align:${alignments[index]}"` : "";
          return `<td${align}>${parseInline(value)}</td>`;
        })
        .join("")}</tr>`;
    })
    .join("")}</tbody>`;

  return {
    html: `<table>${thead}${tbody}</table>`,
    nextIndex: cursor
  };
}

function parseList(lines, startIndex, baseIndent = 0) {
  const firstMatch = lines[startIndex].match(/^(\s*)([-+*]|\d+\.)\s+(.*)$/);
  if (!firstMatch) {
    return null;
  }

  const listIndent = firstMatch[1].length;
  const ordered = /\d+\./.test(firstMatch[2]);
  const tag = ordered ? "ol" : "ul";
  const items = [];
  let cursor = startIndex;
  let taskList = false;

  while (cursor < lines.length) {
    const match = lines[cursor].match(/^(\s*)([-+*]|\d+\.)\s+(.*)$/);
    if (!match) {
      break;
    }

    const indent = match[1].length;
    if (indent < listIndent || indent < baseIndent) {
      break;
    }
    if (indent > listIndent) {
      break;
    }

    cursor += 1;
    const rawContent = match[3];
    const nestedLines = [];

    while (cursor < lines.length) {
      const nextLine = lines[cursor];
      const nextMatch = nextLine.match(/^(\s*)([-+*]|\d+\.)\s+(.*)$/);
      const nextIndentMatch = nextLine.match(/^(\s*)/);
      const nextIndent = nextIndentMatch ? nextIndentMatch[1].length : 0;

      if (!nextLine.trim()) {
        cursor += 1;
        break;
      }

      if (nextMatch && nextIndent === listIndent) {
        break;
      }

      if (nextIndent <= listIndent && nextLine.trim()) {
        break;
      }

      nestedLines.push(nextLine.slice(Math.min(nextLine.length, listIndent + 2)));
      cursor += 1;
    }

    while (cursor < lines.length && !lines[cursor].trim()) {
      cursor += 1;
    }

    const taskMatch = rawContent.match(/^\[( |x|X)\]\s+(.*)$/);
    let itemContent = "";

    if (taskMatch) {
      taskList = true;
      const checked = taskMatch[1].toLowerCase() === "x" ? " checked" : "";
      itemContent += `<label><input type="checkbox" disabled${checked}> <span>${parseInline(taskMatch[2])}</span></label>`;
    } else {
      itemContent += parseInline(rawContent);
    }

    const cleanedNested = nestedLines.join("\n").trim();
    if (cleanedNested) {
      itemContent += parseBlocks(cleanedNested);
    }

    items.push(`<li>${itemContent}</li>`);
  }

  const className = taskList ? ` class="task-list"` : "";
  return {
    html: `<${tag}${className}>${items.join("")}</${tag}>`,
    nextIndex: cursor
  };
}

function parseBlockquote(lines, startIndex) {
  const quoteLines = [];
  let cursor = startIndex;

  while (cursor < lines.length) {
    const line = lines[cursor];
    if (!line.trim()) {
      quoteLines.push("");
      cursor += 1;
      continue;
    }

    const match = line.match(/^\s{0,3}>\s?(.*)$/);
    if (!match) {
      break;
    }

    quoteLines.push(match[1]);
    cursor += 1;
  }

  return {
    html: `<blockquote>${parseBlocks(quoteLines.join("\n"))}</blockquote>`,
    nextIndex: cursor
  };
}

function parseCodeFence(lines, startIndex) {
  const opener = lines[startIndex].match(/^```([a-zA-Z0-9_-]+)?\s*$/);
  if (!opener) {
    return null;
  }

  const language = opener[1] || "";
  const codeLines = [];
  let cursor = startIndex + 1;

  while (cursor < lines.length && !/^```/.test(lines[cursor])) {
    codeLines.push(lines[cursor]);
    cursor += 1;
  }

  if (cursor < lines.length) {
    cursor += 1;
  }

  const languageClass = language ? ` class="language-${escapeAttribute(language)}"` : "";
  return {
    html: `<pre><code${languageClass}>${escapeHtml(codeLines.join("\n"))}</code></pre>`,
    nextIndex: cursor
  };
}

function parseBlocks(markdown) {
  const lines = normalizeMarkdown(markdown).split("\n");
  const chunks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const codeFence = parseCodeFence(lines, index);
    if (codeFence) {
      chunks.push(codeFence.html);
      index = codeFence.nextIndex;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      chunks.push(`<h${level}>${parseInline(headingMatch[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (isHorizontalRule(line)) {
      chunks.push("<hr>");
      index += 1;
      continue;
    }

    if (index + 1 < lines.length && line.includes("|") && isTableSeparator(lines[index + 1])) {
      const table = parseTable(lines, index);
      chunks.push(table.html);
      index = table.nextIndex;
      continue;
    }

    if (/^\s{0,3}>\s?/.test(line)) {
      const quote = parseBlockquote(lines, index);
      chunks.push(quote.html);
      index = quote.nextIndex;
      continue;
    }

    if (/^(\s*)([-+*]|\d+\.)\s+/.test(line)) {
      const list = parseList(lines, index);
      if (list) {
        chunks.push(list.html);
        index = list.nextIndex;
        continue;
      }
    }

    const paragraphLines = [line];
    index += 1;

    while (index < lines.length) {
      const nextLine = lines[index];
      if (!nextLine.trim()) {
        break;
      }
      if (
        /^```/.test(nextLine) ||
        /^(#{1,6})\s+/.test(nextLine) ||
        isHorizontalRule(nextLine) ||
        /^\s{0,3}>\s?/.test(nextLine) ||
        /^(\s*)([-+*]|\d+\.)\s+/.test(nextLine) ||
        (nextLine.includes("|") && index + 1 < lines.length && isTableSeparator(lines[index + 1]))
      ) {
        break;
      }

      paragraphLines.push(nextLine);
      index += 1;
    }

    chunks.push(createParagraph(paragraphLines));
  }

  return chunks.join("\n");
}

function parseMarkdown(markdown) {
  const normalized = normalizeMarkdown(markdown).trim();
  if (!normalized) {
    return `<div class="empty-state"><p>Drop a file to preview it.</p></div>`;
  }
  return parseBlocks(normalized);
}

function extractFirstHeading(content) {
  const match = normalizeMarkdown(content).match(/^\s{0,3}#\s+(.*?)\s*#*\s*$/m);
  return match ? match[1].trim() : "";
}

function stripExtension(fileName) {
  return fileName.replace(/\.[^./\\]+$/, "");
}

function derivePreviewTitle(state) {
  const heading = extractFirstHeading(state.content);
  if (heading) {
    return heading;
  }
  if (state.fileName) {
    return stripExtension(state.fileName);
  }
  return "No document";
}

function deriveImportTitle(state) {
  if (state.fileName) {
    return state.fileName;
  }
  return "Drop Markdown";
}

function deriveImportHint(state) {
  if (state.fileName) {
    return "Drop or open another file";
  }
  return ".md .markdown .txt";
}

function createState() {
  return {
    fileName: "",
    content: ""
  };
}

function applyState(state, elements) {
  const previewTitle = derivePreviewTitle(state);
  const hasContent = Boolean(state.content.trim());

  elements.importTitle.textContent = deriveImportTitle(state);
  elements.importHint.textContent = deriveImportHint(state);
  elements.previewTitle.textContent = previewTitle;
  elements.preview.innerHTML = parseMarkdown(state.content);
  elements.preview.classList.toggle("is-empty", !hasContent);
}

function readFile(file, onLoad) {
  const reader = new FileReader();
  reader.onload = () => {
    onLoad({
      fileName: file.name,
      content: typeof reader.result === "string" ? reader.result : ""
    });
  };
  reader.readAsText(file);
}

function initApp() {
  const elements = {
    appShell: document.querySelector(".app-shell"),
    workspace: document.getElementById("inputWorkspace"),
    dropZone: document.getElementById("dropZone"),
    sidebarToggle: document.getElementById("sidebarToggle"),
    railOpenButton: document.getElementById("railOpenButton"),
    closeButton: document.getElementById("closeButton"),
    openButton: document.getElementById("openButton"),
    fileInput: document.getElementById("fileInput"),
    importTitle: document.getElementById("importTitle"),
    importHint: document.getElementById("importHint"),
    preview: document.getElementById("preview"),
    previewTitle: document.getElementById("previewTitle")
  };

  let state = createState();
  let isSidebarExpanded = false;

  function syncShellState() {
    const hasContent = Boolean(state.content.trim());
    if (!hasContent) {
      isSidebarExpanded = false;
    }

    elements.appShell.classList.toggle("has-document", hasContent);
    elements.appShell.classList.toggle("sidebar-expanded", hasContent && isSidebarExpanded);
    elements.closeButton.disabled = !hasContent;
    elements.sidebarToggle.textContent = hasContent && isSidebarExpanded ? "<" : ">";
    elements.sidebarToggle.setAttribute("aria-expanded", String(hasContent && isSidebarExpanded));
    elements.sidebarToggle.setAttribute(
      "aria-label",
      hasContent && isSidebarExpanded ? "Collapse import panel" : "Expand import panel"
    );
    document.title = hasContent ? `${derivePreviewTitle(state)} - Markdown Viewer` : "Markdown Viewer";
  }

  applyState(state, elements);
  syncShellState();

  function setState(nextState) {
    state = nextState;
    applyState(state, elements);
    syncShellState();
  }

  function handleFileSelection(file) {
    if (!file) {
      return;
    }

    readFile(file, (nextState) => {
      isSidebarExpanded = false;
      setState(nextState);
    });
  }

  elements.openButton.addEventListener("click", () => {
    elements.fileInput.click();
  });

  elements.railOpenButton.addEventListener("click", () => {
    elements.fileInput.click();
  });

  elements.closeButton.addEventListener("click", () => {
    state = createState();
    applyState(state, elements);
    syncShellState();
  });

  elements.sidebarToggle.addEventListener("click", () => {
    if (!state.content.trim()) {
      return;
    }
    isSidebarExpanded = !isSidebarExpanded;
    syncShellState();
  });

  elements.fileInput.addEventListener("change", (event) => {
    const [file] = event.target.files || [];
    handleFileSelection(file);
    event.target.value = "";
  });

  function activateDropState(event) {
    if (event) {
      event.preventDefault();
    }
    elements.dropZone.classList.add("is-dragging");
  }

  function deactivateDropState() {
    elements.dropZone.classList.remove("is-dragging");
  }

  ["dragenter", "dragover"].forEach((eventName) => {
    elements.workspace.addEventListener(eventName, activateDropState);
    elements.dropZone.addEventListener(eventName, activateDropState);
  });

  ["dragleave", "dragend", "drop"].forEach((eventName) => {
    elements.workspace.addEventListener(eventName, deactivateDropState);
    elements.dropZone.addEventListener(eventName, deactivateDropState);
  });

  elements.workspace.addEventListener("drop", (event) => {
    event.preventDefault();
    const [file] = event.dataTransfer.files || [];
    handleFileSelection(file);
  });

  elements.dropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      elements.fileInput.click();
    }
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener("DOMContentLoaded", initApp);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    parseMarkdown,
    parseInline,
    normalizeMarkdown
  };
}
