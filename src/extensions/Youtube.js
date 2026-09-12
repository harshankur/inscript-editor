import { Node } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import i18next from 'i18next';
import { extractYoutubeId } from '../utils/youtubeUrl.js';

const VALID_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

// Static English fallback: this text is serialized into the stored document
// HTML (editor.getHTML()), which is rendered as-is on the public site outside
// any i18next context, so it can't be localized per-viewer.
const PLACEHOLDER_TEXT = 'Video unavailable';

const YOUTUBE_ICON_PATHS = [
    'M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17',
    'm10 15 5-3-5-3z',
];

// DOMOutputSpec (used for editor.getHTML() serialization) can't safely embed
// an <svg> via createElement — ProseMirror's serializer doesn't use the SVG
// namespace, so it renders as an inert unknown element. Keep the persisted
// placeholder to plain markup; the node view below builds a real SVG via
// createElementNS for the on-screen editing experience.
function buildPlaceholderSpec(text = PLACEHOLDER_TEXT) {
    return [
        'div',
        { class: 'absolute inset-0 flex flex-col items-center justify-center gap-2 text-[var(--inscript-color-muted)]' },
        ['span', { class: 'text-xs' }, text],
    ];
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function buildPlaceholderIcon() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', '32');
    svg.setAttribute('height', '32');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    YOUTUBE_ICON_PATHS.forEach(d => {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', d);
        svg.appendChild(path);
    });
    return svg;
}

function buildPlaceholderDom() {
    const wrapper = document.createElement('div');
    wrapper.className = 'absolute inset-0 flex flex-col items-center justify-center gap-2 text-[var(--inscript-color-muted)]';
    wrapper.appendChild(buildPlaceholderIcon());
    const label = document.createElement('span');
    label.className = 'text-xs';
    label.textContent = i18next.t('youtubeVideoUnavailable', { ns: 'inscript-editor', defaultValue: PLACEHOLDER_TEXT });
    wrapper.appendChild(label);
    return wrapper;
}

