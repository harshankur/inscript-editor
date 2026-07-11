import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React, { useState, useEffect } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const MathComponent = ({ node, updateAttributes, selected, isInline }) => {
    const { code } = node.attrs;
    const [html, setHtml] = useState('');
    const [error, setError] = useState(null);

    useEffect(() => {
        try {
            if (!code.trim()) {
                setHtml('');
                setError(null);
                return;
            }
            const rendered = katex.renderToString(code, {
                displayMode: !isInline,
                throwOnError: false, // Prevents crashing on syntax errors, renders error in red
            });
            setHtml(rendered);
            setError(null);
        } catch (err) {
            setError(err.message);
        }
    }, [code, isInline]);

    const WrapperTag = isInline ? 'span' : 'div';

    return (
        <NodeViewWrapper
            as={WrapperTag}
            className={`math-node-wrapper ${isInline ? 'inline-block mx-1' : 'my-4 block'} relative cursor-pointer`}
        >
            <WrapperTag
                className={`math-render ${selected ? 'ring-2 ring-emerald-500 rounded' : ''} ${error ? 'text-red-500' : ''}`}
                dangerouslySetInnerHTML={{ __html: error ? code : html || (isInline ? 'Empty math' : 'Empty math block') }}
            />
            {selected && (
                <div
                    className={`absolute z-50 bg-white border border-slate-300 shadow-lg rounded p-2 flex items-center gap-2 ${
                        isInline ? 'top-full left-0 mt-1' : 'top-full left-1/2 -translate-x-1/2 mt-1'
                    }`}
                    style={{ minWidth: '250px' }}
                >
                    <input
                        type="text"
                        className="flex-1 p-1 border border-slate-200 rounded font-mono text-sm outline-none focus:border-emerald-500"
                        placeholder="LaTeX math..."
                        value={code}
                        onChange={e => updateAttributes({ code: e.target.value })}
                        onKeyDown={e => {
                            if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Enter') {
                                e.stopPropagation();
                            }
                        }}
                        autoFocus
                    />
                </div>
            )}
        </NodeViewWrapper>
    );
};

export const MathInline = Node.create({
    name: 'mathInline',
    group: 'inline',
    inline: true,
    atom: true,

    addAttributes() {
        return {
            code: {
                default: 'E=mc^2',
                parseHTML: element => element.textContent || element.getAttribute('data-math') || '',
            },
        };
    },

    parseHTML() {
        return [
            { tag: 'span[data-math]' },
            { tag: 'span.math-inline' },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { 'data-math': HTMLAttributes.code, class: 'math-inline' }), HTMLAttributes.code];
    },

    addNodeView() {
        return ReactNodeViewRenderer((props) => <MathComponent {...props} isInline={true} />);
    },

    addCommands() {
        return {
            insertMathInline: () => ({ commands }) => {
                return commands.insertContent({
                    type: this.name,
                });
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
                parseHTML: element => element.textContent || element.getAttribute('data-math') || '',
            },
        };
    },

    parseHTML() {
        return [
            { tag: 'div[data-math]' },
            { tag: 'div.math-block' },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { 'data-math': HTMLAttributes.code, class: 'math-block' }), HTMLAttributes.code];
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
