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
import { InscriptLink } from './InscriptLink.js';
import { DocumentValues } from './DocumentValues.js';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { CustomImage } from './CustomImage.js';
import { CustomTable } from './CustomTable.js';
import { FontSize } from './FontSize.js';
import { Youtube } from './Youtube.js';
import { InscriptTaskList, InscriptTaskItem } from './TaskLists.js';
import { Code, CodeBlock } from './Code.js';
import { Divider } from './Divider.js';
import { createLowlight, common } from 'lowlight';
import { boundedLowlight } from '../utils/boundedLowlight.js';
import { htmlSpan } from '../utils/parseDom.js';
import { COLSPAN_LIMIT, ROWSPAN_LIMIT, boundedColwidth } from '../utils/tableSize.js';
import { SlashCommand } from './SlashCommand.js';
import { HostBridge, hostHandlersOf } from './HostBridge.js';
import { ImageFiles } from './ImageFiles.js';
import { FocusModeBlock } from './FocusMode.js';
import { Admonition } from './Admonition.jsx';
import { FootnoteReference, FootnoteDefinition, FootnotesSection } from './Footnote.jsx';
import { Abbreviation } from './Abbreviation.js';
import { KeyboardInput } from './KeyboardInput.js';
import { Details, DetailsSummary } from './Details.js';
import { DefinitionList, DefinitionTerm, DefinitionDescription } from './DefinitionList.js';
import { Wikilink } from './Wikilink.jsx';
import { Mermaid } from './Mermaid.jsx';
import { MathInline, MathBlock } from './Math.jsx';
import { Citation } from './Citation.js';
import { HtmlComment } from './HtmlComment.js';
import { SchemaFittingParser } from './SchemaFittingParser.js';
import { Embed } from './Embed.jsx';
import { getDefaultSlashItems } from './slashCommandItems.js';
import { editorT } from '../utils/editorT.js';

// Bounded: see boundedLowlight (a document's code blocks cannot freeze the page).
const lowlight = boundedLowlight(createLowlight(common));

export { Youtube } from './Youtube.js';
export { FontSize } from './FontSize.js';
export { CustomTable } from './CustomTable.js';
export { CustomImage } from './CustomImage.js';
export { Citation } from './Citation.js';
export { HtmlComment } from './HtmlComment.js';
export { Embed } from './Embed.jsx';


/**
 * A table cell's spans read as a browser reads them (`1e5` is 1, not 100000), within HTML's own
 * limits, and its column widths bounded: TipTap's own read a span with a number parser, and a cell
 * that claims 100000 columns makes the table that wide, padding every row.
 */
const boundedSpans = cell => cell.extend({
    addAttributes() {
        const parent = this.parent?.() ?? {};
        return {
            ...parent,
            // From JSON, spans and widths are bounded as HTML reads them (boundedCellAttrs: DocumentValues
            // for a new editor's content, the table size plugin for a change), and an oversized table
            // is read as its cells' contents: never refused, so no document is lost over a value in it.
            colspan: { ...parent.colspan, default: 1, parseHTML: element => htmlSpan(element.getAttribute('colspan'), COLSPAN_LIMIT) },
            rowspan: { ...parent.rowspan, default: 1, parseHTML: element => htmlSpan(element.getAttribute('rowspan'), ROWSPAN_LIMIT) },
            colwidth: {
                ...parent.colwidth,
                parseHTML: element => {
                    const widths = parent.colwidth?.parseHTML?.(element) ?? null;
                    return Array.isArray(widths) ? boundedColwidth(widths) : widths;
                },
            },
        };
    },
});
const BoundedTableCell = boundedSpans(TableCell);
const BoundedTableHeader = boundedSpans(TableHeader);

/**
 * The full TipTap extension set used by useInscriptEditor. Shared with tests
 * (tests/helpers/createEditor.js) so a headless editor built for testing has
 * exactly the same schema as the one rendered in the app.
 */
