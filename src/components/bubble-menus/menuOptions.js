import { useMemo } from 'react';
import { BUBBLE_MENU_OFFSET, BUBBLE_MENU_Z_INDEX } from '../../constants.js';

/** The style every selection menu's element gets (TipTap manages its position and visibility). */
export const BUBBLE_MENU_STYLE = Object.freeze({ zIndex: BUBBLE_MENU_Z_INDEX });

/**
 * The floating-ui options for a selection menu (TipTap v3's BubbleMenu `options`), stable while the
 * inputs are (BubbleMenu dispatches a transaction whenever its options change).
 *
 * - `scrollTarget`: the element whose scrolling moves the content (the editor's scroll container),
 *   so the menu follows what it is about; the window by default.
 * - `hide`: the menu disappears once what it is about has scrolled out of view.
 * - flip and shift keep it on screen next to a selection near an edge.
 *
 * Where the menu lives is the BubbleMenu's `appendTo` (see bubbleMenuContainer): outside the scroll
 * container, which would clip it.
 *
 * @param {'top' | 'bottom'} placement
 * @param {HTMLElement | null | undefined} scrollContainer
 */
export function useBubbleMenuOptions(placement, scrollContainer) {
    return useMemo(() => ({
        placement,
        offset: BUBBLE_MENU_OFFSET,
        flip: { padding: BUBBLE_MENU_OFFSET },
        shift: { padding: BUBBLE_MENU_OFFSET },
        hide: true,
        scrollTarget: scrollContainer || window,
    }), [placement, scrollContainer]);
}

/** The BubbleMenu `appendTo` for a container, or undefined for TipTap's default (the editor's parent). */
export const bubbleMenuContainer = container => container || undefined;
