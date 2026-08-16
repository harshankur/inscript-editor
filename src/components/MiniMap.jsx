import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ChevronRight, Map as MapIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// ── Geometry ──────────────────────────────────────────────────────────────────
// The minimap is a scaled projection of the ACTUAL rendered document: every
// block's vertical position + height comes from its real DOM rect, so heights
// (and paragraph line-density) are proportional to the real content. Widths use
// each block's real width/offset, so narrow/centred content shows narrow/centred.
const VW = 120;              // logical viewBox width
const X0 = 8;                // left inset
const INNER = VW - X0 * 2;   // usable width
const PAD_TOP = 6;
const LINE_PITCH = 2.3;      // minimap px per real text line (density); also the vertical scale seed
const GAP_FALLBACK = 3;      // gap when we can't measure the DOM (jsdom / not laid out yet)

// ── Theming ───────────────────────────────────────────────────────────────────
// The minimap chrome and neutral document marks read CSS custom properties with
// fallbacks equal to the current zinc/emerald defaults, so a themed host can
// restyle it by setting the vars — no CSS-override hacks:
//   --im-minimap-bg        panel background
//   --im-minimap-border    panel + header border
//   --im-minimap-label     header label text
//   --im-minimap-line      neutral text-line rects / list markers
//   --im-minimap-viewport  draggable viewport marker (stroke + translucent fill)
// Content-semantic glyph colors (YouTube red, image sky, code emerald, …) are
// intentionally NOT themed — they identify content types, not the host theme.
const LINE_CLS = 'fill-[var(--im-minimap-line,#d4d4d8)] dark:fill-[var(--im-minimap-line,#52525b)]';
const MARK_CLS = 'fill-[var(--im-minimap-line,#a1a1aa)] dark:fill-[var(--im-minimap-line,#71717a)]';
const MARK_STROKE_CLS = 'fill-none stroke-[var(--im-minimap-line,#a1a1aa)] dark:stroke-[var(--im-minimap-line,#71717a)]';
const TERM_CLS = 'fill-[var(--im-minimap-line,#71717a)] dark:fill-[var(--im-minimap-line,#a1a1aa)]';
const BG_CLS = 'bg-[var(--im-minimap-bg,#fafafa)] dark:bg-[var(--im-minimap-bg,#18181b)]';
const BORDER_CLS = 'border-[var(--im-minimap-border,#e4e4e7)] dark:border-[var(--im-minimap-border,#27272a)]';
const LABEL_CLS = 'text-[var(--im-minimap-label,#18181b)] dark:text-[var(--im-minimap-label,#f4f4f5)]';
const VIEWPORT_COLOR = 'var(--im-minimap-viewport, #10b981)';

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

