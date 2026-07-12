import { useState, useRef, useCallback, useEffect } from 'react';
import { GripVertical, X, Plus, Check, Settings2 } from 'lucide-react';
import { TOOL_REGISTRY, DIVIDER, ALL_TOOL_IDS } from '../toolbar/toolRegistry.js';
import { TOOLBAR_PRESETS, PRESET_LABELS } from '../toolbar/presets.js';

/**
 * ToolbarCustomizer — a slide-in drawer for reordering and customizing the toolbar.
 *
 * Architecture note: This component renders the UI to edit a toolbar config,
 * but it does NOT own or persist the config. It calls `onSave(config)` with
 * the new array of tool IDs + '|' dividers, and the CONSUMER is responsible
 * for persisting and passing it back to <ResponsiveToolbar toolbarConfig={...}/>.
 *
 * Props:
 *   currentConfig  – The active config array (IDs + '|' dividers).
 *                    If omitted, defaults to TOOLBAR_PRESETS.full.
 *   onSave(config) – Called when the user clicks Save. Receives the new config.
 *   onClose()      – Called when the drawer should close (Cancel or ✕).
 */
export const ToolbarCustomizer = ({ currentConfig, onSave, onClose }) => {
    const initialConfig = currentConfig ?? TOOLBAR_PRESETS.full;
    const [config, setConfig] = useState(initialConfig);
    const [activePreset, setActivePreset] = useState(
        Object.keys(TOOLBAR_PRESETS).find(k =>
            JSON.stringify(TOOLBAR_PRESETS[k]) === JSON.stringify(initialConfig)
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
        // Trigger entrance transition on next paint
        const raf = requestAnimationFrame(() => {
            setIsEntered(true);
        });
        return () => cancelAnimationFrame(raf);
    }, []);

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 300); // matches the duration-300 transition time
    }, [onClose]);

    const handleSave = () => {
        onSave(config);
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

    // ── Preset selection ──────────────────────────────────────────────────────
    const applyPreset = useCallback((key) => {
        setConfig([...TOOLBAR_PRESETS[key]]);
        setActivePreset(key);
    }, []);

    // ── Config mutations ──────────────────────────────────────────────────────
    const removeItem = useCallback((idx) => {
        setConfig(c => {
            const next = c.filter((_, i) => i !== idx);
            setActivePreset(null);
            return next;
        });
    }, []);

    const addDivider = useCallback(() => {
        setConfig(c => { setActivePreset(null); return [...c, DIVIDER]; });
    }, []);

    const addTool = useCallback((id) => {
        setConfig(c => { setActivePreset(null); return [...c, id]; });
    }, []);

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
            setActivePreset(null);
            return next;
        });
        setDragOverIndex(null);
        dragIndexRef.current = null;
    };
    const handleDragEnd = () => {
        setDragOverIndex(null);
        dragIndexRef.current = null;
    };

    // ── Derived ───────────────────────────────────────────────────────────────
    const usedToolIds = new Set(config.filter(x => x !== DIVIDER));
    const availableTools = ALL_TOOL_IDS.filter(id => !usedToolIds.has(id));

    return (
        // Backdrop container
        <div className="fixed inset-0 z-[80] flex justify-end" onClick={handleClose}>
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
                        <Settings2 size={18} className="text-zinc-400" />
                        <span className="font-semibold text-zinc-900 dark:text-white text-sm">Customize Toolbar</span>
                    </div>
                    <button
                        onClick={handleClose}
                        className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {/* Presets */}
                    <div className="px-5 pt-5 pb-4">
                        <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Presets</p>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.keys(TOOLBAR_PRESETS).map(key => (
                                <button
                                    key={key}
                                    onClick={() => applyPreset(key)}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium text-left transition-all border
                                        ${activePreset === key
                                            ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-transparent'
                                            : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500'
                                        }`}
                                >
                                    {PRESET_LABELS[key]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="border-t border-zinc-100 dark:border-zinc-800" />

                    {/* Current config (drag to reorder) */}
                    <div className="px-5 pt-4 pb-2">
                        <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Current toolbar</p>
                        <div className="flex flex-col gap-1">
                            {config.map((item, idx) => {
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
                <div className="px-5 py-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
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
};
