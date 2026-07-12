import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Edit2, Check, X, Search } from 'lucide-react';

export const BibliographyPanel = ({ editor }) => {
    const { t } = useTranslation('inscript-editor');
    const [citations, setCitations] = useState([]);
    const [editingKey, setEditingKey] = useState(null);
    const [editLabel, setEditLabel] = useState('');
    const [editTitle, setEditTitle] = useState('');

    // Extract unique citation entries from editor doc
    const extractCitations = () => {
        if (!editor || !editor.state) return;
        const map = new Map();
        editor.state.doc.descendants((node, pos) => {
            if (node.type.name === 'citation') {
                const { key, label, title } = node.attrs;
                if (key) {
                    if (!map.has(key)) {
                        map.set(key, { key, label, title, positions: [] });
                    }
                    map.get(key).positions.push(pos);
                }
            }
        });
        const sortedList = Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
        setCitations(sortedList);
    };

    useEffect(() => {
        if (!editor) return;

        editor.on('update', extractCitations);
        extractCitations();

        return () => {
            editor.off('update', extractCitations);
        };
    }, [editor]);

    // Go to first occurrence in the document
    const handleNavigate = (pos) => {
        if (!editor || pos === undefined) return;
        editor.chain().focus().setTextSelection(pos).scrollIntoView().run();
    };

    // Start editing attributes for a key
    const startEditing = (cite) => {
        setEditingKey(cite.key);
        setEditLabel(cite.label);
        setEditTitle(cite.title || '');
    };

    const cancelEditing = () => {
        setEditingKey(null);
    };

    // Save changes and update all nodes with this key
    const saveEditing = (key) => {
        if (!editor) return;
        const { state, view } = editor;
        let tr = state.tr;
        let changed = false;

        state.doc.descendants((node, pos) => {
            if (node.type.name === 'citation' && node.attrs.key === key) {
                tr = tr.setNodeMarkup(pos, null, {
                    ...node.attrs,
                    label: editLabel,
                    title: editTitle
                });
                changed = true;
            }
        });

        if (changed) {
            view.dispatch(tr);
            extractCitations();
        }
        setEditingKey(null);
    };

    if (!editor) return null;

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
            {/* Header */}
            <div className="flex items-center gap-2 p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 shrink-0">
                <BookOpen size={16} className="text-zinc-500" />
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    {t('bibliography', 'Bibliography')}
                </h3>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {citations.length === 0 ? (
                    <div className="text-sm text-zinc-500 dark:text-zinc-400 italic text-center py-8">
                        {t('noCitations', 'No citations in document')}
                    </div>
                ) : (
                    citations.map((cite) => {
                        const isEditing = editingKey === cite.key;

                        return (
                            <div
                                key={cite.key}
                                className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/10 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors flex flex-col gap-2 relative group"
                            >
                                {isEditing ? (
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1.5 py-0.5 rounded shrink-0">
                                                @{cite.key}
                                            </span>
                                            <div className="flex-1" />
                                            <button
                                                onClick={() => saveEditing(cite.key)}
                                                className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-emerald-600"
                                                title="Save"
                                            >
                                                <Check size={14} />
                                            </button>
                                            <button
                                                onClick={cancelEditing}
                                                className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-red-500"
                                                title="Cancel"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider block mb-1">
                                                Inline Label
                                                <input
                                                    type="text"
                                                    value={editLabel}
                                                    onChange={(e) => setEditLabel(e.target.value)}
                                                    className="w-full mt-1 text-sm px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
                                                />
                                            </label>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider block mb-1">
                                                Full Citation Entry
                                                <textarea
                                                    value={editTitle}
                                                    onChange={(e) => setEditTitle(e.target.value)}
                                                    rows={2}
                                                    className="w-full mt-1 text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white resize-none"
                                                />
                                            </label>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleNavigate(cite.positions[0])}
                                                className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 px-1.5 py-0.5 rounded cursor-pointer shrink-0 transition-colors"
                                                title="Locate in text"
                                            >
                                                @{cite.key}
                                            </button>
                                            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">
                                                [{cite.label}]
                                            </span>
                                            <div className="flex-1" />
                                            <button
                                                onClick={() => startEditing(cite)}
                                                className="p-1 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 transition-opacity"
                                                title="Edit citation"
                                            >
                                                <Edit2 size={13} />
                                            </button>
                                        </div>
                                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed italic break-words">
                                            {cite.title || t('noTitle', 'No bibliography details set.')}
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
