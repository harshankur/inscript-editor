import { Extension } from '@tiptap/core';
import { GapCursor } from '@tiptap/pm/gapcursor';
import { closeHistory } from '@tiptap/pm/history';
import { Fragment, Slice } from '@tiptap/pm/model';
import { dropPoint } from '@tiptap/pm/transform';
import { Plugin, PluginKey, Selection, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { NODE } from '../constants.js';
import { editorT, onEditorLanguageChanged } from '../utils/editorT.js';
import { documentImageSrc } from '../utils/url.js';
import { followEditable, getHostHandlers } from './HostBridge.js';
import { deleteKeepingDisclosures } from './Details.js';

/** The host handler an image file goes through: a file in, the image's src (or attributes) out. */
export const IMAGE_FILE_HANDLER = 'onImageFile';

/** Where an image file came from, as the host's handler is told. */
export const IMAGE_FILE_SOURCE = Object.freeze({ DROP: 'drop', PASTE: 'paste', PICK: 'pick' });

/** The extension's name in the editor. */
export const IMAGE_FILES_EXTENSION = 'imageFiles';

const IMAGE_TYPE = /^image\//;
// How long after Shift with the paste keys a paste is theirs (as text).
const PLAIN_PASTE_WINDOW_MS = 1000;
// A file the browser gave no type, or only "some bytes" (a format the system does not know, such as
// HEIC on some systems), by its name.
const UNKNOWN_TYPE = 'application/octet-stream';
const SVG_TYPE = /^image\/svg/i;
const SVG_NAME = /\.svgz?$/i;
const IMAGE_NAME = /\.(?:apng|avif|bmp|gif|heic|heif|ico|jfif|jpe?g|jxl|png|tiff?|webp)$/i;
const PLACEHOLDER_CLASS = 'inscript-image-placeholder';

export const imageFilesKey = new PluginKey(IMAGE_FILES_EXTENSION);

/**
 * The host's image-file handler for this editor (an <InscriptEditor> prop or the editorOptions one,
 * through the host bridge, like every host handler); null when none.
 * @param {import('@tiptap/core').Editor | null | undefined} editor
 * @returns {((file: File, info: object) => unknown) | null}
 */
export function imageFileHandler(editor) {
    const handle = getHostHandlers(editor)[IMAGE_FILE_HANDLER];
    return typeof handle === 'function' ? handle : null;
}

/**
 * Whether a paste's or a drop's text is only the files' names (a file copied in a file manager) or
 * none: other text (cells or styled text copied with a picture of them, and no HTML) is the content.
 */
function textIsOnlyNames(plain, files) {
    const lines = (plain ?? '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const names = new Set(Array.from(files ?? [], file => file?.name));
    return lines.every(line => names.has(line) || names.has(lastPathPart(line)));
}

/** A path's or a URL's last part, decoded, without a query or fragment: the file it names. */
function lastPathPart(line) {
    const path = line.replace(/^file:\/\//i, '').replace(/[?#].*$/, '');
    const last = path.split(/[\\/]/).pop() ?? '';
    try {
        return decodeURIComponent(last);
    } catch {
        return last;
    }
}

/**
 * Whether a drop's or a paste's HTML is only the picture of its files (a browser's or an office
 * app's copied image: <img> and nothing to read), so the files are what is taken, through the
 * host. HTML with anything else (a web page's text, office cells) is the content itself.
 */
function htmlIsOnlyImages(html, page) {
    const parsed = new (page.defaultView?.DOMParser ?? DOMParser)().parseFromString(html, 'text/html');
    const { body } = parsed;
    if (body.textContent.trim() || !body.querySelector('img')) return false;
    // A linked image is more than its picture: its link goes with the HTML.
    return !body.querySelector('a[href], table, ul, ol, pre, iframe, video, audio, svg, object, embed');
}

/** The image files among a list of files (a drop's or a paste's), in their order. */
export function imageFilesOf(files) {
    return Array.from(files ?? []).filter(file => {
        // Never an SVG: it is a document that can hold script, which runs on the host's own site
        // once the host stores the file there and it is opened by its address.
        if (SVG_TYPE.test(file?.type ?? '') || SVG_NAME.test(file?.name ?? '')) return false;
        return file?.type && file.type !== UNKNOWN_TYPE ? IMAGE_TYPE.test(file.type) : IMAGE_NAME.test(file?.name ?? '');
    });
}

/**
 * A drop's or a paste's image files, when they are what it brings (else null): its HTML, if any, only their picture
 * (a copied image), and its text, without HTML, none or their names (a copied file). HTML or text
 * with more (a web page, office cells with a picture of them) is the content, read as before.
 */
function filesAreTheContent(data, view) {
    const images = imageFilesOf(data.files);
    if (!images.length) return null;
    const html = data.getData('text/html');
    const theContent = html ? htmlIsOnlyImages(html, view.dom.ownerDocument) : textIsOnlyNames(data.getData('text/plain'), data.files);
    return theContent ? images : null;
}

/** Whether this editor takes image files: the extension is in it, there is a handler, and it can be edited. */
const takesImageFiles = (editor, handle) => typeof handle === 'function' && !!editor?.isEditable
    && !!imageFilesKey.getState(editor.state) && !!editor.schema.nodes[NODE.IMAGE];

/**
 * The image node attributes a handler's result gives: a src string, or an object with `src` (and
 * `alt`, `title`); null for anything else (the file is then not taken).
 */
function imageAttrsOf(result) {
    if (typeof result === 'string') {
        const src = documentImageSrc(result);
        return src ? { src } : null;
    }
    if (!result || typeof result !== 'object') return null;
    const src = documentImageSrc(result.src);
    if (!src) return null;
    const attrs = { src };
    if (typeof result.alt === 'string') attrs.alt = result.alt;
    if (typeof result.title === 'string') attrs.title = result.title;
    return attrs;
}

/** A batch's placeholder: where it is now (mapped through every change since), and the range its images replace. */
const pendingOf = (state, id) => imageFilesKey.getState(state)?.placeholders.get(id) ?? null;

/** The batches whose images are still to come, each with what aborts its handler's signal (per editor). */
const abortsOf = editor => editor.storage[IMAGE_FILES_EXTENSION]?.aborts ?? null;

/**
 * The range a batch's images replace, after a change: null once what was selected is gone or was
 * typed over (deleted at either edge), or once it was changed within (typed in), so nothing but what
 * was selected, as it was, is deleted in its place. Text typed at either edge stays outside it.
 */
function mapReplaced(range, tr) {
    if (!range) return null;
    const from = tr.mapping.mapResult(range.from, 1);
    const to = tr.mapping.mapResult(range.to, -1);
    if (from.deletedAfter || to.deletedBefore || to.pos <= from.pos) return null;
    // Typed in (or otherwise changed within): not replaced.
    if (!tr.doc.slice(from.pos, to.pos).content.eq(range.content)) return null;
    return { from: from.pos, to: to.pos, content: range.content };
}

/**
 * Where an image can go for a position: in a line, there (the line is split round it), but not into
 * code, which it would split: after the code block. Between blocks where an image cannot be (between
 * a table's cells, a list's items), the nearest place it can, as ProseMirror drops a block.
 */
function imageSpot(doc, pos) {
    const $pos = doc.resolve(pos);
    if ($pos.parent.type.spec.code) return $pos.after();
    if ($pos.parent.inlineContent) return pos;
    const image = doc.type.schema.nodes[NODE.IMAGE].create();
    if ($pos.parent.canReplaceWith($pos.index(), $pos.index(), image.type)) return pos;
    return dropPoint(doc, pos, new Slice(Fragment.from(image), 0, 0)) ?? pos;
}

/**
 * A cursor right at a position: in a line, there; between blocks, at the start of the next block's
 * first line when nothing comes before it (a paragraph, a list's first item), else a gap cursor
 * there (typing makes a line), else at the end of the line just before; null where none can be.
 * Never one in text further on (past a rule, in a table).
 */
function cursorAt(doc, pos) {
    const $pos = doc.resolve(pos);
    if ($pos.parent.inlineContent) return TextSelection.create(doc, pos);
    let inner = pos;
    let node = $pos.nodeAfter;
    // Into a list or a quote, not a table (its cells are not lines after the image).
    while (node && !node.isTextblock && !node.isAtom && !node.type.spec.isolating && node.firstChild) {
        inner += 1;
        node = node.firstChild;
    }
    if (node?.isTextblock) return TextSelection.create(doc, inner + 1);
    if (GapCursor.valid($pos)) return new GapCursor($pos);
    // Right after a line (no gap cursor beside a line): at its end.
    return $pos.nodeBefore?.isTextblock ? TextSelection.create(doc, pos - 1) : null;
}

// A placeholder's element, in the editor's language as it changes (its listener goes with it).
const placeholderListeners = new WeakMap();

function placeholderWidget(editor) {
    const element = editor.view.dom.ownerDocument.createElement('span');
    element.className = PLACEHOLDER_CLASS;
    element.setAttribute('role', 'status');
    const say = () => { element.textContent = editorT('imageLoading', 'Loading image…', {}, editor); };
    say();
    placeholderListeners.set(element, onEditorLanguageChanged(editor, say));
    return element;
}

// On the left of what goes in at its spot: text typed there comes after the images, as if they had
// gone in at once.
const placeholder = (editor, pos, id) => Decoration.widget(pos, () => placeholderWidget(editor), {
    id,
    side: -1,
    key: `${PLACEHOLDER_CLASS}-${id}`,
    destroy: element => {
        placeholderListeners.get(element)?.();
        placeholderListeners.delete(element);
    },
});

/**
 * The placeholders after a transaction. Each keeps to the left of what goes in at its spot, and is
 * dropped only when what was on both sides of it is deleted (its spot is gone); a step replacing the
 * token on one side (a block put in at a paragraph's end or start replaces its closing or opening)
 * leaves it. Those at the spot a batch's images just went in to are put by the order the batches
 * were taken: earlier ones before the images, later ones after.
 */
function mapPlaceholders(tr, placeholders, inserted) {
    const next = new Map();
    for (const [id, { pos, replacing, cursor }] of placeholders) {
        let at;
        const ordered = inserted && id !== inserted.id && pos === inserted.spot;
        if (ordered) {
            at = id < inserted.id ? inserted.from : inserted.to;
        } else {
            const mapped = tr.mapping.mapResult(pos, -1);
            if (mapped.deletedAcross) continue;
            at = mapped.pos;
        }
        // A batch replacing a range shows where that range starts (text typed before it stays before),
        // unless just put in order with the images gone in at its spot.
        const replaced = mapReplaced(replacing, tr);
        next.set(id, { pos: replaced && !ordered ? replaced.from : at, replacing: replaced, cursor: cursor === null ? null : tr.mapping.map(cursor, -1) });
    }
    return next;
}

let nextId = 0;

/**
 * Put the image a file gave where its placeholder is, replacing the selection it was taken over
 * (when there was one, it is still there and no other image replaced it first), and drop the
 * placeholder, in one undo step of its own. A cursor that stayed where it goes, or on the selection
 * it replaces, follows it in; one moved elsewhere stays there. An image that cannot go in (its spot
 * is gone, the editor is read-only now, or it does not fit there) changes nothing and aborts the
 * handler's signal, for the host to drop what it stored; no image given is the host's own choice.
 */
function putImage(editor, id, result) {
    const { state } = editor;
    const pending = pendingOf(state, id);
    const abort = abortsOf(editor)?.get(id);
    abortsOf(editor)?.delete(id);
    // Nothing given is the host's own choice; something given that does not go in, for any reason
    // (a src refused, the spot gone, read-only, no fit), aborts the signal.
    const attrs = result == null ? null : imageAttrsOf(result);
    const drop = () => {
        if (result != null) abort?.abort();
        if (pendingOf(editor.state, id)) editor.view.dispatch(editor.state.tr.setMeta(imageFilesKey, { remove: id }));
    };
    // Aborted already (made read-only meanwhile, even if editable again): the host was told it would
    // not go in.
    if (!pending || !attrs || !editor.isEditable || !abort || abort.signal.aborted) {
        drop();
        return;
    }
    const where = pending.pos;
    // Not over code: the image goes after the code block, which is kept whole. (One changed within
    // since is no longer one to replace: see mapReplaced.)
    const range = pending.replacing && imageSpot(state.doc, where) === where ? pending.replacing : null;
    const { selection } = state;
    // The cursor the files were taken with (a drop's, beside the spot) counts as there.
    const follow = range ? selection.from === range.from && selection.to === range.to
        : selection.empty && (selection.from === where || selection.from === pending.cursor);

    // Its own undo step: not joined to the typing before it, nor (closed again once it is in) to
    // typing straight after it.
    const tr = closeHistory(state.tr);
    // In place of the range replaced (text typed at its edges stays round it), else at the spot.
    if (range) deleteKeepingDisclosures(tr, range.from, range.to);
    const at = imageSpot(tr.doc, range ? range.from : tr.mapping.map(where, -1));
    const before = tr.doc;
    const stepsBefore = tr.steps.length;
    tr.replaceRangeWith(at, at, state.schema.nodes[NODE.IMAGE].create(attrs));
    if (tr.doc.eq(before)) {
        drop();
        return;
    }
    // Where the image now is: from the start to the end of what the steps put in, each mapped
    // through the steps after it (a position at a replaced range's edge maps to it either way). Its
    // own steps only, not the deletion of the range it replaces.
    let from = null;
    let to = null;
    tr.mapping.maps.slice(stepsBefore).forEach((map, i) => map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
        const after = tr.mapping.slice(stepsBefore + i + 1);
        from = Math.min(from ?? Infinity, after.map(newStart, -1));
        to = Math.max(to ?? -Infinity, after.map(newEnd, 1));
    }));
    tr.setMeta(imageFilesKey, { remove: id, inserted: { id, spot: where, from: from ?? at, to: to ?? at } });
    // A cursor following it goes right after it (not onto the image, which typing would replace): see
    // cursorAt, or on a new empty line when nothing follows it.
    if (follow) {
        const end = to ?? at;
        const $end = tr.doc.resolve(end);
        const line = $end.nodeAfter ? null : $end.parent.contentMatchAt($end.index()).defaultType;
        if (line?.isTextblock && !$end.parent.inlineContent && $end.parent.canReplaceWith($end.index(), $end.index(), line)) {
            tr.insert(end, line.create());
            tr.setSelection(TextSelection.create(tr.doc, end + 1));
        } else {
            tr.setSelection(cursorAt(tr.doc, end) ?? Selection.near($end, 1));
        }
    } else {
        tr.setSelection(selection.map(tr.doc, tr.mapping));
    }
    editor.view.dispatch(tr);
    editor.view.dispatch(closeHistory(editor.state.tr));
}

/**
 * Take image files into the editor: at a position (a drop), or in place of the selection (a paste,
 * a pick). Each goes through the host's handler, which gives the src to show (a data URL, or where
 * the host stored the file), and goes in, as soon as it is read, where they were put, in the order
 * the files came, however the document changed meanwhile. A file the handler gives nothing for (or
 * fails on) is left out, and a selection is replaced only once an image comes; with no handler,
 * nothing is taken.
 * @param {import('@tiptap/core').Editor} editor
 * @param {ArrayLike<File>} files
 * @param {number | null} pos - Where they go, or null for in place of the selection.
 * @param {string} source - One of IMAGE_FILE_SOURCE.
 * @param {((file: File, info: object) => unknown) | null} [handle] - The handler; the editor's by default.
 * @returns {boolean} Whether the files were taken (some are images and a handler is set).
 */
export function takeImageFiles(editor, files, pos, source, handle = imageFileHandler(editor)) {
    const images = imageFilesOf(files);
    if (!images.length || !takesImageFiles(editor, handle)) return false;
    take(editor, images, pos, source, handle);
    return true;
}

/** takeImageFiles once it is known the editor takes these images (they are images, it has a handler). */
function take(editor, images, pos, source, handle) {
    const { state } = editor;
    const { selection } = state;
    const at = imageSpot(state.doc, pos === null ? selection.from : pos);
    // What a paste or pick replaces: one selected range (text, a node, the whole document), not
    // several (cells) or code (the images go after the code block, which is kept).
    const replacing = pos === null && !selection.empty && selection.ranges.length === 1 && at === selection.from
        ? { from: selection.from, to: selection.to, content: state.doc.slice(selection.from, selection.to).content }
        : null;
    // One placeholder per file, all at the spot: each image goes in once its file is read, a slow one
    // holding up none of the others, and they keep the files' order (see mapPlaceholders).
    const batches = images.map(file => ({ file, id: ++nextId, abort: new AbortController() }));
    for (const { id, abort } of batches) abortsOf(editor)?.set(id, abort);
    const tr = state.tr;
    // A drop puts the cursor (and the focus) where the images go, as dropped content does: they then
    // take it along as they go in. See cursorAt: never a block selected there, which typing would replace.
    if (source === IMAGE_FILE_SOURCE.DROP) {
        const there = cursorAt(tr.doc, at);
        if (there) tr.setSelection(there);
    }
    const cursor = tr.selection.empty ? tr.selection.from : null;
    tr.setMeta(imageFilesKey, { add: batches.map(({ id }) => ({ id, pos: at, replacing, cursor })) });
    editor.view.dispatch(tr);
    if (source === IMAGE_FILE_SOURCE.DROP) editor.view.focus();

    for (const { file, id, abort } of batches) {
        // Called at once (a throw, like a rejection, gives nothing).
        new Promise(resolve => resolve(handle(file, { editor, source, signal: abort.signal })))
            .catch(() => null)
            .then(result => { if (!editor.isDestroyed) putImage(editor, id, result); })
            // Whatever failed on the way in (a plugin's or a listener's error): with the placeholder
            // still there, the image did not go in, so its signal aborts and the placeholder goes.
            .catch(() => {
                abortsOf(editor)?.delete(id);
                if (editor.isDestroyed || !pendingOf(editor.state, id)) return;
                abort.abort();
                editor.view.dispatch(editor.state.tr.setMeta(imageFilesKey, { remove: id }));
            });
    }
}

/**
 * Open the browser's file picker for images and take the chosen ones at the selection (the
 * toolbar's and the slash menu's Image, when the host has no media library of its own). The input
 * is in the page while the picker is open, as some browsers open none for a detached one: at the
 * end of the page, out of the host's own elements (a form around the editor), or in the modal
 * dialog the editor is in (the rest of the page is inert then). Its events go no further.
 * @param {import('@tiptap/core').Editor} editor
 * @param {((file: File, info: object) => unknown) | null} [handle] - The handler; the editor's by default.
 */
export function pickImageFiles(editor, handle = imageFileHandler(editor)) {
    // One left by a picker cancelled where the input says nothing of it (no cancel event).
    const storage = editor.storage[IMAGE_FILES_EXTENSION];
    storage?.picker?.remove();
    const page = editor.view.dom.ownerDocument;
    const input = page.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');
    input.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;';
    const done = () => {
        input.remove();
        if (storage?.picker === input) storage.picker = null;
    };
    if (storage) storage.picker = input;
    input.addEventListener('change', () => {
        done();
        if (!editor.isDestroyed) takeImageFiles(editor, input.files, null, IMAGE_FILE_SOURCE.PICK, handle);
    }, { once: true });
    input.addEventListener('cancel', done, { once: true });
    for (const type of ['change', 'input', 'cancel']) input.addEventListener(type, event => event.stopPropagation());
    (editor.view.dom.closest('dialog[open]') ?? page.body).appendChild(input);
    input.click();
}

/**
 * The Image action of the toolbar and the slash menu: the host's media library when it has one,
 * else the browser's file picker with the chosen files going through the image-file handler (the
 * one given, else the editor's); null with neither.
 * @param {import('@tiptap/core').Editor} editor
 * @param {(() => void) | null | undefined} library
 * @param {((file: File, info: object) => unknown) | null | undefined} [onImageFile]
 * @returns {(() => void) | null}
 */
export function imageAction(editor, library, onImageFile) {
    if (typeof library === 'function') return library;
    const handle = typeof onImageFile === 'function' ? onImageFile : imageFileHandler(editor);
    return takesImageFiles(editor, handle) ? () => pickImageFiles(editor, handle) : null;
}

/**
 * Image files dropped or pasted into the editor go through the host's `onImageFile` handler
 * (editorOptions or an <InscriptEditor> prop). Without one they are not taken, as before.
 */
export const ImageFiles = Extension.create({
    name: IMAGE_FILES_EXTENSION,
    // Ahead of the link and YouTube paste handlers: a copied file can carry its name as text.
    priority: 1100,

    // aborts: the batches still reading; picker: the file input of a picker still open (or left by
    // one cancelled without a word); plainPaste: when the paste keys were pressed with Shift (as text).
    addStorage() {
        return { aborts: new Map(), picker: null, plainPaste: 0, stopFollowing: null };
    },

    // Made read-only (see followEditable), the editor takes none of the files
    // still read: all abort, and their placeholders go.
    onBeforeCreate() {
        const { editor, storage } = this;
        storage.stopFollowing = followEditable(editor, editable => {
            if (editable || !storage.aborts.size) return;
            const { placeholders } = imageFilesKey.getState(editor.state) ?? { placeholders: new Map() };
            const dropped = [...storage.aborts.keys()].filter(id => placeholders.has(id));
            for (const abort of storage.aborts.values()) abort.abort();
            storage.aborts.clear();
            // Once the update that says so is over (not from within it), and only those: any put in
            // since, with the editor editable again, stay.
            if (dropped.length) {
                queueMicrotask(() => {
                    if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(imageFilesKey, { drop: dropped }));
                });
            }
        });
    },

    // Closing the editor aborts the handlers still reading, for the host to stop or drop them, and
    // takes away its picker's input.
    onDestroy() {
        this.storage.stopFollowing?.();
        for (const abort of this.storage.aborts.values()) abort.abort();
        this.storage.aborts.clear();
        this.storage.picker?.remove();
        this.storage.picker = null;
    },

    addProseMirrorPlugins() {
        const { editor, storage } = this;
        return [
            new Plugin({
                key: imageFilesKey,
                // The placeholders by batch (where each is, and the range its images are to replace),
                // and the widgets that show them.
                state: {
                    init: () => ({ placeholders: new Map(), decorations: DecorationSet.empty }),
                    apply(tr, current, _oldState, newState) {
                        const meta = tr.getMeta(imageFilesKey);
                        let next = tr.docChanged && current.placeholders.size ? mapPlaceholders(tr, current.placeholders, meta?.inserted) : current.placeholders;
                        const gone = [...(meta?.drop ?? []), ...(meta?.remove ? [meta.remove] : [])].filter(id => next.has(id));
                        if (meta?.add || gone.length) {
                            next = new Map(next);
                            for (const { id, pos, replacing, cursor } of meta.add ?? []) next.set(id, { pos, replacing, cursor });
                            for (const id of gone) next.delete(id);
                        }
                        if (next === current.placeholders) return current;
                        // The widgets mapped along, unless that leaves them elsewhere than the placeholders
                        // (one added, gone, reordered, or kept where a widget is not): then drawn again.
                        const mapped = current.decorations.map(tr.mapping, tr.doc);
                        const drawn = mapped.find();
                        if (drawn.length === next.size && drawn.every(d => next.get(d.spec.id)?.pos === d.from)) {
                            return { placeholders: next, decorations: mapped };
                        }
                        const widgets = [...next].map(([id, { pos }]) => placeholder(editor, pos, id));
                        return { placeholders: next, decorations: DecorationSet.create(newState.doc, widgets) };
                    },
                },
                // A batch whose placeholder went (its spot deleted) before its file was read: its
                // handler's signal aborts, so the host can stop the upload.
                view: () => ({
                    update: view => {
                        const aborts = abortsOf(editor);
                        if (!aborts?.size) return;
                        const { placeholders } = imageFilesKey.getState(view.state);
                        for (const [id, abort] of aborts) {
                            if (placeholders.has(id)) continue;
                            abort.abort();
                            aborts.delete(id);
                        }
                    },
                }),
                props: {
                    decorations: state => imageFilesKey.getState(state).decorations,
                    // Image files, unless what came with them is the content (see filesAreTheContent).

                    handleDrop: (view, event, _slice, moved) => {
                        const data = event.dataTransfer;
                        const handle = imageFileHandler(editor);
                        // Not an editor's own content dragged (moved or copied, here or from another
                        // editor): that goes as it is, the image node with its size and place.
                        if (moved || view.dragging || !data || /data-pm-slice/.test(data.getData('text/html'))) return false;
                        if (!takesImageFiles(editor, handle)) return false;
                        const images = filesAreTheContent(data, view);
                        const at = images && view.posAtCoords({ left: event.clientX, top: event.clientY });
                        if (!at) return false;
                        take(editor, images, at.pos, IMAGE_FILE_SOURCE.DROP, handle);
                        return true;
                    },
                    // Paste as text (Shift with the paste keys: V, or the key where V is on a layout
                    // without it): the paste they make, straight after, is not the files. Over once a key
                    // is let go, or a moment later (a paste from a menu later on is not that one).
                    handleKeyDown: (_view, event) => {
                        const pasteKey = event.key?.toLowerCase() === 'v' || event.code === 'KeyV';
                        storage.plainPaste = event.shiftKey && (event.metaKey || event.ctrlKey) && pasteKey ? Date.now() : 0;
                        return false;
                    },
                    handleDOMEvents: {
                        keyup: () => {
                            storage.plainPaste = 0;
                            return false;
                        },
                    },
                    handlePaste: (view, event) => {
                        const plain = storage.plainPaste && Date.now() - storage.plainPaste < PLAIN_PASTE_WINDOW_MS;
                        storage.plainPaste = 0;
                        if (plain) return false;
                        const data = event.clipboardData;
                        const handle = imageFileHandler(editor);
                        const images = data && takesImageFiles(editor, handle) ? filesAreTheContent(data, view) : null;
                        if (!images) return false;
                        take(editor, images, null, IMAGE_FILE_SOURCE.PASTE, handle);
                        return true;
                    },
                },
            }),
        ];
    },
});
