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
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-inner'
                        : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'
                    }`}
            >
                {ActiveIcon && <ActiveIcon size={18} />}
            </button>

            {/* Inner divider */}
            <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 shrink-0" />

            {/* Chevron / dropdown trigger */}
            <button
                type="button"
                title={title}
                onClick={() => setOpen(v => !v)}
                style={{ width: `${CHEVRON_W}px`, height: `${BTN_W}px` }}
                className={`flex items-center justify-center rounded-r transition-colors
                    ${open
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white'
                        : 'text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'
                    }`}
            >
                <ChevronDown size={10} />
            </button>

            {/* Popover */}
            {open && (
                <div
                    ref={popoverRef}
                    className="absolute left-0 top-full mt-1 z-[70] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl overflow-hidden"
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
                                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium'
                                        : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'
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
