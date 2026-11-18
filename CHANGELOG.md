# Changelog

All notable changes to `inscript-editor` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) (pre-1.0: minor versions may
carry small breaking changes, called out below).

## [0.13.0] - 2026-11-18

Saved toolbar layouts that keep up with their preset, the editor's nodes exported for headless tests,
formulas and diagrams that show their source while their library loads, and support for i18next 27,
react-i18next 18 and KaTeX 0.19. One change needs action from some hosts: KaTeX must now be 0.18.2 or
later (see **Changed**).

### Added
- **A saved layout follows its preset across releases.** Store `INSCRIPT_EDITOR_VERSION` with a
  toolbar or selection-menu layout you save, and pass it back as `configSavedWith` (on
  `<InscriptEditor>`, or on `<ResponsiveToolbar>` and `<TextBubbleMenu>`; one release for both
  layouts, or `{ toolbar, bubble }`). A layout that was a built-in preset when it was saved is then
  shown, offered in the customizer and saved as that preset is today, so a tool a release adds to it
  (as 0.10.0 and 0.11.0 did) reaches the reader. Without `configSavedWith`, saved layouts are shown as
  they are.
- **`upgradeToolbarConfig(config, surface, options)` and `toolbarPresetOf(config, surface, options)`**
  bring a saved layout up to date and name the preset it is. Options: `savedWith`, `unavailable` (the
  tools you turned off) and, for the upgrade, your own `presets` and `presetsMode`.
  `TOOLBAR_PRESET_HISTORY` and `BUBBLE_PRESET_HISTORY` hold every shape each preset has had since
  0.1.0, and the release each first shipped in.
- **The editor's nodes are exported** for a host's round-trip tests: `KeyboardInput`, `Details`,
  `DetailsSummary`, `MathInline` and `MathBlock`, and `buildExtensions(options)`, the editor's whole
  extension list for the options you give `useInscriptEditor`, for a headless `getSchema` or `Editor`.
- **`INSCRIPT_EDITOR_VERSION`**, the release in use.
- **New locale keys** for what formulas and diagrams show: `mathBlockEmpty`, `mathEmpty`,
  `mathFailed`, `mathLoading`, `mathMissing`, `mathPlaceholder`, `mermaidEmpty`, `mermaidLoading`,
  `mermaidMissing`, `mermaidPlaceholder` and `mermaidSyntaxError`.

### Changed
- **Breaking: the `katex` peer dependency now starts at 0.18.2** (`^0.18.2 || ^0.19.0`). Earlier KaTeX
  lets a page's existing prototype pollution get past its `trust` setting (GHSA-238p-pmpm-9mq7),
  which the editor turns off for every formula. Hosts on KaTeX 0.16 or 0.17 must upgrade. Math inside
  a Mermaid diagram goes through the KaTeX Mermaid depends on, which may be a copy of its own: the
  README shows how to check it. Mermaid 11 and 12 are both still supported.
- **i18next 27 and react-i18next 18 are supported** (react-i18next 18 needs i18next 27; 16 and 17 go
  with i18next 25 to 27). The editor's own English still shows when your i18next is not initialized.
  With i18next 27, an empty translation shows the English default unless you
  `init({ returnEmptyString: true })`.
- **KaTeX 0.19 is supported.**
- **Code highlighting redoes only the code blocks a change touches**, so typing in one block no longer
  highlights every other block again.

### Fixed
- **The contained customize drawer opens at its container's edge.** Its layer could be scrolled while
  the drawer slid in and then kept the drawer 384px to the left, with the container uncovered to its
  right. The layer is now `overflow: clip`, which has no scroll position (hidden where clip is not
  known), in both stylesheets.
- **A formula no longer reads "Empty math" while KaTeX loads.** Formulas and diagrams show their
  source, muted and marked busy, until their library is ready; "Empty math" is only for an empty
  formula. Every word they show now goes through the locales. A diagram whose drawing comes out empty
  says it cannot be shown, instead of staying blank.
- **A text cursor is never left between blocks** (for example after a horizontal rule is inserted at
  the end of the document): it moves to the nearest place text can go.

## [0.12.0] - 2026-11-17

A release that hardens the editor against hostile documents, pastes, files and history. Documents,
pasted content, dropped files and saved versions are treated as untrusted throughout, and the
README has a new section, "What a document cannot do", listing what that means. Some of the changes
below alter behaviour a host may notice: they are called out under **Changed**.

### Added
- **`HistoryView` takes the `editor`** (`<InscriptEditor>` passes it). A web link clicked in a
  version's preview then opens through `onOpenExternal`, else in a new tab with `noopener`, and never
  in place of your page. An anchor within the version goes nowhere; a `mailto:` or `tel:` link is
  left to the browser.
