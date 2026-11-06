// Shared harness for the component tests in this folder (not a test file).
import { forwardRef, useImperativeHandle } from 'react';
import { act, render } from '@testing-library/react';
import { useInscriptEditor } from '../../src/hooks/useInscriptEditor.js';
import { InscriptEditor } from '../../src/InscriptEditor.jsx';
import { ALL_TOOL_IDS } from '../../src/toolbar/toolRegistry.js';

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

/** A document with text, a table, an image and a video: something for every toolbar and menu button. */
export const FULL_EDITOR_DOC = '<p>hello world</p><table><tbody><tr><th><p>H</p></th></tr><tr><td><p>x</p></td></tr></tbody></table>'
    + '<img src="https://example.com/a.png"><div data-youtube-video="dQw4w9WgXcQ"></div>';

/**
 * The full editor (every tool, every host handler, the customizer) on FULL_EDITOR_DOC, with "hello"
 * selected. Stub the toolbar width first so no tool overflows.
 */
export async function setupFullEditor(props = {}) {
    const hookOptions = { initialContent: FULL_EDITOR_DOC, editorOptions: { onShowMediaLibrary: () => {}, onAddYoutube: () => {} } };
    const baseProps = { toolbarConfig: ALL_TOOL_IDS, onShowMetadataModal: () => {}, onToolbarConfigChange: () => {}, ...props };
    const r = renderHost(hookOptions, baseProps);
    await flush();
    const editor = r.api.current.editor;
    act(() => { editor.commands.setTextSelection({ from: 1, to: 6 }); });
    return { ...r, editor, rerenderWith: (next) => r.rerender(hookOptions, { ...baseProps, ...next }) };
}