export const Youtube = Node.create({
    name: 'youtube',
    group: 'block',
    selectable: true,
    draggable: true,
    atom: true,

    addOptions() {
        return {
            // When true, render a lite-youtube-style thumbnail facade that loads the
            // real iframe only on click (privacy + load perf). Default is today's
            // behavior (immediate iframe), so no consumer regresses.
            facade: false,
        };
    },

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
            // Caption/label (::youtube[Label]{…}), round-tripped as data-embed-label —
            // handled manually in renderHTML/nodeView below. Waits on officeParser 10.B
            // to actually emit it on the youtube div; harmless (defaults null) until then.
            label: {
                default: null,
                parseHTML: element => element.getAttribute('data-embed-label') || null,
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
                // Any standard YouTube embed (youtube.com, youtube-nocookie.com,
                // youtu.be — embed/, watch?v=, shorts/, …). extractYoutubeId knows
                // every URL shape and validates the 11-char id. Higher priority than
                // the generic Embed node (40) so YouTube iframes are claimed here;
                // non-YouTube iframes fall through (getAttrs false) to Embed.
                tag: 'iframe[src]',
                priority: 60,
                getAttrs: node => {
                    const id = extractYoutubeId(node.getAttribute('src'));
                    return id ? { 'data-youtube-video': id } : false;
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
        const wrapperAttrs = {
            // Keep the attribute present (even empty) so a placeholder div still
            // matches the `div[data-youtube-video]` parseHTML selector and round-trips.
            'data-youtube-video': id || '',
            'data-width': w,
            'data-align': a,
            class: 'youtube-embed relative aspect-video rounded-lg overflow-hidden my-4',
            style: `width: ${w}; margin-left: ${ml}; margin-right: ${mr};`,
        };
        if (node.attrs.label) wrapperAttrs['data-embed-label'] = node.attrs.label;

        // No id: never request /embed/null. Preserve attrs so the node round-trips
        // via parseHTML, but omit the iframe entirely.
        if (!id) {
            return ['div', wrapperAttrs, buildPlaceholderSpec()];
        }

        return [
            'div',
            wrapperAttrs,
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
                if (!VALID_ID_PATTERN.test(options?.['data-youtube-video'] || '')) return false;
                return commands.insertContent({
                    type: this.name,
                    attrs: options,
                });
            },
        };
    },
    addNodeView() {
        const facadeEnabled = this.options.facade;
        return ({ node }) => {
            // <figure> wrapper so an optional caption sits below the video; the video
            // div (videoDom) keeps all the aspect/overlay/facade behavior.
            const dom = document.createElement('figure');
            dom.className = 'youtube-figure my-4';
            const videoDom = document.createElement('div');
            dom.appendChild(videoDom);
            const captionEl = document.createElement('figcaption');
            captionEl.className = 'mt-1.5 text-center text-xs text-[var(--inscript-color-muted)]';
            let hasCaption = false;

            const iframe = document.createElement('iframe');
            iframe.title = 'YouTube video player';
            iframe.setAttribute('frameborder', '0');
            iframe.setAttribute('allowfullscreen', 'true');
            iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
            iframe.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%;';

            const placeholder = buildPlaceholderDom();

            // Transparent overlay so ProseMirror sees clicks and creates a NodeSelection.
            // Without this, clicks go straight to the cross-origin iframe and TipTap never selects the node.
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position: absolute; inset: 0; z-index: 10;';

            // Facade (opt-in): a thumbnail + play button that loads the iframe only on
            // click. Building it lazily keeps default (non-facade) mode untouched.
            let facadeEl = null;
            let facadeLoaded = false; // user has clicked play → show the iframe
            const buildFacade = (id) => {
                const wrap = document.createElement('button');
                wrap.type = 'button';
                wrap.setAttribute('aria-label', 'Load YouTube video');
                wrap.className = 'absolute inset-0 w-full h-full block cursor-pointer group border-0 p-0';
                // Thumbnail is the ONLY network request until the user consents to the iframe.
                wrap.style.cssText = `border:0;padding:0;background:#000 center/cover no-repeat url("https://i.ytimg.com/vi/${id}/hqdefault.jpg");`;
                const btn = document.createElement('span');
                btn.className = 'absolute inset-0 flex items-center justify-center';
                btn.innerHTML = '<span style="width:48px;height:34px;background:rgba(0,0,0,.75);border-radius:8px;display:flex;align-items:center;justify-content:center;transition:background .15s"><span style="border-style:solid;border-width:8px 0 8px 14px;border-color:transparent transparent transparent #fff;margin-left:3px"></span></span>';
                wrap.appendChild(btn);
                wrap.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    facadeLoaded = true;
                    render(node.attrs);
                });
                return wrap;
            };

            let state = null; // 'placeholder' | 'facade' | 'iframe' — only re-touch DOM on change

            const render = (attrs) => {
                const id = attrs['data-youtube-video'];
                const w = attrs.width || '100%';
                const a = attrs.align || 'center';
                // Alignment/width live on the figure so the caption tracks the video.
                dom.style.cssText = `width: ${w}; margin-left: ${a === 'left' ? '0' : 'auto'}; margin-right: ${a === 'right' ? '0' : 'auto'};`;
                videoDom.setAttribute('data-youtube-video', id || '');
                videoDom.setAttribute('data-width', w);
                videoDom.setAttribute('data-align', a);
                videoDom.className = 'youtube-embed relative aspect-video rounded-lg overflow-hidden';

                const next = !id ? 'placeholder' : (facadeEnabled && !facadeLoaded) ? 'facade' : 'iframe';
                if (next === 'iframe' && id) iframe.src = `https://www.youtube.com/embed/${id}`;
                else iframe.removeAttribute('src');

                if (state !== next) {
                    state = next;
                    videoDom.innerHTML = '';
                    if (next === 'placeholder') videoDom.appendChild(placeholder);
                    else if (next === 'facade') { facadeEl = buildFacade(id); videoDom.appendChild(facadeEl); }
                    else videoDom.appendChild(iframe);
                    videoDom.appendChild(overlay);
                }

                // Optional caption from the label attribute.
                if (attrs.label) {
                    captionEl.textContent = attrs.label;
                    if (!hasCaption) { dom.appendChild(captionEl); hasCaption = true; }
                } else if (hasCaption) {
                    dom.removeChild(captionEl);
                    hasCaption = false;
                }
            };
            render(node.attrs);

            return {
                dom,
                update(newNode) {
                    if (newNode.type.name !== 'youtube') return false;
                    render(newNode.attrs);
                    return true;
                },
                // Once the node is selected (bubble menu open), let clicks fall through
                // to the iframe so a second click plays the video instead of re-showing the menu.
                selectNode() {
                    overlay.style.pointerEvents = 'none';
                },
                deselectNode() {
                    overlay.style.pointerEvents = '';
                },
            };
        };
    },

    // E.3 — paste a bare YouTube URL (its own token) → a Youtube node. handlePaste
    // runs before Link's linkOnPaste, so it wins and the URL doesn't become a link.
    addProseMirrorPlugins() {
        const editor = this.editor;
        return [
            new Plugin({
                props: {
                    handlePaste: (view, event) => {
                        const text = event.clipboardData?.getData('text/plain')?.trim();
                        if (!text || /\s/.test(text)) return false; // must be a single URL token
                        const id = extractYoutubeId(text);
                        if (!id) return false;
                        editor.chain().focus().setYoutubeVideo({ 'data-youtube-video': id }).run();
                        return true;
                    },
                },
            }),
        ];
    },
});
