import { inertPreviewNodes } from '../../src/utils/previewHtml.js';

/**
 * The history preview's nodes (inertPreviewNodes) as HTML, for tests to read. Never shown: the editor
 * inserts the nodes themselves, and HTML parsed again could bring markup back to life.
 * @param {string} html
 * @param {(source: string) => string} [placeholderText]
 */
export function inertPreviewHtml(html, placeholderText) {
    const nodes = inertPreviewNodes(html, placeholderText);
    if (!nodes) return '';
    const holder = document.createElement('template');
    holder.content.appendChild(nodes);
    return holder.innerHTML;
}
