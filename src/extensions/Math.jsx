import { Node, mergeAttributes } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { NODE } from '../constants.js';
import { useEditorEditable } from '../hooks/useEditorEditable.js';
import { inInlineCode, onlyTextBetween, sharedMarks, withoutEdgeSpaces } from '../utils/selectionText.js';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';

// `katex` is an OPTIONAL peer dependency, imported dynamically so it never lands
// in the library bundle and the editor loads fine when a consumer hasn't installed
// it. Consumers that use math must also import the KaTeX stylesheet themselves:
//   import 'katex/dist/katex.min.css';
// When katex is absent (or a render throws), we degrade to showing the raw LaTeX
// source via the `error` path below rather than crashing. That source comes from the
// document, so it is shown as text, never as markup.

// officeParser's default (flag-off) math emission is delimiter-carrying text
// ($…$ / $$…$$). Strip the delimiters on parse so the stored `code` is the bare
// LaTeX, not the delimited source.
function stripMathDelimiters(raw) {
    const s = (raw || '').trim();
    if (s.length >= 4 && s.startsWith('$$') && s.endsWith('$$')) return s.slice(2, -2).trim();
    if (s.length >= 2 && s.startsWith('$') && s.endsWith('$')) return s.slice(1, -1).trim();
    return s;
}

/**
 * The formula an element carries. `data-math` is the exact source (the editor writes it, and
 * attribute values keep their line breaks and backslashes through a Markdown round trip); the
 * text content is the fallback for markup that only has text (officeParser's `$…$` emission).
 */
function readMathCode(element) {
    const fromAttr = element.getAttribute('data-math');
    return stripMathDelimiters(fromAttr || element.textContent || '');
}

/** Macro expansions a formula may make (KaTeX's own default, set so it never depends on the version). */
const KATEX_MAX_EXPAND = 1000;
/** The largest size (in em) a formula may give a rule or a box. */
const KATEX_MAX_SIZE_EM = 50;

// One ResizeObserver per window, shared by every inline formula in it (a document may hold hundreds).
const sizeObservers = new WeakMap();

/** Call `callback` whenever `element` changes size; returns what stops it. Nothing where sizes are not observed. */
function observeSize(element, callback) {
    const View = element.ownerDocument?.defaultView;
    if (typeof View?.ResizeObserver !== 'function') return () => {};
    let shared = sizeObservers.get(View);
    if (!shared) {
        const callbacks = new WeakMap();
        shared = { callbacks, observer: new View.ResizeObserver(entries => entries.forEach(entry => callbacks.get(entry.target)?.())) };
        sizeObservers.set(View, shared);
    }
    shared.callbacks.set(element, callback);
    shared.observer.observe(element);
    return () => {
        shared.callbacks.delete(element);
        shared.observer.unobserve(element);
    };
}

