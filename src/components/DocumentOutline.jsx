import React, { useEffect, useState } from 'react';
import { extractHeadings } from '../utils/headingExtraction.js';
import { ChevronRight, List as ListIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { hasView } from '../utils/editorView.js';

const STORAGE_KEY = 'inscript-outline-collapsed';
// Storage can throw (sandboxed iframes, blocked site data, some privacy modes): the
// collapsed state is a convenience, so fall back to "expanded" and never crash.
const readCollapsed = () => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
};
const writeCollapsed = (value) => {
    try { localStorage.setItem(STORAGE_KEY, String(value)); } catch { /* ignore */ }
};

/**
 * The document's headings as a clickable outline.
 *
 * @param {object} props
 * @param {import('@tiptap/core').Editor|null} props.editor
 * @param {string}  [props.width]        - CSS width for the expanded panel (default 16rem).
 * @param {string}  [props.className]    - Extra classes appended to the root.
 * @param {boolean} [props.chrome]       - Default true. False renders just the list, with no header,
 *                                          border, background or fixed width, filling its container:
 *                                          for hosting the outline inside your own panel.
 * @param {boolean} [props.collapsible]  - Default true. False removes the collapse button and ignores
 *                                          the stored collapsed state. Implied by `chrome={false}`.
 */
export const DocumentOutline = ({ editor, width, className = '', chrome = true, collapsible = true }) => {
    const { t } = useTranslation('inscript-editor');
    const [headings, setHeadings] = useState([]);

    // Without its header there is no button to expand it again, so a chrome-less outline can't
    // collapse; a stored "collapsed" state is ignored whenever collapsing is off.
    const canCollapse = chrome && collapsible;
    const [storedCollapsed, setIsCollapsed] = useState(readCollapsed);
    const isCollapsed = canCollapse && storedCollapsed;

    useEffect(() => {
        if (!editor) return;

        const updateHeadings = () => {
            setHeadings(extractHeadings(editor));
        };
        // Any doc change, not only 'update': TipTap skips 'update' for content set with
        // emitUpdate: false (a version restore, a quiet load), and those change the headings too.
        const onTransaction = ({ transaction }) => {
            if (transaction.docChanged) updateHeadings();
        };

        editor.on('transaction', onTransaction);
        updateHeadings();

        return () => {
            editor.off('transaction', onTransaction);
        };
    }, [editor]);

    const handleToggleCollapse = () => {
        const next = !storedCollapsed;
        setIsCollapsed(next);
        writeCollapsed(next);
    };

    const handleClick = (pos) => {
        if (!hasView(editor)) return;
        // Place the caret at the heading, then scroll the heading itself to the TOP of the viewport.
        // The old `.scrollIntoView()` (ProseMirror's minimum-scroll) put a heading at the top when it
        // was above the view but at the bottom when it was below - inconsistent. Scroll the node's DOM
        // with `block: 'start'` so a clicked heading always lands at the top (matches the minimap).
        // `focus()` defaults to its own minimum-scroll (which is the inconsistent behavior); disable it
        // so ours is the only scroll, then align the heading's DOM node to the TOP.
        editor.chain().setTextSelection(pos).focus(null, { scrollIntoView: false }).run();
        let dom = null;
        try { dom = editor.view.nodeDOM(pos); } catch { /* stale position after an edit */ }
        if (dom && typeof dom.scrollIntoView === 'function') {
            dom.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
    };

    if (!editor) return null;

    if (isCollapsed) {
        return (
            <div className={`flex flex-col border-l border-[var(--inscript-color-border)] bg-[var(--inscript-color-surface-raised)] w-12 shrink-0 transition-all ${className}`}>
                <button
                    onClick={handleToggleCollapse}
                    className="p-3 text-[var(--inscript-color-muted)] hover:text-[var(--inscript-color-text)] flex justify-center"
                    title={t('expandOutline', 'Expand outline')}
                >
                    <ListIcon size={18} />
                </button>
            </div>
        );
    }

    return (
        <div
            className={`flex flex-col ${chrome ? 'border-l border-[var(--inscript-color-border)] bg-[var(--inscript-color-surface-raised)] w-64 shrink-0 transition-all' : 'w-full h-full'} max-h-full overflow-hidden ${className}`}
            style={width ? { width } : undefined}
        >
            {chrome && (
                <div className="flex items-center justify-between p-3 border-b border-[var(--inscript-color-border)]">
                    <span className="font-semibold text-sm text-[var(--inscript-color-text)]">{t('documentOutline', 'Outline')}</span>
                    {canCollapse && (
                        <button
                            onClick={handleToggleCollapse}
                            className="p-1 rounded text-[var(--inscript-color-muted)] hover:bg-[var(--inscript-color-hover)]"
                            title={t('collapseOutline', 'Collapse outline')}
                        >
                            <ChevronRight size={16} />
                        </button>
                    )}
                </div>
            )}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1 custom-scrollbar">
                {headings.length === 0 ? (
                    <div className="text-sm text-[var(--inscript-color-muted)] italic">
                        {t('noHeadings', 'No headings yet')}
                    </div>
                ) : (
                    headings.map((h, i) => (
                        <button
                            key={`${h.pos}-${i}`}
                            onClick={() => handleClick(h.pos)}
                            className="text-left text-sm py-1 px-2 rounded hover:bg-[var(--inscript-color-hover)] text-[var(--inscript-color-text)] transition-colors truncate"
                            style={{ paddingLeft: `${(h.level - 1) * 0.75 + 0.5}rem` }}
                            title={h.text}
                        >
                            {h.text}
                        </button>
                    ))
                )}
            </div>
        </div>
    );
};
