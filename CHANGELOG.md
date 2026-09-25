# Changelog

All notable changes to `inscript-editor` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) (pre-1.0: minor versions may
carry small breaking changes, called out below).

## [Unreleased]

### Added
- `chrome` and `collapsible` props on `<DocumentOutline>` and `<MiniMap>`. `chrome={false}` renders
  just the content (no header, border or fixed width) to host it inside your own panel, and ignores
  the stored collapsed state, replacing the `!important` CSS overrides and `localStorage` clearing
  hosts needed before. `<DocumentOutline>` also takes `width` and `className`, like `<MiniMap>`.

### Fixed
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