const MathComponent = ({ node, editor, updateAttributes, selected, isInline }) => {
    const { code } = node.attrs;
    const editable = useEditorEditable(editor);
    const [html, setHtml] = useState('');
    const [error, setError] = useState(null);
    // An inline formula wider than its line scrolls sideways (see .math-render-wide); one that fits
    // sits on the text's baseline.
    const renderRef = useRef(null);
    const [wide, setWide] = useState(false);
    useLayoutEffect(() => {
        const element = renderRef.current;
        if (!isInline || !element) return undefined;
        // Measured when the observer first reports the element's size (and on every change after):
        // never a layout forced here, once per formula.
        const measure = () => setWide(element.scrollWidth > element.clientWidth + 1);
        return observeSize(element, measure);
    }, [html, error, isInline]);

    useEffect(() => {
        let cancelled = false;
        if (!code.trim()) {
            setHtml('');
            setError(null);
            return;
        }
        (async () => {
            let katex;
            try {
                katex = (await import('katex')).default;
            } catch {
                if (!cancelled) setError('Math rendering requires the optional "katex" package to be installed.');
                return;
            }
            try {
                const rendered = katex.renderToString(code, {
                    displayMode: !isInline,
                    throwOnError: false, // Prevents crashing on syntax errors, renders error in red
                    // A document's formula is untrusted: no \href, \url, \html* or \includegraphics,
                    // a bounded expansion of its macros, and bounded sizes (it is also clipped to its
                    // own box: see .math-render in the stylesheet).
                    trust: false,
                    maxExpand: KATEX_MAX_EXPAND,
                    maxSize: KATEX_MAX_SIZE_EM,
                });
                if (!cancelled) {
                    setHtml(rendered);
                    setError(null);
                }
            } catch (err) {
                if (!cancelled) setError(err.message);
            }
        })();
        return () => { cancelled = true; };
    }, [code, isInline]);

    const WrapperTag = isInline ? 'span' : 'div';
    // The source editor changes the document, so a read-only editor never offers it.
    const showSourceEditor = selected && editable;
    const renderClass = `math-render ${wide ? 'math-render-wide' : ''} ${selected ? 'ring-2 ring-[var(--inscript-color-accent)] rounded' : ''} ${error ? 'text-red-500' : ''}`;

    return (
        <NodeViewWrapper
            as={WrapperTag}
            className={`math-node-wrapper ${isInline ? 'inline-block mx-1' : 'my-4 block'} relative cursor-pointer`}
        >
            {error || !html ? (
                // Text, never markup: on the error path this is the document's raw source.
                <WrapperTag ref={renderRef} className={renderClass} title={error || undefined}>
                    {error ? code : (isInline ? 'Empty math' : 'Empty math block')}
                </WrapperTag>
            ) : (
                // KaTeX's own output (trust off, so no \href, \url or \html* commands).
                <WrapperTag ref={renderRef} className={renderClass} dangerouslySetInnerHTML={{ __html: html }} />
            )}
            {showSourceEditor && (
                <div
                    className={`absolute z-50 bg-[var(--inscript-color-surface-raised)] border border-[var(--inscript-color-border-strong)] shadow-lg rounded p-2 flex items-center gap-2 ${
                        isInline ? 'top-full left-0 mt-1' : 'top-full left-1/2 -translate-x-1/2 mt-1'
                    }`}
                    style={{ minWidth: '250px' }}
                >
                    <input
                        type="text"
                        className="flex-1 p-1 border border-[var(--inscript-color-border)] rounded font-mono text-sm text-[var(--inscript-color-text)] outline-none focus:border-[var(--inscript-color-accent)]"
                        placeholder="LaTeX math..."
                        value={code}
                        onChange={e => updateAttributes({ code: e.target.value })}
                        onKeyDown={e => {
                            if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Enter') {
                                e.stopPropagation();
                            }
                            // Enter in a text field submits the form around it: the editor may sit in the host's.
                            if (e.key === 'Enter') e.preventDefault();
                        }}
                        autoFocus
                    />
                </div>
            )}
        </NodeViewWrapper>
    );
};

/**
 * Where inline math goes for a selection, and its source: only where text with inline nodes goes, in
 * place of text selected within one block, which becomes its source (a key or formula in it as its
 * text, a line break as a space; the spaces at its edges stay round it). Not in inline code or a
 * code block (which it would split), between blocks, or over selected cells, blocks, the whole
 * document, text running across blocks, or text holding anything else inline (a footnote, a
 * citation: not text to put in a formula, and not deleted for one). A selected inline node (a
 * formula, a key) stays: the new formula goes after it. Null where it cannot go.
 * @param {Pick<import('@tiptap/pm/state').EditorState, 'schema' | 'doc' | 'selection' | 'storedMarks'>} state
 * @returns {{ from: number, to: number, code: string, marks: readonly import('@tiptap/pm/model').Mark[] } | null}
 */
