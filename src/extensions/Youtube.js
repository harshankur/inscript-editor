import { Node } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import i18next from 'i18next';
import { getExternalOpener } from './HostBridge.js';
import { extractYoutubeId, youtubeEmbedUrl } from '../utils/youtubeUrl.js';
import { buildYoutubeConsent, buildYoutubeIcon, YOUTUBE_CONSENT_DEFAULTS } from '../utils/youtubeConsent.js';

const VALID_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

/**
 * What a video shows before the visitor clicks it:
 * - NONE: the player itself, loaded straight away (the default);
 * - THUMBNAIL: YouTube's thumbnail (fetched from i.ytimg.com) with a play button;
 * - LOCAL: a consent placeholder drawn by the editor: it says that playing the video loads it
 *   from YouTube, which then receives data such as the visitor's IP address, and offers a
 *   "Load video" button (and the host's privacy notice, when given). Nothing is requested from
 *   any other host until the button is pressed.
 */
export const YOUTUBE_FACADE = Object.freeze({ NONE: 'none', THUMBNAIL: 'thumbnail', LOCAL: 'local' });

/**
 * The facade mode for the `facade` option. `'local'` is the consent placeholder that loads nothing;
 * `'thumbnail'`, `true` and any other truthy value are the thumbnail (any truthy value turned
 * the facade on before the option took a mode, so it keeps doing so); a falsy value is none.
 *
 * @param {boolean | 'thumbnail' | 'local' | undefined} facade
 * @returns {'none' | 'thumbnail' | 'local'}
 */
export function resolveYoutubeFacade(facade) {
    if (facade === YOUTUBE_FACADE.LOCAL) return YOUTUBE_FACADE.LOCAL;
    return facade ? YOUTUBE_FACADE.THUMBNAIL : YOUTUBE_FACADE.NONE;
}

const IFRAME_TITLE = 'YouTube video player';
const IFRAME_ALLOW = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
const THUMBNAIL_URL = id => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
const LOAD_LABEL = 'Load YouTube video';
// The thumbnail facade's play badge, in plain markup (no remote image).
const PLAY_BADGE_HTML = '<span style="width:48px;height:34px;background:rgba(0,0,0,.75);border-radius:8px;display:flex;align-items:center;justify-content:center;transition:background .15s"><span style="border-style:solid;border-width:8px 0 8px 14px;border-color:transparent transparent transparent #fff;margin-left:3px"></span></span>';

// Static English fallback: this text is serialized into the stored document
// HTML (editor.getHTML()), which is rendered as-is on the public site outside
// any i18next context, so it can't be localized per-viewer.
const PLACEHOLDER_TEXT = 'Video unavailable';
const PLACEHOLDER_ICON_SIZE = 32;

/** The consent placeholder's labels, in the current language. */
function consentLabels() {
    const t = (key, defaultValue) => i18next.t(key, { ns: 'inscript-editor', defaultValue });
    return {
        title: t('youtubeConsentTitle', YOUTUBE_CONSENT_DEFAULTS.title),
        text: t('youtubeConsentText', YOUTUBE_CONSENT_DEFAULTS.text),
        load: t('youtubeConsentLoad', YOUTUBE_CONSENT_DEFAULTS.load),
        privacy: t('youtubeConsentPrivacy', YOUTUBE_CONSENT_DEFAULTS.privacy),
    };
}

/** The consent placeholder's own controls. */
const CONSENT_CONTROLS = 'button, a';

/** The class that lets a read-only editor's clicks reach a loaded player (see the stylesheet). */
const OVERLAY_CLASS = 'youtube-embed-overlay';

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

