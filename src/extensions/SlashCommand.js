import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';

export const slashCommandStore = {
    state: null,
    listeners: new Set(),
    setState(newState) {
        this.state = newState;
        this.listeners.forEach(l => l(newState));
    },
    subscribe(listener) {
        this.listeners.add(listener);
        listener(this.state);
        return () => this.listeners.delete(listener);
    },
    onKeyDown: null, // Will be set by the React component
};

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
                    const items = editor.extensionManager.extensions.find(e => e.name === 'slashCommand').options.items || [];
                    // `title` is read here, at query time, so filtering matches the current language.
                    const q = query.toLowerCase();
                    return items.filter(item =>
                        String(item.title ?? '').toLowerCase().includes(q) ||
                        (item.keywords || []).some(k => String(k).toLowerCase().includes(q))
                    );
                },
                render: () => {
                    return {
                        onStart: (props) => {
                            slashCommandStore.setState({ active: true, props });
                        },
                        onUpdate: (props) => {
                            slashCommandStore.setState({ active: true, props });
                        },
                        onKeyDown: (props) => {
                            if (props.event.key === 'Escape') {
                                slashCommandStore.setState(null);
                                return true;
                            }
                            if (slashCommandStore.onKeyDown) {
                                return slashCommandStore.onKeyDown(props.event);
                            }
                            return false;
                        },
                        onExit: () => {
                            slashCommandStore.setState(null);
                        },
                    };
                }
            },
            items: [],
        };
    },

    addProseMirrorPlugins() {
        return [
            Suggestion({
                editor: this.editor,
                ...this.options.suggestion,
            }),
        ];
    },
});
