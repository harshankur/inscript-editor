import React, { useEffect, useState } from 'react';
import { extractHeadings } from '../utils/headingExtraction.js';
import { ChevronRight, List as ListIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const DocumentOutline = ({ editor }) => {
    const { t } = useTranslation('inscript-editor');
    const [headings, setHeadings] = useState([]);
    
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const stored = localStorage.getItem('inscript-outline-collapsed');
        return stored === 'true';
    });

    useEffect(() => {
        if (!editor) return;

        const updateHeadings = () => {
            setHeadings(extractHeadings(editor));
        };

        editor.on('update', updateHeadings);
        updateHeadings();

        return () => {
            editor.off('update', updateHeadings);
        };
    }, [editor]);

    const handleToggleCollapse = () => {
        const next = !isCollapsed;
        setIsCollapsed(next);
        localStorage.setItem('inscript-outline-collapsed', String(next));
    };

    const handleClick = (pos) => {
        if (!editor) return;
        // Place the caret at the heading, then scroll the heading itself to the TOP of the viewport.
        // The old `.scrollIntoView()` (ProseMirror's minimum-scroll) put a heading at the top when it
        // was above the view but at the bottom when it was below - inconsistent. Scroll the node's DOM
        // with `block: 'start'` so a clicked heading always lands at the top (matches the minimap).
        // `focus()` defaults to its own minimum-scroll (which is the inconsistent behavior); disable it
        // so ours is the only scroll, then align the heading's DOM node to the TOP.
        editor.chain().setTextSelection(pos).focus(null, { scrollIntoView: false }).run();
        const dom = editor.view.nodeDOM(pos);
        if (dom && typeof dom.scrollIntoView === 'function') {
            dom.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
    };

    if (!editor) return null;

    if (isCollapsed) {
        return (
            <div className="flex flex-col border-l border-[var(--inscript-color-border)] bg-[var(--inscript-color-surface-raised)] w-12 shrink-0 transition-all">
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
        <div className="flex flex-col border-l border-[var(--inscript-color-border)] bg-[var(--inscript-color-surface-raised)] w-64 shrink-0 transition-all max-h-full overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-[var(--inscript-color-border)]">
                <span className="font-semibold text-sm text-[var(--inscript-color-text)]">{t('documentOutline', 'Outline')}</span>
                <button
                    onClick={handleToggleCollapse}
                    className="p-1 rounded text-[var(--inscript-color-muted)] hover:bg-[var(--inscript-color-hover)]"
                    title={t('collapseOutline', 'Collapse outline')}
                >
                    <ChevronRight size={16} />
                </button>
            </div>
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
