import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ChevronRight, Map as MapIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { hasView, viewDom } from '../utils/editorView.js';

// ── What this is ────────────────────────────────────────────────────────────
// A "spatial outline", not a photo of the text. Prose has weak silhouette (most
// paragraphs look alike shrunk), so a faithful VSCode-style thumbnail would be a
// stack of near-identical grey blocks you can't navigate. Instead we make the
// picture a function of the CONTENT and keep the WHOLE document in view:
//   • headings render as READABLE text at their true position, sized/indented by
//     level — the landmarks you actually steer by;
//   • body is content-derived line texture (real line counts, ragged last line,
//     colored inline runs for links/code) — enough shape to recognize a passage;
//   • images use their real bitmap — the strongest memory anchor in prose;
//   • everything is FIT TO THE PANEL, so the labels never scroll out of reach.
// Rendered in plain pixel space (absolutely-positioned elements) so text is crisp,
// truncation is free, and the viewport math is trivial.

// ── Geometry ──────────────────────────────────────────────────────────────────
const PAD_TOP = 6;
const PAD_BOTTOM = 8;
const X0 = 8;                 // left inset for body content
const RIGHT = 6;              // right inset
const NAT_PX_PER_LINE = 2.6;  // fallback density (unbounded host): minimap px per real text line
const GAP_FALLBACK = 3;       // gap when we can't measure (jsdom / not laid out)
const MIN_FIT_HEIGHT = 60;    // below this the panel isn't really bounded → don't fit
const MAX_SCALE = 0.5;        // cap upscaling so a very short doc doesn't balloon into giant bars

// Heading label metrics by level. Labels are allowed to overflow their (tiny)
// proportional box — they're cartographic annotations pinned at the true y.
const H_FONT = { 1: 11, 2: 9.5, 3: 8.5, 4: 8, 5: 7.5, 6: 7.5 };
const H_WEIGHT = { 1: 800, 2: 700, 3: 600, 4: 600, 5: 500, 6: 500 };
const hIndent = (level) => Math.min((Math.max(1, level) - 1) * 7, 24);
const hFont = (level) => H_FONT[level] || 8;
const hWeight = (level) => H_WEIGHT[level] || 500;

// ── Theming ───────────────────────────────────────────────────────────────────
// Chrome + neutral marks read CSS custom properties (fallbacks = the zinc/emerald
// defaults) so a themed host restyles by setting vars — no CSS-override hacks:
//   --im-minimap-bg / -border / -label / -line / -viewport
// Content-semantic colors (image sky, code emerald, link blue…) are intentionally
// NOT themed — they identify content types, not the host theme.
const LINE_CLS = 'bg-[var(--im-minimap-line,#d4d4d8)] dark:bg-[var(--im-minimap-line,#3f3f46)]';
const TICK_CLS = 'bg-[var(--im-minimap-label,#18181b)] dark:bg-[var(--im-minimap-label,#e4e4e7)]';
const LABEL_CLS = 'text-[var(--im-minimap-label,#18181b)] dark:text-[var(--im-minimap-label,#f4f4f5)]';
const BG_CLS = 'bg-[var(--im-minimap-bg,#fafafa)] dark:bg-[var(--im-minimap-bg,#18181b)]';
const BORDER_CLS = 'border-[var(--im-minimap-border,#e4e4e7)] dark:border-[var(--im-minimap-border,#27272a)]';
const HEADER_LABEL_CLS = 'text-[var(--im-minimap-label,#18181b)] dark:text-[var(--im-minimap-label,#f4f4f5)]';
const VIEWPORT_COLOR = 'var(--im-minimap-viewport, #10b981)';
const RUN_LINK_CLS = 'bg-sky-400/80 dark:bg-sky-500/80';
const RUN_CODE_CLS = 'bg-rose-400/80 dark:bg-rose-500/80';
const RUN_BOLD_CLS = 'bg-zinc-500/70 dark:bg-zinc-400/70';

