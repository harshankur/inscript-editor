# Changelog

All notable changes to `inscript-editor` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) (pre-1.0: minor versions may
carry small breaking changes, called out below).

## [0.4.0] - 2026-09-25

Version history, reworked. Documents opened with existing content showed an empty history, the
first edit was labelled "Original", and the opened document could not be reached again. The
behaviour changes are listed under **Changed**.

### Added
- `initialContent` option: the editor is created with the document's content, seeded as its
  baseline version, so a host that creates one editor per document never loads from an effect
  (where React-rendered nodes log "flushSync was called from inside a lifecycle method").
- `loadContent(html, { title, tags, categories, kind, keepHistory, history })` on the hook: the way
  to load a document. It becomes the baseline version ("Opened"), clears the dirty flag, never
  calls `onContentChange`, drops any pending edit (a keystroke just before a document switch no
  longer lands in the next document), and stores the editor's normalized HTML so a load never
  records a phantom version. `keepHistory: true` appends an `external` entry for a document changed
  elsewhere; `history` restores a persisted stack (validated, so a corrupt file can't break the
  editor). Reopening a stack by loading its active entry, or HTML that parses to the same document,
  adds no version, even when the editor now serializes it differently (a trailing `<p></p>` after a
  blockquote, a Markdown renderer's newlines, an older release's attribute order), so the pointer
  and redo stay where the user left them.
- `undo()` and `redo()` on the hook. Undo commits pending typing first, so it can be redone.
- `flush()` on the hook (and the `<InscriptEditor>` ref): commits pending typing now and returns
  `{ history, historyIndex }` synchronously, so a host switching documents in one editor can save
  the outgoing document's last second of typing instead of losing it.
- `documentKey` option: names the document, so history resets only when it changes, and
  recreating the editor (a `contentKey` or `editorOptions` change) keeps the document's content and
  history, a pending edit included. Without it, `contentKey` behaves exactly as before.
- History entries carry a stable `id` and a `kind` (`opened`, `imported`, `edited`, `restored`,
  `external`), plus `restoredFrom` / `parentId` links. They stay plain JSON.
- The history panel: an explicit empty state, relative timestamps ("2 minutes ago") with the full
  date to the second on hover, labels from each version's kind ("Opened", "Version 2", "Restored
  from Version 1", "Changed outside the app"), and no empty Title/Tags/Categories rows for hosts
  that keep metadata out of history.
- Spread the hook's result into `<InscriptEditor>` and the toolbar's Undo/Redo and the panel's
  Restore work with no handlers (`onHistoryUndo` / `onHistoryRedo` / `onHistorySelect` still
  override). The ref handle gains `loadContent`, `undo` and `redo`.
- A cap: `maxHistory` (default 200 versions) and `maxHistoryBytes` (default about 20 MB of HTML).
  The oldest versions go first; the baseline and the active version never do.
- `editor.commands.refreshWikilinks()` re-runs the wikilink resolver for every link (for when a
  target page is created or removed after the links rendered). It changes neither the document
  nor the undo stack.
- `chrome` and `collapsible` props on `<DocumentOutline>` and `<MiniMap>`. `chrome={false}` renders
  just the content (no header, border or fixed width) to host it inside your own panel, and ignores
  the stored collapsed state, replacing the `!important` CSS overrides and `localStorage` clearing
  hosts needed before. `<DocumentOutline>` also takes `width` and `className`, like `<MiniMap>`.

### Changed
- README: a prominent "Already using Tailwind?" section. The full stylesheet next to a host's own
  Tailwind build silently breaks the host's `md:`/`dark:` layout (the merged utilities layers let
  the bundle's plain classes win); the content-only route is now spelled out for Tailwind v4
  (`@source`) and v3 (`contentGlob`). Also: a "Loading a document" section, the version-history
  model, and a note on loading from effects.
- **Versions are append-only.** Editing after an undo, or after restoring an older version, used to
  delete every newer version silently. The edit is now added at the end (recording where it
  branched from), and nothing but the cap ever removes a version.
- **Undo, redo and restores notify the host.** `onContentChange(entry, { reason })` now fires for
  `'undo'`, `'redo'` and `'restore'` as well as `'edit'`, and marks the document dirty, so a host that
  saves from it saves those too (an undo used to stay unsaved). Single-argument handlers keep working.