function buildPlaceholderDom() {
    const wrapper = document.createElement('div');
    wrapper.className = 'absolute inset-0 flex flex-col items-center justify-center gap-2 text-[var(--inscript-color-muted)]';
    wrapper.appendChild(buildYoutubeIcon(PLACEHOLDER_ICON_SIZE));
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
            // Click-to-load. `true` or 'thumbnail': a lite-youtube-style thumbnail (fetched
            // from i.ytimg.com) that loads the real iframe only on click. 'local': a consent
            // placeholder drawn here, so nothing at all is requested from another host until
            // the visitor presses its "Load video" button. Default false is the immediate
            // iframe, so no consumer regresses.
            facade: false,
            // The host's privacy notice, linked from the consent placeholder (facade 'local').
            // Only an http(s) URL becomes a link; unset, there is no link.
            privacyUrl: null,
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
                    src: youtubeEmbedUrl(id),
                    title: IFRAME_TITLE,
                    frameborder: '0',
                    allow: IFRAME_ALLOW,
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
        const facadeMode = resolveYoutubeFacade(this.options.facade);
        const { privacyUrl } = this.options;
        const editor = this.editor;
        // Read when the privacy link is followed, so a host opener set later still applies.
        const getOpenExternal = () => getExternalOpener(editor);
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
            iframe.title = IFRAME_TITLE;
            iframe.setAttribute('frameborder', '0');
            iframe.setAttribute('allowfullscreen', 'true');
            iframe.setAttribute('allow', IFRAME_ALLOW);
            iframe.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%;';

            const placeholder = buildPlaceholderDom();

            // Transparent overlay so ProseMirror sees clicks and creates a NodeSelection.
            // Without this, clicks go straight to the cross-origin iframe and TipTap never selects the node.
            // Not needed (so not added) over a facade, which is no iframe: ProseMirror sees those clicks.
            const overlay = document.createElement('div');
            overlay.className = OVERLAY_CLASS;
            overlay.style.cssText = 'position: absolute; inset: 0; z-index: 10;';

            let consentEl = null; // the consent placeholder on screen, if any

            // Facade (opt-in): a thumbnail or a local placeholder, with a play button, that
            // loads the iframe only on click. Built lazily, so the default (no facade) mode is
            // untouched.
            let facadeLoaded = false; // user has clicked play → show the iframe
            const loadPlayer = () => {
                // A keyboard user who pressed the button keeps their place: focus moves to the player.
                const hadFocus = dom.contains(document.activeElement);
                facadeLoaded = true;
                render(currentAttrs);
                if (hadFocus && iframe.isConnected) iframe.focus();
            };
            const buildFacade = (id) => {
                if (facadeMode === YOUTUBE_FACADE.LOCAL) {
                    // Drawn entirely here: no request leaves the page until "Load video" is
                    // pressed. That press is the consent, for this video only; nothing is kept.
                    consentEl = buildYoutubeConsent({ labels: consentLabels(), onLoad: loadPlayer, privacyUrl, getOpenExternal });
                    consentEl.setAttribute('data-youtube-facade', YOUTUBE_FACADE.LOCAL);
                    return consentEl;
                }
                const wrap = document.createElement('button');
                wrap.type = 'button';
                wrap.setAttribute('aria-label', i18next.t('youtubeLoadVideo', { ns: 'inscript-editor', defaultValue: LOAD_LABEL }));
                wrap.className = 'absolute inset-0 w-full h-full block cursor-pointer group border-0 p-0';
                wrap.setAttribute('data-youtube-facade', YOUTUBE_FACADE.THUMBNAIL);
                // The thumbnail is the ONLY network request until the user clicks.
                wrap.style.cssText = `border:0;padding:0;background:#000 center/cover no-repeat url("${THUMBNAIL_URL(id)}");`;
                const btn = document.createElement('span');
                btn.className = 'absolute inset-0 flex items-center justify-center';
                btn.innerHTML = PLAY_BADGE_HTML;
                wrap.appendChild(btn);
                wrap.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    loadPlayer();
                });
                return wrap;
            };

            let state = null; // 'placeholder' | 'facade' | 'iframe' — only re-touch DOM on change
            let facadeId = null; // the id the facade on screen was built for
            let currentAttrs = node.attrs; // the latest attrs, for the facade's click

            const render = (attrs) => {
                currentAttrs = attrs;
                const id = attrs['data-youtube-video'];
                const w = attrs.width || '100%';
                const a = attrs.align || 'center';
                // Alignment/width live on the figure so the caption tracks the video.
                dom.style.cssText = `width: ${w}; margin-left: ${a === 'left' ? '0' : 'auto'}; margin-right: ${a === 'right' ? '0' : 'auto'};`;
                videoDom.setAttribute('data-youtube-video', id || '');
                videoDom.setAttribute('data-width', w);
                videoDom.setAttribute('data-align', a);
                // @container: the consent placeholder fits itself to the video's width.
                videoDom.className = 'youtube-embed relative aspect-video rounded-lg overflow-hidden @container';

                const facadePending = facadeMode !== YOUTUBE_FACADE.NONE && !facadeLoaded;
                const next = !id ? 'placeholder' : facadePending ? 'facade' : 'iframe';
                if (next === 'iframe' && id) {
                    // Setting src again, even to the same URL, reloads the player (and stops a
                    // playing video), so only a new URL is set.
                    const src = youtubeEmbedUrl(id);
                    if (iframe.getAttribute('src') !== src) iframe.src = src;
                } else iframe.removeAttribute('src');

                // A facade shows its video's ID (and thumbnail), so a new ID rebuilds it.
                if (state !== next || (next === 'facade' && facadeId !== id)) {
                    state = next;
                    videoDom.innerHTML = '';
                    consentEl = null;
                    if (next === 'placeholder') videoDom.appendChild(placeholder);
                    else if (next === 'facade') { facadeId = id; videoDom.appendChild(buildFacade(id)); }
                    else videoDom.appendChild(iframe);
                    // The consent placeholder's button and link must take the first click, and
                    // its background is plain DOM that ProseMirror selects the node from, so it
                    // gets no overlay.
                    if (!consentEl) videoDom.appendChild(overlay);
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
                // The consent placeholder's button and link handle their own events: ProseMirror
                // must not turn a press on them into a node selection, or Enter and Space into
                // an edit, so the first click or key press loads the player (or follows the link).
                stopEvent(event) {
                    const target = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
                    return !!(consentEl && target && consentEl.contains(target) && target.closest(CONSENT_CONTROLS));
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
