# inscript-editor

A standalone, TipTap-based rich text editor for React. Extracted from [Inscript](https://inscript.harshankur.com), a self-hosted markdown CMS, so it can be reused across other projects.

**[Homepage &amp; live demo →](https://inscript-editor.harshankur.com)**

<!-- screenshot: docs/screenshot.png -->

## Features

- **Rich text editing** built on [TipTap v3](https://tiptap.dev) — bold/italic/underline/strike, headings, lists, blockquotes, code blocks, sub/superscript, text alignment, font size, text/highlight color, and links.
- **Images** with inline resizing, alignment, and a media-library modal (bring your own upload/list backend).
- **Tables** with per-cell/row/column controls, header row/column toggles, and layout alignment.
- **YouTube embeds** by URL or search, with strict ID validation and a placeholder for legacy/corrupt content instead of a broken embed.
- **Version history** with a visual/text/source diff view and one-click restore.
- **Responsive toolbar** that collapses overflowing tools into a "More" menu based on measured width.
- **i18n-ready**: English out of the box (safe even if you never touch i18next), and add any language from your own app with one call.
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
import 'inscript-editor/styles'; // already running Tailwind? see "Styling" first

function PostEditor({ post }) {
    const api = useInscriptEditor({
        contentKey: post.id,          // one editor per document...
        initialContent: post.html,    // ...created with its content (the "Opened" version)
        title: post.title,
        editorOptions: {
            onShowMediaLibrary: () => {/* open your <ImageSelectorModal> */},
            onAddYoutube: () => {/* open your <YoutubeEmbedModal> */},
        },
        onContentChange: (entry, { reason }) => {
            // reason: 'edit' | 'undo' | 'redo' | 'restore'. Persist entry.html here.
        },
    });

    // Spread the hook's result in: the toolbar's Undo/Redo and the history panel work as is.
    return <InscriptEditor {...api} />;
}
```

`useInscriptEditor` owns the TipTap editor instance and a client-side version history; `InscriptEditor` renders the toolbar, bubble menus, content area, and (when `showDiff` is true) the history diff view. Everything else (saving, uploads, YouTube search) stays in your app, wired in through props and callbacks.

### Loading a document

A load is not an edit: it must not create a version, mark the document dirty, or trigger a save.
Two ways to do it right:

- **`initialContent`** (above): the editor is created with the document's content, which becomes
  its baseline version ("Opened"). Best when you create one editor per document (`contentKey`).
- **`loadContent(html, options)`**: load into the existing editor, for example when the user opens
  another file, or when the file changed on disk.

```js
const { loadContent } = api;
loadContent(file.html, { title: file.title, kind: 'opened' });           // a document is opened
loadContent(changedHtml, { keepHistory: true });                         // same document, changed elsewhere
loadContent(savedStack[savedIdx].html, { history: savedStack, historyIndex: savedIdx }); // reopen a persisted stack
```

Reopening a persisted stack adds no version when you load its active entry's HTML (or HTML that
parses to the same document, such as a file whose Markdown renders it), so the pointer and redo
stay where the user left them. Different content is recorded as "Changed outside the app".

**Switching documents in one editor?** Typing from the last second is still waiting for its
debounced commit, and a document switch drops it (so it can't land in the next document). Call
`flush()` first: it commits that typing to the current document and returns the stack
synchronously, ready to save before you switch.

```js
const { history, historyIndex } = api.flush(); // commit the last keystrokes to the outgoing document
saveDraft(currentId, { history, historyIndex });
setCurrentId(nextId);                          // then switch (documentKey changes on render)
```

`loadContent` seeds the baseline, clears the dirty flag, never calls `onContentChange`, drops a
pending edit (so a keystroke just before a document switch can't land in the next document) and
starts keyboard undo fresh (so Cmd/Ctrl+Z can't undo the load). Don't use `editor.commands.setContent`
or the ref handle's `setContent` to open a document: those record an edit.

Pass **`documentKey`** (the document's id) when the editor can be recreated without the document
changing (a `contentKey` or `editorOptions` change): history then belongs to the document and
survives the recreation, content and pending edits included. A `documentKey` change resets the
history when it renders, so load the new document **after** that render (in an effect keyed on the
document, deferred as below), not in the same event handler that switches the key.

> **Calling `loadContent` from `useEffect`?** Nodes rendered by React (embeds, admonitions,
> footnotes, math, mermaid, wikilinks) mount through `flushSync`, which React refuses (and logs
> "flushSync was called from inside a lifecycle method") during its commit phase. Load from an event
> handler, use `initialContent`, or defer the call: `useEffect(() => { queueMicrotask(() => loadContent(html)); }, [docId])`.

### Version history

Versions are an append-only list with a pointer:

- **Edits** append a version (debounced 1s), and so does an edit made after an undo, so undone
  versions are never lost (redo is disabled after it, as users expect).
- **Toolbar Undo/Redo** move the pointer (`undo()` / `redo()`). Undo commits pending typing first,
  so it can be redone. Keyboard undo (Cmd/Ctrl+Z) is finer-grained: it undoes typing within the
  current version.
- **Restore** in the history panel appends a `restored` version (`restoreVersion(i, { reason: 'restore' })`).
- `onContentChange(entry, { reason })` fires for every one of these (`'edit'`, `'undo'`, `'redo'`,
  `'restore'`), so saving from it saves them all. Loads never fire it.
- Each entry is plain JSON: `{ id, kind, html, title, tags, categories, timestamp }`, with `kind` one of
  `opened`, `imported`, `edited`, `restored`, `external` (plus `restoredFrom` / `parentId` links), so
  you can persist a document's stack and hand it back to `loadContent`.
- A cap keeps memory bounded: `maxHistory` (default 200 versions) and `maxHistoryBytes` (default
  about 20 MB of HTML). The oldest versions go first; the baseline and the active version never do.

## Internationalization

The editor's own strings (toolbar tooltips, modal copy, etc.) ship in **English**, under a dedicated `inscript-editor` i18next namespace separate from your app's own translations. English is the single source of truth (it is also the built-in `defaultValue` on every string), so adding a feature never means translating it into a dozen languages. Bring any other language yourself, from your own app.

**Zero-config**: if your app already initializes i18next and renders `<InscriptEditor>` (or any of the individually-exported modals/bubble-menus), the library auto-registers English into your active i18next instance on mount. Nothing else to do.

**No i18next at all?** Every string carries an English `defaultValue`, so the editor renders correctly in English even if your app never sets up i18next.

**Adding a language, or rewording the defaults**, from the `inscript-editor/locales` subpath:

```js
import i18n from 'i18next';
import { registerInscriptEditorTranslations } from 'inscript-editor/locales';

registerInscriptEditorTranslations(i18n, {
    overrides: {
        de: { undo: 'Rückgängig', redo: 'Wiederholen' },  // add a language (any keys from en.json)
        en: { insertImage: 'Add Image' },                 // ...or reword an English default
    },
    overwrite: false,                                     // default: resources you registered first always win
});
i18n.changeLanguage('de');
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
| `contentKey` | `string` | `''` | Changing this recreates the TipTap editor. Without a `documentKey` it also names the document, so history and dirty state reset when it changes. Pass a filename or document id. |
| `documentKey` | `string \| number` | | Names the document. When set, history resets only when this changes (or on `loadContent` without `keepHistory`); recreating the editor (`contentKey`, `editorOptions`) keeps the content and history. |
| `initialContent` | `string` | | The document's HTML, set when an editor is created and seeded as its baseline version. See [Loading a document](#loading-a-document). |
| `title` | `string` | `''` | Live title, read inside the debounced update handler without recreating the editor. |
| `tags` | `string[]` | `[]` | Live tags, same live-ref treatment as `title`. |
| `categories` | `string[]` | `[]` | Live categories, same live-ref treatment as `title`. |
| `isReadonly` | `boolean` | `false` | Disables editing without recreating the editor. |
| `onContentChange` | `(entry, { reason }) => void` | `null` | Called for every change the user causes: an edit (~1s after typing settles), an undo, a redo or a restore, with the now-active entry and `reason` (`'edit'`, `'undo'`, `'redo'`, `'restore'`). Never called for a load. |
| `editorOptions` | `EditorBuildOptions` | `{}` | Per-editor feature toggles plus the host handlers `onAddCitation` / `onAddWikilink` / `onAddAbbreviation` / `onShowMediaLibrary` / `onAddYoutube`. Pass each host handler **once** here and it drives both the slash menu and the toolbar/bubble buttons (the matching `<InscriptEditor>` props are optional per-call overrides). Options apply at construction: changing their serializable part recreates the editor (keeping the document); functions are read live, so a new function identity never recreates it. |
| `maxHistory` | `number` | `200` | Most versions kept. |
| `maxHistoryBytes` | `number` | ~20 MB | Most HTML kept across versions (in characters). |

Returns `{ editor, history, historyIndex, isDirty, canUndo, canRedo, loadContent, flush, undo, redo, restoreVersion, markSaved, setIsDirty, titleRef, historyRef, historyDebounceRef, isSyncingRef, isLoadingRef }`, plus the deprecated `setHistory` / `setHistoryIndex` (use `loadContent` instead; they still work).

- `loadContent(html, { title, tags, categories, kind, keepHistory, history, historyIndex })`: see [Loading a document](#loading-a-document).
- `flush()`: commit pending typing now and return `{ history, historyIndex }` synchronously (before switching documents).
- `undo()` / `redo()`: step through versions; each notifies the host.
- `restoreVersion(index, { reason })`: `'restore'` appends a `restored` version (the history panel); `'undo'`/`'redo'`, or no reason, move the pointer.

### `<InscriptEditor />`

| Prop | Type | Description |
| --- | --- | --- |
| `editor` | `Editor \| null` | From `useInscriptEditor`. Component renders `null` until this is set. |
| `isReadonly` | `boolean` | Hides the toolbar and disables bubble menus. |
| `showDiff` | `boolean` | Swaps the content area for `<HistoryView>`. |
| `history`, `historyIndex` | | Passed through to `<HistoryView>`. |
| `originalContent` | `{ html, title, tags, categories }` | The diff view's reference. Defaults to the first version (the document as opened). Its `html` is rendered as markup, so it must be editor-serialized HTML (from `getHTML()` or a history entry). |
| `canUndo`, `canRedo` | `boolean` | Drive the toolbar's undo/redo buttons. |
| `onHistoryUndo`, `onHistoryRedo` | `() => void` | Undo/redo handlers. Default to the hook's `undo` / `redo` when you spread its result in. |
| `onShowMetadataModal`, `hasMetadata`, `showMetadataActive` | | Tags/categories entry point — bring your own modal. |
| `onShowMediaLibrary` | `() => void` | Opens your `<ImageSelectorModal>`. |
| `onAddYoutube` | `() => void` | Opens your `<YoutubeEmbedModal>`. |
| `onAddCitation`, `onAddWikilink`, `onAddAbbreviation` | `() => void` | Optional **per-call overrides** of the matching `editorOptions` handlers for the Citation / Wikilink / Abbreviation toolbar/bubble buttons. Prefer supplying each handler **once** via `useInscriptEditor({ editorOptions })` (see the `editorOptions` row above) so it also drives the slash menu; a prop here wins when both are set. When neither is given, a built-in native prompt is used. |
| `onHistorySelect` | `(index, entry) => void` | Called when a version is chosen for restore in `<HistoryView>`. Defaults to `restoreVersion(index, { reason: 'restore' })`. |
| `restoreVersion`, `loadContent`, `flush`, `undo`, `redo`, `markSaved` | | From `useInscriptEditor`, exposed through the imperative ref too. |
| `theme` | `InscriptEditorTheme` | Colors, surfaces, borders, radii, spacing and fonts for the whole editor. See [Theming](#theming). |

**Imperative ref**: `ref.current.getHTML()`, `.getText()`, `.loadContent(html, options)`, `.flush()`, `.undo()`, `.redo()`, `.restoreVersion(index, options)`, `.markSaved()`, and `.setContent(html)`, which records an **edit** (use `loadContent` to open a document).

The history panel's previews are inert: embeds show a placeholder naming their source instead of loading (the YouTube node serializes a live iframe), and nothing in a version can run.

### Extensions

`Youtube`, `FontSize`, `CustomTable`, `CustomImage` — TipTap extensions used internally, exported so you can build a headless editor with the same schema (e.g. for tests) via `@tiptap/core`'s `Editor`.

### Utilities

- `getTableNode(state)`, `isHeaderRowActive(editor)`, `isHeaderColumnActive(editor)`, `setTableLayout(editor, attrs)` — table introspection/commands used by `TableBubbleMenu`.
- `getTextContent(html)` — strips HTML to plain text; SSR-safe (falls back to a regex strip when `DOMParser` is unavailable).
- `extractYoutubeId(input)` — extracts an 11-character YouTube video ID from a known URL shape or a bare ID string; returns `null` otherwise.

### Individually-exported components

Every piece is also exported standalone if you want to compose your own layout instead of `<InscriptEditor>`: `ToolbarButton`, `ColorSelector`, `FontSizeSelector`, `LinkSelector`, `ResponsiveToolbar`, `ImageSelectorModal`, `YoutubeEmbedModal`, `HistoryView`, `TextBubbleMenu`, `TableBubbleMenu`, `ImageBubbleMenu`, `YoutubeBubbleMenu`.

## Styling

Built with Tailwind CSS (v4) utility classes baked into the compiled `dist/styles/inscript-editor.css`, so you don't need Tailwind in your own app to use it. **If your app does not run Tailwind**, import the stylesheet once:

```js
import 'inscript-editor/styles';
```

### Already using Tailwind? Don't import the full bundle

The full bundle is a complete Tailwind build (reset, theme, utilities). Next to your own Tailwind
build it silently breaks your layout: the two `utilities` layers merge, and the bundle's plain
`.hidden`, `.fixed`, `.flex`, ... come later in the cascade than your `md:` / `dark:` variants, so
they win (a `fixed md:sticky` sidebar stays `fixed` on desktop). Nothing errors; things just move.

Import only the editor's content and token rules, and let **your** Tailwind generate the utilities
the editor's components use, by scanning the package:

```css
/* Tailwind v4 (CSS-first). The @source path is relative to this CSS file. */
@import "tailwindcss";
@import "inscript-editor/styles/content";
@source "../node_modules/inscript-editor/dist";
```

```js
// Tailwind v3 (tailwind.config.js): contentGlob resolves the package wherever it is installed.
import { contentGlob } from 'inscript-editor/tailwind-content';
export default { content: ['./src/**/*.{js,jsx,ts,tsx}', contentGlob] };
```

Dark mode follows Tailwind's `dark:` class strategy — add/remove a `dark` class on an ancestor element (e.g. `<html>`) to toggle it.

### Theming

Every color, surface, border, radius, spacing knob and font in the editor is a CSS custom property (`--inscript-*`) with a default that reproduces the built-in look. Restyle the whole editor with the `theme` prop: pass any subset, and each field accepts any CSS value (hex, `rgb()`, a `var()` reference, a length, a font stack):

```jsx
<InscriptEditor
  editor={editor}
  theme={{
    accent: '#7c3aed',              // links, active toolbar buttons, table selection
    surface: '#ffffff',             // editor background
    surfaceRaised: '#f7f7f8',       // toolbar, popovers, menus
    text: '#1a1a1a',
    fontFamily: 'Georgia, serif',
    headingFont: '"Playfair Display", serif',
    fontSize: '1.2rem',
    maxWidth: '68ch',
    radius: '0.75rem',
    blockGap: '1.25rem',
  }}
/>
```

A token you set applies in **both** light and dark (you own that value). A token you *don't* set keeps its default and still swaps automatically for dark mode. For distinct dark values, set the variables yourself under your own `.dark` selector instead of (or alongside) the prop:

```css
.dark .inscript-editor { --inscript-color-accent: #a78bfa; }
```

That works because the prop just sets the same `--inscript-*` variables inline on the editor scope, so any ancestor CSS can override them too.

**Available tokens** (theme key → CSS variable):

| Group | Keys |
| --- | --- |
| Text | `text`, `heading`, `muted` |
| Surfaces & borders | `surface`, `surfaceRaised`, `border`, `borderStrong`, `hover`, `active` |
| Accent & links | `accent`, `onAccent`, `link`, `linkHover` |
| Code | `codeBg`, `codeText`, `codeBorder` |
| Quotes | `quoteBorder`, `quoteText` |
| Tables | `tableBorder`, `tableHeaderBg` |
| Marks & selection | `markBg`, `markText`, `selection` |
| Typography | `fontFamily`, `fontSize`, `lineHeight`, `headingFont`, `monoFont`, `headingWeight`, `h1Size`, `h2Size`, `h3Size` |
| Layout & shape | `maxWidth`, `focusMaxWidth`, `blockGap`, `radius`, `radiusSm`, `minHeight`, `focusDimOpacity` |

Each key `fooBar` maps to the CSS variable `--inscript-…` (e.g. `surfaceRaised` → `--inscript-color-surface-raised`, `radius` → `--inscript-radius`). Interactive `hover`/`active` overlays are semi-transparent so they read correctly on any surface color you pick. `onAccent` is the text/icon color on accent-filled buttons; its default clears WCAG AA against the default accent, so if you pick a **dark** accent set `onAccent` too (e.g. `'#fff'`).

The token map is exported as `THEME_VAR_MAP` (with `buildThemeVars`) from the package root, so a host can translate its own design tokens to inscript's programmatically.

Content-semantic palettes are intentionally **not** themed: syntax highlighting, admonition types (note/tip/warning/…), and the `<MiniMap>`'s content colors identify a *kind* of content, not your brand.

> Running your own Tailwind? Use `inscript-editor/styles/content` instead of the full bundle; see [Already using Tailwind?](#already-using-tailwind-dont-import-the-full-bundle).

`<MiniMap>` is a *spatial outline*, not a shrunk photo of the text. Prose has weak
silhouette, so instead of near-identical grey blocks it makes the picture a function of the
content and keeps the whole document in view:

- **Readable heading landmarks** — headings render as real, truncated text at their true
  position, sized and indented by level (an H1 gets a full-width rule). Click a label to
  jump to that heading. This is what lets you actually follow the page.
- **Content-derived body texture** — paragraphs are per-line bars with a ragged last line
  and colored inline runs (links, inline code); lists, tables, code and quotes keep their
  real counts/shape.
- **Real image thumbnails** — images draw their actual bitmap, the strongest anchor in prose.
- **Fit to panel** — the entire document is scaled into the available height, so the labels
  never scroll out of reach; a draggable viewport marker shows where you are.

Pass `showHeadingText={false}` to collapse headings to level ticks (labels off).

### MiniMap theming & sizing

`<MiniMap>` reads CSS custom properties (with fallbacks equal to its default zinc/emerald
look), so a themed host restyles it by setting variables on any ancestor — no CSS overrides:

```css
.my-right-rail {
    --im-minimap-bg: var(--surface);        /* panel background */
    --im-minimap-border: var(--line);       /* panel + header border */
    --im-minimap-label: var(--ink);         /* header label text + heading landmarks + ticks */
    --im-minimap-line: var(--ink-dim);      /* neutral body lines / list markers */
    --im-minimap-viewport: var(--brand);    /* draggable viewport marker */
}
```

Content-semantic colors (image sky, code emerald, table violet, link blue, …) are
intentionally not themed — they identify content types. Sizing: pass `width` (inline style,
beats the default `9rem`) and/or `className` (appended to the root, e.g. `border-l-0` to drop
the built-in border when the minimap lives inside your own bordered panel). The minimap fits
the document to its own height, so give it a **bounded-height** container (it falls back to a
natural scale with internal scroll if the height is unbounded).

```jsx
<MiniMap editor={editor} width="6rem" className="border-l-0" />
```

### Hosting the outline and minimap in your own panel

`<DocumentOutline>` and `<MiniMap>` come with their own panel chrome (a header with a collapse
button, a border, a fixed width). To put either inside a panel of your own, pass `chrome={false}`:
it renders just the content, fills its container, and ignores any stored collapsed state (there is
no header to expand it from). No CSS overrides or `localStorage` clearing needed.

```jsx
<aside className="my-panel">
    <header>Outline</header>
    <DocumentOutline editor={editor} chrome={false} />
</aside>
```

`collapsible={false}` keeps the header but removes the collapse button. Both components also take
`width` and `className`. Match the minimap's label backing to your panel with `--im-minimap-bg`.

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
