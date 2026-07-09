// Named (not default) imports throughout: Rollup/Rolldown's CJS-output interop
// double-wraps a default import when the dependency already ships __esModule
// plus a matching named export (every @tiptap/extension-* package does this),
// silently losing the real export and breaking `X.extend is not a function`
// for any require()-based (CJS) consumer. Named imports sidestep that interop
// entirely, since there's no `.default` unwrapping involved.
import { StarterKit } from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { TextAlign } from '@tiptap/extension-text-align';
import { Link } from '@tiptap/extension-link';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { CustomImage } from './CustomImage.js';
import { CustomTable } from './CustomTable.js';
import { FontSize } from './FontSize.js';
import { Youtube } from './Youtube.js';

export { Youtube } from './Youtube.js';
export { FontSize } from './FontSize.js';
export { CustomTable } from './CustomTable.js';
export { CustomImage } from './CustomImage.js';

/**
 * The full TipTap extension set used by useInscriptEditor. Shared with tests
 * (tests/helpers/createEditor.js) so a headless editor built for testing has
 * exactly the same schema as the one rendered in the app.
 */
export function buildExtensions(options = {}) {
    const extensions = [
        StarterKit.configure({
            history: false,
            link: false,
        }),
        Underline,
        CustomImage.configure({ allowBase64: true }),
        TextStyle,
        Color,
        FontSize,
        Highlight.configure({ multicolor: true }),
        Subscript,
        Superscript,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Youtube,
        CustomTable.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
        Link.configure({
            openOnClick: false,
            linkOnPaste: true,
            autolink: true,
            HTMLAttributes: {
                class: 'text-emerald-500 underline underline-offset-4 cursor-pointer hover:text-emerald-400 transition-colors',
            },
        }),
    ];

    return extensions;
}
