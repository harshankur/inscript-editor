import { Node } from '@tiptap/core';

export const Youtube = Node.create({
    name: 'youtube',
    group: 'block',
    selectable: true,
    draggable: true,
    atom: true,

    addAttributes() {
        return {
            'data-youtube-video': { default: null },
            width: {
                default: '100%',
                parseHTML: element => element.getAttribute('data-width') || '100%',
                renderHTML: () => ({}),
            },
            align: {
                default: 'center',
                parseHTML: element => element.getAttribute('data-align') || 'center',
                renderHTML: () => ({}),
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-youtube-video]',
            },
            {
                tag: 'iframe[src*="youtube.com"]',
                getAttrs: node => {
                    const src = node.getAttribute('src');
                    if (!src) return false;
                    const match = src.match(/(?:embed\/|v=)([^&?/\s]+)/);
                    return match ? { 'data-youtube-video': match[1] } : false;
                },
            },
        ];
    },

    renderHTML({ node }) {
        const id = node.attrs['data-youtube-video'];
        const w = node.attrs.width || '100%';
        const a = node.attrs.align || 'center';
        const ml = a === 'left' ? '0' : 'auto';
        const mr = a === 'right' ? '0' : 'auto';
        return [
            'div',
            {
                'data-youtube-video': id,
                'data-width': w,
                'data-align': a,
                class: 'youtube-embed relative aspect-video rounded-lg overflow-hidden my-4 bg-zinc-100 dark:bg-zinc-800',
                style: `width: ${w}; margin-left: ${ml}; margin-right: ${mr};`,
            },
            [
                'iframe',
                {
                    src: `https://www.youtube.com/embed/${id}`,
                    title: 'YouTube video player',
                    frameborder: '0',
                    allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
                    allowfullscreen: 'true',
                    class: 'absolute top-0 left-0 w-full h-full',
                },
            ],
        ];
    },

    addCommands() {
        return {
            setYoutubeVideo: options => ({ commands }) => {
                return commands.insertContent({
                    type: this.name,
                    attrs: options,
                });
            },
        };
    },
    addNodeView() {
        return ({ node }) => {
            const dom = document.createElement('div');
            const iframe = document.createElement('iframe');
            iframe.title = 'YouTube video player';
            iframe.setAttribute('frameborder', '0');
            iframe.setAttribute('allowfullscreen', 'true');
            iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
            iframe.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%;';
            dom.appendChild(iframe);
            // Transparent overlay so ProseMirror sees clicks and creates a NodeSelection.
            // Without this, clicks go straight to the cross-origin iframe and TipTap never selects the node.
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position: absolute; inset: 0; z-index: 10;';
            dom.appendChild(overlay);

            const applyAttrs = (attrs) => {
                const id = attrs['data-youtube-video'];
                const w = attrs.width || '100%';
                const a = attrs.align || 'center';
                dom.setAttribute('data-youtube-video', id || '');
                dom.setAttribute('data-width', w);
                dom.setAttribute('data-align', a);
                dom.className = 'youtube-embed relative aspect-video rounded-lg overflow-hidden my-4 bg-zinc-100 dark:bg-zinc-800';
                dom.style.cssText = `width: ${w}; margin-left: ${a === 'left' ? '0' : 'auto'}; margin-right: ${a === 'right' ? '0' : 'auto'};`;
                if (id) iframe.src = `https://www.youtube.com/embed/${id}`;
            };
            applyAttrs(node.attrs);

            return {
                dom,
                update(newNode) {
                    if (newNode.type.name !== 'youtube') return false;
                    applyAttrs(newNode.attrs);
                    return true;
                },
            };
        };
    },
});
