import React, { useEffect, useState, useRef } from 'react';
import { slashCommandStore } from '../extensions/SlashCommand.js';

export const SlashCommandMenu = ({ isReadonly }) => {
    const [state, setState] = useState(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const menuRef = useRef(null);

    useEffect(() => {
        return slashCommandStore.subscribe(newState => {
            if (!newState || !newState.active) {
                setState(null);
            } else {
                setState(newState.props);
                setSelectedIndex(0); // Reset selection on update
            }
        });
    }, []);

    useEffect(() => {
        if (!state) {
            slashCommandStore.onKeyDown = null;
            return;
        }

        slashCommandStore.onKeyDown = (event) => {
            const items = state.items;
            if (!items.length) return false;

            if (event.key === 'ArrowUp') {
                setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
                return true;
            }
            if (event.key === 'ArrowDown') {
                setSelectedIndex((prev) => (prev + 1) % items.length);
                return true;
            }
            if (event.key === 'Enter') {
                const item = items[selectedIndex];
                if (item) {
                    state.command(item);
                }
                return true;
            }
            return false;
        };

        return () => {
            slashCommandStore.onKeyDown = null;
        };
    }, [state, selectedIndex]);

    useEffect(() => {
        // Ensure selected item is in view
        if (state && menuRef.current) {
            const selectedItem = menuRef.current.children[selectedIndex];
            if (selectedItem) {
                selectedItem.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex, state]);

    if (isReadonly || !state || state.items.length === 0) return null;

    const { clientRect } = state;
    const rect = clientRect ? clientRect() : null;
    
    // Positioning logic (similar to floating-ui but simpler absolute coords if needed, 
    // or we can rely on fixed positioning if we want to bypass scroll clipping)
    // Tiptap's clientRect() returns DOMRect relative to viewport.
    const style = rect ? {
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        zIndex: 9999,
        maxHeight: '300px',
        overflowY: 'auto',
    } : { display: 'none' };

    return (
        <div 
            ref={menuRef}
            className="bg-[var(--inscript-color-surface-raised)] border border-[var(--inscript-color-border-strong)] rounded-lg shadow-xl py-2 min-w-[240px] z-[9999]"
            style={style}
        >
            {state.items.map((item, index) => (
                <button
                    key={item.id}
                    className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors ${
                        index === selectedIndex
                            ? 'bg-[var(--inscript-color-active)]'
                            : 'hover:bg-[var(--inscript-color-hover)]'
                    }`}
                    onClick={() => state.command(item)}
                >
                    <div>
                        <div className="text-sm font-medium text-[var(--inscript-color-text)]">{item.title}</div>
                        {item.subtitle && <div className="text-xs text-[var(--inscript-color-muted)]">{item.subtitle}</div>}
                    </div>
                </button>
            ))}
        </div>
    );
};
