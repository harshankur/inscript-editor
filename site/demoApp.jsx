import React from 'react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import '../dist/styles/inscript-editor.css';
import './demo.css';
import { ListTree, Map as MapIcon, Palette, X } from 'lucide-react';
import {
    useInscriptEditor, InscriptEditor, MiniMap, DocumentOutline, extractYoutubeId,
    DEFAULT_TOOLBAR_CONFIG, DEFAULT_BUBBLE_CONFIG,
} from '../src/index.js';

if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } });
}

// Right-hand tools, markdownwriter-style: a narrow always-present rail of icon buttons
// (Outline / Minimap), with ONE panel open at a time beside it. Clicking the active
// button closes it, collapsing back to just the rail — so the editor gets the full width
// by default. The library components render with chrome={false}, so this panel's header is
// the only one and they fill the panel body.
const PANELS = {
    outline: { icon: ListTree, title: 'Outline' },
    minimap: { icon: MapIcon, title: 'Minimap' },
    theme: { icon: Palette, title: 'Theme' },
};

// Full-palette presets: each sets background, panels, text, borders and code so the
// whole editor re-skins, not just the accent. A value you set wins in BOTH light and
// dark mode (you own it), so the light presets stay light even with the page's dark
// toggle on; the "Slate" preset shows you can drive a full dark look from the prop
// alone, independent of the page.
const THEME_PRESETS = [
    { name: 'Default', theme: {} },
    { name: 'Violet', theme: { accent: '#7c3aed', link: '#6d28d9', surface: '#fbfaff', surfaceRaised: '#f2ecfe', text: '#2a2141', border: '#e7ddfb', borderStrong: '#d6c6f7', codeBg: '#efe7ff' } },
    { name: 'Sunset', theme: { accent: '#ea580c', link: '#c2410c', surface: '#fffaf4', surfaceRaised: '#fff1e6', text: '#41271a', border: '#f6e1cd', borderStrong: '#f0cba6', codeBg: '#ffe7d2' } },
    { name: 'Rose', theme: { accent: '#e11d48', link: '#be123c', surface: '#fff7f9', surfaceRaised: '#ffe9ef', text: '#3f1622', border: '#f8d6df', borderStrong: '#f4b6c5', codeBg: '#ffdfe8' } },
    { name: 'Ocean', theme: { accent: '#0284c7', link: '#0369a1', surface: '#f5fbff', surfaceRaised: '#e7f3fd', text: '#0f2a3f', border: '#cfe6f6', borderStrong: '#a9d2ee', codeBg: '#dceffb' } },
    { name: 'Slate', theme: { accent: '#22d3ee', link: '#22d3ee', onAccent: '#06232b', surface: '#0b1220', surfaceRaised: '#131d2f', text: '#e2e8f0', muted: '#94a3b8', border: '#24314a', borderStrong: '#3a4c6b', codeBg: '#0e1728', codeText: '#e2e8f0' } },
    { name: 'Serif', theme: { accent: '#6d28d9', link: '#6d28d9', fontFamily: 'Georgia, "Times New Roman", serif', headingFont: '"Iowan Old Style", Palatino, Georgia, serif', surface: '#fdfcf8', surfaceRaised: '#f4f0e7', text: '#2b2620', codeBg: '#efe9db' } },
];

const FONT_PRESETS = {
    System: '',
    Serif: 'Georgia, "Times New Roman", serif',
    Mono: 'ui-monospace, Menlo, Consolas, monospace',
    Rounded: '"SF Pro Rounded", "Nunito", "Segoe UI", system-ui, sans-serif',
};

// Live editor of the `theme` prop. Presets replace the whole theme; the individual
// controls merge into it, so you can pick a preset and then nudge one token.
// The color tokens exposed as pickers: [theme key, label, default shown when unset].
const THEME_COLORS = [
    ['accent', 'Accent', '#10b981'],
    ['link', 'Links', '#047857'],
    ['text', 'Text', '#18181b'],
    ['surface', 'Background', '#ffffff'],
    ['surfaceRaised', 'Panels', '#fafafa'],
];