- **Table commands that would go past the size limit are not offered.** `mergeCells`,
  `mergeOrSplit`, `addColumnBefore`, `addColumnAfter`, `addRowBefore` and `addRowAfter` return false
  (and `can()` says so, so the table menu's buttons are disabled) when the change would take the
  document's tables past the limit below, or a span past what HTML reads back.
- **An inline formula wider than its line scrolls sideways** within the line, instead of running
  past it.
- **An image's height in percent stays a percentage** (`height="50%"`), as a browser reads it.
- **`editorOptions.link.HTMLAttributes` is typed** in `EditorBuildOptions` (it was read already).

### Changed
- **Links take their `target`, `rel` and `class` from `editorOptions.link.HTMLAttributes` only**,
  never from a document: a document's would lay an invisible link over the page, send the top window
  away (`target="_top"`) or hand the opened page this one (`rel="opener"`).
- **In a read-only editor, a click on a link to another site opens outside your page**: through
  `onOpenExternal`, else a new tab with `noopener`. A link on your own site is still left to your page
  (your router). On a page opened from a file (a desktop app), a relative link, or one with no
  address, is kept from replacing the app.
- **A wikilink to another site opens outside your page.** In a read-only editor a click opens it;
  while editing, a plain click selects it and Cmd/Ctrl-click opens it. A resolver's `href` is
  followed only when it is a page on your site or an http(s) address: open an app's own pages from
  `onNavigate`. A wikilink with no page (`#`) goes nowhere.
- **Protocol-relative addresses** (`//host/x`) in images and links are read and saved as the https
  address they mean (`https://host/x`), on every page: on a page opened from a file, `//host/x`
  names a share on another machine.
- **An embed's `isTrusted` (or `isEmbedTrusted`) is given the address as it will be loaded**:
  absolute, https for a protocol-relative one, normalized as a browser reads it
  (`https://maps.example.com/`), rather than the text the document stores.
- **Content given as JSON is held to the same rules as HTML** (`content`, `setContent`,
  `insertContent`, commands), so `getJSON()` never keeps what the editor refuses: an image whose
  source is refused is left out, a link whose address is refused is its text, and image and video
  sizes, video ids, code languages, text alignment, font sizes, table spans and column widths are
  kept as HTML would read them. A ProseMirror node given as content is held to them too.
- **Tables are bounded however they come.** A table squared up gains the cells its spans claim and
  the cells padded onto short rows; all of a document's tables together may gain at most 20,000, when
  opened, pasted or made by edits, so a document made in the editor opens again as it was. Past that,
  the tables brought in that gain the most are read as their cells' contents (a rectangular table is
  never touched, however large). Pasting into a table never grows it by more than 20,000 cells. Spans
  are read as a browser reads them (`1e5` is 1, `rowspan="0"` reaches the end of its row group) and
  kept within HTML's own limits (1,000 columns, 65,534 rows), and a column is at most 4,000 pixels
  wide, a dragged one too.
- **Code highlighting is bounded.** A block of more than 5,000 characters (2,000 when its language is
  guessed) shows as plain text, and highlighting gets 50 ms per turn of the page across all editors:
  what does not fit is finished in later turns. A code block's language is only ever a name.
- **Diagrams are drawn at Mermaid's `strict` level** whatever your page's Mermaid configuration says
  (which is restored afterwards), and what Mermaid draws is cleaned and shown in a shadow root of
  its own. A diagram that cannot be shown says so.
- **Formulas are drawn by KaTeX with `trust` off**, bounded macro expansion and sizes, and painted
  near their own box only. The `katex` peer dependency now starts at 0.16.10.
- **Widths, heights and font sizes from a document are capped** (an image or video at most the
  line's width or 4,000 pixels, an image's height at most 10,000 pixels, text at most about 200
  pixels).

### Fixed
- **Nothing in a saved version can run in the history panel.** A version's preview is made of the
  cleaned nodes themselves, never HTML parsed again (where text the cleaning saw as text could come
  back as markup), without scripts, handlers, foreign content (MathML, SVG), ids, names, link targets
  or any style that could load something, and it is contained, so nothing in it can cover your page.
  It holds no `.mermaid` element for your page's Mermaid to draw.
- **A diagram keeps nothing that runs, loads or navigates**: scripts, handlers (on any element, a
  `<style>` too), links, foreign frames and images, and CSS that could load something or reach past
  the diagram (escapes included), whatever Mermaid's own settings were.
- **The saved Markdown keeps document text as text** when a Markdown renderer reads it back: link
  addresses and titles (including an address that reads as a character reference, such as
  `&#x6a;avascript:`), image text, code fences, hard breaks, source comments and HTML kept in a link's
  text are written so they cannot turn into raw HTML or a script link.
- **A share on another machine is never fetched** (`\\host\share`, `file://host/…`, and `//host` on a
  page opened from a file), from an image, a link, the minimap, a history preview or a host's
  `onImageFile` result: such a page would send the reader's credentials to it.
