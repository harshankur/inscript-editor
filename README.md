# inscript-editor

A standalone, TipTap-based rich text editor for React. Extracted from [Inscript](https://inscript.harshankur.com), a self-hosted markdown CMS, so it can be reused across other projects.

<!-- screenshot: docs/screenshot.png -->

## Features

- **Rich text editing** built on [TipTap v3](https://tiptap.dev) — bold/italic/underline/strike, headings, lists, blockquotes, code blocks, sub/superscript, text alignment, font size, text/highlight color, and links.
- **Images** with inline resizing, alignment, and a media-library modal (bring your own upload/list backend).
- **Tables** with per-cell/row/column controls, header row/column toggles, and layout alignment.
- **YouTube embeds** by URL or search, with strict ID validation and a placeholder for legacy/corrupt content instead of a broken embed.
- **Version history** with a visual/text/source diff view and one-click restore.
- **Responsive toolbar** that collapses overflowing tools into a "More" menu based on measured width.
- **Built-in i18n** in 19 languages, safe to use even if you never touch i18next.
- Ships as ESM + CJS, with hand-written TypeScript types.

## Installation

```bash
npm install inscript-editor
```

Peer dependencies (install alongside, matching the ranges in `package.json`):

```bash
npm install react react-dom \
  @tiptap/core @tiptap/pm @tiptap/react @tiptap/starter-kit @tiptap/suggestion \
  @tiptap/extension-code-block-lowlight @tiptap/extension-color @tiptap/extension-highlight \
  @tiptap/extension-image @tiptap/extension-link @tiptap/extension-subscript \
  @tiptap/extension-superscript @tiptap/extension-table @tiptap/extension-table-cell \
  @tiptap/extension-table-header @tiptap/extension-table-row @tiptap/extension-task-item \
  @tiptap/extension-task-list @tiptap/extension-text-align @tiptap/extension-text-style \
  @tiptap/extension-underline lowlight lucide-react diff react-i18next i18next
```

### Optional peer dependencies

Math (KaTeX) and Mermaid load their heavy libraries via a dynamic `import()` only
when a math/diagram node actually renders, so they are declared as **optional**
peers and kept out of this package's bundle.

```bash
# Math (KaTeX). Also import its stylesheet once in your app (see below).
npm install katex

# Mermaid diagrams.
npm install mermaid
```

If you use math, import the KaTeX stylesheet yourself — it is intentionally **not**
bundled into `inscript-editor/styles`:

```js
import 'katex/dist/katex.min.css';
```

**If you use a bundler (Vite, webpack, etc.) you must install `katex`/`mermaid`
whenever those features are enabled** — even though the `import()` is dynamic, the
bundler still resolves the specifier at build time, so a missing package is a
build error, not a graceful runtime fallback. The at-render fallback (the node
degrades to showing its raw source) only applies in non-bundled contexts such as
Node/SSR. To ship without them, either disable the features so they aren't part of
your build's intent (see below) **and** alias/externalize the specifiers in your
bundler, or simply install the packages.

Disable either feature entirely via `useInscriptEditor` options (`math: false`,
`mermaid: false`) so the extension is never registered.

## Quick start

```jsx
import { useInscriptEditor, InscriptEditor } from 'inscript-editor';
import 'inscript-editor/styles';

function PostEditor({ filename }) {
    const {
        editor, history, historyIndex, canUndo, canRedo,
        restoreVersion, markSaved,
    } = useInscriptEditor({
        contentKey: filename,       // recreates the editor when this changes
        title: 'My post',
        onContentChange: (entry) => {
            // entry = { html, title, tags, categories, timestamp }
            // persist to your backend here
        },
    });

    return (
        <InscriptEditor
            editor={editor}
            history={history}
            historyIndex={historyIndex}
            canUndo={canUndo}
            canRedo={canRedo}
            restoreVersion={restoreVersion}
            markSaved={markSaved}
            onShowMediaLibrary={() => {/* open your <ImageSelectorModal> */}}
            onAddYoutube={() => {/* open your <YoutubeEmbedModal> */}}
        />
    );
}
```

`useInscriptEditor` owns the TipTap editor instance and a client-side history stack; `InscriptEditor` renders the toolbar, bubble menus, content area, and (when `showDiff` is true) the history diff view. Everything else — saving, uploads, YouTube search — stays in your app, wired in through props and callbacks.

## Internationalization

The editor's own strings (toolbar tooltips, modal copy, etc.) are translated into 19 languages out of the box: `en, de, fr, es, pt, it, ja, zh, zh-CN, ko, ru, af, ne, hi, bn, ta, te, ml, kn`. They live under a dedicated `inscript-editor` i18next namespace, separate from your app's own translations.

**Zero-config**: if your app already initializes i18next and renders `<InscriptEditor>` (or any of the individually-exported modals/bubble-menus), the library auto-registers its bundled languages into your active i18next instance on mount. Nothing else to do.

**No i18next at all?** Every string carries an English `defaultValue`, so the editor renders correctly in English even if your app never sets up i18next.

**Overriding or extending strings**, from the `inscript-editor/locales` subpath:

```js
import i18n from 'i18next';
import { registerInscriptEditorTranslations } from 'inscript-editor/locales';

registerInscriptEditorTranslations(i18n, {
    languages: ['en', 'de', 'fr'],       // only register a subset (drops the rest)
    overrides: {
        en: { insertImage: 'Add Image' },  // partially override strings for a shipped language
        pt: { insertLink: 'Link' },        // ...or override for any other shipped language
        'pt-BR': { insertLink: 'Link' },   // ...or register a language the library doesn't ship at all
    },
    overwrite: false,                     // default: resources you registered first always win
});
```

Call this *before* mounting the editor if you want your overrides to apply from the first render — the library's own auto-registration uses `overwrite: false`, so anything you've already registered under the `inscript-editor` namespace is left alone.

You can also reach for plain i18next APIs post-hoc:

```js
i18n.addResourceBundle('en', 'inscript-editor', { insertImage: 'Add Image' }, true, true);
```

`inscriptEditorTranslations` (also exported from `inscript-editor/locales`) gives you the raw `{ [lang]: bundle }` map if you want to inspect or reuse it directly.

## API reference

### `useInscriptEditor(options)`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `contentKey` | `string` | `''` | Changing this recreates the TipTap editor and resets history/dirty state. Pass a filename or document id. |
| `title` | `string` | `''` | Live title, read inside the debounced update handler without recreating the editor. |
| `tags` | `string[]` | `[]` | Live tags, same live-ref treatment as `title`. |
| `categories` | `string[]` | `[]` | Live categories, same live-ref treatment as `title`. |
| `isReadonly` | `boolean` | `false` | Disables editing without recreating the editor. |
| `onContentChange` | `(entry) => void` | `null` | Called ~1s after edits settle, with `{ html, title, tags, categories, timestamp }`. |

Returns `{ editor, history, setHistory, historyIndex, setHistoryIndex, isDirty, setIsDirty, canUndo, canRedo, restoreVersion, markSaved, titleRef, historyRef, historyDebounceRef, isSyncingRef, isLoadingRef }`.

### `<InscriptEditor />`

| Prop | Type | Description |
| --- | --- | --- |
| `editor` | `Editor \| null` | From `useInscriptEditor`. Component renders `null` until this is set. |
| `isReadonly` | `boolean` | Hides the toolbar and disables bubble menus. |
| `showDiff` | `boolean` | Swaps the content area for `<HistoryView>`. |
| `history`, `historyIndex` | | Passed through to `<HistoryView>`. |
| `originalContent` | `{ html, title, tags, categories }` | The pre-edit baseline shown in the diff view. |
| `canUndo`, `canRedo` | `boolean` | Drive the toolbar's undo/redo buttons. |
| `onHistoryUndo`, `onHistoryRedo` | `() => void` | Undo/redo handlers. |
| `onShowMetadataModal`, `hasMetadata`, `showMetadataActive` | | Tags/categories entry point — bring your own modal. |
| `onShowMediaLibrary` | `() => void` | Opens your `<ImageSelectorModal>`. |
| `onAddYoutube` | `() => void` | Opens your `<YoutubeEmbedModal>`. |
| `onHistorySelect` | `(index) => void` | Called when a version is chosen for restore in `<HistoryView>`. |
| `restoreVersion`, `markSaved` | | From `useInscriptEditor`, exposed through the imperative ref too. |

**Imperative ref**: `ref.current.getHTML()`, `.getText()`, `.setContent(html)`, `.restoreVersion(index)`, `.markSaved()`.

### Extensions

`Youtube`, `FontSize`, `CustomTable`, `CustomImage` — TipTap extensions used internally, exported so you can build a headless editor with the same schema (e.g. for tests) via `@tiptap/core`'s `Editor`.

### Utilities

- `getTableNode(state)`, `isHeaderRowActive(editor)`, `isHeaderColumnActive(editor)`, `setTableLayout(editor, attrs)` — table introspection/commands used by `TableBubbleMenu`.
- `getTextContent(html)` — strips HTML to plain text; SSR-safe (falls back to a regex strip when `DOMParser` is unavailable).
- `extractYoutubeId(input)` — extracts an 11-character YouTube video ID from a known URL shape or a bare ID string; returns `null` otherwise.

### Individually-exported components

Every piece is also exported standalone if you want to compose your own layout instead of `<InscriptEditor>`: `ToolbarButton`, `ColorSelector`, `FontSizeSelector`, `LinkSelector`, `ResponsiveToolbar`, `ImageSelectorModal`, `YoutubeEmbedModal`, `HistoryView`, `TextBubbleMenu`, `TableBubbleMenu`, `ImageBubbleMenu`, `YoutubeBubbleMenu`.

## Styling

Built with Tailwind CSS (v4) utility classes baked into the compiled `dist/styles/inscript-editor.css` — you don't need Tailwind in your own app to use it. Import the stylesheet once:

```js
import 'inscript-editor/styles';
```

Dark mode follows Tailwind's `dark:` class strategy — add/remove a `dark` class on an ancestor element (e.g. `<html>`) to toggle it.

### MiniMap theming & sizing

`<MiniMap>` reads CSS custom properties (with fallbacks equal to its default zinc/emerald
look), so a themed host restyles it by setting variables on any ancestor — no CSS overrides:

```css
.my-right-rail {
    --im-minimap-bg: var(--surface);        /* panel background */
    --im-minimap-border: var(--line);       /* panel + header border */
    --im-minimap-label: var(--ink);         /* header label text */
    --im-minimap-line: var(--ink-dim);      /* neutral text-line rects / list markers */
    --im-minimap-viewport: var(--brand);    /* draggable viewport marker */
}
```

Content-semantic glyph colors (YouTube red, image blue, code block, …) are intentionally
not themed — they identify content types. Sizing: pass `width` (inline style, beats the
default `9rem`) and/or `className` (appended to the root, e.g. `border-l-0` to drop the
built-in border when the minimap lives inside your own bordered panel).

```jsx
<MiniMap editor={editor} width="6rem" className="border-l-0" />
```

### Toolbar customizer containment

The settings-gear customizer drawer covers the viewport (`position: fixed`) by
default. To scope it to your editor panel instead, pass that panel's element as
`customizerContainer` — the drawer renders into it and positions `absolute`
within it. The element must be `position: relative; overflow: hidden`.

```jsx
const panelRef = useRef(null);
// ...
<div ref={panelRef} className="relative overflow-hidden">
    <InscriptEditor editor={editor} customizerContainer={panelRef.current} … />
</div>
```

## Development

```bash
npm run build   # one-off build (dist/inscript-editor.{es,cjs}.js + dist/styles)
npm run dev      # watch mode
npm test         # vitest
npm run coverage # vitest with coverage report
```

## Testing

Unit and component tests run under Vitest + Testing Library + jsdom (`npm test`). Deliberately deferred: end-to-end/browser tests — the only genuinely E2E-only surfaces are bubble-menu positioning (floating-ui), table column-resize drag, and the YouTube iframe click-overlay, all low-churn. Everything else is covered at the unit/component level.

## License

MIT © Harsh Ankur
