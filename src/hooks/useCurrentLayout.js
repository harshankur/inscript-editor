import { useMemo } from 'react';
import { currentLayout } from '../toolbar/presetHistory.js';

/**
 * A saved layout as it is today (see currentLayout), for the toolbar and the selection menu alike.
 * Worked out again only when its inputs change, by value (a host may pass its layouts and presets as
 * new objects on every render, or change one in place; a layout is a few dozen ids).
 * @param {unknown} config
 * @param {'toolbar' | 'bubble'} surface
 * @param {{ savedWith?: string | { toolbar?: string, bubble?: string } | null, unavailable?: string[], presets?: Record<string, string[]>, presetsMode?: 'merge' | 'replace' }} options -
 *   `savedWith`: the release the layout was saved with, one for both layouts or one for each
 *   (`{ toolbar, bubble }`); `unavailable`: the tools this editor cannot show.
 */
export function useCurrentLayout(config, surface, { savedWith, unavailable, presets, presetsMode } = {}) {
    const release = savedWith && typeof savedWith === 'object' ? savedWith[surface] : savedWith;
    const key = JSON.stringify([config, release, unavailable, presets, presetsMode]);
    return useMemo(
        () => {
            const layout = currentLayout(config, surface, { savedWith: release, unavailable, presets, presetsMode });
            // A new array whenever the value is new (a host may change its own in place): what reads it
            // by reference sees the change.
            return Array.isArray(layout) && layout === config ? [...layout] : layout;
        },
        // The inputs by value (key), not by reference.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [key, surface],
    );
}
