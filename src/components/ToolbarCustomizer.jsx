import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { GripVertical, X, Plus, Check, SlidersHorizontal } from 'lucide-react';
import { TOOL_REGISTRY, DIVIDER, TOOLBAR_TOOL_IDS, BUBBLE_ALLOWED_TOOL_IDS, sanitizeToolConfig } from '../toolbar/toolRegistry.js';
import { TOOLBAR_PRESETS, BUBBLE_PRESETS, PRESET_LABELS, DEFAULT_TOOLBAR_CONFIG, DEFAULT_BUBBLE_CONFIG } from '../toolbar/presets.js';

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
}) => {
    const [activeTab, setActiveTab] = useState('toolbar'); // 'toolbar' | 'bubble'

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

    const effPresetLabels = useMemo(() => ({ ...PRESET_LABELS, ...(toolbarPresetLabels || {}) }), [toolbarPresetLabels]);

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

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 300);
    }, [onClose]);

    const handleSave = () => {
        onSave(toolbarConfig);
        if (onSaveBubble) {
            onSaveBubble(bubbleConfig);
        }
        handleClose();
    };

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                handleClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleClose]);

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
        <div className={`${container ? 'absolute' : 'fixed'} inset-0 z-[80] flex justify-end`} onClick={handleClose}>
            {/* Overlay background with fade-in and backdrop-blur */}
            <div
                className={`absolute inset-0 transition-all duration-300 ease-in-out ${
                    isEntered && !isClosing ? 'bg-black/40 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-none'
                }`}
            />

            {/* Drawer panel with slide-in transform */}
            <div
                className={`relative w-full max-w-sm h-full bg-white dark:bg-zinc-900 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${
                    isEntered && !isClosing ? 'translate-x-0' : 'translate-x-full'
                }`}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                        <SlidersHorizontal size={18} className="text-zinc-400" />
                        <span className="font-semibold text-zinc-900 dark:text-white text-sm">Customize Layout</span>
                    </div>
                    <button
                        onClick={handleClose}
                        className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Tab Switcher */}
                {currentBubbleConfig && onSaveBubble && (
                    <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 shrink-0">
                        <button
                            onClick={() => { setActiveTab('toolbar'); setDragOverIndex(null); }}
                            className={`flex-1 py-3 text-xs font-semibold text-center border-b-2 transition-all
                                ${activeTab === 'toolbar'
                                    ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white bg-white dark:bg-zinc-900'
                                    : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                                }`}
                        >
                            Main Toolbar
                        </button>
                        <button
                            onClick={() => { setActiveTab('bubble'); setDragOverIndex(null); }}
                            className={`flex-1 py-3 text-xs font-semibold text-center border-b-2 transition-all
                                ${activeTab === 'bubble'
                                    ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white bg-white dark:bg-zinc-900'
                                    : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                                }`}
                        >
                            Selection Menu
                        </button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto">
                    {/* Presets */}
                    <div className="px-5 pt-5 pb-4">
                        <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Presets</p>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.keys(activeTab === 'toolbar' ? effToolbarPresets : effBubblePresets).map(key => (
                                <button
                                    key={key}
                                    onClick={() => applyPreset(key)}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium text-left transition-all border
                                        ${getActivePreset() === key
                                            ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-transparent'
                                            : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500'
                                        }`}
                                >
                                    {effPresetLabels[key] ?? key}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="border-t border-zinc-100 dark:border-zinc-800" />

                    {/* Current config (drag to reorder) */}
                    <div className="px-5 pt-4 pb-2">
                        <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">
                            Current {activeTab === 'toolbar' ? 'toolbar' : 'selection menu'}
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
                                            ${isDropTarget ? 'bg-zinc-100 dark:bg-zinc-700 ring-2 ring-zinc-400 dark:ring-zinc-500' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'}
                                            ${isDivider ? 'opacity-60' : ''}
                                        `}
                                    >
                                        <GripVertical size={14} className="text-zinc-300 dark:text-zinc-600 shrink-0" />
                                        {isDivider ? (
                                            <div className="flex-1 flex items-center gap-2">
                                                <div className="flex-1 h-px bg-zinc-300 dark:bg-zinc-600" />
                                                <span className="text-xs text-zinc-400 dark:text-zinc-500">Divider</span>
                                                <div className="flex-1 h-px bg-zinc-300 dark:bg-zinc-600" />
                                            </div>
                                        ) : (
                                            <>
                                                {Icon && <Icon size={14} className="text-zinc-500 dark:text-zinc-400 shrink-0" />}
                                                <span className="flex-1 text-sm text-zinc-700 dark:text-zinc-200">{meta?.label ?? item}</span>
                                            </>
                                        )}
                                        <button
                                            onClick={() => removeItem(idx)}
                                            className="text-zinc-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-colors rounded p-0.5 shrink-0"
                                            title="Remove"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                );
                            })}

                            {/* Add divider button */}
                            <button
                                onClick={addDivider}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm transition-colors"
                            >
                                <Plus size={13} />
                                <span>Add divider</span>
                            </button>
                        </div>
                    </div>

                    {/* Available tools to add */}
                    {availableTools.length > 0 && (
                        <>
                            <div className="border-t border-zinc-100 dark:border-zinc-800 mt-2" />
                            <div className="px-5 pt-4 pb-6">
                                <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Available to add</p>
                                <div className="flex flex-col gap-1">
                                    {availableTools.map(id => {
                                        const meta = TOOL_REGISTRY[id];
                                        const Icon = meta?.icon ?? null;
                                        return (
                                            <button
                                                key={id}
                                                onClick={() => addTool(id)}
                                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors text-left"
                                            >
                                                {Icon && <Icon size={14} className="shrink-0" />}
                                                <span className="flex-1">{meta?.label ?? id}</span>
                                                <Plus size={13} className="text-zinc-300 dark:text-zinc-600" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer actions */}
                <div className="px-5 py-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2 shrink-0">
                    <button
                        onClick={handleClose}
                        className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-100 transition-colors"
                    >
                        <Check size={14} />
                        Save layout
                    </button>
                </div>
            </div>
        </div>
    );

    return container ? createPortal(tree, container) : tree;
};