- `restoreVersion(index, { reason: 'restore' })` appends a `restored` entry instead of moving the
  pointer; without a reason it moves the pointer as before (what hosts wire undo/redo to).
- `editorOptions` changes now apply: their serializable part is part of the editor's identity, so
  changing it recreates the editor (keeping the document). Function-valued options (the wikilink
  resolver, embed trust, custom slash items) are read live, so a new function identity never
  recreates it, and `buildExtensions` no longer runs on every render. The docs had always said
  changes recreate the editor; they didn't.
- `setHistory` / `setHistoryIndex` are deprecated in favour of `loadContent`; they still work, now
  update the history synchronously, and give entries ids.
- Keystroke undo (Cmd/Ctrl+Z) now starts fresh on every load and version jump, so it can't undo
  the load itself or pull the previous document's text into this one. (It was never disabled:
  StarterKit's old `history: false` key is ignored by TipTap v3, so it has been on all along; the
  dead key is removed.)

### Fixed
- History previews are inert. The YouTube node serializes a live iframe, so opening the history
  panel contacted youtube.com even for hosts using the click-to-load facade; embeds now show a
  placeholder naming their source, and scripts, event handlers and script URLs are stripped.
  Previews are also styled by the editor's content rules instead of dead `prose` classes, so a
  version looks like the document.
- The history panel's reference pane is no longer blank by default: `originalContent` defaults to
  the first version (the document as opened) instead of an empty document.
- The history panel no longer shows "Selected Version (1)" over an empty list: the selection follows
  the active version and stays inside the list, and Restore is disabled with nothing to restore or
  for the version already active. `onHistorySelect` also receives the entry.
- Undoing a title-only change, then restoring the title as documented, recorded a spurious version
  that replaced the redo step whenever the stored HTML was not byte-identical to the editor's
  (a host seeding `''` against the editor's `<p></p>`). Commits now compare against the HTML the
  editor held at the last history sync.
- Real `<!-- ... -->` comments in loaded HTML are now kept as source-comment nodes. 0.3.3 only read
  officeParser's `<span data-html-comment>` shape, and ProseMirror never sees comment nodes, so the
  comments that marked, markdown-it and most HTML carry still vanished on load. A comment-aware
  parser now covers initial content, `setContent`, `insertContent` and paste.
- GFM-rendered task lists (marked, markdown-it, GitHub: `<li><input type="checkbox"> …`, tight or
  loose) load as checklists instead of plain bullet lists that lost the checkbox. Together with the
  new task-item turndown rule, a checklist now survives a Markdown round trip. `getHTML()` output
  is unchanged.
- **Markdown round trips no longer lose editor nodes.** `applyInscriptEditorTurndownRules` now
  works with a real TurndownService, which decides an element is "blank" before consulting any
  rule, so the 0.3.3 source-comment rule never ran and comments were dropped on save. Empty nodes
  are now routed to their rule. New rules keep generic embeds (every third-party iframe was
  deleted from a document the first time it was saved, since 0.2.1), citations (they became the
  escaped text `\[label\]`), YouTube videos and resized/aligned images as HTML, and write
  checklists as GFM task items (`- [x]`) instead of plain lists that lost the checked state.
- Editor tables become real GFM tables. Their `<colgroup>` made turndown-plugin-gfm keep every
  one as raw HTML, and the `<p>` in every cell broke the rows. A table GFM can't express (merged
  cells, a header column, resized columns, multi-paragraph cells, a non-default alignment) stays
  HTML so nothing is lost. Works with or without the gfm plugin.
- "/" menu labels follow an i18n language switch made after the editor was created (they were
  resolved once, at creation), and filtering matches the current language. The default items also
  carry `titleKey`/`subtitleKey`. Host-supplied `slashCommands` with plain strings work as before;
  an item without `keywords` no longer breaks filtering.
- `inscript-editor/styles/content` now includes `@keyframes ProseMirror-cursor-blink`, so the gap
  cursor blinks for hosts on the content-only stylesheet (the extractor skipped at-rules).
