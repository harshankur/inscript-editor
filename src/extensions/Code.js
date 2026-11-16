import { Code as TiptapCode } from '@tiptap/extension-code';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { Fragment } from '@tiptap/pm/model';
import { mergeAttributes } from '@tiptap/core';
import { codeHighlightPlugin } from './codeHighlight.js';

import { codeLanguage } from '../utils/codeLanguage.js';


/** The one newline a Markdown renderer always ends a fenced code block with. */
const TRAILING_NEWLINE = /\r?\n$/;

/**
 * Code blocks with syntax highlighting. A Markdown renderer ends every fenced code block's text
 * with a newline (CommonMark keeps none), which showed as an empty last line after every load: that
 * one newline is not part of the code.
 */
export const CodeBlock = CodeBlockLowlight.extend({
    addAttributes() {
        const parent = this.parent?.() ?? {};
        return {
            ...parent,
            language: {
                ...parent.language,
                parseHTML: element => codeLanguage(parent.language?.parseHTML?.(element) ?? null),
            },
        };
    },

    // One highlighting plugin, ours (see codeHighlight.js): extending CodeBlockLowlight had TipTap add
    // its own twice, each walking the whole document on every change, and it never finished a pass the
    // bounded lowlight left unfinished.
    addProseMirrorPlugins() {
        return [
            // TipTap's highlighting plugin: one that keeps a state and draws decorations (by what it is,
            // not by its key's name).
            ...(this.parent?.() ?? []).filter(plugin => !(plugin.spec.state && plugin.spec.props?.decorations)),
            codeHighlightPlugin({ name: this.name, lowlight: this.options.lowlight, defaultLanguage: this.options.defaultLanguage }),
        ];
    },

    // As TipTap's, with the language written only when it is a name (see codeLanguage).
    renderHTML({ node, HTMLAttributes }) {
        const language = codeLanguage(node.attrs.language);
        return [
            'pre',
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
            ['code', { class: language ? this.options.languageClassPrefix + language : null }, 0],
        ];
    },

    parseHTML() {
        return (this.parent?.() ?? []).map(rule => ({
            ...rule,
            getContent: (node, schema) => {
                const text = (node.textContent || '').replace(TRAILING_NEWLINE, '');
                return text ? Fragment.from(schema.text(text)) : Fragment.empty;
            },
        }));
    },
});

/**
 * Inline code that keeps the marks around it. TipTap's excludes every other mark, so a linked
 * code span (`` [`npm`](https://www.npmjs.com/) `` in Markdown) lost its link on load, and bold
 * code its bold.
 */
export const Code = TiptapCode.extend({
    excludes: '',
});
