import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Play } from 'lucide-react';

// Generic third-party embed (maps, tweets, gists, CodePen, …). Separate from the
// Youtube node. Fixes the silent-drop of non-YouTube iframes AND shows untrusted
// embeds safely: the placeholder makes NO network request before consent, and
// trust is decided by the HOST (options), never read from the document.

function hostOf(src) {
    try { return new URL(src, 'https://x').hostname.replace(/^www\./, ''); }
    catch { return src; }
}

function isTrustedSrc(src, options) {
    if (!src) return false;
    if (typeof options.isTrusted === 'function') {
        try { if (options.isTrusted(src)) return true; } catch { /* host callback threw — treat as untrusted */ }
    }
    const hosts = options.trustedEmbedHosts;
    if (Array.isArray(hosts) && hosts.length) {
        const h = hostOf(src);
        return hosts.some(t => h === t || h.endsWith(`.${t}`));
    }
    return false;
}

const EmbedComponent = ({ node, extension }) => {
    const { t } = useTranslation('inscript-editor');
    const { src, label } = node.attrs;
    // Auto-load only for host-trusted sources; otherwise wait for an explicit click.
    const [loaded, setLoaded] = useState(() => isTrustedSrc(src, extension.options));

    let inner;
    if (!src) {
        inner = (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 p-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
                {t('embedUnavailable', 'Embed unavailable')}
            </div>
        );
    } else if (loaded) {
        inner = (
            <div className="relative aspect-video rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800">
                <iframe
                    src={src}
                    title={label || 'Embedded content'}
                    // No allow-same-origin: keeps the framed page from touching this origin
                    // unless a consumer deliberately needs it.
                    sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-presentation"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    className="absolute inset-0 w-full h-full"
                />
            </div>
        );
    } else {
        inner = (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-6 flex flex-col items-center gap-3 text-center">
                <Globe size={22} className="text-zinc-400 dark:text-zinc-500" />
                <div className="min-w-0 max-w-full">
                    <div className="font-medium text-sm text-zinc-800 dark:text-zinc-200">{hostOf(src)}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[280px] mx-auto">{src}</div>
                </div>
                <button
                    type="button"
                    onClick={() => setLoaded(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-100 transition-colors"
                >
                    <Play size={13} />
                    {t('embedLoad', 'Load embedded content')}
                </button>
                <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                    {t('embedThirdParty', 'Loads third-party content from the source above')}
                </div>
            </div>
        );
    }

    return (
        <NodeViewWrapper as="figure" className="embed-node my-4">
            {inner}
            {label && <figcaption className="mt-1.5 text-center text-xs text-zinc-500 dark:text-zinc-400">{label}</figcaption>}
        </NodeViewWrapper>
    );
};

export const Embed = Node.create({
    name: 'embed',
    group: 'block',
    atom: true,
    selectable: true,
    draggable: true,

    addOptions() {
        return {
            // Host decides trust. `isTrusted(src) => boolean` and/or a hostname allowlist.
            isTrusted: null,
            trustedEmbedHosts: [],
        };
    },

    addAttributes() {
        return {
            src: {
                default: null,
                parseHTML: el => el.getAttribute('data-embed-src') || el.getAttribute('src') || null,
                renderHTML: attrs => (attrs.src ? { 'data-embed-src': attrs.src } : {}),
            },
            // Caption/label from officeParser 10.B (::embed[Label]{…}). Round-trips
            // as data-embed-label; dropped-if-absent, so nothing that parses today changes.
            label: {
                default: null,
                parseHTML: el => el.getAttribute('data-embed-label') || null,
                renderHTML: attrs => (attrs.label ? { 'data-embed-label': attrs.label } : {}),
            },
        };
    },

    parseHTML() {
        return [
            // officeParser 9.F gated-embed shape (import + our own round-trip).
            { tag: 'div[data-embed-src][data-embed-gated]' },
            {
                // Any iframe NOT claimed by the Youtube node (priority 60). Turns a
                // previously-dropped iframe into a real round-tripping node.
                tag: 'iframe[src]',
                priority: 40,
                getAttrs: node => {
                    const src = node.getAttribute('src');
                    return src ? { src } : false;
                },
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        // Always serialize to the gated shape; the raw untrusted markup is never
        // re-emitted, so officeParser writes `::embed{src=}` on save.
        return ['div', mergeAttributes(HTMLAttributes, { 'data-embed-gated': 'true' })];
    },

    addNodeView() {
        return ReactNodeViewRenderer(EmbedComponent);
    },

    addCommands() {
        return {
            insertEmbed: (src) => ({ commands }) => {
                if (!src) return false;
                return commands.insertContent({ type: this.name, attrs: { src } });
            },
        };
    },
});
