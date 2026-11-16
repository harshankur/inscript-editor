/**
 * Values a document may not keep, whichever way they come. HTML is read without them (see CustomImage
 * and InscriptLink); content given as JSON (a new editor's, setContent, insertContent, a command) is
 * cleaned here as HTML would have been read, so getJSON() never holds them either:
 * - an image whose source is refused (see documentImageSrc) is left out, as HTML's is never read as an
 *   image, and a protocol-relative one is kept as the web address it means;
 * - a link whose address is refused (see allowedLinkHref) is its text, as HTML's is, and a link's
 *   target, rel and class are the host's (see InscriptLink), never the document's;
 * - an image's and a video's size and placement, a video's id, a code block's language, a text
 *   alignment and a font size are kept as HTML is read (capped, a name only: see NODE_VALUES and
 *   MARK_VALUES).
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { changedRange, perTransaction, replacesWholeDocument } from '../utils/transactions.js';
import { documentImageSrc } from '../utils/url.js';
import { cssLength, imageHeight, layoutAlign } from '../utils/layout.js';
import { codeLanguage } from '../utils/codeLanguage.js';
import { normalizeFontSize } from './FontSize.js';
import { isYoutubeId } from '../utils/youtubeUrl.js';
import { TextAlign } from '@tiptap/extension-text-align';
import { mapJsonNodes } from '../utils/jsonContent.js';
import { HOST_LINK_ATTRS, allowedLinkHref } from './InscriptLink.js';
import { unpackedJsonTables } from './CustomTable.js';
import { TABLE_GROWTH_LIMIT, boundedJsonCell, boundedJsonTable, jsonTableExcess } from '../utils/tableSize.js';

const IMAGE = 'image';
const LINK = 'link';
const TABLE = 'table';

/** Text alignments a paragraph or heading may have: TipTap's TextAlign's own (configured here with its types only). */
const TEXT_ALIGNMENTS = Object.freeze([...(TextAlign.options?.alignments ?? ['left', 'center', 'right', 'justify'])]);
const textAlign = value => (TEXT_ALIGNMENTS.includes(value) ? value : null);
/**
 * Attributes a node or mark keeps only as HTML is read (see each extension's parseHTML), with what
 * keeps each: an image's and a video's size and placement, a video's id, a code block's language, a
 * text alignment, a font size.
 */
const NODE_VALUES = Object.freeze({
    image: { width: cssLength, height: imageHeight, align: layoutAlign },
    youtube: { 'data-youtube-video': value => (isYoutubeId(value) ? value : null), width: cssLength, align: layoutAlign },
    codeBlock: { language: codeLanguage },
    paragraph: { textAlign },
    heading: { textAlign },
});
const MARK_VALUES = Object.freeze({
    textStyle: { fontSize: normalizeFontSize },
});
/** Attribute names any of those keep (an attribute step setting one is checked). */
const KEPT_ATTRS = new Set(['src', ...Object.values(NODE_VALUES).flatMap(Object.keys), ...Object.values(MARK_VALUES).flatMap(Object.keys)]);

/** The changes `attrs` need to be as `keeps` keeps them (attributes not given are left to their defaults). */
function keptValueChanges(keeps, attrs) {
    const changes = {};
    if (!keeps || !attrs) return changes;
    for (const [name, keep] of Object.entries(keeps)) {
        if (attrs[name] === null || attrs[name] === undefined) continue;
        const kept = keep(attrs[name]);
        // The same value written otherwise (a size of 24 as `'24'`) is left as it is.
        if (kept !== attrs[name] && String(kept) !== String(attrs[name])) changes[name] = kept;
    }
    return changes;
}
const hasChanges = changes => Object.keys(changes).length > 0;
const documentValuesKey = new PluginKey('inscriptDocumentValues');

/** The link extension's options and HTMLAttributes (the host's), or null when links are off. */
function linkOptionsOf(editor) {
    const link = editor?.extensionManager?.extensions.find(extension => extension.name === LINK);
    return link ? link.options : null;
}

