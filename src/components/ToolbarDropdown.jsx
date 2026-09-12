import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { TOOLBAR_SIZES } from './ToolbarButton.jsx';

/**
 * A split-button toolbar control.
 *
 * The left portion fires the primary action (the last-chosen item or the
 * current active item); the right chevron opens a popover to pick from all
 * options.  Once a user picks from the popover, that choice becomes the new
 * primary action until changed again.
 *
 * Props:
 *   items     – array of { id, icon: LucideComponent, label, action, active? }
 *   title     – tooltip on the whole control
 *   activeId  – externally-resolved active id (overrides internal lastId when set)
 */
export const ToolbarDropdown = ({ items = [], title, activeId }) => {
    const [open, setOpen] = useState(false);
    const [lastId, setLastId] = useState(items[0]?.id);
    const popoverRef = useRef(null);
    const containerRef = useRef(null);

    // Prefer the externally-active item; fall back to last chosen; fall back to first.
    const resolvedId = activeId ?? lastId ?? items[0]?.id;
    const activeItem = items.find(it => it.id === resolvedId) ?? items[0];

    const handlePick = useCallback((item) => {
        item.action();
        setLastId(item.id);
        setOpen(false);
    }, []);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const CHEVRON_W = 14;
    const BTN_W = TOOLBAR_SIZES.BUTTON;
    const totalW = BTN_W + CHEVRON_W + 1; // +1 for inner divider

    const isAnyActive = items.some(it => it.active);
    const ActiveIcon = activeItem?.icon;

    return (
        <div
            ref={containerRef}
            className="relative flex items-center shrink-0"
            style={{ height: `${BTN_W}px`, width: `${totalW}px` }}
        >
            {/* Primary action button */}
            <button
                type="button"
                title={activeItem?.label ?? title}
                onClick={() => activeItem?.action()}
                style={{ width: `${BTN_W}px`, height: `${BTN_W}px` }}
                className={`flex items-center justify-center rounded-l transition-colors
                    ${isAnyActive
                        ? 'bg-[var(--inscript-color-active)] text-[var(--inscript-color-text)] shadow-inner'
                        : 'text-[var(--inscript-color-muted)] hover:bg-[var(--inscript-color-hover)] hover:text-[var(--inscript-color-text)]'
                    }`}
            >
                {ActiveIcon && <ActiveIcon size={18} />}
            </button>

            {/* Inner divider */}
            <div className="w-px h-4 bg-[var(--inscript-color-border)] shrink-0" />

            {/* Chevron / dropdown trigger */}
            <button
                type="button"
                title={title}
                onClick={() => setOpen(v => !v)}
                style={{ width: `${CHEVRON_W}px`, height: `${BTN_W}px` }}
                className={`flex items-center justify-center rounded-r transition-colors
                    ${open
                        ? 'bg-[var(--inscript-color-active)] text-[var(--inscript-color-text)]'
                        : 'text-[var(--inscript-color-muted)] hover:bg-[var(--inscript-color-hover)] hover:text-[var(--inscript-color-text)]'
                    }`}
            >
                <ChevronDown size={10} />
            </button>

            {/* Popover */}
            {open && (
                <div
                    ref={popoverRef}
                    className="absolute left-0 top-full mt-1 z-[70] bg-[var(--inscript-color-surface-raised)] border border-[var(--inscript-color-border)] rounded-lg shadow-xl overflow-hidden"
                    style={{ minWidth: '160px' }}
                >
                    {items.map(item => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => handlePick(item)}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors
                                    ${item.active
                                        ? 'bg-[var(--inscript-color-active)] text-[var(--inscript-color-text)] font-medium'
                                        : 'text-[var(--inscript-color-text)] hover:bg-[var(--inscript-color-hover)] hover:text-[var(--inscript-color-text)]'
                                    }`}
                            >
                                {Icon && <Icon size={15} className="shrink-0" />}
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