- **A crafted document cannot stop the page**: tables of millions of cells from a few bytes of HTML
  or JSON, highlighting a crafted code block on every change, deeply nested JSON, content given by a
  host that holds itself, or a document many footnotes long.
- **Footnote numbers follow the document.** A reference added before others left theirs, and their
  definitions, showing their old numbers.
- **A frame whose address is a bare 11-letter word** (`<iframe src="development">`) is no longer
  taken as a YouTube video and loaded from YouTube.

## [0.11.0] - 2026-11-16

### Added
- **Image files dropped, pasted or picked go in, through your handler.** A new `onImageFile(file,
  { editor, source, signal })` (in `editorOptions`, or as an `<InscriptEditor>` prop, which wins;
  `<ResponsiveToolbar>` takes it too, for its Image button) takes each image file and gives the src to show: a data
  URL, or where you stored the file (or `{ src, alt, title }`), at once or as a Promise. A "Loading
  image…" placeholder marks the spot meanwhile. Each image goes in as soon as its file is read, in the
  files' order, however the document changed in the meantime. A selection pasted over is replaced
  only once an image comes, and only as it was. `signal` aborts when an image will not go in (its spot
  was deleted, or the editor was closed or made read-only), so the upload can stop. A src that would
  run script, or a `data:` URL that is not an image, is left out. Not taken as files: a copied web
  page or office cells, whose HTML is more than the picture; a paste as text (Shift with the paste
  keys); an image dragged within or between editors. Without `onShowMediaLibrary`, the toolbar's
  Image button and the slash menu's Image item open the browser's file picker for it. Without
  `onImageFile`, image files are not taken, as before.
- **Inline math has a way in.** An Inline Math button joins the toolbar's full and science layouts,
  and the slash menu has an Inline Math item. Text selected within a line becomes the formula's
  source, keeping the formatting all of it shares, with the spaces at its edges left round it. A
  selected key or formula stays, and the new formula goes after it. Both turn off with
  `editorOptions.math: false`.

### Changed
- **`insertMathInline` goes only where text does.** It refuses inline code and code blocks (which
  it would split), the gaps between blocks, selected cells or blocks, the whole document, text
  running across blocks, and text holding a footnote, citation or other inline element, which it
  would delete. Over a selected inline node, it no longer replaces it.
- **The image menu's URL field takes a URL of the scheme the image already has** (a host's own,
  such as `asset://`, given by its image-file handler), besides an image URL or a relative path.
  Never a file on the reader's machine.
- **History previews keep an image's SVG data URL**, as the editor shows it. A data URL used as a
  link is still dropped.

### Fixed
- **A selected formula's or diagram's source editor closes when the editor is made read-only**, also
  when `setEditable(false, false)` is used, which sends no update. The toolbar follows that change
  too.

## [0.10.0] - 2026-11-16

### Added
- **Keyboard input.** A `keyboardInput` node reads and writes `<kbd>`, drawn as a keycap, so
  `<kbd>Ctrl</kbd>+<kbd>S</kbd>` survives an edit (it was saved as "Ctrl+S"). Each key is a token
  holding its text, like a citation, so keys side by side always stay apart. The editor's Markdown
  keeps it as `<kbd>…</kbd>` (inline code holding a key as HTML). A Keyboard Input button joins the toolbar's full and technical layouts
  (selected text becomes a key, selected keys turn back into text) and the selection menu's
  technical one (it shows for a selected key too), with `setKeyboardInput`, `unsetKeyboardInput` and `toggleKeyboardInput`.
  `editorOptions.keyboardInput: false` turns it off, and its button is then left out (the
  customizer no longer offers it, and keeps it in a saved layout, marked as not available).
- **Disclosures.** A `details` node reads and writes `<details><summary>…</summary>…</details>`: a
  summary, then any blocks. A toggle beside the summary opens and closes it, in the document
  (`<details open>`) in an editable editor and for the reader only in a read-only one; a closed one
  shows its body while the cursor is in it. Enter in the summary goes on into the body, Backspace at
  its start unwraps it, and a block put in the summary (inserted, pasted) goes to the start of the
  body, the summary staying one line. The editor's Markdown writes it as GitHub reads it (the tags and summary as
  HTML, the body as Markdown between blank lines), and a `<details>` without a `<summary>` loads with
  an empty one rather than losing its body. A Disclosure entry in the slash menu and a Disclosure
  button in the toolbar's full and technical layouts, with `setDetails`, `unsetDetails`,
  `toggleDetails` and `setDetailsOpen(open)`. `editorOptions.details: false` turns it off, and its
  button and slash entry are then left out.