const HUMAN_LABEL = {
    heading: 'Heading', paragraph: 'Paragraph',
    bulletList: 'Bullet list', orderedList: 'Numbered list', taskList: 'Task list',
    image: 'Image', customImage: 'Image', youtube: 'YouTube video',
    table: 'Table', customTable: 'Table',
    codeBlock: 'Code block', blockquote: 'Quote', admonition: 'Admonition',
    mathBlock: 'Math', mermaid: 'Diagram', horizontalRule: 'Divider',
    definitionList: 'Definition list',
};

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Inline mark runs (link / code / bold) as char spans, for body-line coloring.
function inlineRuns(node) {
    const runs = [];
    let pos = 0;
    node.forEach((child) => {
        const len = child.isText ? child.text.length : (child.textContent?.length || 0);
        if (child.marks && child.marks.length) {
            for (const m of child.marks) {
                const name = m.type.name;
                const kind = name === 'link' ? 'link'
                    : name === 'code' ? 'code'
                    : (name === 'bold' || name === 'strong') ? 'bold' : null;
                if (kind) { runs.push({ start: pos, len, kind }); break; }
            }
        }
        pos += len;
    });
    return runs;
}

// Measure top-level blocks against the real ProseMirror DOM. Direct children of
// .ProseMirror map 1:1 (in order) to top-level doc nodes.
function measureBlocks(editor) {
    const pmDom = editor.view.dom;
    const children = pmDom.children;
    const rows = [];
    let i = 0;
    editor.state.doc.forEach((node, offset) => {
        rows.push({ node, dom: children[i], pos: offset });
        i += 1;
    });

    let colLeft = Infinity, colRight = -Infinity, docTop = Infinity, docBottom = -Infinity;
    for (const r of rows) {
        const rect = r.dom && r.dom.getBoundingClientRect ? r.dom.getBoundingClientRect() : null;
        r.rect = rect;
        if (!rect || rect.width === 0) continue;
        colLeft = Math.min(colLeft, rect.left);
        colRight = Math.max(colRight, rect.right);
        docTop = Math.min(docTop, rect.top);
        docBottom = Math.max(docBottom, rect.bottom);
    }
    const colWidth = colRight - colLeft;
    const measured = isFinite(colLeft) && colWidth > 0 && docBottom > docTop;
    const docHeight = measured ? docBottom - docTop : 0;
    let lineHeightPx = parseFloat(getComputedStyle(pmDom).lineHeight);
    if (!lineHeightPx || Number.isNaN(lineHeightPx)) lineHeightPx = 28;

    const blocks = rows.map(({ node, rect, pos }) => {
        const type = node.type.name;
        const b = { type, level: node.attrs?.level, pos };
        if (measured && rect && rect.width > 0) {
            b.top = rect.top - docTop;
            b.height = rect.height;
            b.left = rect.left - colLeft;
            b.width = rect.width;
            b.lines = Math.max(1, Math.round(rect.height / lineHeightPx));
        }
        if (type === 'heading') b.text = node.textContent;
        if (type === 'paragraph' || type === 'heading') b.textLen = node.textContent.length;
        if (type === 'paragraph') b.runs = inlineRuns(node);
        if (type === 'image' || type === 'customImage') b.src = node.attrs?.src || '';
        if (type === 'bulletList' || type === 'orderedList' || type === 'taskList') b.itemCount = node.childCount;
        if (type === 'table' || type === 'customTable') { b.rows = node.childCount; b.cols = node.firstChild ? node.firstChild.childCount : 0; }
        if (type === 'codeBlock') b.codeLines = (node.textContent.match(/\n/g) || []).length + 1;
        if (type === 'definitionList') b.itemCount = node.childCount;
        return b;
    });

    return { blocks, docHeight, colWidth, measured, lineHeightPx };
}

// Fallback heights (jsdom / not-yet-laid-out) in minimap px.
function fallbackHeight(b) {
    switch (b.type) {
        case 'heading': return b.level === 1 ? 13 : b.level === 2 ? 11 : 10;
        case 'paragraph': return clamp(Math.round((b.textLen || 40) / 42) + 1, 1, 6) * 3;
        case 'bulletList': case 'orderedList': case 'taskList': return clamp(b.itemCount || 2, 1, 7) * 3.2;
        case 'image': case 'customImage': case 'youtube': return 22;
        case 'table': case 'customTable': return clamp(b.rows || 2, 1, 4) * 3;
        case 'codeBlock': return clamp(b.codeLines || 3, 2, 6) * 2.4 + 3;
        case 'blockquote': return 7;
        case 'admonition': return 9;
        case 'mathBlock': return 9;
        case 'mermaid': return 12;
        case 'horizontalRule': return 3;
        case 'definitionList': return clamp(b.itemCount || 2, 1, 5) * 5;
        default: return 3;
    }
}

