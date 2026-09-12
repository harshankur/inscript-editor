# Changelog

All notable changes to `inscript-editor` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) (pre-1.0: minor versions may
carry small breaking changes, called out below).

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