### Changed
- **A tool whose feature the host turned off is left out** of the toolbar and the selection menu
  (with any divider it leaves stranded), where it used to show as a button that did nothing: Math,
  Mermaid, Footnote, Citation, Definition List, Abbreviation, Task List and Admonitions, as well as the
  new Keyboard Input and Disclosure. The customizer no longer offers them, to add or in a preset or the
  default layout; one already in the host's layout stays there, marked as not available in this
  editor, and is kept on save, for an editor that has it.

### Fixed
- **HTML is fitted to the editor's schema with source comments turned off too.** With
  `editorOptions.htmlComment: false`, a list item opening with an image, a code block or a quote had
  that block moved out of the list, and an image alone in its paragraph left an empty one behind:
  the reshaping came with the comment node. It is always on now.
- **The customizer's preset buttons say which one is in use** (`aria-pressed`), as the toolbar's do.
- **A contained customizer drawer no longer gives its host something to scroll.** Scoped to a
  `customizerContainer`, the drawer lay past the container's edge while it slid in or out, so a
  container with `overflow: hidden` could be scrolled sideways (by script or by focus) and stayed
  scrolled, the drawer sitting a drawer's width to the left. The drawer is now clipped by its own
  backdrop, and moving focus inside it never scrolls anything.
- **A `+` between two keys was saved escaped** (`<kbd>Ctrl</kbd>\+<kbd>S</kbd>`). Text that would
  open a heading, list or quote at the start of a line (`#`, `+`, `-`, `1.`, `1)`, `>`, `=`) is no
  longer escaped when it comes right after an element written on the same line (a key, inline code,
  a link, bold); anywhere else it is escaped as before, which reads back the same.

## [0.9.0] - 2026-11-06

### Added
- **A column can be aligned.** The table menu has a column group: align the column left, centre or
  right, or clear its alignment. It sets the alignment on every cell of the columns the selection
  covers, header included, and clears the alignment of the paragraphs inside them, so the column is
  aligned for a reader of the HTML and for a Markdown writer (`---:`). A row added later (a button, or
  Tab in the last cell) takes its column's alignment, so the column stays aligned (undo and redo
  put rows back as they were), and a merged cell reaching into a column that is not selected is
  left alone. The same is available as
  `editor.commands.setColumnAlign(align)`, `setColumnAlign(editor, align)` and
  `getColumnAlign(state)`, with `COLUMN_ALIGNMENTS`; a value other than those three or `null` is
  refused. On an editor without this library's table extension the column buttons are disabled.
- **The toolbar's and the menus' buttons tell assistive technology their name and state.** Every
  icon-only button is named by the text of its tooltip; one showing text is named by that text. A toggle (bold, a list, an alignment, a
  placement, a width) reports `aria-pressed`; a button that always inserts (Math, Mermaid) is not a
  toggle, even when the cursor lights it. In a list of choices (alignment, admonition type, font
  size, colour swatches) the current one is marked with `aria-current`; the default highlight swatch
  reported `aria-pressed` before. A button that shows a popover (link, colour, font size,
  the alignment and admonition choices, more tools) reports `aria-expanded` and carries its state in
  its name: "Edit Link" over a link (its tooltip too), "Text Color: #dc2626", the font size it shows. The alignment
  control shows the alignment of the selected paragraphs and headings (in a table cell, the cell's
  alignment counts): Align Left for text with none of its own, and none in a code block, on an
  image or across differently aligned paragraphs. The tags and Customize buttons say they open a
  dialog. The customizer drawer is a named dialog that takes focus when it opens and gives it back
  when it closes; covering the page, it is modal and keeps Tab inside. `ToolbarButton` takes
  `expanded`, `hasPopup`, `toggle` and `ariaLabel` for this, and `ToolbarCustomizer` takes
  `returnFocusRef`. The overflow panel no longer claims to be a menu (`aria-haspopup` is gone from its
  button).

### Changed
- **Placement buttons say what they place.** The table, image and video menus named their placement
  buttons "Align Left", "Align Center" and "Align Right", which read as aligning text. They are now
  "Place table left", "Center table on the page", "Place table right" (and the same for an image and
  a video), with keys of their own (`placeTableLeft`, `placeImageLeft`, `placeVideoLeft` and their
  centre and right forms) and placement icons. A host that translated `alignLeft`, `alignCenter` or
  `alignRight` for these menus translates the new keys instead; those three keys now name only the
  text alignment buttons.
- **Markdown: a column aligned paragraph by paragraph is a GFM column alignment.** A table whose
  cells each hold one paragraph aligned the same way, as the toolbar's text alignment leaves it, is
  written as a GFM table with that column alignment instead of as HTML. Loaded back, the alignment
  sits on the cells, which looks the same. In a column, body cells left-aligned or unaligned look
  alike, so the header decides between `:---` and `---` (with no header, `---` unless every cell
  says left); centre or right needs every cell. A cell
  aligned to `start` reads as left.

