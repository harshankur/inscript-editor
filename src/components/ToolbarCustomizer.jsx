import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useInscriptT } from '../hooks/useInscriptT.js';
import { GripVertical, X, Plus, Check, SlidersHorizontal } from 'lucide-react';
import { TOOL_REGISTRY, DIVIDER, TOOLBAR_TOOL_IDS, BUBBLE_ALLOWED_TOOL_IDS, sanitizeToolConfig } from '../toolbar/toolRegistry.js';
import { TOOLBAR_PRESETS, BUBBLE_PRESETS, PRESET_LABELS, DEFAULT_TOOLBAR_CONFIG, DEFAULT_BUBBLE_CONFIG } from '../toolbar/presets.js';

/** What Tab can reach inside the drawer. */
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * ToolbarCustomizer — a slide-in drawer for reordering and customizing
 * both the main toolbar and the text selection bubble menu.
 *
 * Consumers may supply their own named presets via `toolbarPresets` /
 * `bubbleMenuPresets` (+ `toolbarPresetLabels`). `presetsMode` decides whether
 * those replace the built-ins ('replace') or extend them ('merge', default).
 * Each supplied preset is validated per surface; invalid ids are dropped.
 */
export const ToolbarCustomizer = ({
    currentConfig,
    onSave,
    onClose,
    currentBubbleConfig,
    onSaveBubble,
    toolbarPresets,
    bubbleMenuPresets,
    toolbarPresetLabels,
    presetsMode = 'merge',
    // When a DOM element is passed, the drawer is rendered into it and scoped to
    // it (position:absolute) instead of covering the viewport (position:fixed).
    // The element should be position:relative + overflow:hidden.
    container = null,
    // Where focus goes back to when the drawer closes (the button that opened it).
    returnFocusRef = null,
}) => {
    const { t } = useInscriptT();
    const [activeTab, setActiveTab] = useState('toolbar'); // 'toolbar' | 'bubble'
    // A tool's name (under the key the toolbar uses for it) and a built-in preset's name in the UI language. A host's own preset labels
    // (toolbarPresetLabels) are its own words and are shown as given.
    const toolLabel = (id) => (TOOL_REGISTRY[id]?.labelKey ? t(TOOL_REGISTRY[id].labelKey, TOOL_REGISTRY[id].label) : (TOOL_REGISTRY[id]?.label ?? id));
    const presetLabel = (key) => (toolbarPresetLabels?.[key] ?? (PRESET_LABELS[key] ? t(`toolbarPreset.${key}`, PRESET_LABELS[key]) : key));

    // Effective presets: built-ins, optionally replaced/merged with the
    // consumer-supplied ones (each validated for its surface).
    const effToolbarPresets = useMemo(() => {
        if (!toolbarPresets) return TOOLBAR_PRESETS;
        const clean = Object.fromEntries(Object.entries(toolbarPresets).map(([k, v]) => [k, sanitizeToolConfig(v, 'toolbar')]));
        return presetsMode === 'replace' ? clean : { ...TOOLBAR_PRESETS, ...clean };
    }, [toolbarPresets, presetsMode]);

    const effBubblePresets = useMemo(() => {
        if (!bubbleMenuPresets) return BUBBLE_PRESETS;
        const clean = Object.fromEntries(Object.entries(bubbleMenuPresets).map(([k, v]) => [k, sanitizeToolConfig(v, 'bubble')]));
        return presetsMode === 'replace' ? clean : { ...BUBBLE_PRESETS, ...clean };
    }, [bubbleMenuPresets, presetsMode]);

    // Local state for main toolbar
    const initialToolbarConfig = currentConfig ?? DEFAULT_TOOLBAR_CONFIG;
    const [toolbarConfig, setToolbarConfig] = useState(initialToolbarConfig);

    // Local state for selection bubble menu
    const initialBubbleConfig = currentBubbleConfig ?? DEFAULT_BUBBLE_CONFIG;
    const [bubbleConfig, setBubbleConfig] = useState(initialBubbleConfig);

    // Track active presets per tab (matched against the effective set)
    const [activeToolbarPreset, setActiveToolbarPreset] = useState(
        Object.keys(effToolbarPresets).find(k =>
            JSON.stringify(effToolbarPresets[k]) === JSON.stringify(initialToolbarConfig)
        ) ?? null
    );
    const [activeBubblePreset, setActiveBubblePreset] = useState(
        Object.keys(effBubblePresets).find(k =>
            JSON.stringify(effBubblePresets[k]) === JSON.stringify(initialBubbleConfig)
        ) ?? null
    );

    // Animation states
    const [isEntered, setIsEntered] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    // Drag state
    const dragIndexRef = useRef(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);

    // ── Entrance & Exit Animation Helpers ─────────────────────────────────────
    useEffect(() => {
        const raf = requestAnimationFrame(() => {
            setIsEntered(true);
        });
        return () => cancelAnimationFrame(raf);
    }, []);

    // A modal dialog: it takes focus when it opens (onto its Close button), Tab cycles inside it
    // rather than into the page under the backdrop, and focus goes back to `returnFocusRef` when it
    // closes, unless the reader has already moved it somewhere else.
    const closeButtonRef = useRef(null);
    const drawerRef = useRef(null);
    // Where focus was when it opened: where it goes back to when the host gives no returnFocusRef.
    const openerRef = useRef(null);
    useEffect(() => {
        const active = closeButtonRef.current?.ownerDocument.activeElement;
        if (active && active !== active.ownerDocument.body) openerRef.current = active;
        closeButtonRef.current?.focus({ preventScroll: true });
    }, []);
    const keepFocusInside = useCallback((e) => {
        const drawer = drawerRef.current;
        if (!drawer) return;
        // What Tab really stops at: not disabled, not taken out of the order, not hidden (itself or
        // by a parent; checkVisibility sees both, where the browser has it).
        const view = drawer.ownerDocument.defaultView;
        const visible = el => (typeof el.checkVisibility === 'function'
            ? el.checkVisibility({ visibilityProperty: true })
            : !el.closest('[hidden], [aria-hidden="true"]') && view?.getComputedStyle(el).display !== 'none');
        const focusable = Array.from(drawer.querySelectorAll(FOCUSABLE))
            .filter(el => !el.disabled && el.tabIndex >= 0 && visible(el));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = drawer.ownerDocument.activeElement;
        if (!drawer.contains(active)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
        else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    }, []);

    // Focus goes back when the drawer goes away (not when a host keeps it open after onClose), and
    // only if it is still in the drawer or nowhere: a reader who moved it on keeps it there. A layout
    // effect's cleanup runs before the drawer leaves the DOM, so where focus is can still be told.
    const returnFocusTo = useRef(returnFocusRef);
    returnFocusTo.current = returnFocusRef?.current ? returnFocusRef : openerRef;
    useLayoutEffect(() => () => {
        const drawer = drawerRef.current;
        const doc = drawer?.ownerDocument ?? (typeof document !== 'undefined' ? document : null);
        const active = doc?.activeElement;
        if (!active || active === doc.body || drawer?.contains(active)) returnFocusTo.current?.current?.focus();
    }, []);

    // Escape, the backdrop and Save can all close it: onClose runs once, when it has slid out, and it
    // stays out (a host shows it again by mounting it again). An unmount before then cancels it.
    const closingRef = useRef(false);
    const closeTimerRef = useRef(null);
    useEffect(() => () => clearTimeout(closeTimerRef.current), []);
    const handleClose = useCallback(() => {
        if (closingRef.current) return;
        closingRef.current = true;
        // Focus leaves before the drawer is hidden from assistive technology (never hide a focused
        // element): back to where it came from, if it is in the drawer.
        const drawer = drawerRef.current;
        const active = drawer?.ownerDocument.activeElement;
        if (drawer && drawer.contains(active)) {
            const target = returnFocusTo.current?.current;
            if (target) target.focus();
            else active.blur(); // nowhere to return it: at least not left inside the hidden drawer
        }
        setIsClosing(true);
        closeTimerRef.current = setTimeout(onClose, 300);
    }, [onClose]);

    const handleSave = () => {
        onSave(toolbarConfig);
        if (onSaveBubble) {
            onSaveBubble(bubbleConfig);
        }
        handleClose();
    };

    // Close on Escape. Covering the page, it is modal: Tab stays inside it wherever focus is (also
    // once it has left it). Scoped to a host's container, the rest of the page stays usable.
    const modal = !container;
    useEffect(() => {
        const handleKeyDown = (e) => {
            // A dialog of the host's, open over the drawer, keeps its own keys.
            const target = e.target;
            const otherModal = target?.closest?.('[aria-modal="true"]');
            const inDrawer = target instanceof Node && !!drawerRef.current?.contains(target);
            if (otherModal && !inDrawer && otherModal !== drawerRef.current) return;
            // Scoped to a container, the rest of the page is the reader's: Escape there is not ours.
            if (e.key === 'Escape' && !modal && !inDrawer) return;
            if (e.key === 'Escape') {
                handleClose();
            } else if (e.key === 'Tab' && modal && !closingRef.current) {
                // Once it has started sliding out it no longer holds focus.
                keepFocusInside(e);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleClose, keepFocusInside, modal]);

    // ── Getters/Setters based on Active Tab ───────────────────────────────────
    const getConfig = () => (activeTab === 'toolbar' ? toolbarConfig : bubbleConfig);
    const setConfig = (updater) => {
        if (activeTab === 'toolbar') {
            setToolbarConfig(updater);
            setActiveToolbarPreset(null);
        } else {
            setBubbleConfig(updater);
            setActiveBubblePreset(null);
        }
    };

    const getActivePreset = () => (activeTab === 'toolbar' ? activeToolbarPreset : activeBubblePreset);

    // ── Preset selection ──────────────────────────────────────────────────────
    const applyPreset = useCallback((key) => {
        if (activeTab === 'toolbar') {
            setToolbarConfig([...effToolbarPresets[key]]);
            setActiveToolbarPreset(key);
        } else {
            setBubbleConfig([...effBubblePresets[key]]);
            setActiveBubblePreset(key);
        }
    }, [activeTab, effToolbarPresets, effBubblePresets]);

    // ── Config mutations ──────────────────────────────────────────────────────
    const removeItem = useCallback((idx) => {
        setConfig(c => c.filter((_, i) => i !== idx));
    }, [activeTab]);

    const addDivider = useCallback(() => {
        setConfig(c => [...c, DIVIDER]);
    }, [activeTab]);

    const addTool = useCallback((id) => {
        setConfig(c => [...c, id]);
    }, [activeTab]);

    // ── Drag & drop reorder ───────────────────────────────────────────────────
    const handleDragStart = (e, idx) => {
        dragIndexRef.current = idx;
        e.dataTransfer.effectAllowed = 'move';
    };
    const handleDragOver = (e, idx) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverIndex(idx);
    };
    const handleDrop = (e, idx) => {
        e.preventDefault();
        const from = dragIndexRef.current;
        if (from === null || from === idx) { setDragOverIndex(null); return; }
        setConfig(c => {
            const next = [...c];
            const [removed] = next.splice(from, 1);
            next.splice(idx, 0, removed);
            return next;
        });
        setDragOverIndex(null);
        dragIndexRef.current = null;
    };
    const handleDragEnd = () => {
        setDragOverIndex(null);
        dragIndexRef.current = null;
    };

    // ── Derived List of Tools ────────────────────────────────────────────────
    const activeConfig = getConfig();
    const usedToolIds = new Set(activeConfig.filter(x => x !== DIVIDER));

    const totalAllowedTools = activeTab === 'toolbar'
        ? TOOLBAR_TOOL_IDS
        : BUBBLE_ALLOWED_TOOL_IDS;

    const availableTools = totalAllowedTools.filter(id => !usedToolIds.has(id));

    const tree = (
        // Backdrop container — fixed (viewport) by default, absolute when contained.
        // Once it is sliding out it is out of the way: no clicks caught, nothing announced (a host may
        // keep it mounted after onClose).
        <div
            className={`${container ? 'absolute' : 'fixed'} inset-0 z-[80] flex justify-end ${isClosing ? 'pointer-events-none' : ''}`}
            aria-hidden={isClosing || undefined}
            onClick={handleClose}
        >
            {/* Overlay background with fade-in and backdrop-blur */}
            <div
                className={`absolute inset-0 transition-all duration-300 ease-in-out ${
                    isEntered && !isClosing ? 'bg-black/40 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-none'
                }`}
            />

            {/* Drawer panel with slide-in transform; the dialog the toolbar's Customize button opens */}
            <div
                ref={drawerRef}
                role="dialog"
                aria-modal={modal ? 'true' : undefined}
                aria-label={t('customizeLayout', 'Customize Layout')}
                className={`relative w-full max-w-sm h-full bg-[var(--inscript-color-surface-raised)] shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${
                    isEntered && !isClosing ? 'translate-x-0' : 'translate-x-full'
                }`}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--inscript-color-border)]">
                    <div className="flex items-center gap-2">
                        <SlidersHorizontal size={18} className="text-[var(--inscript-color-muted)]" />
                        <span className="font-semibold text-[var(--inscript-color-text)] text-sm">{t('customizeLayout', 'Customize Layout')}</span>
                    </div>
                    <button type="button"
                        ref={closeButtonRef}
                        onClick={handleClose}
                        aria-label={t('close', 'Close')}
                        title={t('close', 'Close')}
                        className="text-[var(--inscript-color-muted)] hover:text-[var(--inscript-color-text)] transition-colors rounded p-1 hover:bg-[var(--inscript-color-hover)]"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Tab Switcher: whenever the host can save the selection menu (its config may be the default) */}
                {onSaveBubble && (
                    <div className="flex border-b border-[var(--inscript-color-border)] bg-[var(--inscript-color-surface-raised)] shrink-0">
                        <button type="button"
                            onClick={() => { setActiveTab('toolbar'); setDragOverIndex(null); }}
                            className={`flex-1 py-3 text-xs font-semibold text-center border-b-2 transition-all
                                ${activeTab === 'toolbar'
                                    ? 'border-[var(--inscript-color-text)] text-[var(--inscript-color-text)] bg-[var(--inscript-color-surface-raised)]'
                                    : 'border-transparent text-[var(--inscript-color-muted)] hover:text-[var(--inscript-color-text)]'
                                }`}
                        >
                            {t('customizerMainToolbar', 'Main Toolbar')}
                        </button>
                        <button type="button"
                            onClick={() => { setActiveTab('bubble'); setDragOverIndex(null); }}
                            className={`flex-1 py-3 text-xs font-semibold text-center border-b-2 transition-all
                                ${activeTab === 'bubble'
                                    ? 'border-[var(--inscript-color-text)] text-[var(--inscript-color-text)] bg-[var(--inscript-color-surface-raised)]'
                                    : 'border-transparent text-[var(--inscript-color-muted)] hover:text-[var(--inscript-color-text)]'
                                }`}
                        >
                            {t('customizerSelectionMenu', 'Selection Menu')}
                        </button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto">
                    {/* Presets */}
                    <div className="px-5 pt-5 pb-4">
                        <p className="text-xs font-medium text-[var(--inscript-color-muted)] uppercase tracking-wider mb-3">{t('customizerPresets', 'Presets')}</p>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.keys(activeTab === 'toolbar' ? effToolbarPresets : effBubblePresets).map(key => (
                                <button type="button"
                                    key={key}
                                    onClick={() => applyPreset(key)}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium text-left transition-all border
                                        ${getActivePreset() === key
                                            ? 'bg-[var(--inscript-color-text)] text-[var(--inscript-color-surface)] border-transparent'
                                            : 'bg-[var(--inscript-color-surface-raised)] text-[var(--inscript-color-text)] border-[var(--inscript-color-border)] hover:border-[var(--inscript-color-border-strong)]'
                                        }`}
                                >
                                    {presetLabel(key)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="border-t border-[var(--inscript-color-border)]" />

                    {/* Current config (drag to reorder) */}
                    <div className="px-5 pt-4 pb-2">
                        <p className="text-xs font-medium text-[var(--inscript-color-muted)] uppercase tracking-wider mb-3">
                            {activeTab === 'toolbar' ? t('customizerCurrentToolbar', 'Current toolbar') : t('customizerCurrentSelectionMenu', 'Current selection menu')}
                        </p>
                        <div className="flex flex-col gap-1">
                            {activeConfig.map((item, idx) => {
                                const isDivider = item === DIVIDER;
                                const meta = isDivider ? null : TOOL_REGISTRY[item];
                                const Icon = meta?.icon ?? null;
                                const isDropTarget = dragOverIndex === idx;

                                return (
                                    <div
                                        key={`${item}-${idx}`}
                                        draggable
                                        onDragStart={e => handleDragStart(e, idx)}
                                        onDragOver={e => handleDragOver(e, idx)}
                                        onDrop={e => handleDrop(e, idx)}
                                        onDragEnd={handleDragEnd}
                                        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-grab active:cursor-grabbing transition-all
                                            ${isDropTarget ? 'bg-[var(--inscript-color-active)] ring-2 ring-[var(--inscript-color-border-strong)]' : 'hover:bg-[var(--inscript-color-hover)]'}
                                            ${isDivider ? 'opacity-60' : ''}
                                        `}
                                    >
                                        <GripVertical size={14} className="text-[var(--inscript-color-muted)] shrink-0" />
                                        {isDivider ? (
                                            <div className="flex-1 flex items-center gap-2">
                                                <div className="flex-1 h-px bg-[var(--inscript-color-border-strong)]" />
                                                <span className="text-xs text-[var(--inscript-color-muted)]">{t('customizerDivider', 'Divider')}</span>
                                                <div className="flex-1 h-px bg-[var(--inscript-color-border-strong)]" />
                                            </div>
                                        ) : (
                                            <>
                                                {Icon && <Icon size={14} className="text-[var(--inscript-color-muted)] shrink-0" />}
                                                <span className="flex-1 text-sm text-[var(--inscript-color-text)]">{toolLabel(item)}</span>
                                            </>
                                        )}
                                        <button type="button"
                                            onClick={() => removeItem(idx)}
                                            className="text-[var(--inscript-color-muted)] hover:text-red-500 dark:hover:text-red-400 transition-colors rounded p-0.5 shrink-0"
                                            title={t('customizerRemove', 'Remove')}
                                            aria-label={t('customizerRemove', 'Remove')}
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                );
                            })}

                            {/* Add divider button */}
                            <button type="button"
                                onClick={addDivider}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[var(--inscript-color-muted)] hover:text-[var(--inscript-color-text)] hover:bg-[var(--inscript-color-hover)] text-sm transition-colors"
                            >
                                <Plus size={13} />
                                <span>{t('customizerAddDivider', 'Add divider')}</span>
                            </button>
                        </div>
                    </div>

                    {/* Available tools to add */}
                    {availableTools.length > 0 && (
                        <>
                            <div className="border-t border-[var(--inscript-color-border)] mt-2" />
                            <div className="px-5 pt-4 pb-6">
                                <p className="text-xs font-medium text-[var(--inscript-color-muted)] uppercase tracking-wider mb-3">{t('customizerAvailable', 'Available to add')}</p>
                                <div className="flex flex-col gap-1">
                                    {availableTools.map(id => {
                                        const meta = TOOL_REGISTRY[id];
                                        const Icon = meta?.icon ?? null;
                                        return (
                                            <button type="button"
                                                key={id}
                                                onClick={() => addTool(id)}
                                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--inscript-color-hover)] text-sm text-[var(--inscript-color-muted)] hover:text-[var(--inscript-color-text)] transition-colors text-left"
                                            >
                                                {Icon && <Icon size={14} className="shrink-0" />}
                                                <span className="flex-1">{toolLabel(id)}</span>
                                                <Plus size={13} className="text-[var(--inscript-color-muted)]" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer actions */}
                <div className="px-5 py-4 border-t border-[var(--inscript-color-border)] flex items-center gap-2 shrink-0">
                    <button type="button"
                        onClick={handleClose}
                        className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--inscript-color-surface-raised)] text-[var(--inscript-color-text)] hover:bg-[var(--inscript-color-hover)] transition-colors"
                    >
                        {t('cancel', 'Cancel')}
                    </button>
                    <button type="button"
                        onClick={handleSave}
                        className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--inscript-color-text)] text-[var(--inscript-color-surface)] hover:opacity-90 transition-colors"
                    >
                        <Check size={14} />
                        {t('customizerSave', 'Save layout')}
                    </button>
                </div>
            </div>
        </div>
    );

    return container ? createPortal(tree, container) : tree;
};
