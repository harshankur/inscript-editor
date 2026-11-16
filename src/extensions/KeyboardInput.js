import { Node, mergeAttributes } from '@tiptap/core';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { KEYBOARD_INPUT_NODE } from '../constants.js';
import { runSpacesTogether } from '../utils/spaces.js';

/** The text a key shows. */
const keyText = node => String(node.attrs.text ?? '');
/** A `<kbd>`'s text as a reader sees it: spaces and line breaks run together, none at the ends. */
const shownText = element => runSpacesTogether(element.textContent).trim();


/**
 * Keyboard input: a key to press, `<kbd>Ctrl</kbd>+<kbd>S</kbd>`. A key is a token of its own, holding
 * its text (like a citation), so two keys side by side always stay two keys, however they came to be
 * next to each other. Parsed from and written as `<kbd>`, which the editor's Markdown keeps as it is
 * (Markdown has no syntax for it). Formatting around a key (bold) stays on the key; inside it, a key
 * keeps only its text, and a `<kbd>` nested in another is one key with the outer one's text.
 *
 * `setKeyboardInput` turns the selected text into a key, `unsetKeyboardInput` turns the selected keys
 * (a key selected, or the keys in a selected range) back into text (to edit it), and
 * `toggleKeyboardInput` does whichever applies.
 */
export const KeyboardInput = Node.create({
    name: KEYBOARD_INPUT_NODE,
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,

    addOptions() {
        return { HTMLAttributes: {} };
    },

    addAttributes() {
        return {
            text: {
                default: '',
                parseHTML: element => shownText(element),
                renderHTML: () => ({}),
            },
        };
    },

    parseHTML() {
        // An empty <kbd>, or one of only spaces, is no key (as setKeyboardInput makes none): the
        // editor's Markdown could not keep it.
        return [{ tag: 'kbd', getAttrs: element => (shownText(element) ? null : false) }];
    },

    renderHTML({ node, HTMLAttributes }) {
        return ['kbd', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), keyText(node)];
    },

    renderText({ node }) {
        return keyText(node);
    },

    // The key's text is the node's text too (textContent, textBetween): a heading holding keys
    // reads whole in the outline, a cell holding one is not empty.
    extendNodeSchema(extension) {
        return extension.name === KEYBOARD_INPUT_NODE ? { leafText: node => keyText(node) } : {};
    },

    addCommands() {
        const type = () => this.type;
        /**
         * The selected text as one key: within one block that may hold a key (not code), and only
         * text (no line break, citation or key in it, which a key would swallow).
         */
        const keyFromSelection = state => {
            const { from, to, $from, $to, empty } = state.selection;
            if (empty || !$from.sameParent($to) || !$from.parent.inlineContent) return null;
            if (!$from.parent.canReplaceWith($from.index(), $to.indexAfter(), type())) return null;
            // Only text, and none of it inline code (a key in code would be written as its tag's text).
            let onlyText = true;
            state.doc.nodesBetween(from, to, node => {
                if (node.isInline && (!node.isText || node.marks.some(mark => mark.type.spec.code))) onlyText = false;
            });
            const selected = state.doc.textBetween(from, to);
            // A key needs something to show (a key of only spaces would not survive Markdown), and
            // spaces around the selected text stay outside it (a double-click often takes one along).
            const trimmed = selected.trim();
            if (!onlyText || !trimmed) return null;
            const start = from + (selected.length - selected.trimStart().length);
            const end = start + trimmed.length;
            // Its text as a <kbd> is read back: spaces inside run together.
            const text = runSpacesTogether(trimmed);
            // The key keeps the formatting all of its text shares (a bold word stays a bold key, a
            // linked one a linked key); formatting on only part of it is left off.
            let shared = null;
            state.doc.nodesBetween(start, end, node => {
                if (!node.isText) return;
                shared = shared === null ? node.marks : shared.filter(mark => mark.isInSet(node.marks));
            });
            return { key: type().create({ text }, null, shared ?? $from.marks()), from: start, to: end };
        };
        // The keys the selection holds: a selected key, or those in a selected range, by position.
        const selectedKeys = state => {
            const { selection } = state;
            if (selection instanceof NodeSelection) return selection.node.type === type() ? [{ node: selection.node, pos: selection.from }] : [];
            const found = [];
            if (!selection.empty) state.doc.nodesBetween(selection.from, selection.to, (node, pos) => { if (node.type === type()) found.push({ node, pos }); });
            return found;
        };
        return {
            setKeyboardInput: () => ({ state, tr, dispatch }) => {
                const made = keyFromSelection(state);
                if (!made) return false;
                if (dispatch) {
                    const { key, from, to } = made;
                    tr.replaceWith(from, to, key);
                    tr.setSelection(TextSelection.create(tr.doc, from + key.nodeSize));
                }
                return true;
            },
            unsetKeyboardInput: () => ({ state, tr, dispatch }) => {
                const keys = selectedKeys(state);
                if (keys.length === 0) return false;
                if (dispatch) {
                    const { from, to } = state.selection;
                    // Last first, so the positions before stay. A key with no text (from JSON, say)
                    // simply goes.
                    for (const { node, pos } of [...keys].reverse()) {
                        const text = keyText(node);
                        if (text) tr.replaceWith(pos, pos + node.nodeSize, state.schema.text(text, node.marks));
                        else tr.delete(pos, pos + node.nodeSize);
                    }
                    // The same stretch selected, now as text.
                    tr.setSelection(TextSelection.between(tr.doc.resolve(tr.mapping.map(from, -1)), tr.doc.resolve(tr.mapping.map(to, 1))));
                }
                return true;
            },
            toggleKeyboardInput: () => ({ state, commands }) => (selectedKeys(state).length > 0 ? commands.unsetKeyboardInput() : commands.setKeyboardInput()),
        };
    },
});