// ── Pure layout math (exported for direct unit testing) ─────────────────────────
// The vertical scale. Fit-to-panel: scale the whole doc into the available height so
// it fills the panel and the viewport marker is a true proportional slice; cap
// upscaling so a short doc doesn't balloon. Falls back to a fixed density (with the
// body scrolling) when the host height is unbounded or the doc isn't measured yet.
export function miniMapScale({ measured, docHeight, availH, lineHeightPx }) {
    const natScale = NAT_PX_PER_LINE / (lineHeightPx || 28);
    const canFit = !!measured && availH >= MIN_FIT_HEIGHT && docHeight > 0;
    const S = canFit ? Math.min(availH / docHeight, MAX_SCALE) : natScale;
    return { S, canFit, natScale };
}

// The viewport marker as a proportional slice of the DRAWN document region (`drawnPx`),
// NOT the padded container — mapping against the container is what made a one-third-
// visible window render a marker that overran all the content.
export function miniMapViewport({ scrollTop, scrollHeight, clientHeight, drawnPx }) {
    const total = scrollHeight || 1;
    return {
        top: PAD_TOP + (scrollTop / total) * drawnPx,
        height: Math.max(12, (clientHeight / total) * drawnPx),
        scrolls: scrollHeight > clientHeight + 2,
    };
}

// Per-line body bars with content-derived ragged last line and colored inline runs.
function bodyLines({ w, h, lines, textLen, runs, cls = LINE_CLS, indent = 0 }) {
    const n = clamp(Math.round(lines || 2), 1, 400);
    // Too small to resolve individual lines → a single faint tone block.
    if (h / n < 1.6) {
        return [<div key="tone" className={cls} style={{ position: 'absolute', left: indent, top: 0, width: (w - indent), height: Math.max(1, h), borderRadius: 1, opacity: 0.5 }} />];
    }
    const pitch = h / n;
    const th = clamp(pitch * 0.5, 0.8, 1.8);
    const cpl = Math.max(1, Math.ceil((textLen || n * 40) / n)); // chars per line
    const lastChars = (textLen || n * cpl) - (n - 1) * cpl;
    const lastFrac = clamp(lastChars / cpl, 0.25, 1);
    const els = [];
    for (let i = 0; i < n; i++) {
        const last = i === n - 1;
        const lw = (w - indent) * (last ? lastFrac : 1);
        const y = i * pitch + (pitch - th) / 2;
        els.push(<div key={`l${i}`} className={cls} style={{ position: 'absolute', left: indent, top: y, width: lw, height: th, borderRadius: th / 2 }} />);
    }
    // Colored inline runs mapped onto their line.
    (runs || []).forEach((r, ri) => {
        const line = clamp(Math.floor(r.start / cpl), 0, n - 1);
        const xFrac = clamp((r.start - line * cpl) / cpl, 0, 0.95);
        const wFrac = clamp(r.len / cpl, 0.12, 1 - xFrac);
        const y = line * pitch + (pitch - th) / 2;
        const runCls = r.kind === 'link' ? RUN_LINK_CLS : r.kind === 'code' ? RUN_CODE_CLS : RUN_BOLD_CLS;
        els.push(<div key={`r${ri}`} className={runCls} style={{ position: 'absolute', left: indent + (w - indent) * xFrac, top: y, width: (w - indent) * wFrac, height: th, borderRadius: th / 2 }} />);
    });
    return els;
}

