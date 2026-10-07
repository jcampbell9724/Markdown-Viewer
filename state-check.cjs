const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function createElement() {
  const classes = new Set();
  return {
    textContent: '', innerHTML: '', disabled: false, clicks: 0,
    attributes: {}, events: {},
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
      toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name)
    },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, fn) { (this.events[name] ||= []).push(fn); },
    dispatch(name, event = {}) { for (const fn of this.events[name] || []) fn(event); },
    click() { this.clicks += 1; this.dispatch('click'); }
  };
}
const ids = ['inputWorkspace', 'dropZone', 'sidebarToggle', 'railOpenButton', 'closeButton', 'openButton', 'fileInput', 'importTitle', 'importHint', 'preview', 'previewTitle'];
const elements = Object.fromEntries(ids.map(id => [id, createElement()]));
const shell = createElement();
const document = { title: '', querySelector: () => shell, getElementById: id => elements[id] };
let onReady;
class FixtureFileReader {
  readAsText(file) { this.result = file.content; this.onload(); }
}
vm.runInNewContext(fs.readFileSync(require.resolve('./app.js'), 'utf8'), {
  document,
  window: { addEventListener: (name, fn) => { if (name === 'DOMContentLoaded') onReady = fn; } },
  FileReader: FixtureFileReader
});
onReady();
assert.equal(document.title, 'Markdown Viewer');
assert.match(elements.preview.innerHTML, /Drop a file/);
assert.equal(elements.closeButton.disabled, true);
elements.openButton.click();
assert.equal(elements.fileInput.clicks, 1);
const selection = { files: [{ name: 'notes.md', content: '# Imported\n\n**Ready**' }], value: 'notes.md' };
elements.fileInput.dispatch('change', { target: selection });
assert.equal(selection.value, '');
assert.equal(elements.previewTitle.textContent, 'Imported');
assert.equal(elements.importTitle.textContent, 'notes.md');
assert.equal(document.title, 'Imported - Markdown Viewer');
assert.match(elements.preview.innerHTML, /<strong>Ready<\/strong>/);
assert.equal(shell.classList.contains('has-document'), true);
assert.equal(shell.classList.contains('sidebar-expanded'), false);
elements.sidebarToggle.click();
assert.equal(shell.classList.contains('sidebar-expanded'), true);
assert.equal(elements.sidebarToggle.attributes['aria-expanded'], 'true');
elements.railOpenButton.click();
assert.equal(elements.fileInput.clicks, 2);
elements.closeButton.click();
assert.equal(shell.classList.contains('has-document'), false);
assert.equal(elements.closeButton.disabled, true);
assert.equal(document.title, 'Markdown Viewer');
let prevented = false;
elements.dropZone.dispatch('keydown', { key: 'Enter', preventDefault() { prevented = true; } });
assert.equal(prevented, true);
assert.equal(elements.fileInput.clicks, 3);
elements.inputWorkspace.dispatch('drop', {
  preventDefault() {},
  dataTransfer: { files: [{ name: 'fallback.txt', content: 'No heading here.' }] }
});
assert.equal(elements.previewTitle.textContent, 'fallback');
assert.equal(document.title, 'fallback - Markdown Viewer');
elements.fileInput.dispatch('change', { target: { files: [{ name: 'empty.md', content: '' }], value: 'empty.md' } });
assert.equal(shell.classList.contains('has-document'), false);
assert.match(elements.preview.innerHTML, /Drop a file/);
console.log('PASS import, replacement, title fallback, reset, sidebar, keyboard-open and empty-file integration checks.');