/** A link mark's attributes as the editor keeps them, or null when it is no link (its address refused). */
function keptLinkAttrs(options, attrs) {
    const href = allowedLinkHref(options, attrs?.href);
    if (href === null) return null;
    const host = options.HTMLAttributes ?? {};
    return { ...attrs, href, ...Object.fromEntries(HOST_LINK_ATTRS.map(name => [name, host[name] ?? null])) };
}

const sameAttrs = (a, b) => Object.keys(b).every(key => a?.[key] === b[key]);

/** A JSON node with its values as the editor keeps them (see the top of this file), or null to leave it out. */
function keptJsonValues(node, linkOptions) {
    let kept = node;
    if (node.type === IMAGE) {
        const src = documentImageSrc(node.attrs?.src);
        if (src === null) return null;
        if (src !== node.attrs.src) kept = { ...kept, attrs: { ...kept.attrs, src } };
    }
    const changes = keptValueChanges(NODE_VALUES[node.type], kept.attrs);
    if (hasChanges(changes)) kept = { ...kept, attrs: { ...kept.attrs, ...changes } };
    if (!Array.isArray(kept.marks)) return kept;
    const marks = kept.marks.flatMap(mark => {
        if (mark?.type === LINK) {
            if (!linkOptions) return [mark];
            const attrs = keptLinkAttrs(linkOptions, mark.attrs);
            return attrs ? [{ ...mark, attrs }] : [];
        }
        const markChanges = keptValueChanges(MARK_VALUES[mark?.type], mark?.attrs);
        return [hasChanges(markChanges) ? { ...mark, attrs: { ...mark.attrs, ...markChanges } } : mark];
    });
    return marks.length === kept.marks.length && marks.every((mark, index) => mark === kept.marks[index]) ? kept : { ...kept, marks };
}

/**
 * A JSON node whose content a left-out image emptied, filled as its node type requires (a document, a
 * quote or a cell holds at least a paragraph), as HTML's parser fills it; else itself.
 */
function filledAsRequired(schema, node) {
    if (!node || !Array.isArray(node.content) || node.content.length) return node;
    const type = schema?.nodes?.[node.type];
    if (!type || type.contentMatch.validEnd) return node;
    const filled = type.createAndFill();
    return filled ? { ...node, content: filled.toJSON().content ?? [] } : node;
}

/** Content given as a ProseMirror node, as the JSON it holds (cleaned as any JSON); anything else as it is. */
const asJson = content => (content && typeof content === 'object' && typeof content.toJSON === 'function' && content.type?.schema ? content.toJSON() : content);

/**
 * Content given to a new editor (JSON, or a ProseMirror node as the JSON it holds) made safe before
 * anything is drawn, in one walk: its values (see the top of this file) and its cells' spans and
 * column widths kept as the editor keeps them (see boundedJsonCell), then its tables bounded (see unpackedJsonTables) when they come to more
 * than TABLE_GROWTH_LIMIT excess cells. Anything else (HTML, which the parser makes safe) as it is.
 * @param {import('@tiptap/core').Editor} editor
 * @param {unknown} given
 */
export function cleanedContent(editor, given) {
    const content = asJson(given);
    if (!content || typeof content !== 'object' || Array.isArray(content) || content.type !== 'doc') return given;
    const linkOptions = linkOptionsOf(editor);
    let excess = 0;
    let cleaned;
    try {
        cleaned = mapJsonNodes(content, node => {
            const kept = filledAsRequired(editor?.schema, keptJsonValues(node, linkOptions));
            if (kept === null) return null;
            if (kept.type !== TABLE) return boundedJsonCell(kept);
            const table = boundedJsonTable(kept);
            excess += jsonTableExcess(table);
            return table;
        });
    } catch {
        // Content too odd to walk (it is not plain JSON): left to TipTap, which refuses what it cannot read.
        return given;
    }
    return excess > TABLE_GROWTH_LIMIT && editor?.schema ? unpackedJsonTables(editor.schema, cleaned) : cleaned;
}

/**
 * Whether a node or mark may need its values kept here: an image or a link always (their checks need
 * more than the value), any other only when a value is not as kept (a paragraph put in with its
 * alignment as kept needs nothing).
 */