export function buildExtensions(options = {}) {
    // useInscriptEditor passes a ref to the latest editorOptions: function-valued options are
    // read through it at call time, so a host passing a new function each render neither
    // recreates the editor nor leaves the editor calling a stale one.
    const live = options.liveOptionsRef || null;
    const extensions = [
        // HTML read fitted to the schema (a Markdown renderer's images and list items), whichever
        // features are on.
        SchemaFittingParser,
        // Values a document may not keep (a refused image source or link address, a link's target),
        // cleaned from JSON content as HTML is read without them (see DocumentValues.js).
        DocumentValues,
        // Image files dropped or pasted in, through the host's onImageFile (see ImageFiles.js).
        ImageFiles,
        FocusModeBlock,
        StarterKit.configure({
            // Keystroke undo (Cmd/Ctrl+Z) is StarterKit's UndoRedo, left on: it undoes typing
            // within the current version, while the toolbar's Undo/Redo step through saved versions.
            // (The `history: false` that used to sit here was a TipTap v2 key that v3 ignores.)
            // useInscriptEditor resets it on every load and version jump so it never crosses one.
            link: false,
            // Our own inline code (keeps the marks around it) and code block (see Code.js).
            code: false,
            codeBlock: false,
            // StarterKit v3 bundles Underline; we register our own below, so
            // disable StarterKit's to avoid a duplicate-extension warning.
            underline: false,
        }),
        Code,
        Divider,
        CodeBlock.configure({
            lowlight,
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
        Youtube.configure({
            facade: options.youtube?.facade ?? false,
            privacyUrl: options.youtube?.privacyUrl ?? null,
        }),
        CustomTable.configure({ resizable: true }),
        TableRow,
        BoundedTableHeader,
        BoundedTableCell,
        InscriptLink.configure({
            openOnClick: false,
            linkOnPaste: options.link?.linkOnPaste ?? true,
            autolink: options.link?.autolink ?? true,
            // Link styling lives in CSS (.ProseMirror a[href], token-driven) rather
            // than as classes here, so link color is themeable AND not serialized
            // into the saved document HTML. A host can still inject its own classes
            // via options.link.HTMLAttributes.
            HTMLAttributes: options.link?.HTMLAttributes ?? {},
        }),
    ];

    if (options.taskList !== false) {
        // TipTap's task list and item, also reading GFM-rendered task lists (see TaskLists.js).
        extensions.push(
            InscriptTaskList,
            InscriptTaskItem.configure({ nested: true })
        );
    }

    if (options.admonition !== false) {
        extensions.push(Admonition);
    }

    if (options.footnote !== false) {
        extensions.push(FootnoteReference, FootnoteDefinition, FootnotesSection);
    }

    if (options.definitionList !== false) {
        extensions.push(DefinitionList, DefinitionTerm, DefinitionDescription);
    }

    if (options.abbreviation !== false) {
        extensions.push(Abbreviation);
    }

    if (options.keyboardInput !== false) {
        extensions.push(KeyboardInput);
    }

    if (options.details !== false) {
        extensions.push(Details, DetailsSummary);
    }

    if (options.wikilink?.enabled) {
        extensions.push(Wikilink.configure({
            resolver: live
                ? target => {
                    const resolve = live.current?.wikilink?.resolver;
                    return typeof resolve === 'function' ? resolve(target) : null;
                }
                : (options.wikilink.resolver || null),
        }));
    }

    if (options.mermaid !== false) {
        extensions.push(Mermaid);
    }

    if (options.math !== false) {
        extensions.push(MathInline, MathBlock);
    }

    if (options.citation !== false) {
        extensions.push(Citation);
    }

    // Source comments (`<!-- ... -->`): on by default, since dropping one silently loses the
    // author's hidden note (and turning it into text would reveal it).
    if (options.htmlComment !== false) {
        extensions.push(HtmlComment);
    }

    // Generic third-party embeds. On by default — this is what turns a
    // previously-DROPPED non-YouTube iframe into a round-tripping, gated node.
    // Trust is supplied by the host (never read from the document).
    if (options.embed !== false) {
        extensions.push(Embed.configure({
            isTrusted: live
                ? src => {
                    const current = live.current || {};
                    const trust = current.embed?.isTrusted ?? current.isEmbedTrusted;
                    return typeof trust === 'function' ? trust(src) : false;
                }
                : (options.embed?.isTrusted ?? options.isEmbedTrusted ?? null),
            trustedEmbedHosts: options.embed?.trustedEmbedHosts ?? options.trustedEmbedHosts ?? [],
        }));
    }

    // The "/" command menu can be turned off entirely (options.slashCommand === false); otherwise it
    // offers the host-provided items or the defaults.
    if (options.slashCommand !== false) {
        const items = options.slashCommands ?? getDefaultSlashItems(editorT, options);
        extensions.push(
            SlashCommand.configure({
                items,
                // Host-supplied items are read live, so their command closures never go stale.
                resolveItems: live && options.slashCommands ? () => live.current?.slashCommands ?? items : null,
            })
        );
    }

    // Always present: carries the host handler ref (in its options) so <InscriptEditor>
    // (toolbar/bubble) can read the same handlers the slash items do. See HostBridge.js.
    // Built without useInscriptEditor (no live ref), the handlers given in these options.
    extensions.push(HostBridge.configure({ handlersRef: options.hostHandlersRef ?? { current: hostHandlersOf(options) } }));

    return extensions;
}