- Wikilink tooltips ("Go to …" / "Create …") are translatable (`wikilinkGoTo`, `wikilinkCreate`),
  existing links use the themeable link tokens instead of hard-coded indigo, and a resolver that
  throws is treated as a missing page instead of breaking the node view.
- `<MiniMap>` no longer throws "The editor view is not available" for an editor that is unmounted
  or destroyed (a host that swaps editors per document hit this, and it could blank the page). In
  TipTap v3 `editor.view` is a Proxy that throws whenever no view is mounted, so `!editor.view` never
  guarded anything; every view read (MiniMap, DocumentOutline, the spellcheck toggle) now checks
  `editor.isDestroyed`, including inside deferred callbacks, and MiniMap re-measures when an editor
  is mounted later.
- `<DocumentOutline>` and `<MiniMap>` refresh after any document change, including content set with
  `emitUpdate: false` (a version restore), instead of only on TipTap's `update` event.
- `<DocumentOutline>` no longer crashes where storage access throws (sandboxed iframes, blocked site
  data, some privacy modes); its collapsed state falls back to expanded, as MiniMap's already did.

## [0.3.3] - 2026-09-24

### Added
- `htmlComment` node: source comments are kept as hidden, deletable inline atoms instead of being
  dropped when HTML is loaded, so a Markdown/HTML round trip no longer loses the author's notes.
  (Only officeParser's span shape below was read in this release; real `<!-- ... -->` comment nodes
  are read from 0.4.0.) It reads and writes officeParser's `sourceAttributes` shape, an empty
  `<span data-html-comment="…">`, so `getHTML()` hands back exactly what the parser reads (pair with
  officeParser 8.1+). In the editor it shows as a small muted `<!-- … -->` chip with the full text on
  hover; the text is only ever set as text or an attribute, never markup. On by default; opt out with
  `htmlComment: false`. The turndown rules write it back as a real `<!-- ... -->` comment.

### Fixed
- The editor lost ProseMirror's base styles whenever one editor instance replaced another (React
  StrictMode's double mount, or a host re-creating its editor): Tiptap's injected `<style>` is shared and
  an unmounting editor removes it. Text whitespace then collapsed, and a paragraph ending in an inline
  node (a citation, inline math, a source comment) grew a tall gap from Tailwind's `img { display: block }`
  reaching ProseMirror's separator image. The base rules now ship in the stylesheet, so they can't vanish.

## [0.3.2] - 2026-09-16

### Added
- Slash-menu Citation can open a host modal instead of the built-in prompt, via
  `editorOptions.onAddCitation`; its fallback prompts now use the same i18n keys as the
  toolbar's Citation button.

### Changed
- Host handlers (`onAddCitation` / `onAddWikilink` / `onAddAbbreviation` /
  `onShowMediaLibrary` / `onAddYoutube`) are now supplied **once** via
  `useInscriptEditor({ editorOptions })` and reach both the slash menu and the
  toolbar/bubble buttons, instead of being wired in two places. The matching
  `<InscriptEditor>` props remain optional per-call overrides (non-breaking). Internally a
  live handler ref is shared through a small always-registered `HostBridge` extension, so
  changing a callback never recreates the editor.

## [0.3.1] - 2026-09-13

### Added
- Optional `onAddCitation`, `onAddWikilink` and `onAddAbbreviation` props on
  `<InscriptEditor>`. Provide one to open your own modal (and call the matching editor
  command) for that toolbar button; when omitted, the built-in `window.prompt` is used.

### Fixed
- **Abbreviation** now works: the toolbar and selection-bubble button prompt for the
  expansion and apply `<abbr title="...">`. Previously they applied a titleless `<abbr>`,
  which neither parses back nor styles (both require `abbr[title]`), and never asked for
  the full form. Clicking the button on an existing abbreviation now clears it.
- **Wikilink** button no longer throws `insertWikilink is not a function`. Its extension
  is opt-in (`editorOptions.wikilink.enabled`); the action is now guarded to no-op when
  the extension is absent, and `wikilink` is removed from the default toolbar presets.

## [0.3.0] - 2026-09-12

### Added
- **Consumer theming.** A `theme` prop plus `--inscript-*` CSS variables cover every
  color, surface, border, radius, spacing knob and font. `THEME_VAR_MAP` and
  `buildThemeVars` are exported so hosts can map their own tokens. Defaults reproduce the
  previous look and adapt to dark mode automatically; a value you set applies in both
  modes. Interactive hover/active use surface-agnostic overlay tokens.