// Build the inner content of a block's box (everything except heading labels,
// which are drawn in their own collision-resolved layer).
function blockBody(b, w, h) {
    switch (b.type) {
        case 'heading':
            // A faint tick sits in the label layer; the box itself stays empty.
            return null;
        case 'paragraph':
            return bodyLines({ w, h, lines: b.lines || 2, textLen: b.textLen, runs: b.runs });
        case 'blockquote':
            return [
                <div key="bar" style={{ position: 'absolute', left: 0, top: 0, width: 1.6, height: h, borderRadius: 1, background: 'rgba(16,185,129,.6)' }} />,
                ...bodyLines({ w, h, lines: b.lines || 2, textLen: b.textLen, indent: 4.5 }),
            ];
        case 'bulletList':
        case 'orderedList':
        case 'taskList': {
            const n = clamp(b.itemCount || Math.max(1, Math.round(h / NAT_PX_PER_LINE)), 1, 40);
            const pitch = h / n;
            if (pitch < 1.8) return bodyLines({ w, h, lines: n, textLen: b.textLen, indent: 4 });
            const th = clamp(pitch * 0.5, 0.8, 1.6);
            const els = [];
            for (let i = 0; i < n; i++) {
                const y = i * pitch;
                if (b.type === 'taskList') els.push(<div key={`m${i}`} className="border border-zinc-400 dark:border-zinc-500" style={{ position: 'absolute', left: 0, top: y, width: 2.4, height: 2.4, borderRadius: 0.5 }} />);
                else if (b.type === 'orderedList') els.push(<div key={`m${i}`} className={LINE_CLS} style={{ position: 'absolute', left: 0, top: y + 0.2, width: 2.2, height: 1.8, borderRadius: 0.4 }} />);
                else els.push(<div key={`m${i}`} className={LINE_CLS} style={{ position: 'absolute', left: 0.4, top: y + 0.3, width: 2, height: 2, borderRadius: '50%' }} />);
                els.push(<div key={`t${i}`} className={LINE_CLS} style={{ position: 'absolute', left: 4.5, top: y + 0.3, width: (w - 4.5) * (1 - (i % 2) * 0.22), height: th, borderRadius: th / 2 }} />);
            }
            return els;
        }
        case 'image':
        case 'customImage':
            if (b.src) {
                return [<img key="img" src={b.src} alt="" loading="lazy" decoding="async" draggable={false}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 2, display: 'block', pointerEvents: 'none' }} />];
            }
            return [
                <div key="bg" className="bg-sky-200 dark:bg-sky-900 border border-sky-400 dark:border-sky-700" style={{ position: 'absolute', inset: 0, borderRadius: 2 }} />,
                <div key="mtn" className="bg-sky-400 dark:bg-sky-600" style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: '55%', clipPath: 'polygon(0 100%,30% 40%,55% 65%,78% 35%,100% 100%)' }} />,
            ];
        case 'youtube': {
            const s = clamp(Math.min(w, h) * 0.2, 3, 7);
            return [
                <div key="bg" className="bg-red-500" style={{ position: 'absolute', inset: 0, borderRadius: 2 }} />,
                <div key="p" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-40%,-50%)', width: 0, height: 0, borderLeft: `${s}px solid #fff`, borderTop: `${s * 0.6}px solid transparent`, borderBottom: `${s * 0.6}px solid transparent` }} />,
            ];
        }
        case 'table':
        case 'customTable': {
            const rows = clamp(b.rows || 2, 1, 14), cols = clamp(b.cols || 2, 1, 10);
            const els = [
                <div key="bg" className="bg-violet-100 dark:bg-violet-950" style={{ position: 'absolute', inset: 0, borderRadius: 1, boxShadow: 'inset 0 0 0 1px rgba(139,92,246,.4)' }} />,
                <div key="hdr" className="bg-violet-300/50 dark:bg-violet-800/50" style={{ position: 'absolute', left: 0, top: 0, width: w, height: h / rows }} />,
            ];
            for (let r = 1; r < rows; r++) els.push(<div key={`r${r}`} className="bg-violet-300/60 dark:bg-violet-700/60" style={{ position: 'absolute', left: 0, top: (h / rows) * r, width: w, height: 0.5 }} />);
            for (let c = 1; c < cols; c++) els.push(<div key={`c${c}`} className="bg-violet-300/60 dark:bg-violet-700/60" style={{ position: 'absolute', left: (w / cols) * c, top: 0, width: 0.5, height: h }} />);
            return els;
        }
        case 'codeBlock': {
            const n = clamp(b.codeLines || Math.max(2, Math.round(h / NAT_PX_PER_LINE)), 1, 200);
            const pitch = h / (n + 0.6);
            const els = [<div key="bg" className="bg-zinc-800 dark:bg-zinc-900" style={{ position: 'absolute', inset: 0, borderRadius: 2 }} />];
            if (pitch >= 1.4) {
                const th = clamp(pitch * 0.5, 0.7, 1.4);
                const wd = [0.55, 0.82, 0.4, 0.68, 0.5, 0.72, 0.6];
                for (let i = 0; i < n; i++) {
                    const ind = (i % 3 === 1 ? 6 : 3);
                    els.push(<div key={i} className="bg-emerald-400/70" style={{ position: 'absolute', left: ind, top: pitch * (i + 0.5), width: (w - ind - 3) * wd[i % wd.length], height: th, borderRadius: th / 2 }} />);
                }
            }
            return els;
        }
        case 'admonition':
            return [
                <div key="bg" className="bg-amber-100 dark:bg-amber-950" style={{ position: 'absolute', inset: 0, borderRadius: 2 }} />,
                <div key="bar" className="bg-amber-500" style={{ position: 'absolute', left: 0, top: 0, width: 2, height: h, borderRadius: 1 }} />,
                <div key="dot" className="bg-amber-500" style={{ position: 'absolute', left: 4.5, top: clamp(h * 0.28, 2, h / 2), width: 2.4, height: 2.4, borderRadius: '50%' }} />,
                ...bodyLines({ w, h, lines: clamp(b.lines || 2, 1, 6), cls: 'bg-amber-400/50', indent: 9 }),
            ];
        case 'mathBlock':
            return [
                <div key="bg" className="bg-indigo-100 dark:bg-indigo-950" style={{ position: 'absolute', inset: 0, borderRadius: 2 }} />,
                <div key="num" className="bg-indigo-500" style={{ position: 'absolute', left: w / 2 - 8, top: h / 2 - 2.6, width: 16, height: 1.2, borderRadius: 0.6 }} />,
                <div key="bar" className="bg-indigo-500" style={{ position: 'absolute', left: w / 2 - 11, top: h / 2 - 0.4, width: 22, height: 0.8 }} />,
                <div key="den" className="bg-indigo-500" style={{ position: 'absolute', left: w / 2 - 6, top: h / 2 + 1.4, width: 12, height: 1.2, borderRadius: 0.6 }} />,
            ];
        case 'mermaid':
            return [
                <div key="bg" className="bg-teal-100 dark:bg-teal-950" style={{ position: 'absolute', inset: 0, borderRadius: 2 }} />,
                <div key="n1" className="bg-teal-500" style={{ position: 'absolute', left: w * 0.12 - 2, top: h / 2 - 2, width: 4, height: 4, borderRadius: '50%' }} />,
                <div key="n2" className="bg-teal-400" style={{ position: 'absolute', left: w * 0.54 - 1.6, top: h * 0.3 - 1.6, width: 3.2, height: 3.2, borderRadius: '50%' }} />,
                <div key="n3" className="bg-teal-400" style={{ position: 'absolute', left: w * 0.54 - 1.6, top: h * 0.7 - 1.6, width: 3.2, height: 3.2, borderRadius: '50%' }} />,
            ];
        case 'horizontalRule':
            return [<div key="hr" className={LINE_CLS} style={{ position: 'absolute', left: 0, top: h / 2 - 0.5, width: w, height: 1, borderRadius: 0.5 }} />];
        case 'definitionList': {
            const n = clamp(b.itemCount || 2, 1, 20);
            const pitch = h / n;
            const els = [];
            for (let i = 0; i < n; i++) {
                els.push(<div key={`t${i}`} className={TICK_CLS} style={{ position: 'absolute', left: 0, top: pitch * i + pitch * 0.1, width: w * 0.4, height: clamp(pitch * 0.25, 0.9, 1.6), borderRadius: 0.7, opacity: 0.7 }} />);
                els.push(<div key={`d${i}`} className={LINE_CLS} style={{ position: 'absolute', left: 5, top: pitch * i + pitch * 0.5, width: w * 0.7, height: clamp(pitch * 0.2, 0.8, 1.3), borderRadius: 0.6 }} />);
            }
            return els;
        }
        default:
            return bodyLines({ w, h, lines: b.lines || 1, textLen: b.textLen });
    }
}

