import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React, { useState, useEffect, useRef } from 'react';
import { cleanSvg } from '../utils/cleanSvg.js';
import { useInscriptT } from '../hooks/useInscriptT.js';
import { useEditorEditable } from '../hooks/useEditorEditable.js';
import { useInsertedNodes } from '../hooks/useInsertedNodes.js';
import { saidError } from '../utils/saidError.js';

// `mermaid` is an OPTIONAL peer dependency, imported dynamically so its (large)
// bundle never lands in the library and the editor loads fine when a consumer
// hasn't installed it. When mermaid is absent (or a render throws) we degrade to
// the `error`/source path below rather than crashing.

/** How a document's diagram is drawn: labels as text, no click handlers or links run. */
const MERMAID_SECURITY_LEVEL = 'strict';
/** How a document's diagram is drawn. */
const EDITOR_CONFIG = Object.freeze({ startOnLoad: false, theme: 'default', look: 'classic', layout: 'dagre', securityLevel: MERMAID_SECURITY_LEVEL });
/** Diagrams being drawn here, and the page's Mermaid configuration from before the first of them. */
let drawing = 0;
let pageConfig = null;
/** The site configuration as the editor set it (to tell whether the page set its own since). */
let drawnWith = null;
const configSnapshot = mermaid => {
    try { return JSON.stringify(mermaid.mermaidAPI?.getSiteConfig?.() ?? null); } catch { return null; }
};

/** How long typing in a diagram's source must pause before it is drawn again, in ms. */
const MERMAID_REDRAW_DELAY_MS = 250;

/**
 * A drawn diagram's cleaned nodes, put in as they are (see cleanSvg), in a shadow root of their own:
 * the diagram's styles and ids stay inside it, never reaching the host's page.
 */
function DiagramNodes({ svg }) {
    // Cleaned once for each drawing, in the element's own document, and put in as it is. A drawing that
    // could not be cleaned says so beside it, as text of the editor's own (following its language).
    const { t } = useInscriptT();
    const [unshownSvg, setUnshownSvg] = useState(null);
    const ref = useInsertedNodes(
        ownerDocument => {
            const nodes = cleanSvg(svg, ownerDocument);
            // Changed only when it changes (no render of its own for a drawing shown as before).
            const unshown = nodes ? null : svg;
            if (unshown !== unshownSvg) setUnshownSvg(unshown);
            return nodes;
        },
        [svg],
        { shadow: true },
    );
    // The shadow's host inside a box of its own, contained: the diagram can style its host (`:host`),
    // never this box, so nothing in it (a fixed position) reaches past it.
    return (
        <div style={DIAGRAM_CONTAINMENT}>
            <div ref={ref} />
            {unshownSvg === svg && <div className="text-[var(--inscript-color-muted)] text-sm">{t('mermaidUnavailable', 'This diagram could not be shown.')}</div>}
        </div>
    );
}

const DIAGRAM_CONTAINMENT = Object.freeze({ position: 'relative', overflowX: 'auto', overflowY: 'hidden', contain: 'paint', maxWidth: '100%' });

/** Messages of the editor's own about a diagram, in the editor's `t` (said when shown). */
const MERMAID_MISSING = t => t('mermaidMissing', 'Mermaid diagrams require the optional "mermaid" package to be installed.');
const MERMAID_SYNTAX_ERROR = t => t('mermaidSyntaxError', 'Syntax Error in Mermaid graph');