function ThemeControls({ theme, setTheme }) {
    const radiusPx = parseInt(theme.radius, 10) || 8;
    const set = (patch) => setTheme((t) => ({ ...t, ...patch }));
    return (
        <div className="demo-theme">
            <p className="demo-theme-hint">Every control drives the editor's <code>theme</code> prop live. A value you set applies in both light and dark.</p>
            <div className="demo-theme-presets">
                {THEME_PRESETS.map((p) => (
                    <button key={p.name} type="button" className="demo-theme-preset" onClick={() => setTheme(p.theme)}>
                        <span className="demo-theme-dot" style={{ background: p.theme.accent || '#10b981' }} />
                        {p.name}
                    </button>
                ))}
            </div>
            {THEME_COLORS.map(([key, label, dflt]) => (
                <label key={key} className="demo-theme-field">
                    <span>{label}</span>
                    <input type="color" value={theme[key] || dflt} onChange={(e) => set({ [key]: e.target.value })} />
                </label>
            ))}
            <label className="demo-theme-field">
                <span>Font</span>
                <select value={theme.fontFamily || ''} onChange={(e) => set({ fontFamily: e.target.value || undefined })}>
                    {Object.entries(FONT_PRESETS).map(([name, val]) => <option key={name} value={val}>{name}</option>)}
                </select>
            </label>
            <label className="demo-theme-field">
                <span>Radius</span>
                <input type="range" min="0" max="20" value={radiusPx} onChange={(e) => set({ radius: `${e.target.value}px` })} />
                <em>{radiusPx}px</em>
            </label>
            <button type="button" className="demo-theme-reset" onClick={() => setTheme({})}>Reset to default</button>
        </div>
    );
}

function DemoSidebar({ editor, theme, setTheme, showOutline = true, showMiniMap = true }) {
    // Build the visible panel set: outline/minimap are gated by the host flags, the
    // theme editor is always available.
    const panels = {};
    if (showOutline) panels.outline = PANELS.outline;
    if (showMiniMap) panels.minimap = PANELS.minimap;
    panels.theme = PANELS.theme;

    // Default collapsed (rail only); ?tab=outline|minimap|theme opens one (used for screenshots).
    const [view, setView] = React.useState(() => {
        try { const p = new URLSearchParams(location.search).get('tab'); return panels[p] ? p : null; }
        catch { return null; }
    });
    const toggle = (v) => setView((cur) => (cur === v ? null : v));
    const active = view && panels[view];
    const renderBody = () => {
        if (view === 'outline') return <DocumentOutline editor={editor} chrome={false} />;
        if (view === 'minimap') return <MiniMap editor={editor} chrome={false} />;
        if (view === 'theme') return <ThemeControls theme={theme} setTheme={setTheme} />;
        return null;
    };
    return (
        <>
            {active && (
                <aside className="demo-panel im-demo-aside">
                    <header className="demo-panel-head">
                        <active.icon size={14} />
                        <span>{active.title}</span>
                        <button onClick={() => setView(null)} title="Close" aria-label="Close panel"><X size={15} /></button>
                    </header>
                    {/* The outline/minimap render chrome-less inside this panel; the theme panel scrolls. */}
                    <div className={`demo-panel-body ${view === 'theme' ? 'is-plain' : ''}`}>{renderBody()}</div>
                </aside>
            )}
            <div className="demo-rail im-demo-aside" role="toolbar" aria-orientation="vertical" aria-label="Editor panels">
                {Object.entries(panels).map(([id, p]) => (
                    <button
                        key={id}
                        type="button"
                        className={`demo-railbtn ${view === id ? 'active' : ''}`}
                        onClick={() => toggle(id)}
                        title={p.title}
                        aria-label={p.title}
                        aria-pressed={view === id}
                    >
                        <p.icon size={16} />
                    </button>
                ))}
            </div>
        </>
    );
}

const IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="420"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#38bdf8"/><stop offset=".45" stop-color="#a7f3d0"/><stop offset=".46" stop-color="#4ade80"/><stop offset="1" stop-color="#166534"/></linearGradient></defs><rect width="960" height="420" fill="url(#g)"/><circle cx="720" cy="110" r="46" fill="#fde68a"/><path d="M0 420 L250 180 L420 270 L620 140 L820 300 L960 220 L960 420 Z" fill="#15803d"/></svg>`);

export const SAMPLE = `
<h1>The Fjords of Western Norway</h1>
<p>A standalone, TipTap-based editor, and this whole panel is <strong>live</strong>. Select some text, open the <em>“/”</em> menu, drag the minimap, or hit the settings gear to rearrange the toolbar. Everything you see is the <a href="https://www.npmjs.com/package/inscript-editor">inscript-editor</a> package.</p>
<img src="${IMG}" data-width="100%" />
<h2>Getting There</h2>
<p>Most visitors arrive through Bergen, then continue by rail or road toward the inner arms of the Sognefjord. Book the popular legs early in summer, and keep a ferry timetable handy.</p>
<ul>
<li>Reserve seats on the Flåm branch</li>
<li>Sit on the left leaving Bergen</li>
<li>Buy the combined fjord ticket</li>
</ul>
<h2>What to Pack</h2>
<ol>
<li>Waterproof shell, since the weather turns fast</li>
<li>Layers for the plateau crossing</li>
<li>A real camera; phones don't do the light justice</li>
</ol>
<h3>Checklist</h3>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="true">Book the Bergen Line</li>
<li data-type="taskItem" data-checked="false">Reserve a harbour room</li>
</ul>
<blockquote>Wake before the first ferry and the fjord is a mirror; by ten it is a highway of tour boats.</blockquote>
<h2>A Musical Interlude</h2>
<p>Embeds are first-class. Here's one, because the internet demands it:</p>
<div data-youtube-video="dQw4w9WgXcQ"></div>
<h2>Costs at a Glance</h2>
<table>
<thead><tr><th>Item</th><th>Low (NOK)</th><th>High (NOK)</th></tr></thead>
<tbody>
<tr><td>Lodging / night</td><td>800</td><td>2400</td></tr>
<tr><td>Ferry day pass</td><td>210</td><td>210</td></tr>
<tr><td>Dinner</td><td>180</td><td>520</td></tr>
</tbody>
</table>
<h2>A Snippet</h2>
<p>Inline <code>code</code> and fenced blocks are first-class:</p>
<pre><code>function itinerary(days) {
  const plan = [];
  for (let d = 0; d &lt; days; d++) plan.push('explore');
  return plan;
}</code></pre>
<hr>
<p>By the third morning the rhythm of ferries and quiet villages has become the whole point, and the itinerary matters less than the light.</p>
`;