// Measure top-level blocks against the real ProseMirror DOM. Direct children of
// .ProseMirror map 1:1 (in order) to top-level doc nodes.
function measureBlocks(editor) {
    const pmDom = editor.view.dom;
    const children = pmDom.children;
    const rows = [];
    let i = 0;
    editor.state.doc.forEach((node) => {
        rows.push({ node, dom: children[i] });
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

    const blocks = rows.map(({ node, rect }) => {
        const type = node.type.name;
        const b = { type, level: node.attrs?.level };
        if (measured && rect && rect.width > 0) {
            b.top = rect.top - docTop;
            b.height = rect.height;
            b.left = rect.left - colLeft;
            b.width = rect.width;
            b.lines = Math.max(1, Math.round(rect.height / lineHeightPx));
        }
        if (type === 'paragraph' || type === 'heading') b.textLen = node.textContent.length;
        if (type === 'bulletList' || type === 'orderedList' || type === 'taskList') b.itemCount = node.childCount;
        if (type === 'table' || type === 'customTable') { b.rows = node.childCount; b.cols = node.firstChild ? node.firstChild.childCount : 0; }
        if (type === 'codeBlock') b.codeLines = (node.textContent.match(/\n/g) || []).length + 1;
        if (type === 'definitionList') b.itemCount = node.childCount;
        return b;
    });

    return { blocks, docHeight, colWidth, measured, lineHeightPx };
}

// A stack of thin lines filling [0,h], density = n (last line short).
function fillLines(w, h, n, cls, key, lastFrac = 0.55, indent = 0) {
    n = clamp(Math.round(n), 1, 400);
    const pitch = h / n;
    const th = clamp(pitch * 0.55, 0.8, 1.8);
    const els = [];
    for (let i = 0; i < n; i++) {
        const last = i === n - 1;
        const y = i * pitch + (pitch - th) / 2;
        els.push(<rect key={`${key}${i}`} x={indent} y={y} width={(last ? w * lastFrac : w) - indent} height={th} rx={th / 2} className={cls} />);
    }
    return els;
}

// Build the glyph for a block, filling its (already-scaled) w×h box.
function buildGlyph(b, w, h) {
    switch (b.type) {
        case 'heading':
            return [
                <rect key="m" x={0} y={0} width={clamp(h, 2, 4)} height={clamp(h, 2, 4)} rx={0.8} className="fill-emerald-500" />,
                ...fillLines(w, h, b.lines || 1, 'fill-emerald-500', 'h', 0.9, clamp(h, 2, 4) + 2),
            ];
        case 'paragraph':
            return fillLines(w, h, b.lines || 2, LINE_CLS, 'p');
        case 'bulletList':
        case 'orderedList':
        case 'taskList': {
            const n = clamp(b.itemCount || Math.max(1, Math.round(h / LINE_PITCH)), 1, 40);
            const pitch = h / n;
            const els = [];
            for (let i = 0; i < n; i++) {
                const y = i * pitch;
                if (b.type === 'taskList') els.push(<rect key={`c${i}`} x={0} y={y} width={2} height={2} rx={0.4} className={MARK_STROKE_CLS} strokeWidth={0.5} />);
                else if (b.type === 'orderedList') els.push(<rect key={`c${i}`} x={0} y={y} width={2} height={1.6} rx={0.4} className={MARK_CLS} />);
                else els.push(<circle key={`c${i}`} cx={1} cy={y + 0.9} r={1} className={MARK_CLS} />);
                els.push(<rect key={`l${i}`} x={4.5} y={y + 0.2} width={(w - 4.5) * (1 - (i % 2) * 0.22)} height={clamp(pitch * 0.5, 0.8, 1.5)} rx={0.6} className={LINE_CLS} />);
            }
            return els;
        }
        case 'image':
        case 'customImage':
            return [
                <rect key="bg" x={0} y={0} width={w} height={h} rx={1.5} className="fill-sky-200 dark:fill-sky-900 stroke-sky-400 dark:stroke-sky-700" strokeWidth={0.5} />,
                <circle key="sun" cx={w * 0.74} cy={h * 0.28} r={clamp(Math.min(w, h) * 0.12, 1, 2.4)} className="fill-amber-300" />,
                <path key="mtn" d={`M ${w * 0.06} ${h - 1.5} L ${w * 0.38} ${h * 0.42} L ${w * 0.58} ${h * 0.66} L ${w * 0.78} ${h * 0.34} L ${w * 0.95} ${h - 1.5} Z`} className="fill-sky-400 dark:fill-sky-600" />,
            ];
        case 'youtube': {
            const cx = w / 2, cy = h / 2, s = clamp(Math.min(w, h) * 0.22, 2, 5);
            return [
                <rect key="bg" x={0} y={0} width={w} height={h} rx={1.5} className="fill-red-500" />,
                <path key="p" d={`M ${cx - s * 0.5} ${cy - s * 0.7} L ${cx + s * 0.8} ${cy} L ${cx - s * 0.5} ${cy + s * 0.7} Z`} className="fill-white" />,
            ];
        }
        case 'table':
        case 'customTable': {
            const rows = clamp(b.rows || 2, 1, 12), cols = clamp(b.cols || 2, 1, 8);
            const els = [
                <rect key="bg" x={0} y={0} width={w} height={h} rx={1} className="fill-violet-100 dark:fill-violet-950 stroke-violet-400 dark:stroke-violet-600" strokeWidth={0.5} />,
                <rect key="hdr" x={0} y={0} width={w} height={h / rows} className="fill-violet-300/60 dark:fill-violet-800/60" />,
            ];
            for (let r = 1; r < rows; r++) els.push(<line key={`r${r}`} x1={0} y1={(h / rows) * r} x2={w} y2={(h / rows) * r} className="stroke-violet-300 dark:stroke-violet-700" strokeWidth={0.4} />);
            for (let c = 1; c < cols; c++) els.push(<line key={`c${c}`} x1={(w / cols) * c} y1={0} x2={(w / cols) * c} y2={h} className="stroke-violet-300 dark:stroke-violet-700" strokeWidth={0.4} />);
            return els;
        }
        case 'codeBlock': {
            const n = clamp(b.codeLines || Math.max(2, Math.round(h / LINE_PITCH)), 1, 200);
            const pitch = h / (n + 0.6);
            const th = clamp(pitch * 0.5, 0.7, 1.4);
            const els = [<rect key="bg" x={0} y={0} width={w} height={h} rx={1.5} className="fill-zinc-800 dark:fill-zinc-900" />];
            const wd = [0.55, 0.82, 0.4, 0.68, 0.5, 0.72, 0.6];
            for (let i = 0; i < n; i++) {
                const ind = (i % 3 === 1 ? 6 : 3);
                els.push(<rect key={i} x={ind} y={pitch * (i + 0.5)} width={(w - ind - 3) * wd[i % wd.length]} height={th} rx={th / 2} className="fill-emerald-400/80" />);
            }
            return els;
        }
        case 'blockquote':
            return [
                <rect key="bar" x={0} y={0} width={1.6} height={h} rx={0.8} className="fill-emerald-400 dark:fill-emerald-600" />,
                ...fillLines(w, h, b.lines || 2, LINE_CLS, 'q', 0.7, 4.5),
            ];
        case 'admonition':
            return [
                <rect key="bg" x={0} y={0} width={w} height={h} rx={1.5} className="fill-amber-100 dark:fill-amber-950" />,
                <rect key="bar" x={0} y={0} width={2} height={h} rx={1} className="fill-amber-500" />,
                <circle key="dot" cx={5.5} cy={clamp(h * 0.28, 2, h / 2)} r={1.3} className="fill-amber-500" />,
                ...fillLines(w, h, clamp(b.lines || 2, 1, 6), 'fill-amber-400/60', 'a', 0.7, 9),
            ];
        case 'mathBlock': {
            const cx = w / 2, cy = h / 2;
            return [
                <rect key="bg" x={0} y={0} width={w} height={h} rx={1.5} className="fill-indigo-100 dark:fill-indigo-950" />,
                <rect key="num" x={cx - 8} y={cy - 2.6} width={16} height={1.2} rx={0.6} className="fill-indigo-500" />,
                <rect key="bar" x={cx - 11} y={cy - 0.4} width={22} height={0.8} className="fill-indigo-500" />,
                <rect key="den" x={cx - 6} y={cy + 1.4} width={12} height={1.2} rx={0.6} className="fill-indigo-500" />,
            ];
        }
        case 'mermaid': {
            const my = h / 2;
            return [
                <rect key="bg" x={0} y={0} width={w} height={h} rx={1.5} className="fill-teal-100 dark:fill-teal-950" />,
                <line key="ln1" x1={w * 0.14} y1={my} x2={w * 0.52} y2={h * 0.3} className="stroke-teal-500" strokeWidth={0.7} />,
                <line key="ln2" x1={w * 0.14} y1={my} x2={w * 0.52} y2={h * 0.7} className="stroke-teal-500" strokeWidth={0.7} />,
                <circle key="n1" cx={w * 0.12} cy={my} r={clamp(h * 0.2, 1.6, 2.6)} className="fill-teal-500" />,
                <circle key="n2" cx={w * 0.56} cy={h * 0.3} r={clamp(h * 0.18, 1.4, 2.4)} className="fill-teal-400" />,
                <circle key="n3" cx={w * 0.56} cy={h * 0.7} r={clamp(h * 0.18, 1.4, 2.4)} className="fill-teal-400" />,
            ];
        }
        case 'horizontalRule':
            return [<rect key="hr" x={0} y={h / 2 - 0.5} width={w} height={1} rx={0.5} className={LINE_CLS} />];
        case 'definitionList': {
            const n = clamp(b.itemCount || 2, 1, 20);
            const pitch = h / n;
            const els = [];
            for (let i = 0; i < n; i++) {
                els.push(<rect key={`t${i}`} x={0} y={pitch * i + pitch * 0.1} width={w * 0.4} height={clamp(pitch * 0.25, 0.9, 1.6)} rx={0.7} className={TERM_CLS} />);
                els.push(<rect key={`d${i}`} x={5} y={pitch * i + pitch * 0.5} width={w * 0.7} height={clamp(pitch * 0.2, 0.8, 1.3)} rx={0.6} className={LINE_CLS} />);
            }
            return els;
        }
        default:
            return fillLines(w, h, b.lines || 1, LINE_CLS, 'd', 0.9);
    }
}

// Fallback heights (jsdom / not-yet-laid-out): keep the minimap sensible before
// real geometry is available.
function fallbackHeight(b) {
    switch (b.type) {
        case 'heading': return b.level === 1 ? 8 : b.level === 2 ? 6.5 : 5.5;
        case 'paragraph': return clamp(Math.round((b.textLen || 40) / 42) + 1, 1, 6) * 3;
        case 'bulletList': case 'orderedList': case 'taskList': return clamp(b.itemCount || 2, 1, 7) * 3.2;
        case 'image': case 'customImage': case 'youtube': return 13;
        case 'table': case 'customTable': return clamp(b.rows || 2, 1, 4) * 3;
        case 'codeBlock': return clamp(b.codeLines || 3, 2, 6) * 2.4 + 3;
        case 'blockquote': return 7;
        case 'admonition': return 9;
        case 'mathBlock': return 9;
        case 'mermaid': return 12;
        case 'horizontalRule': return 2;
        case 'definitionList': return clamp(b.itemCount || 2, 1, 5) * 5;
        default: return 3;
    }
}

/**
 * MiniMap — proportional thumbnail of the document with a draggable viewport.
 *
 * @param {object} props
 * @param {import('@tiptap/core').Editor|null} props.editor
 * @param {string} [props.width]     - CSS width for the expanded panel (defaults to 9rem).
 *                                     Applied as an inline style, so it wins over the default class.
 * @param {string} [props.className] - Extra classes appended to the root (both states),
 *                                     e.g. to drop the built-in border with `border-l-0`.
 */
export const MiniMap = ({ editor, width, className = '' }) => {
    const { t } = useTranslation('inscript-editor');
    const [meta, setMeta] = useState({ blocks: [], docHeight: 0, colWidth: 0, measured: false, lineHeightPx: 28 });
    const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('inscript-minimap-collapsed') === 'true');

    // When the whole document fits in the scroll container there is nothing to
    // navigate — the viewport marker is hidden instead of covering everything.
    const [docFits, setDocFits] = useState(false);
    const [viewport, setViewport] = useState({ y: 0, height: 40 });
    const scrollContainerRef = useRef(null);
    const svgRef = useRef(null);
    const isDragging = useRef(false);
    const dragStartY = useRef(0);
    const dragStartScrollTop = useRef(0);

    // 1. Measure the real document geometry (re-measured on edits and reflow).
    const measure = useCallback(() => {
        if (!editor || !editor.state || !editor.view) return;
        setMeta(measureBlocks(editor));
    }, [editor]);

    useEffect(() => {
        if (!editor) return;
        measure();                                   // populate immediately (blocks/types)
        const raf = requestAnimationFrame(measure);  // re-measure once laid out (real geometry)
        editor.on('update', measure);
        const ro = new ResizeObserver(measure);
        ro.observe(editor.view.dom);
        return () => { cancelAnimationFrame(raf); editor.off('update', measure); ro.disconnect(); };
    }, [editor, measure]);

    // 2. Lay out blocks. When measured, use a single vertical scale (proportional
    //    heights + constant line pitch) and per-block width/offset. Otherwise fall
    //    back to type-based sizes stacked with a gap.
    const { blocks, docHeight, colWidth, measured, lineHeightPx } = meta;
    const Sy = measured && lineHeightPx > 0 ? LINE_PITCH / lineHeightPx : 0;
    const Sx = measured && colWidth > 0 ? INNER / colWidth : 1;

    let stackY = PAD_TOP;
    const laidOut = blocks.map((b, idx) => {
        let y, h, x, w;
        if (measured && b.height != null) {
            y = PAD_TOP + b.top * Sy;
            h = Math.max(1.2, b.height * Sy);
            x = X0 + b.left * Sx;
            w = Math.max(3, b.width * Sx);
        } else {
            h = fallbackHeight(b);
            y = stackY;
            x = X0;
            w = INNER;
            stackY += h + GAP_FALLBACK;
        }
        return { key: `${idx}-${b.type}`, y, x, glyph: buildGlyph(b, w, h), label: HUMAN_LABEL[b.type] || b.type };
    });
    // No artificial minimum: a short document yields a short thumbnail instead of
    // a small band floating above a large empty area.
    const contentBottom = measured && docHeight > 0 ? PAD_TOP + docHeight * Sy : stackY;
    const totalSvgHeight = Math.max(48, contentBottom + 8);

    // 3. Track editor scroll → viewport indicator.
    useEffect(() => {
        if (!editor || isCollapsed) return;
        const proseMirrorEl = editor.view.dom;
        const scrollContainer = proseMirrorEl.closest('.overflow-y-auto') || proseMirrorEl.parentElement;
        scrollContainerRef.current = scrollContainer;
        const handleScroll = () => {
            if (isDragging.current || !scrollContainer) return;
            const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
            const total = scrollHeight || 1;
            setDocFits(scrollHeight <= clientHeight + 2);
            const svgEl = svgRef.current;
            if (svgEl) {
                const svgHeight = svgEl.getBoundingClientRect().height || 200;
                setViewport({ y: (scrollTop / total) * svgHeight, height: Math.max(15, (clientHeight / total) * svgHeight) });
            }
        };
        scrollContainer.addEventListener('scroll', handleScroll);
        setTimeout(handleScroll, 100);
        const observer = new ResizeObserver(handleScroll);
        observer.observe(scrollContainer);
        return () => { scrollContainer.removeEventListener('scroll', handleScroll); observer.disconnect(); };
    }, [editor, meta, isCollapsed]);

    // 4. Viewport drag + click nav (pixel-space, viewBox-independent).
    const handleDragStart = (e) => {
        e.preventDefault();
        isDragging.current = true;
        dragStartY.current = e.clientY;
        dragStartScrollTop.current = scrollContainerRef.current ? scrollContainerRef.current.scrollTop : 0;
        document.addEventListener('mousemove', handleDrag);
        document.addEventListener('mouseup', handleDragEnd);
    };
    const handleDrag = (e) => {
        if (!isDragging.current || !scrollContainerRef.current || !svgRef.current) return;
        const deltaY = e.clientY - dragStartY.current;
        const scrollContainer = scrollContainerRef.current;
        const svgHeight = svgRef.current.getBoundingClientRect().height || 200;
        scrollContainer.scrollTop = dragStartScrollTop.current + (deltaY / svgHeight) * scrollContainer.scrollHeight;
        const ratio = scrollContainer.scrollTop / scrollContainer.scrollHeight;
        setViewport(prev => ({ ...prev, y: ratio * svgHeight }));
    };
    const handleDragEnd = () => {
        isDragging.current = false;
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', handleDragEnd);
    };
    const handleSvgClick = (e) => {
        if (isDragging.current || !svgRef.current || !scrollContainerRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const ratio = (e.clientY - rect.top) / rect.height;
        const scrollContainer = scrollContainerRef.current;
        scrollContainer.scrollTop = ratio * scrollContainer.scrollHeight - scrollContainer.clientHeight / 2;
    };
    const handleToggleCollapse = () => {
        const next = !isCollapsed;
        setIsCollapsed(next);
        localStorage.setItem('inscript-minimap-collapsed', String(next));
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
                <span className={`font-semibold text-xs ${LABEL_CLS} uppercase tracking-wider`}>{t('minimap', 'Minimap')}</span>
                <button onClick={handleToggleCollapse} className="p-1 rounded text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800" title={t('collapseMinimap', 'Collapse minimap')}>
                    <ChevronRight size={16} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 relative custom-scrollbar">
                <svg
                    ref={svgRef}
                    width="100%"
                    height={totalSvgHeight}
                    viewBox={`0 0 ${VW} ${totalSvgHeight}`}
                    preserveAspectRatio="xMidYMin meet"
                    onClick={handleSvgClick}
                    className="cursor-pointer overflow-visible"
                >
                    {laidOut.map(({ y, x, glyph, label, key }) => (
                        <g key={key} transform={`translate(${x}, ${y})`} className="opacity-80 hover:opacity-100 transition-opacity">
                            <title>{label}</title>
                            {glyph}
                        </g>
                    ))}

                    {!docFits && (
                        <rect
                            y={viewport.y}
                            height={viewport.height}
                            width={VW - 4}
                            x={2}
                            fill={VIEWPORT_COLOR}
                            fillOpacity="0.08"
                            stroke={VIEWPORT_COLOR}
                            strokeWidth="1.5"
                            rx="2"
                            className="cursor-grab active:cursor-grabbing"
                            onMouseDown={handleDragStart}
                        />
                    )}
                </svg>
            </div>
        </div>
    );
};