const MermaidComponent = (props) => {
    const { node, editor, updateAttributes, selected } = props;
    const { code } = node.attrs;
    // The source editor changes the document: only while the editor can be edited, followed as it changes.
    const editable = useEditorEditable(editor);
    const { t } = useInscriptT();
    const [svg, setSvg] = useState('');
    const [error, setError] = useState(null);
    const idRef = useRef(`mermaid-${Math.random().toString(36).substr(2, 9)}`);

    // The first drawing is immediate; after that, typing in the source redraws once it pauses.
    const drawnOnceRef = useRef(false);
    useEffect(() => {
        let isMounted = true;
        const renderMermaid = async () => {
            if (!code.trim()) {
                setSvg('');
                setError(null);
                return;
            }
            let mermaid;
            try {
                mermaid = (await import('mermaid')).default;
            } catch {
                // A message of the editor's own, said when shown: in the language of the moment.
                if (isMounted) setError({ say: MERMAID_MISSING });
                return;
            }
            // Mermaid's configuration is the page's: a host may set its own (a `loose` security level
            // for its own diagrams), even while a diagram here waits its turn in Mermaid's queue. So
            // what Mermaid draws is cleaned here anyway (see cleanSvg), and asked strict as well; the
            // page's configuration is put back once no diagram here is being drawn.
            // look/layout pinned to Mermaid 11's defaults: Mermaid 12 switched its defaults to the
            // "neo" look and the ELK layout, so the same document would otherwise draw differently
            // depending on the host's Mermaid. A diagram can still opt in through its own frontmatter
            // config (never to a looser security level: Mermaid keeps that one from diagrams).
            // The site configuration (the page's own), not the current one, which holds the last drawn
            // diagram's own directives (it would make them the page's).
            let counted = false;
            try {
                // Before the first diagram, or when the page has set its own since the last one began.
                // (The snapshot is taken only while another diagram here draws.)
                const changed = drawing === 0 || configSnapshot(mermaid) !== drawnWith;
                if (changed) pageConfig = mermaid.mermaidAPI?.getSiteConfig?.() ?? mermaid.mermaidAPI?.getConfig?.() ?? null;
                drawing += 1;
                counted = true;
                // Mermaid's own defaults with these (never the page's theme colours, which would carry
                // over to a theme they were not made for); already so while another diagram here draws.
                if (changed) {
                    mermaid.initialize(EDITOR_CONFIG);
                    drawnWith = configSnapshot(mermaid);
                }
                const { svg: renderedSvg } = await mermaid.render(idRef.current, code);
                if (isMounted) {
                    // A drawing that came back empty is no drawing (never left loading).
                    setSvg(renderedSvg || '');
                    setError(renderedSvg ? null : { say: MERMAID_SYNTAX_ERROR });
                }
            } catch (err) {
                if (isMounted) {
                    setError(err?.message || { say: MERMAID_SYNTAX_ERROR });
                }
            } finally {
                if (counted) drawing -= 1;
                // Put back only if the page has not set its own meanwhile (that one stays). A history
                // preview holds no `.mermaid` element for the page's Mermaid to draw (see previewHtml).
                if (counted && drawing === 0 && pageConfig) {
                    if (configSnapshot(mermaid) === drawnWith) mermaid.initialize(pageConfig);
                    pageConfig = null;
                    drawnWith = null;
                }
            }
        };
        const delay = drawnOnceRef.current ? MERMAID_REDRAW_DELAY_MS : 0;
        drawnOnceRef.current = true;
        const timer = setTimeout(renderMermaid, delay);
        return () => { isMounted = false; clearTimeout(timer); };
    }, [code]);

    return (
        <NodeViewWrapper className="mermaid-node my-4 p-4 border border-[var(--inscript-color-border)] rounded-md bg-[var(--inscript-color-surface-raised)]">
            {selected && editable && (
                <div className="mb-4">
                    <textarea
                        className="w-full p-2 border border-[var(--inscript-color-border-strong)] rounded font-mono text-sm text-[var(--inscript-color-text)] outline-none focus:ring-2 focus:ring-[var(--inscript-color-accent)]"
                        rows={5}
                        placeholder={t('mermaidPlaceholder', 'Enter mermaid code here... (e.g. graph TD;\n A-->B;)')}
                        value={code}
                        onChange={e => updateAttributes({ code: e.target.value })}
                        onKeyDown={e => {
                            // Stop prosemirror from capturing these keys when editing
                            if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Enter') {
                                e.stopPropagation();
                            }
                        }}
                    />
                </div>
            )}
            <div className="mermaid-render flex justify-center items-center min-h-[50px]">
                {error ? (
                    <div className="text-red-500 text-sm font-mono whitespace-pre-wrap">{saidError(error, t)}</div>
                ) : svg ? (
                    <DiagramNodes svg={svg} />
                ) : code.trim() ? (
                    // Its source, as text, while Mermaid loads and draws it (the first diagram of a session
                    // waits for it): only a diagram with no code at all is empty.
                    <div className="text-[var(--inscript-color-muted)] text-sm font-mono whitespace-pre-wrap" aria-busy="true" title={t('mermaidLoading', 'Drawing the diagram…')}>{code}</div>
                ) : (
                    <div className="text-[var(--inscript-color-muted)] italic">{t('mermaidEmpty', 'Empty Mermaid diagram')}</div>
                )}
            </div>
        </NodeViewWrapper>
    );
};

export const Mermaid = Node.create({
    name: 'mermaid',
    group: 'block',
    atom: true,

    addAttributes() {
        return {
            code: {
                default: 'graph TD;\n    A-->B;',
                // `data-mermaid` is the exact source (attribute values keep their line breaks through a
                // Markdown round trip); the text content is the fallback for markup that only has text.
                parseHTML: element => element.getAttribute('data-mermaid') || element.textContent || '',
                // Carried by `data-mermaid` + the text content; don't also serialize
                // a stray raw `code` attribute.
                renderHTML: () => ({}),
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div.mermaid',
            },
            {
                tag: 'pre.mermaid',
            },
            {
                tag: 'div[data-mermaid]',
            },
            {
                // officeParser's default (flag-off) mermaid shape:
                // <pre><code class="language-mermaid">…</code></pre>. Claim the <pre>
                // (with higher priority than the code-block extension) only when its
                // code is language-mermaid; otherwise fall through to a normal code block.
                tag: 'pre',
                priority: 60,
                getAttrs: node => (node.querySelector('code.language-mermaid') ? {} : false),
            },
        ];
    },

    renderHTML({ node, HTMLAttributes }) {
        const code = node.attrs.code || '';
        return ['div', mergeAttributes(HTMLAttributes, { 'data-mermaid': code, class: 'mermaid' }), code];
    },

    addNodeView() {
        return ReactNodeViewRenderer(MermaidComponent);
    },

    addCommands() {
        return {
            insertMermaid: () => ({ commands }) => {
                return commands.insertContent({
                    type: this.name,
                });
            },
        };
    },
});
