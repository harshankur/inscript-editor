import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';

/**
 * The slash menu's state for one editor, kept in that editor's extension storage: the open
 * suggestion (or null), who renders it, and the key handler the rendered menu installs. Each
 * editor has its own, so two editors on a page never share a menu or its keyboard.
 */
export function createSlashCommandStore() {
    return {
        state: null,
        listeners: new Set(),
        onKeyDown: null, // set by the SlashCommandMenu rendering this editor's menu
        setState(newState) {
            this.state = newState;
            this.listeners.forEach(listener => listener(newState));
        },
        subscribe(listener) {
            this.listeners.add(listener);
            listener(this.state);
            return () => this.listeners.delete(listener);
        },
    };
}

/**
 * Where "/" opens the menu: an editable editor, outside code (a code block, inline code), where
 * a "/" is code and Enter must stay a line break.
 */
function allowSlashMenu({ editor, state, range }) {
    if (!editor.isEditable) return false;
    const $from = state.doc.resolve(range.from);
    if ($from.parent.type.spec.code) return false;
    const codeMark = state.schema.marks.code;
    if (codeMark && ($from.marks().some(mark => mark.type === codeMark) || state.doc.rangeHasMark(range.from, range.to, codeMark))) return false;
    return true;
}

export const SlashCommand = Extension.create({
    name: 'slashCommand',

    addOptions() {
        return {
            suggestion: {
                char: '/',
                startOfLine: false,
                command: ({ editor, range, props }) => {
                    props.command({ editor, range });
                },
                items: ({ query, editor }) => {
                    const { options } = editor.extensionManager.extensions.find(e => e.name === 'slashCommand');
                    const items = (typeof options.resolveItems === 'function' ? options.resolveItems() : options.items) || [];
                    // `title` is read here, at query time, so filtering matches the current language.
                    const q = query.toLowerCase();
                    return items.filter(item =>
                        // An item that needs a host handler is offered only while there is one.
                        (typeof item.isAvailable !== 'function' || item.isAvailable({ editor })) && (
                            String(item.title ?? '').toLowerCase().includes(q) ||
                            (item.keywords || []).some(k => String(k).toLowerCase().includes(q))
                        )
                    );
                },
                allow: allowSlashMenu,
            },
            items: [],
            /** Optional `() => items`, read at query time instead of `items` (live host items). */
            resolveItems: null,
        };
    },

    addStorage() {
        return createSlashCommandStore();
    },

    addProseMirrorPlugins() {
        const store = this.storage;
        return [
            Suggestion({
                editor: this.editor,
                // This editor's own menu state (see createSlashCommandStore).
                render: () => ({
                    onStart: (props) => store.setState({ active: true, props }),
                    onUpdate: (props) => store.setState({ active: true, props }),
                    onKeyDown: (props) => {
                        if (props.event.key === 'Escape') {
                            store.setState(null);
                            return true;
                        }
                        return store.onKeyDown ? store.onKeyDown(props.event) : false;
                    },
                    onExit: () => store.setState(null),
                }),
                ...this.options.suggestion,
            }),
        ];
    },
});
