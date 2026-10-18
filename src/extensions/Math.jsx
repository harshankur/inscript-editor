import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React, { useState, useEffect } from 'react';

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

const MathComponent = ({ node, editor, updateAttributes, selected, isInline }) => {
    const { code } = node.attrs;
    const [html, setHtml] = useState('');
    const [error, setError] = useState(null);

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
    const showSourceEditor = selected && editor?.isEditable !== false;
    const renderClass = `math-render ${selected ? 'ring-2 ring-[var(--inscript-color-accent)] rounded' : ''} ${error ? 'text-red-500' : ''}`;

    return (
        <NodeViewWrapper
            as={WrapperTag}
            className={`math-node-wrapper ${isInline ? 'inline-block mx-1' : 'my-4 block'} relative cursor-pointer`}
        >
            {error || !html ? (
                // Text, never markup: on the error path this is the document's raw source.
                <WrapperTag className={renderClass} title={error || undefined}>
                    {error ? code : (isInline ? 'Empty math' : 'Empty math block')}
                </WrapperTag>
            ) : (
                // KaTeX's own output (trust off, so no \href, \url or \html* commands).
                <WrapperTag className={renderClass} dangerouslySetInnerHTML={{ __html: html }} />
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
