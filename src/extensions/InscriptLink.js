import { Link, isAllowedUri } from '@tiptap/extension-link';
import { Plugin } from '@tiptap/pm/state';
import { clickedLink, openOutside } from './HostBridge.js';
import { isShareAddress, protocolRelativeAsWeb } from '../utils/url.js';
import { replacesWholeDocument } from '../utils/transactions.js';

const CHECKED_AUTOLINK = Symbol('inscript-editor.checkedAutoLink');

/** The key TipTap's autolink plugin registers under (`autolink$`, with ProseMirror's suffix). */
const AUTOLINK_KEY_PREFIX = 'autolink$';
/** A link's attributes that are the host's (HTMLAttributes), never a document's (see addAttributes). */
export const HOST_LINK_ATTRS = Object.freeze(['target', 'rel', 'class']);

/**
 * The address a link may have, as the editor keeps it (a protocol-relative one as the web address it
 * means, see protocolRelativeAsWeb), or null when it may not: checked by the link's isAllowedUri
 * (which never takes another machine's share), with the link extension's options.
 * @param {object} options - The link extension's options.
 * @param {unknown} value
 * @returns {string | null}
 */
export function allowedLinkHref(options, value) {
    const href = protocolRelativeAsWeb(value);
    if (typeof href !== 'string' || !href) return null;
    const protocols = options.protocols ?? [];
    const allowed = options.isAllowedUri(href, {
        defaultValidate: url => !!isAllowedUri(url, protocols),
        protocols,
        defaultProtocol: options.defaultProtocol,
    });
    return allowed ? href : null;
}


/**
 * TipTap's Link, with autolink limited to what the writer types or pastes. Its autolink plugin also
 * ran on content set as a whole (`editor.commands.setContent`, opening or restoring a document) and
 * linked a plain-text URL there: an opened document was changed before anyone touched it, and a link
 * the writer had removed came back when the version was restored.
 */
export const InscriptLink = Link.extend({
    addOptions() {
        const parent = this.parent?.() ?? {};
        const allowed = parent.isAllowedUri;
        return {
            ...parent,
            // Never another machine's share (see isShareAddress): read, written, set and pasted alike.
            isAllowedUri: (url, ctx) => !isShareAddress(protocolRelativeAsWeb(url)) && (typeof allowed === 'function' ? allowed(url, ctx) : true),
        };
    },

    // Read with its address as the web address a protocol-relative one means on a page opened from a
    // file (see protocolRelativeAsWeb), then checked.
    parseHTML() {
        return (this.parent?.() ?? []).map(rule => ({
            ...rule,
            getAttrs: dom => (allowedLinkHref(this.options, dom.getAttribute?.('href')) === null ? false : null),
        }));
    },

    // A link's target, rel and class are the host's (HTMLAttributes), never a document's: one from a
    // document could lay an invisible link over the whole page (the stylesheet's own classes), send
    // the top window away (`target="_top"`), or give the opened page this one (`rel="opener"`).
    addAttributes() {
        const parent = this.parent?.() ?? {};
        const host = this.options.HTMLAttributes ?? {};
        const fromHost = name => ({
            default: host[name] ?? null,
            parseHTML: () => host[name] ?? null,
            renderHTML: () => (host[name] ? { [name]: host[name] } : {}),
        });
        return {
            ...parent,
            // A protocol-relative address read as the web address it means (see protocolRelativeAsWeb).
            href: {
                ...parent.href,
                parseHTML: element => protocolRelativeAsWeb(element.getAttribute('href')),
                // Written so too (from JSON, a command). TipTap's own rendering then writes a refused one
                // (isAllowedUri: another machine's share among them) as an empty address. No address, none.
                renderHTML: attrs => (attrs.href === null || attrs.href === undefined ? {} : { href: protocolRelativeAsWeb(attrs.href) }),
            },
            ...Object.fromEntries(HOST_LINK_ATTRS.map(name => [name, fromHost(name)])),
        };
    },

    addProseMirrorPlugins() {
        const { editor, options } = this;
        // Linking what is typed or pasted (autolink, link on paste) only to an address a link may have:
        // TipTap's link-on-paste checks nothing else, and kept a `file:` or other one. The protocols
        // are read when a link is checked (the host's own, if it gave any).
        if (!options.shouldAutoLink?.[CHECKED_AUTOLINK]) {
            const autoLink = options.shouldAutoLink;
            const checked = url => allowedLinkHref(options, url) !== null && (typeof autoLink !== 'function' || !!autoLink(url));
            checked[CHECKED_AUTOLINK] = true;
            options.shouldAutoLink = checked;
        }
        const plugins = (this.parent?.() ?? []).map(plugin => {
            if (!plugin.key?.startsWith(AUTOLINK_KEY_PREFIX)) return plugin;
            const { appendTransaction } = plugin.spec;
            return new Plugin({
                ...plugin.spec,
                appendTransaction: (transactions, oldState, newState) => (
                    transactions.some(replacesWholeDocument) ? null : appendTransaction(transactions, oldState, newState)
                ),
            });
        });
        // A link clicked in a read-only document opens outside it (see openOutside): never in place
        // of the app. A mail link or a page's own anchor is left to the browser.
        plugins.push(new Plugin({
            props: {
                handleDOMEvents: {
                    click: (view, event) => {
                        // A click with a modifier (a new tab, a new window) is the browser's.
                        if (view.editable || event.button !== 0 || event.defaultPrevented
                            || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
                        const anchor = clickedLink(event, view.dom);
                        if (!anchor) return false;
                        // A link mark's own anchor only: a node view's link (a wikilink, a video's notice)
                        // handles its click itself.
                        let linked = false;
                        try {
                            const node = view.state.doc.nodeAt(view.posAtDOM(anchor, 0));
                            linked = !!node && node.marks.some(mark => mark.type === this.type);
                        } catch { /* not in the document's text */ }
                        if (!linked) return false;
                        if (!openOutside(editor, anchor.getAttribute('href'), view.dom.ownerDocument)) return false;
                        event.preventDefault();
                        return true;
                    },
                },
            },
        }));
        return plugins;
    },
});
