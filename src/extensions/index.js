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
import { InscriptTaskList, InscriptTaskItem } from './TaskLists.js';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import { SlashCommand } from './SlashCommand.js';
import { HostBridge } from './HostBridge.js';
import { FocusModeBlock } from './FocusMode.js';
import { Admonition } from './Admonition.jsx';
import { FootnoteReference, FootnoteDefinition, FootnotesSection } from './Footnote.jsx';
import { Abbreviation } from './Abbreviation.js';
import { DefinitionList, DefinitionTerm, DefinitionDescription } from './DefinitionList.js';
import { Wikilink } from './Wikilink.jsx';
import { Mermaid } from './Mermaid.jsx';
import { MathInline, MathBlock } from './Math.jsx';
import { Citation } from './Citation.js';
import { HtmlComment } from './HtmlComment.js';
import { Embed } from './Embed.jsx';
import { getDefaultSlashItems } from './slashCommandItems.js';
import i18next from 'i18next';

const lowlight = createLowlight(common);

export { Youtube } from './Youtube.js';
export { FontSize } from './FontSize.js';
export { CustomTable } from './CustomTable.js';
export { CustomImage } from './CustomImage.js';
export { Citation } from './Citation.js';
export { HtmlComment } from './HtmlComment.js';
export { Embed } from './Embed.jsx';

/**
 * The full TipTap extension set used by useInscriptEditor. Shared with tests
 * (tests/helpers/createEditor.js) so a headless editor built for testing has
 * exactly the same schema as the one rendered in the app.
 */
export function buildExtensions(options = {}) {
    const extensions = [
        FocusModeBlock,
        StarterKit.configure({
            history: false,
            link: false,
            codeBlock: false,
            // StarterKit v3 bundles Underline; we register our own below, so
            // disable StarterKit's to avoid a duplicate-extension warning.
            underline: false,
        }),
        CodeBlockLowlight.configure({
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
        Youtube.configure({ facade: options.youtube?.facade ?? false }),
        CustomTable.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
        Link.configure({
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

    if (options.wikilink?.enabled) {
        extensions.push(Wikilink.configure({
            resolver: options.wikilink.resolver || null
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
            isTrusted: options.embed?.isTrusted ?? options.isEmbedTrusted ?? null,
            trustedEmbedHosts: options.embed?.trustedEmbedHosts ?? options.trustedEmbedHosts ?? [],
        }));
    }

    // The "/" command menu can be turned off entirely (options.slashCommand === false); otherwise it
    // offers the host-provided items or the defaults.
    if (options.slashCommand !== false) {
        const t = (k, f) => i18next.t(k, { defaultValue: f, ns: 'inscript-editor' });
        extensions.push(
            SlashCommand.configure({
                items: options.slashCommands ?? getDefaultSlashItems(t, options)
            })
        );
    }

    // Always present: carries the host handler ref (in its options) so <InscriptEditor>
    // (toolbar/bubble) can read the same handlers the slash items do. See HostBridge.js.
    extensions.push(HostBridge.configure({ handlersRef: options.hostHandlersRef }));

    return extensions;
}