### Fixed
- **Text with a value in it showed its placeholder when the host had not initialized i18next**, for
  example "Version {{n}}", "Go to {{target}}" or "Image width {{width}}": react-i18next returns the
  English default unfilled until then. Every component now fills the values in itself, and text
  built outside React (the slash menu's items, a video's placeholder and play button, a hidden
  comment's label), which read "undefined" then, shows its English default. That text also follows
  the i18next instance of the host's own React tree (an `I18nextProvider`), each editor its own, where
  it used the default instance only. A
  translated value with an apostrophe or ampersand was also HTML-escaped (`&#39;`) in labels and
  tooltips, where React escapes text already; it no longer is.

## [0.8.0] - 2026-11-01

### Added
- **Two theme tokens for the space around the text.** `theme.gutter` sets the side space around
  the content column, and `theme.padding` the padding inside the editable area. An embedded editor,
  such as a reply box, no longer has to override the editor's CSS. Leaving them unset changes
  nothing.

### Fixed
- **The editor no longer crashes on mount when i18next has not been initialized.** It threw
  ``registerInscriptEditorTranslations: `i18n` must be an i18next instance`` from an effect, which
  also hit an app that uses its own instance through `I18nextProvider` and never initializes the
  default one. The strings now register when the app initializes, and until then the editor shows
  its English defaults. Calling `registerInscriptEditorTranslations` directly with an uninitialized
  instance still throws.

## [0.7.0] - 2026-10-19

### Added
- **The media library can say why an upload failed.** When `onUpload` rejects with an error
  that has a non-empty `userMessage` string, `ImageSelectorModal` shows that text instead of
  the general "Upload failed. Please try again." Other error text, such as an HTTP status, is
  still not shown to readers.

## [0.6.0] - 2026-10-18

### Added
- **A YouTube consent placeholder.** `editorOptions.youtube.facade` now also takes a mode:
  `'local'` shows a placeholder drawn by the editor that asks for consent then and there. It
  keeps the video's size and says, under a "YouTube video" heading, that playing the video loads
  it from YouTube, which then receives data such as the visitor's IP address and may set cookies,
  with a "Load video" button. Nothing is requested from any other host until the button is
  pressed, and then the official player loads from www.youtube.com. The press is the consent, for
  that video only, and nothing is remembered. One press loads the player, by mouse or by Enter or
  Space, in an editable or a read-only editor; a click elsewhere on the placeholder still selects
  the video. The thumbnail facade (`true`, or the new name `'thumbnail'`) is unchanged, and any
  other truthy value still turns it on. The default stays `false` (the player loads straight
  away), and the saved HTML is the same in every mode.
- `editorOptions.youtube.privacyUrl`: the host's privacy notice, linked from the consent
  placeholder in a new tab (`rel="noopener"`). Only an http(s) URL is linked; unset, there is no
  link.
- `editorOptions.onOpenExternal`, passed once like the other host handlers: it opens a video's
  privacy link and the media bubble menus' "open" actions, for a desktop webview where a new tab
  cannot open. The `<InscriptEditor onOpenExternal>` prop overrides it, and now opens the privacy
  link too.
- `<YoutubeEmbedModal>` takes `privacyUrl` and `onOpenExternal` props for its live preview's
  consent placeholder.
- Translatable labels: `youtubeConsentTitle`, `youtubeConsentText`, `youtubeConsentLoad`,
  `youtubeConsentLoadPreview` and `youtubeConsentPrivacy` for the placeholder, `youtubeLoadVideo`
  for the thumbnail facade's button (fixed English before) and `pasteLinkToEmbed` for the modal.
- The site (homepage and embed page) links the Impressum and the privacy notice and carries the
  copyright line, and counts page views with the viewcounter's tracker script, which stores
  nothing on the device.
- `useInscriptEditor` returns `isReadonly`, so spreading its result into `<InscriptEditor>` passes the
  read-only state on (no editing toolbar).
- Selection menus take `scrollContainer` and `menuContainer` (see "Individually-exported components");
  `<InscriptEditor>` passes its own. `ToolbarDropdown` items may give `onClick` as well as `action`.
- The overflow ("More tools") menu closes on Escape, returns focus to its button and reports its
  state (`aria-expanded`, `aria-haspopup`).
- Translatable labels for the toolbar customizer, the bibliography panel's controls, the admonition
  header and type names, the link field's refusal and the video search button. The customizer names
  each tool with the key its toolbar button uses.

### Changed
- **Breaking:** `@tiptap/extension-code` is a new peer dependency (the inline code mark now keeps a
  link or bold around it, which needs the mark itself). Install it with the other TipTap packages.
- Typing still waiting for its one-second commit is recorded when React tears the editor's effects
  down (an `<Activity>` hidden, an unmount, Fast Refresh), when the editor is replaced, and when it
  turns read-only, instead of being carried along or dropped. `canUndo` and `canRedo` count it.
- Markdown output: kept HTML is written on one line with its attributes fully escaped; the text of a
  formula, abbreviation, citation or wikilink, and brackets in link text, as character references;
  comment text with line breaks or closing sequences in a reversible encoding; emphasis with `*`
  inside words; and text that looks like syntax (`<b>`, `&copy;`, `~`, a lone `#`, `1)`, a bare URL)
  escaped. Tables keep their column alignment.
- Loading HTML from a Markdown renderer: an image alone in a paragraph becomes an image block, a list
  item that opens with an image, a code block or a quote keeps it, a bare `[ ]` item is an empty task,
  and a code block's trailing newline is dropped.
- Content set as a whole (a load, a version jump, `setContent`) is never autolinked; typed and pasted
  URLs still are.
- A document switch starts from the host's title, tags and categories props; the metadata given to
  `loadContent` is kept until a prop really changes.
- `<YoutubeEmbedModal>`'s live preview no longer loads YouTube's player as soon as a valid ID is
  typed: it shows the same consent placeholder, and loads the preview when "Load preview" is
  pressed, for that video only.
- `<YoutubeEmbedModal>` offers its search tab only when `onSearch` is given. Without it the tab
  could not search, so the modal now shows just the link field.
- The site's demo asks for consent before its video loads, linking its section of the privacy
  notice, so neither page contacts YouTube, or any other host, when it opens. Adding a video
  opens the library's modal instead of a browser prompt.

### Fixed
- In a read-only editor, the first click on a loaded YouTube player, or on the thumbnail facade,
  only selected the video, which has no menu there; it now plays the video (or loads it).
- A YouTube facade showed the old video after the video's URL was changed before it was clicked,
  and clicking it put back a width or alignment set in the meantime.
- Changing a YouTube video's width or alignment reloaded the player (stopping a playing video),
  because the iframe's address was set again on every change.
- A math formula's source was inserted as HTML when the optional `katex` package was missing or KaTeX
  failed (deep nesting), so a document could run script in the host page. It is shown as text.
- Markdown saves could turn document text into live HTML or `javascript:` links (a blank line in a
  comment, math, Mermaid or other kept HTML; `<` in plain text; escaped brackets in link text, which
  marked reads as a link).
- The history preview let script URLs through with a tab, newline or control character in the
  scheme, or through SVG animation, and still fetched from other hosts (CSS `url()`, SVG images,
  `<input type=image>`, `background`, `srcset`, external SVG `use`).
- A document could add CSS declarations through an image's or video's `data-width`, classes through an
  admonition's `data-type`, and any youtube.com address (or a thumbnail facade background from any
  host) through a video ID. Only lengths, known alignments and types, and real video IDs are taken.
