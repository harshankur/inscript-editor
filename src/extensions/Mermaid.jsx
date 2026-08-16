import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React, { useState, useEffect, useRef } from 'react';

// `mermaid` is an OPTIONAL peer dependency, imported dynamically so its (large)
// bundle never lands in the library and the editor loads fine when a consumer
// hasn't installed it. When mermaid is absent (or a render throws) we degrade to
// the `error`/source path below rather than crashing. `initialize` runs once, the
// first time a diagram actually renders.
let mermaidInitialized = false;

const MermaidComponent = (props) => {
    const { node, updateAttributes, selected } = props;
    const { code } = node.attrs;
    const [svg, setSvg] = useState('');
    const [error, setError] = useState(null);
    const idRef = useRef(`mermaid-${Math.random().toString(36).substr(2, 9)}`);

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
                if (isMounted) setError('Mermaid diagrams require the optional "mermaid" package to be installed.');
                return;
            }
            try {
                if (!mermaidInitialized) {
                    mermaid.initialize({ startOnLoad: false, theme: 'default' });
                    mermaidInitialized = true;
                }
                const { svg: renderedSvg } = await mermaid.render(idRef.current, code);
                if (isMounted) {
                    setSvg(renderedSvg);
                    setError(null);
                }
            } catch (err) {
                if (isMounted) {
                    setError(err.message || 'Syntax Error in Mermaid graph');
                }
            }
        };
        renderMermaid();
        return () => { isMounted = false; };
    }, [code]);

    return (
        <NodeViewWrapper className="mermaid-node my-4 p-4 border border-slate-200 rounded-md bg-white">
            {selected && (
                <div className="mb-4">
                    <textarea
                        className="w-full p-2 border border-slate-300 rounded font-mono text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                        rows={5}
                        placeholder="Enter mermaid code here... (e.g. graph TD;\n A-->B;)"
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
                    <div className="text-red-500 text-sm font-mono whitespace-pre-wrap">{error}</div>
                ) : svg ? (
                    <div dangerouslySetInnerHTML={{ __html: svg }} />
                ) : (
                    <div className="text-slate-400 italic">Empty Mermaid diagram</div>
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
                parseHTML: element => element.textContent || element.getAttribute('data-mermaid') || '',
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