- Homepage live theme editor (accent / text / background / panels / font / radius, plus
  full-palette presets including a dark one).

### Changed
- **Breaking: i18n ships English only.** The other 18 bundled languages are removed;
  English is the single source of truth (and the built-in `defaultValue` on every
  string), so adding a feature no longer means translating it into a dozen languages.
  Register any language yourself via `registerInscriptEditorTranslations(i18n, { overrides })`.
  A consumer that relied on an auto-loaded non-English language now gets English until it
  registers that language. This drops the main bundle roughly 44% (ES ~352KB to ~197KB).
- Links, citations and footnote references style from CSS tokens instead of serializing
  theme colors into the saved document HTML.

### Fixed
- Accessible defaults (WCAG AA). Link, citation and footnote text (the bright accent read
  at only ~2.5:1 on white) and the highlight now clear AA in both light and dark; a
  distinct, accessible `--inscript-color-link` handles accent-as-text.
- Math and Mermaid node views no longer render as white boxes in dark mode.

## [0.2.10] - 2026-09-09

### Added
- `onOpenExternal` prop to route a media node's "open in new tab" action through a host
  opener (e.g. a Tauri desktop webview where `window.open` is inert).

## [0.2.9] - 2026-09-09

### Added
- Toolbar tools: inline code, horizontal rule, and clear-formatting.
- Source-URL transparency: view and edit the underlying URL of YouTube, image and embed
  nodes from their bubble menus.
- A landing page with a live demo (deployed to GitHub Pages), a collapsible
  outline/minimap sidebar (one panel open at a time), and a live-localization switcher.

### Fixed
- Toolbar overflow: recompute when the tool set (preset) changes, not only on resize, and
  reserve the overflow button only when tools actually overflow.

## [0.2.8] - 2026-09-08

### Added
- MiniMap redesigned as a followable spatial outline (readable heading labels, image
  thumbnails, fit-to-panel viewport marker).

### Fixed
- Definition lists unwrap without crashing; footnote insertion positions; a focus-mode
  decoration null guard; the outline always scrolls to top.

## [0.2.7] - 2026-09-07

### Added
- Optional autolink and a toggle to disable the slash menu.
- Host-controlled spellcheck, focus-mode column width and dimming, and heading font.

## [0.2.5] - 2026-09-06

### Added
- `--inscript-font-size` for a host-controlled reading text size.

## [0.2.4] - 2026-08-29

### Added
- Toolbar customizer optional containment (scope the drawer to a container instead of the
  viewport).

### Fixed
- Record title/tags/categories-only edits, not just content changes.

## [0.2.3] - 2026-08-18

### Added
- Round-trip embed/YouTube captions via `data-embed-label`.

## [0.2.1] - 2026-08-16

### Added
- Generic Embed node with click-to-load, plus a YouTube facade and paste handling.

## [0.2.0] - 2026-08-16

- First tagged release of the standalone `inscript-editor` package extracted from Inscript.

[0.4.0]: https://github.com/harshankur/inscript-editor/compare/v0.3.3...v0.4.0
[0.3.3]: https://github.com/harshankur/inscript-editor/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/harshankur/inscript-editor/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/harshankur/inscript-editor/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/harshankur/inscript-editor/compare/v0.2.10...v0.3.0
[0.2.10]: https://github.com/harshankur/inscript-editor/compare/v0.2.9...v0.2.10
[0.2.9]: https://github.com/harshankur/inscript-editor/compare/v0.2.8...v0.2.9
[0.2.8]: https://github.com/harshankur/inscript-editor/compare/v0.2.7...v0.2.8
[0.2.7]: https://github.com/harshankur/inscript-editor/compare/v0.2.5...v0.2.7
[0.2.5]: https://github.com/harshankur/inscript-editor/compare/v0.2.4...v0.2.5
[0.2.4]: https://github.com/harshankur/inscript-editor/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/harshankur/inscript-editor/compare/v0.2.1...v0.2.3
[0.2.1]: https://github.com/harshankur/inscript-editor/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/harshankur/inscript-editor/releases/tag/v0.2.0