export function inlineMathPlan(state) {
    const { selection } = state;
    const type = state.schema.nodes[NODE.MATH_INLINE];
    if (!type) return null;
    // Never inline code's formatting (a formula is not code, even after a key or code text).
    const notCode = marks => marks.filter(mark => !mark.type.spec.code);
    if (selection instanceof NodeSelection && selection.node.isInline) {
        const $after = state.doc.resolve(selection.to);
        return $after.parent.canReplaceWith($after.index(), $after.index(), type) ? { from: selection.to, to: selection.to, code: '', marks: notCode(selection.node.marks) } : null;
    }
    const { $from, $to } = selection;
    if (!$from.sameParent($to) || !$from.parent.canReplaceWith($from.index(), selection.empty ? $from.index() : $to.indexAfter(), type)) return null;
    if (inInlineCode(state.doc, selection.from, selection.to)) return null;
    const textOf = node => node.type.spec.leafText?.(node)
        ?? (typeof node.attrs?.code === 'string' ? node.attrs.code : node.type.name === NODE.HARD_BREAK ? ' ' : null);
    if (!onlyTextBetween(state.doc, selection.from, selection.to, node => textOf(node) !== null)) return null;
    const leafText = node => textOf(node) ?? '';
    const { from, to } = withoutEdgeSpaces(state.doc, selection.from, selection.to, leafText);
    // It keeps the formatting all of its text shares (a linked word stays linked, as a key does);
    // with no text (a cursor, only spaces), the formatting where it goes, as for text typed there
    // (turned on or off there: stored marks).
    const shared = sharedMarks(state.doc, from, to);
    const marks = notCode(shared ?? state.storedMarks ?? state.doc.resolve(from).marks());
    // Only spaces selected (or none): the formula goes after them, the spaces kept.
    return { from, to, code: state.doc.textBetween(from, to, ' ', leafText), marks };
}

export const MathInline = Node.create({
    name: 'mathInline',
    group: 'inline',
    inline: true,
    atom: true,

    addAttributes() {
        return {
            code: {
                default: 'E=mc^2',
                parseHTML: readMathCode,
                // Carried by `data-math` + the text content; don't also serialize a
                // stray raw `code` attribute.
                renderHTML: () => ({}),
            },
        };
    },

    parseHTML() {
        return [
            { tag: 'span[data-math]' },
            { tag: 'span.math-inline' },
        ];
    },

    renderHTML({ node, HTMLAttributes }) {
        const code = node.attrs.code || '';
        return ['span', mergeAttributes(HTMLAttributes, { 'data-math': code, class: 'math-inline' }), code];
    },

    addNodeView() {
        return ReactNodeViewRenderer((props) => <MathComponent {...props} isInline={true} />);
    },

    addCommands() {
        return {
            // See inlineMathPlan.
            insertMathInline: () => ({ state, commands }) => {
                const plan = inlineMathPlan(state);
                if (!plan) return false;
                const node = {
                    type: this.name,
                    ...(plan.code ? { attrs: { code: plan.code } } : {}),
                    ...(plan.marks.length ? { marks: plan.marks.map(mark => mark.toJSON()) } : {}),
                };
                return commands.insertContentAt(plan.from === plan.to ? plan.from : { from: plan.from, to: plan.to }, node);
            },
        };
    },
});

export const MathBlock = Node.create({
    name: 'mathBlock',
    group: 'block',
    atom: true,

    addAttributes() {
        return {
            code: {
                default: '\\int_0^\\infty x^2 dx',
                parseHTML: readMathCode,
                renderHTML: () => ({}),
            },
        };
    },

    parseHTML() {
        return [
            { tag: 'div[data-math]' },
            { tag: 'div.math-block' },
        ];
    },

    renderHTML({ node, HTMLAttributes }) {
        const code = node.attrs.code || '';
        return ['div', mergeAttributes(HTMLAttributes, { 'data-math': code, class: 'math-block' }), code];
    },

    addNodeView() {
        return ReactNodeViewRenderer((props) => <MathComponent {...props} isInline={false} />);
    },

    addCommands() {
        return {
            insertMathBlock: () => ({ commands }) => {
                return commands.insertContent({
                    type: this.name,
                });
            },
        };
    },
});