/**
 * MiniMap — a spatial-outline overview of the document with readable heading
 * landmarks, content-derived body texture, and a draggable viewport.
 *
 * @param {object} props
 * @param {import('@tiptap/core').Editor|null} props.editor
 * @param {string}  [props.width]           - CSS width for the expanded panel (default 9rem).
 * @param {string}  [props.className]       - Extra classes appended to the root.
 * @param {boolean} [props.showHeadingText] - Render readable heading labels (default true).
 *                                            When false, headings collapse to level ticks.
 */
export const MiniMap = ({ editor, width, className = '', showHeadingText = true }) => {
    const { t } = useTranslation('inscript-editor');
    const [meta, setMeta] = useState({ blocks: [], docHeight: 0, colWidth: 0, measured: false, lineHeightPx: 28 });
    const [panel, setPanel] = useState({ w: 0, h: 0 });
    const [isCollapsed, setIsCollapsed] = useState(() => {
        try { return localStorage.getItem('inscript-minimap-collapsed') === 'true'; } catch { return false; }
    });
    const [viewport, setViewport] = useState({ top: 0, height: 40, scrolls: false });

    const bodyRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const isDragging = useRef(false);
    const dragStartY = useRef(0);
    const dragStartScrollTop = useRef(0);
    const measureTimer = useRef(null);

    // 1. Measure the real document geometry (debounced on edits; immediate on mount).
    // hasView is re-checked on every call: the rAF, the debounce and the observer can all
    // fire after the editor was unmounted or destroyed (a host swapping editors per document).
    const measure = useCallback(() => {
        if (!hasView(editor)) return;
        setMeta(measureBlocks(editor));
    }, [editor]);

    useEffect(() => {
        if (!editor) return;
        let ro = null;
        const debounced = () => {
            if (measureTimer.current) clearTimeout(measureTimer.current);
            measureTimer.current = setTimeout(measure, 120);
        };
        const observe = () => {
            if (ro) ro.disconnect();
            ro = null;
            const dom = viewDom(editor);
            if (!dom) return;
            ro = new ResizeObserver(debounced);
            ro.observe(dom);
        };
        // Any doc change, not only 'update': TipTap skips 'update' for content set with
        // emitUpdate: false (a version restore, a quiet load), and those change the doc too.
        const onTransaction = ({ transaction }) => { if (transaction.docChanged) debounced(); };
        // An editor mounted (or re-mounted) after we subscribed: observe its new view.
        const onMount = () => { observe(); measure(); };
        measure();
        const raf = requestAnimationFrame(measure);
        observe();
        editor.on('transaction', onTransaction);
        editor.on('mount', onMount);
        return () => {
            cancelAnimationFrame(raf);
            if (measureTimer.current) clearTimeout(measureTimer.current);
            editor.off('transaction', onTransaction);
            editor.off('mount', onMount);
            if (ro) ro.disconnect();
        };
    }, [editor, measure]);

    // 2. Track the panel's own pixel size so we can fit the whole doc into it.
    useEffect(() => {
        const node = bodyRef.current;
        if (!node) return;
        const update = () => setPanel({ w: node.clientWidth, h: node.clientHeight });
        update();
        const ro = new ResizeObserver(update);
        ro.observe(node);
        return () => ro.disconnect();
    }, [isCollapsed]);

    // ── Layout (pixel space, fit-to-panel) ──────────────────────────────────────
    const { blocks, docHeight, colWidth, measured, lineHeightPx } = meta;
    const panelW = panel.w || 136;
    const INNER = Math.max(20, panelW - X0 - RIGHT);
    const availH = panel.h - PAD_TOP - PAD_BOTTOM;
    const { S, canFit } = miniMapScale({ measured, docHeight, availH, lineHeightPx });
    const Sx = measured && colWidth > 0 ? INNER / colWidth : 1;

    let stackY = PAD_TOP;
    const laidOut = [];
    const headingItems = [];
    for (let idx = 0; idx < blocks.length; idx++) {
        const b = blocks[idx];
        let y, h, x, w;
        if (measured && b.height != null) {
            y = PAD_TOP + b.top * S;
            h = Math.max(1.2, b.height * S);
            x = X0 + b.left * Sx;
            w = Math.max(4, b.width * Sx);
        } else {
            h = fallbackHeight(b) * (measured ? 1 : 1);
            y = stackY;
            x = X0;
            w = INNER;
            stackY += h + GAP_FALLBACK;
        }
        laidOut.push({ key: `${idx}-${b.type}`, b, x, y, w, h, label: HUMAN_LABEL[b.type] || b.type });
        if (b.type === 'heading') headingItems.push({ idx, level: b.level || 1, text: b.text || '', y, x, pos: b.pos });
    }
    // `drawnPx` is the height the document actually occupies in the map — the region
    // the viewport marker and click/drag must map against (NOT the padded container,
    // which may be taller when a capped short doc leaves empty space below).
    const drawnPx = measured && docHeight > 0 ? docHeight * S : Math.max(0, stackY - PAD_TOP);
    const contentExtent = PAD_TOP + drawnPx;
    const contentHeight = canFit ? Math.max(contentExtent + PAD_BOTTOM, 48) : Math.max(48, contentExtent + PAD_BOTTOM);

    // Heading labels: pin at true y, allow overflow, resolve collisions in two tiers
    // so H1/H2 always stay readable and only the finest levels demote to a tick.
    const placed = [];       // occupied [top, bottom] intervals
    const labels = [];       // { level, text, tickY, labelY|null, indent, pos }
    const overlaps = (top, bottom) => placed.some(([t, bt]) => top < bt && bottom > t);
    const sorted = [...headingItems].sort((a, b) => a.y - b.y);
    const tiers = [sorted.filter(h => (h.level || 1) <= 2), sorted.filter(h => (h.level || 1) >= 3)];
    for (const tier of tiers) {
        for (const hd of tier) {
            const fs = hFont(hd.level);
            const labelH = fs + 3;
            const top = hd.y - 1;
            const bottom = top + labelH;
            const wants = showHeadingText && hd.text.trim().length > 0;
            if (wants && !overlaps(top, bottom)) {
                placed.push([top, bottom]);
                labels.push({ level: hd.level, text: hd.text, tickY: hd.y, labelY: top, indent: hIndent(hd.level), pos: hd.pos });
            } else {
                labels.push({ level: hd.level, text: hd.text, tickY: hd.y, labelY: null, indent: hIndent(hd.level), pos: hd.pos });
            }
        }
    }

    // 3. Track editor scroll → viewport indicator (fraction of the whole doc).
    useEffect(() => {
        const pmEl = isCollapsed ? null : viewDom(editor);
        if (!pmEl) return;
        const scrollContainer = pmEl.closest('.overflow-y-auto') || pmEl.parentElement;
        scrollContainerRef.current = scrollContainer;
        if (!scrollContainer) return;
        const onScroll = () => {
            if (isDragging.current) return;
            const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
            setViewport(miniMapViewport({ scrollTop, scrollHeight, clientHeight, drawnPx }));
        };
        onScroll();
        const id = setTimeout(onScroll, 80);
        scrollContainer.addEventListener('scroll', onScroll);
        const ro = new ResizeObserver(onScroll);
        ro.observe(scrollContainer);
        return () => { clearTimeout(id); scrollContainer.removeEventListener('scroll', onScroll); ro.disconnect(); };
    }, [editor, isCollapsed, drawnPx]);

    // 4. Viewport drag + click nav (pixel space against the drawn document region).
    const handleBodyClick = (e) => {
        if (isDragging.current || !bodyRef.current || !scrollContainerRef.current || drawnPx <= 0) return;
        const rect = bodyRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top + bodyRef.current.scrollTop - PAD_TOP;
        const sc = scrollContainerRef.current;
        const frac = clamp(y / drawnPx, 0, 1);
        sc.scrollTop = frac * sc.scrollHeight - sc.clientHeight / 2;
    };
    const handleDragStart = (e) => {
        e.preventDefault();
        e.stopPropagation();
        isDragging.current = true;
        dragStartY.current = e.clientY;
        dragStartScrollTop.current = scrollContainerRef.current ? scrollContainerRef.current.scrollTop : 0;
        const onMove = (ev) => {
            if (!isDragging.current || !scrollContainerRef.current || drawnPx <= 0) return;
            const dy = ev.clientY - dragStartY.current;
            const sc = scrollContainerRef.current;
            sc.scrollTop = dragStartScrollTop.current + (dy / drawnPx) * sc.scrollHeight;
            const total = sc.scrollHeight || 1;
            setViewport(prev => ({ ...prev, top: PAD_TOP + (sc.scrollTop / total) * drawnPx }));
        };
        const onUp = () => {
            isDragging.current = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };
    const jumpToHeading = (pos, e) => {
        e.stopPropagation();
        if (pos == null || !hasView(editor)) return;
        let dom = null;
        try { dom = editor.view.nodeDOM(pos); } catch { /* stale position after an edit */ }
        const el = dom && dom.nodeType === 1 ? dom : (dom && dom.parentElement);
        if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    };

    const handleToggleCollapse = () => {
        const next = !isCollapsed;
        setIsCollapsed(next);
        try { localStorage.setItem('inscript-minimap-collapsed', String(next)); } catch { /* ignore */ }
    };

    if (!editor) return null;

    if (isCollapsed) {
        return (
            <div className={`flex flex-col border-l ${BORDER_CLS} ${BG_CLS} w-12 shrink-0 transition-all select-none ${className}`}>
                <button onClick={handleToggleCollapse} className="p-3 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 flex justify-center" title={t('expandMinimap', 'Expand minimap')}>
                    <MapIcon size={18} />
                </button>
            </div>
        );
    }

    return (
        <div
            className={`flex flex-col border-l ${BORDER_CLS} ${BG_CLS} w-36 shrink-0 transition-all max-h-full overflow-hidden select-none ${className}`}
            style={width ? { width } : undefined}
        >
            <div className={`flex items-center justify-between p-3 border-b ${BORDER_CLS} shrink-0`}>
                <span className={`font-semibold text-xs ${HEADER_LABEL_CLS} uppercase tracking-wider`}>{t('minimap', 'Minimap')}</span>
                <button onClick={handleToggleCollapse} className="p-1 rounded text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800" title={t('collapseMinimap', 'Collapse minimap')}>
                    <ChevronRight size={16} />
                </button>
            </div>

            <div
                ref={bodyRef}
                className={`flex-1 relative ${canFit ? 'overflow-hidden' : 'overflow-y-auto'} custom-scrollbar cursor-pointer`}
                onClick={handleBodyClick}
            >
                <div style={{ position: 'relative', height: contentHeight, width: '100%' }}>
                    {/* Blocks */}
                    {laidOut.map(({ key, b, x, y, w, h, label }) => (
                        <div key={key} title={label} style={{ position: 'absolute', left: x, top: y, width: w, height: h }} className="opacity-90">
                            {blockBody(b, w, h)}
                        </div>
                    ))}

                    {/* Heading landmarks (ticks always; labels when they fit) */}
                    {labels.map((l, i) => (
                        <React.Fragment key={`hd${i}`}>
                            <div className={TICK_CLS} style={{ position: 'absolute', left: l.indent, top: l.tickY + 1, width: 6, height: (l.level || 1) === 1 ? 2.5 : 2, borderRadius: 1 }} />
                            {(l.level || 1) === 1 && (
                                <div className={LINE_CLS} style={{ position: 'absolute', left: 0, top: l.tickY + hFont(1) + 3, width: INNER + X0 - RIGHT, height: 1, opacity: 0.7 }} />
                            )}
                            {l.labelY != null && (
                                <div
                                    onClick={(e) => jumpToHeading(l.pos, e)}
                                    title={l.text}
                                    className={`${LABEL_CLS} ${BG_CLS} hover:underline`}
                                    style={{
                                        position: 'absolute', left: l.indent + 8, top: l.labelY,
                                        maxWidth: panelW - l.indent - 8 - RIGHT,
                                        fontSize: hFont(l.level), fontWeight: hWeight(l.level), lineHeight: `${hFont(l.level) + 2}px`,
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                        padding: '0 3px', borderRadius: 2, cursor: 'pointer', zIndex: 3,
                                    }}
                                >
                                    {l.text}
                                </div>
                            )}
                        </React.Fragment>
                    ))}

                    {/* Viewport marker: translucent fill + solid themed border */}
                    {viewport.scrolls && (
                        <div
                            data-minimap-viewport
                            onMouseDown={handleDragStart}
                            className="cursor-grab active:cursor-grabbing shadow-[0_0_0_1px_rgba(255,255,255,0.65)] dark:shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
                            style={{
                                position: 'absolute', left: 2, top: viewport.top, width: panelW - 4, height: viewport.height,
                                border: `1.5px solid ${VIEWPORT_COLOR}`, borderRadius: 3, zIndex: 4,
                            }}
                        >
                            <div style={{ position: 'absolute', inset: 0, background: VIEWPORT_COLOR, opacity: 0.1, borderRadius: 2 }} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
