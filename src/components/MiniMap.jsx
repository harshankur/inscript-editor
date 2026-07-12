import React, { useEffect, useState, useRef } from 'react';
import { ChevronRight, Map as MapIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const MiniMap = ({ editor }) => {
    const { t } = useTranslation('inscript-editor');
    const [blocks, setBlocks] = useState([]);
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const stored = localStorage.getItem('inscript-minimap-collapsed');
        return stored === 'true';
    });

    const [viewport, setViewport] = useState({ y: 0, height: 40 });
    const scrollContainerRef = useRef(null);
    const svgRef = useRef(null);
    const isDragging = useRef(false);
    const dragStartY = useRef(0);
    const dragStartScrollTop = useRef(0);

    // 1. Walk document nodes to extract blocks
    const updateBlocks = () => {
        if (!editor || !editor.state) return;
        const list = [];
        editor.state.doc.forEach((node, offset) => {
            list.push({
                type: node.type.name,
                pos: offset,
                size: node.nodeSize,
                level: node.type.name === 'heading' ? node.attrs.level : null
            });
        });
        setBlocks(list);
    };

    useEffect(() => {
        if (!editor) return;

        editor.on('update', updateBlocks);
        updateBlocks();

        return () => {
            editor.off('update', updateBlocks);
        };
    }, [editor]);

    // 2. Track editor scroll to position the viewport indicator
    useEffect(() => {
        if (!editor || isCollapsed) return;

        // Find the scroll container (parent of .ProseMirror)
        const proseMirrorEl = editor.view.dom;
        const scrollContainer = proseMirrorEl.closest('.overflow-y-auto') || proseMirrorEl.parentElement;
        scrollContainerRef.current = scrollContainer;

        const handleScroll = () => {
            if (isDragging.current || !scrollContainer) return;
            const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
            const totalHeight = scrollHeight || 1;
            const ratio = scrollTop / totalHeight;
            const heightRatio = clientHeight / totalHeight;

            // Map to SVG coordinates
            const svgEl = svgRef.current;
            if (svgEl) {
                const svgHeight = svgEl.getBoundingClientRect().height || 200;
                setViewport({
                    y: ratio * svgHeight,
                    height: Math.max(15, heightRatio * svgHeight)
                });
            }
        };

        scrollContainer.addEventListener('scroll', handleScroll);
        // Initial sync
        setTimeout(handleScroll, 100);

        // ResizeObserver to handle window / panel resizing
        const observer = new ResizeObserver(handleScroll);
        observer.observe(scrollContainer);

        return () => {
            scrollContainer.removeEventListener('scroll', handleScroll);
            observer.disconnect();
        };
    }, [editor, blocks, isCollapsed]);

    // 3. Layout blocks into absolute coordinates
    let currentY = 8;
    const renderingBlocks = blocks.map((block) => {
        let height = 3;
        let color = '#e4e4e7'; // default light grey
        let width = '90%';

        switch (block.type) {
            case 'heading':
                height = block.level === 1 ? 6 : (block.level === 2 ? 4 : 3);
                color = '#10b981'; // emerald-500
                width = block.level === 1 ? '70%' : (block.level === 2 ? '60%' : '50%');
                break;
            case 'codeBlock':
                height = 8;
                color = '#71717a'; // zinc-500
                width = '85%';
                break;
            case 'image':
            case 'customImage':
            case 'youtube':
                height = 10;
                color = '#60a5fa'; // blue-400
                width = '55%';
                break;
            case 'table':
            case 'customTable':
                height = 9;
                color = '#a78bfa'; // purple-400
                width = '80%';
                break;
            case 'admonition':
                height = 9;
                color = '#f59e0b'; // amber-500
                width = '88%';
                break;
            case 'blockquote':
                height = 6;
                color = '#d4d4d8'; // zinc-300
                width = '80%';
                break;
        }

        const item = {
            y: currentY,
            height,
            color,
            width,
            pos: block.pos,
            type: block.type
        };
        currentY += height + 3; // height + gap
        return item;
    });

    const totalSvgHeight = Math.max(200, currentY + 10);

    // 4. Viewport dragging and navigation
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

        // Calculate scroll delta based on SVG dragging delta
        const scrollDelta = (deltaY / svgHeight) * scrollContainer.scrollHeight;
        scrollContainer.scrollTop = dragStartScrollTop.current + scrollDelta;

        // Update local viewport state directly for instant feedback
        const ratio = scrollContainer.scrollTop / scrollContainer.scrollHeight;
        const heightRatio = scrollContainer.clientHeight / scrollContainer.scrollHeight;
        setViewport(prev => ({
            ...prev,
            y: ratio * svgHeight
        }));
    };

    const handleDragEnd = () => {
        isDragging.current = false;
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', handleDragEnd);
    };

    const handleSvgClick = (e) => {
        if (isDragging.current || !svgRef.current || !scrollContainerRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        const ratio = clickY / rect.height;

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
            <div className="flex flex-col border-l border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 w-12 shrink-0 transition-all select-none">
                <button
                    onClick={handleToggleCollapse}
                    className="p-3 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 flex justify-center"
                    title={t('expandMinimap', 'Expand minimap')}
                >
                    <MapIcon size={18} />
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col border-l border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 w-36 shrink-0 transition-all max-h-full overflow-hidden select-none">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
                <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">{t('minimap', 'Minimap')}</span>
                <button
                    onClick={handleToggleCollapse}
                    className="p-1 rounded text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    title={t('collapseMinimap', 'Collapse minimap')}
                >
                    <ChevronRight size={16} />
                </button>
            </div>

            {/* Interactive SVG Minimap container */}
            <div className="flex-1 overflow-y-auto p-2 relative custom-scrollbar">
                <svg
                    ref={svgRef}
                    width="100%"
                    height={totalSvgHeight}
                    onClick={handleSvgClick}
                    className="cursor-pointer overflow-visible"
                >
                    {/* Rendered block shapes */}
                    {renderingBlocks.map((block, idx) => (
                        <rect
                            key={`${block.pos}-${idx}`}
                            x="5%"
                            y={block.y}
                            width={block.width}
                            height={block.height}
                            fill={block.color}
                            rx="1"
                            className="opacity-75 hover:opacity-100 transition-opacity"
                        />
                    ))}

                    {/* Viewport overlay rectangle */}
                    <rect
                        y={viewport.y}
                        height={viewport.height}
                        width="96%"
                        x="2%"
                        fill="rgba(16, 185, 129, 0.08)"
                        stroke="#10b981"
                        strokeWidth="1.5"
                        rx="2"
                        className="cursor-grab active:cursor-grabbing"
                        onMouseDown={handleDragStart}
                    />
                </svg>
            </div>
        </div>
    );
};
