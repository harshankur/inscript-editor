// Shared harness for the component tests in this folder (not a test file).
import { forwardRef, useImperativeHandle } from 'react';
import { act, render } from '@testing-library/react';
import { useInscriptEditor } from '../../src/hooks/useInscriptEditor.js';
import { InscriptEditor } from '../../src/InscriptEditor.jsx';

/** Tiny seeded PRNG (mulberry32), so randomized sequences reproduce. */
export function prng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function stubClientWidth(width) {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return width; } });
    return () => { if (original) Object.defineProperty(HTMLElement.prototype, 'clientWidth', original); };
}

/**
 * Renders <InscriptEditor {...useInscriptEditor(hookOptions)} {...props} /> and returns the
 * live hook result through `api.current`.
 */
export const Host = forwardRef(function Host({ hookOptions = {}, props = {} }, ref) {
    const hook = useInscriptEditor(hookOptions);
    useImperativeHandle(ref, () => hook, [hook]);
    return <InscriptEditor {...hook} {...props} />;
});

export function renderHost(hookOptions = {}, props = {}) {
    const api = { current: null };
    const utils = render(<Host ref={api} hookOptions={hookOptions} props={props} />);
    const rerender = (nextHook = hookOptions, nextProps = props) => utils.rerender(<Host ref={api} hookOptions={nextHook} props={nextProps} />);
    return { ...utils, api, rerender, editor: () => api.current.editor };
}

export async function flush() {
    await act(async () => { await Promise.resolve(); });
}