- An embed's "Open in new tab" opened a `javascript:` source from the document; the image and embed
  source fields accepted any scheme; the embed trust list accepted non-web schemes naming a host.
- Consent for a YouTube video or an embed carried over to a different video or source shown in the
  same place; each asks again.
- Inside a host's `<form>`, the editor's buttons (selection menu, toolbar overflow and customizer,
  history view, panels, modals) submitted the form, Enter in a text field (the math source, the
  image search, a citation label, the video link) submitted it, and the link popover and video
  search nested forms. Every button is `type="button"`, every field keeps Enter (a citation label
  saves, a valid video link inserts), and there are no forms.
- Selection menus ignored their placement, layering and size (TipTap 3 dropped the `tippyOptions` they
  passed): the scroll container clipped them (a selected video's menu could not be seen) and a loaded
  video's click layer swallowed clicks on the text menu above it.
- A document opened with `initialContent` ending in a heading, list, quote, table or code block
  recorded a phantom edit (and told the host to save) on the first click.
- Restoring or undoing while typing was pending and the history was full restored the wrong version.
- History and lifecycle: a title change around an editor replacement or an `<Activity>` reveal was
  lost; typing pending at unmount, or while hidden, was lost or overwritten by undo; a document
  switch while hidden recorded the old document's typing for the new one; `loadContent` changed
  identity on every editor recreation (re-running a host's load effect and discarding typing); a sync
  right after typing was recorded as the user's edit; `onContentChange` could hand over an entry
  differing from the stored one; undo, redo and restore collapsed spaces; an empty table could be
  dropped on an editor replacement; a string index broke redo; a numeric-string cap was ignored; and
  replacing an editor that held React-rendered nodes logged a `flushSync` error.
- Every undo, restore and load rebuilt the entire document's DOM (every formula and diagram rendered
  again), because the table plugin's state was reset.
- Markdown round trips lost footnotes, comments alone in a block, a checklist's last empty item and
  its ticks, Mermaid and math line breaks, inline math characters, tables with a backslash before a
  pipe, column alignment, literal text that looked like syntax, hard breaks in headings or in pairs,
  empty blocks, and the boundary between two adjacent lists; `-->` in a comment came back as `--&gt;`;
  a link around inline code, and bold inline code, lost the link or the bold on load.
- Exporting a GFM table to Markdown took time quadratic in its rows (20 s for 4000 rows).
- The slash menu opened inside code (turning a code block into a heading on Enter), was shared by
  every editor on a page (a read-only one took the keyboard), and ignored the `<InscriptEditor>`
  `onShowMediaLibrary` / `onAddYoutube` props; items without an `id` warned.
- In a read-only editor, the math and Mermaid source editors, the bibliography panel and (with the
  hook result spread in) the toolbar could still change the document.
- Definition List in a list item or with an image selected corrupted the document; Footnote and
  Citation in a code block split it; a divider in a definition list left the cursor between blocks.
- The admonition control showed the wrong type and nested a second admonition instead of switching.
- Font sizes in pt, em, % or keywords were lost on save.
- The text menu opened over selected embeds, formulas, diagrams and rules; Escape in a source field
  applied the typed value; the link field closed silently on a refused address, kept spaces in the
  address and ignored a whitespace-only one.
- The outline put the cursor between blocks for later headings and rebuilt every heading button on
  each keystroke; the minimap rebuilt every block's box after each edit; the toolbar measured its
  width (a forced layout) on every keystroke; the toolbar and text menu re-read every format on the
  whole selection twice per transaction.
- Toolbar and menu configs with duplicate ids rendered twice; Image, YouTube, Tags and Wikilink
  buttons stayed enabled with nothing to do; marks lit up in a code block; the abbreviation button
  did not remove an abbreviation around the cursor; the customizer hid the Selection Menu tab with
  the default selection menu; a standalone `HighlightSelector` went stale; the image picker kept an
  old error and search, offered upload without `onUpload`, and crashed without `images`; video
  search durations showed fractions; an emptied citation label showed `[]`; a consent placeholder
  kept its old language after a switch.
- Comparing two long, very different versions in the history view blocked the page for seconds; it
  now gives up after half a second and shows both versions as they are.
- `extractYoutubeId` and the server-side `getTextContent` took quadratic time on hostile input.
- `FontSize` was declared a `Mark` in the types (it is an `Extension`), `TextBubbleMenu`'s type
  lacked `onAddAbbreviation`, and `ImageSelectorModal`'s type required `onUpload`.
- The homepage was wider than a phone screen (the quick start code cards), so phones showed it zoomed
  out.

## [0.5.0] - 2026-10-04

### Added
- Support for the current majors of the optional and UI peers. The peer ranges now also accept
  `lucide-react` 1.x, `i18next` 26, `react-i18next` 17, `diff` 9, `katex` 0.18 and `mermaid` 12; the
  test suite passes on both the previous and the new major of each.
- A default highlight. The highlight picker's first swatch applies a plain `<mark>` with no colour of
  its own, drawn from the theme's mark token (`markBg` / `markText`). It is the one highlight a
  Markdown round trip can keep as `==text==`; every other swatch still sets a colour. Exported as
  `<HighlightSelector>`, with a `defaultSwatch` prop on `<ColorSelector>` for building your own.
- The homepage demo and the embed page can open the version history panel: a clock button in the
  right rail (or `?tab=history`), so every edit you make there becomes a version you can compare
  and restore.
- README: a "Saving as Markdown" section for `applyInscriptEditorTurndownRules`, the minimum peer
  versions, and the complete lists of exported extensions and components.

### Changed
- **A table nobody placed no longer carries placement markup.** `getHTML()` wrote
  `data-align="center"` and centring margins on every table, which was read downstream as column
  alignment (every Markdown column saved as `:---:`). An unplaced table is now a bare `<table>`; a
  table set left or right still writes `data-align` and its margins. Documents saved earlier load
  the same, and the stylesheet centres an unplaced table wherever the content rules apply. A host
  that renders saved HTML with its own CSS and wants unplaced tables centred needs
  `margin-inline: auto` on them.
- `applyInscriptEditorTurndownRules` keeps the formatting Markdown has no syntax for instead of
  dropping it: highlight (with its colour), subscript, superscript, underline, text colour and font
  size keep their HTML tag around Markdown content ("H<sub>2</sub>O" was saved as "H2O"), and a
  centred, right-aligned or justified paragraph or heading is kept as an HTML block.
- The YouTube toolbar tool, bubble menu and modal use lucide's `SquarePlay` icon instead of its
  `Youtube` brand icon, which lucide-react 1.0 removed (with every brand icon). `SquarePlay` exists
  in both 0.577 and 1.x, so the icon renders whichever lucide the host has.
- Mermaid diagrams are pinned to the classic look and the dagre layout (Mermaid 11's defaults), so
  a document draws the same on Mermaid 11 and 12, whose defaults changed to the "neo" look and the
  ELK layout. A diagram can still choose its own through its frontmatter config.
- Development moves to Vitest 5, jsdom 29 and jest-dom 7, which need Node 22.12 or later; CI now
  runs on Node 24 like the release and Pages workflows. The development lockfile is refreshed
  (TipTap 3.31.4, React 19.3, Vite 8.3), clearing every `npm audit` finding in this repo's own
  toolchain. This repo still develops against Mermaid 11: Mermaid 12.0.0 depends on a `lodash-es`
  with open advisories (through chevrotain), which a host that chooses Mermaid 12 inherits.

### Fixed
- **Breaking: raised the minimum TipTap and Mermaid versions to patched releases.** The peer ranges allowed
  versions with published advisories, and the editor exercises both code paths:
  - every `@tiptap/*` peer is now `^3.30.5` (was as low as `^3.20.4`). Earlier `@tiptap/core`
    releases have a high-severity ReDoS in its Markdown attribute parsing (GHSA-j95f-988m-3j2f, fixed
    in 3.30.5) and a `mergeAttributes()` `__proto__` issue (GHSA-cp6q-959q-f8rh, fixed in 3.30.4),
    which several of this editor's extensions call;
  - `mermaid` is now `^11.16.1` (was `^11.16.0`): 11.16.0 has five advisories (CSS injection,
    prototype pollution, and two denial-of-service bugs) reachable from diagrams in a document.

  A host on an older TipTap or Mermaid must update them together with this release (npm reports
  the peer mismatch). All 23 TipTap packages should stay on one version.
- **The open document could be blanked.** Two ways, both through the logic that hands a
  document from an editor to its replacement:
  - In development (React StrictMode with Fast Refresh), editing the file of the component that
    hosts the editor emptied the document, or reverted it to what it was at mount. StrictMode
    builds and discards an extra editor a moment after mount; that destruction was taken for the
    live editor's, and the live document as it then stood was kept as a leftover and applied on
    the next effect re-run. Each editor now reports its own destruction, and a leftover is only
    ever given to a different editor.
  - When React tore the effects down and TipTap destroyed the editor meanwhile (an `<Activity>`
    hidden, then shown), the replacement editor came back empty under an intact history. It now
    gets the document back, including typing that had not been recorded yet.

  An empty editor is also never trusted over a recorded document: without a leftover that can be
  believed, a replacement editor is given the active version.
- Effects re-running on the same editor (StrictMode, Fast Refresh) no longer drop a pending edit
  or arm a commit for unchanged metadata.
- **The history panel is laid out by its own width, not the viewport's.** In a narrow editor pane
  inside a wide window (a library on one side, an outline on the other) it still put the version
  list and both previews side by side, leaving the previews no width at all. It now uses container
  queries: below 48rem of panel width the list sits on top with the two previews stacked under
  it, each at full width.
- **Toolbar buttons show the editor's state.** The toolbar and the text and table bubble menus read
  the editor while rendering, but nothing re-rendered them when it changed (TipTap 3 does not
  re-render React on transactions), so Bold never lit up when clicked and no button followed the
  cursor. They now follow every change. The bubble menus also stopped dispatching a needless
  transaction on every render.
- **Table placement works in the editor.** The left/centre/right margins were set on the
  full-width wrapper around the table instead of the table, so a narrow table sat at the left
  whatever its placement, while the saved HTML said otherwise. Placement now moves the table, for
  tables in the document the editor was created with too.
- Task items lacking `data-type="taskItem"` inside a declared task list (`ul[data-type="taskList"]`,
  as officeParser's editor-bound HTML wrote them) loaded as one empty task item followed by a plain
  bullet list, losing the checked state. Every item of a declared task list is now a task item,
  with its state read from `data-checked` or its checkbox.
- `<BibliographyPanel>` refreshes after content set with `emitUpdate: false` (a quiet load, a
  version restore), like the outline and minimap.

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
- Hosts linked to this checkout's `dist/` (for trying unpublished changes) no longer break while it
  rebuilds. Every build emptied `dist/` first, so the bundle and stylesheets were missing for the
  whole build, and `npm run dev` (`vite build --watch`) never produced `styles/content.css` at all
  (a separate script made it, which only `npm run build` ran). The build now makes `content.css`
  itself, on every build and watch rebuild, writes every file atomically, and never empties
  `dist/` (`npm run clean`, run by `prepublishOnly`, does that before a publish). The published
  files are byte-identical.
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

[0.7.0]: https://github.com/harshankur/inscript-editor/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/harshankur/inscript-editor/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/harshankur/inscript-editor/compare/v0.4.0...v0.5.0
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
