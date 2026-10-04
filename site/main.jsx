import React from 'react';
import { createRoot } from 'react-dom/client';
import { trackPageView } from './track.js';
import { Demo } from './demoApp.jsx';

// Count this homepage view (fire-and-forget; no-op on localhost).
trackPageView();

// ── Theme (persisted; the same `dark` class drives the page and the editor) ──
const root = document.documentElement;
const saved = localStorage.getItem('ie-theme');
if (saved === 'dark' || (!saved && matchMedia('(prefers-color-scheme: dark)').matches)) root.classList.add('dark');
document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const dark = root.classList.toggle('dark');
    localStorage.setItem('ie-theme', dark ? 'dark' : 'light');
});

// ── Copy install command ──
document.getElementById('copy-install')?.addEventListener('click', async (e) => {
    try {
        await navigator.clipboard.writeText('npm install inscript-editor');
        const btn = e.currentTarget;
        btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>';
        setTimeout(() => { btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>'; }, 1600);
    } catch { /* clipboard blocked; ignore */ }
});

// ── Feature grid ──
const icon = (p) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const FEATURES = [
    ['Rich text on TipTap v3', 'Bold, italic, headings, lists, quotes, code, sub/superscript, alignment, font size, text & highlight colour, links.', '<path d="M4 7V5h16v2M9 5v14M7 19h4"/>'],
    ['Images & media', 'Inline resize and alignment, a media-library hook for your own uploads, and validated YouTube embeds.', '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>'],
    ['Tables', 'Per-cell, row and column controls, header row/column toggles, and layout alignment.', '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>'],
    ['Math & diagrams', 'KaTeX math and Mermaid diagrams, loaded lazily and declared as optional peers so they stay out of your bundle until used.', '<path d="M4 4h16M9 4l-3 16M15 4l3 16M4 20h16"/>'],
    ['Wikilinks, citations & footnotes', 'First-class scholarly and knowledge-base primitives, plus admonitions, definition lists and abbreviations.', '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>'],
    ['Slash commands', 'Type “/” for a searchable command menu; bring your own registry or extend the defaults.', '<path d="M9 20 15 4"/><rect x="3" y="4" width="18" height="16" rx="2"/>'],
    ['Version history & diff', 'Append-only versions with undo, redo and one-click restore, a visual/text/source diff, and a save hook that hears every change.', '<path d="M3 3v6h6M3 9a9 9 0 1 0 3-6.7L3 5"/><path d="M12 7v5l3 3"/>'],
    ['Followable minimap', 'A spatial outline with readable heading labels, real image thumbnails and a draggable, fit-to-panel viewport.', '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/><path d="M6 8h5M6 12h5M6 16h3"/>'],
    ['i18n-ready', 'Every string carries an English default and auto-registers into your i18next, so it works out of the box. Add any language from your own app with a one-call override.', '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>'],
    ['Markdown round trips', 'Turndown rules that keep what Markdown cannot say: checklists and tables as GFM, and highlights, sub/superscript, embeds, citations and comments as HTML, so a save loses nothing.', '<path d="M3 5h18v14H3z"/><path d="M7 15V9l2.5 3L12 9v6M15 12l2 3 2-3M17 9v6"/>'],
    ['Themeable', 'One theme prop, or the --inscript-* CSS variables behind it, restyles every colour, surface, radius and font, with WCAG AA defaults in light and dark.', '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18c1.7 0 2-1.3 1.2-2.3-.9-1.1-.2-2.7 1.3-2.7H17a4 4 0 0 0 4-4"/><circle cx="8" cy="10" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16" cy="10" r="1"/>'],
    ['Private by default', 'Third-party embeds wait behind a click until you trust their host, and version previews never load them at all.', '<rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'],
];
const grid = document.getElementById('feature-grid');
if (grid) {
    grid.innerHTML = FEATURES.map(([h, p, path]) =>
        `<div class="card"><div class="ic">${icon(path)}</div><h3>${h}</h3><p>${p}</p></div>`
    ).join('');
}

// ── Live demo ──
const demoRoot = document.getElementById('demo-root');
if (demoRoot) createRoot(demoRoot).render(<Demo />);