export function Demo({ focusMode = false, showMiniMap = true, showOutline = true, enableCustomizer = true }) {
    // Host insert handlers, provided ONCE via editorOptions so they drive both the toolbar
    // buttons AND the "/" menu (whose Image/YouTube entries appear only when the handler is
    // present). They read the editor through a ref since they're defined before it exists.
    const editorRef = React.useRef(null);
    const onShowMediaLibrary = React.useCallback(() => {
        const url = window.prompt('Image URL');
        if (url && editorRef.current) editorRef.current.chain().focus().setImage({ src: url }).run();
    }, []);
    const onAddYoutube = React.useCallback(() => {
        const url = window.prompt('YouTube URL or video ID');
        const id = url && extractYoutubeId(url);
        if (id && editorRef.current) editorRef.current.chain().focus().setYoutubeVideo({ 'data-youtube-video': id }).run();
    }, []);

    const api = useInscriptEditor({
        contentKey: 'inscript-editor-demo',
        title: 'The Fjords of Western Norway',
        editorOptions: { onShowMediaLibrary, onAddYoutube },
    });
    const { editor } = api;
    editorRef.current = editor;

    // The customizer drawer scopes itself to this element (position: relative; overflow:
    // hidden) instead of covering the viewport. Track it in state so it's set once mounted.
    const panelRef = React.useRef(null);
    const [container, setContainer] = React.useState(null);
    React.useEffect(() => { setContainer(panelRef.current); }, []);

    // Host-owned toolbar/bubble config — providing onChange is what reveals the settings gear.
    const [toolbarConfig, setToolbarConfig] = React.useState(DEFAULT_TOOLBAR_CONFIG);
    const [bubbleConfig, setBubbleConfig] = React.useState(DEFAULT_BUBBLE_CONFIG);
    // Live theme object driven by the Theme panel; empty = the built-in look.
    const [theme, setTheme] = React.useState({});

    React.useEffect(() => { if (editor) editor.commands.setContent(SAMPLE); }, [editor]);

    // In focus mode, drop the caret into a paragraph so one block reads at full opacity
    // and the rest dim — the real focus-mode look (otherwise, with no selection, every
    // block sits at the dimmed baseline).
    React.useEffect(() => {
        if (!editor || !focusMode) return;
        const pos = Math.min(52, editor.state.doc.content.size);
        editor.commands.setTextSelection(pos);
        editor.commands.focus();
    }, [editor, focusMode]);

    // Optional deep-link (?select=youtube|image|embed): select the first node of that type
    // so its bubble menu opens — handy for screenshots and for linking to a feature.
    React.useEffect(() => {
        if (!editor) return;
        let type;
        try { type = new URLSearchParams(location.search).get('select'); } catch { type = null; }
        if (!type) return;
        let pos = null;
        editor.state.doc.descendants((n, p) => { if (n.type.name === type && pos == null) pos = p; });
        if (pos != null) setTimeout(() => editor.chain().focus().setNodeSelection(pos).run(), 350);
    }, [editor]);

    return (
        <div className="im-demo" ref={panelRef}>
            <div className="im-demo-main">
                <InscriptEditor
                    editor={editor}
                    {...api}
                    focusMode={focusMode}
                    theme={theme}
                    toolbarConfig={enableCustomizer ? toolbarConfig : undefined}
                    onToolbarConfigChange={enableCustomizer ? setToolbarConfig : undefined}
                    bubbleMenuConfig={bubbleConfig}
                    onBubbleMenuConfigChange={setBubbleConfig}
                    customizerContainer={container}
                />
            </div>
            {/* A single right-hand sidebar: outline, minimap and the live theme editor, one open at a time. */}
            {!focusMode && <DemoSidebar editor={editor} theme={theme} setTheme={setTheme} showOutline={showOutline} showMiniMap={showMiniMap} />}
        </div>
    );
}