const keepsNode = node => node.type.name === IMAGE || hasChanges(keptValueChanges(NODE_VALUES[node.type.name], node.attrs));
const keepsMark = mark => mark.type.name === LINK || hasChanges(keptValueChanges(MARK_VALUES[mark.type.name], mark.attrs));

/** Whether a transaction may bring values kept here (content put in, a mark added, an attribute set). */
const bringsValues = perTransaction(tr => tr.steps.some(step => {
    if ((step.mark && keepsMark(step.mark)) || KEPT_ATTRS.has(step.attr)) return true;
    let found = false;
    step.slice?.content.descendants(node => {
        if (found) return false;
        if (keepsNode(node) || node.marks.some(keepsMark)) found = true;
        return !found;
    });
    return found;
}));

function documentValuesPlugin(editor) {
    // The link extension's options, looked up once (the extensions do not change).
    let foundLinkOptions;
    const linkOptionsNow = () => (foundLinkOptions === undefined ? (foundLinkOptions = linkOptionsOf(editor)) : foundLinkOptions);
    return new Plugin({
        key: documentValuesKey,
        appendTransaction(transactions, _oldState, state) {
            const changed = transactions.filter(tr => tr.docChanged);
            if (!changed.length || !changed.some(bringsValues)) return null;
            const range = changed.some(replacesWholeDocument) ? { from: 0, to: state.doc.content.size } : changedRange(changed);
            if (!range) return null;
            const linkOptions = linkOptionsNow();
            const removed = [];
            const nodeChanges = [];
            const marks = [];
            state.doc.nodesBetween(Math.max(0, range.from), Math.min(range.to, state.doc.content.size), (node, pos) => {
                const src = node.type.name === IMAGE ? documentImageSrc(node.attrs.src) : undefined;
                if (src === null) {
                    removed.push({ pos, size: node.nodeSize });
                    return false;
                }
                const changes = keptValueChanges(NODE_VALUES[node.type.name], node.attrs);
                if (src !== undefined && src !== node.attrs.src) changes.src = src;
                if (hasChanges(changes)) nodeChanges.push({ pos, changes });
                // Marks on any inline node (text, or an atom: a formula, a line break).
                for (const mark of node.isInline ? node.marks : []) {
                    if (mark.type.name === LINK) {
                        if (!linkOptions) continue;
                        const attrs = keptLinkAttrs(linkOptions, mark.attrs);
                        if (!attrs || !sameAttrs(mark.attrs, attrs)) marks.push({ from: pos, to: pos + node.nodeSize, mark, attrs });
                        continue;
                    }
                    const markChanges = keptValueChanges(MARK_VALUES[mark.type.name], mark.attrs);
                    if (hasChanges(markChanges)) marks.push({ from: pos, to: pos + node.nodeSize, mark, attrs: { ...mark.attrs, ...markChanges } });
                }
                return !node.isLeaf;
            });
            if (!removed.length && !nodeChanges.length && !marks.length) return null;
            const tr = state.tr;
            // Attributes and marks first (they move nothing), then the images left out, last to first.
            for (const { pos, changes } of nodeChanges) {
                for (const [name, value] of Object.entries(changes)) tr.setNodeAttribute(pos, name, value);
            }
            for (const { from, to, mark, attrs } of marks) {
                tr.removeMark(from, to, mark);
                if (attrs) tr.addMark(from, to, mark.type.create(attrs));
            }
            for (let index = removed.length - 1; index >= 0; index--) tr.delete(removed[index].pos, removed[index].pos + removed[index].size);
            return tr;
        },
    });
}


/** Always on: see the top of this file. */
export const DocumentValues = Extension.create({
    name: 'documentValues',
    // Content given to a new editor, made safe before the first drawing (see cleanedContent): the one
    // place it is.
    onBeforeCreate() {
        const { editor } = this;
        if (editor?.options) editor.options.content = cleanedContent(editor, editor.options.content);
    },
    addProseMirrorPlugins() {
        return [documentValuesPlugin(this.editor)];
    },
});
