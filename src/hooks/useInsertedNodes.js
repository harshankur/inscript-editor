import { useLayoutEffect, useRef } from 'react';

/**
 * A ref for an element whose content is nodes put in as they are, never markup parsed again (where
 * text a cleaning saw as text could come back live): `build(document)` gives them (a node or a
 * fragment, or null for none), made anew whenever `deps` change. They go in the element itself, or in a
 * shadow root of its own (`shadow`), whose styles and ids never reach the page.
 * @param {(document: Document) => Node | null} build
 * @param {unknown[]} deps
 * @param {{ shadow?: boolean }} [options]
 */
export function useInsertedNodes(build, deps, { shadow = false } = {}) {
    const ref = useRef(null);
    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) return;
        const target = shadow ? (element.shadowRoot ?? element.attachShadow({ mode: 'open' })) : element;
        const nodes = build(element.ownerDocument);
        if (nodes) target.replaceChildren(nodes);
        else target.replaceChildren();
    // The nodes follow `deps` (build is made anew on every render) and where they go.
    }, [...deps, shadow]);
    return ref;
}
