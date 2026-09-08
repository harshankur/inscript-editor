import React from 'react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import '../dist/styles/inscript-editor.css';
import './demo.css';
import {
    useInscriptEditor, InscriptEditor, MiniMap, DocumentOutline, extractYoutubeId,
    DEFAULT_TOOLBAR_CONFIG, DEFAULT_BUBBLE_CONFIG,
} from '../src/index.js';

if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } });
}

// The combined sidebar renders the outline/minimap header-less, so make sure neither
// component starts in its own collapsed state.
try {
    localStorage.removeItem('inscript-outline-collapsed');
    localStorage.removeItem('inscript-minimap-collapsed');
} catch { /* ignore */ }

// One right-hand sidebar that holds BOTH the document outline and the minimap, with a
// tab strip so only one is open at a time. The library components keep their own chrome,
// so demo.css hides their internal headers and lets them fill this panel.
function DemoSidebar({ editor }) {
    const [tab, setTab] = React.useState(() => {
        try { return new URLSearchParams(location.search).get('tab') === 'minimap' ? 'minimap' : 'outline'; }
        catch { return 'outline'; }
    });
    return (
        <div className="demo-sidebar im-demo-aside">
            <div className="demo-sidebar-tabs" role="tablist">
                <button role="tab" aria-selected={tab === 'outline'} className={tab === 'outline' ? 'active' : ''} onClick={() => setTab('outline')}>Outline</button>
                <button role="tab" aria-selected={tab === 'minimap'} className={tab === 'minimap' ? 'active' : ''} onClick={() => setTab('minimap')}>Minimap</button>
            </div>
            <div className="demo-sidebar-body">
                {tab === 'outline' ? <DocumentOutline editor={editor} /> : <MiniMap editor={editor} />}
            </div>
        </div>
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
<div data-youtube-video><iframe src="https://www.youtube.com/watch?v=dQw4w9WgXcQ"></iframe></div>
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
    const api = useInscriptEditor({ contentKey: 'inscript-editor-demo', title: 'The Fjords of Western Norway' });
    const { editor } = api;

    // The customizer drawer scopes itself to this element (position: relative; overflow:
    // hidden) instead of covering the viewport. Track it in state so it's set once mounted.
    const panelRef = React.useRef(null);
    const [container, setContainer] = React.useState(null);
    React.useEffect(() => { setContainer(panelRef.current); }, []);

    // Host-owned toolbar/bubble config — providing onChange is what reveals the settings gear.
    const [toolbarConfig, setToolbarConfig] = React.useState(DEFAULT_TOOLBAR_CONFIG);
    const [bubbleConfig, setBubbleConfig] = React.useState(DEFAULT_BUBBLE_CONFIG);

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

    const onShowMediaLibrary = () => {
        const url = window.prompt('Image URL');
        if (url && editor) editor.chain().focus().setImage({ src: url }).run();
    };
    const onAddYoutube = () => {
        const url = window.prompt('YouTube URL or video ID');
        const id = url && extractYoutubeId(url);
        if (id && editor) editor.chain().focus().setYoutubeVideo({ 'data-youtube-video': id }).run();
    };

    return (
        <div className="im-demo" ref={panelRef}>
            <div className="im-demo-main">
                <InscriptEditor
                    editor={editor}
                    {...api}
                    focusMode={focusMode}
                    onShowMediaLibrary={onShowMediaLibrary}
                    onAddYoutube={onAddYoutube}
                    toolbarConfig={enableCustomizer ? toolbarConfig : undefined}
                    onToolbarConfigChange={enableCustomizer ? setToolbarConfig : undefined}
                    bubbleMenuConfig={bubbleConfig}
                    onBubbleMenuConfigChange={setBubbleConfig}
                    customizerContainer={container}
                />
            </div>
            {/* A single right-hand sidebar holding the outline and the minimap, one open at a time. */}
            {!focusMode && (showOutline || showMiniMap) && <DemoSidebar editor={editor} />}
        </div>
    );
}
