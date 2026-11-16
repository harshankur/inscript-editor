// Named import — see the comment in extensions/index.js on why default imports
// from @tiptap/extension-* packages break under CJS-output interop.
import { Image as TiptapImage } from '@tiptap/extension-image';
import { DEFAULT_LAYOUT_ALIGN, DEFAULT_LAYOUT_WIDTH, cssLength, imageHeight, layoutAlign } from '../utils/layout.js';
import { documentImageSrc } from '../utils/url.js';

export const CustomImage = TiptapImage.extend({
    // An image whose source is refused is not read as an image (a broken box that would vanish on save).
    parseHTML() {
        return (this.parent?.() ?? []).map(rule => ({
            ...rule,
            getAttrs: dom => {
                if (typeof dom.getAttribute === 'function' && documentImageSrc(dom.getAttribute('src')) === null) return false;
                return typeof rule.getAttrs === 'function' ? rule.getAttrs(dom) : null;
            },
        }));
    },

    addAttributes() {
        const parent = this.parent?.() ?? {};
        return {
            ...parent,
            // A document's image source: never a script URL, a data URL that is not an image, or a
            // share on another machine (see documentImageSrc), read or written.
            src: {
                ...parent.src,
                parseHTML: element => documentImageSrc(element.getAttribute('src')),
                // Written as read: a protocol-relative one (from JSON, a command) as the web address it
                // means on a page opened from a file.
                renderHTML: attrs => {
                    const src = documentImageSrc(attrs.src);
                    return src ? { src } : {};
                },
            },
            // A height in pixels, at most MAX_IMAGE_HEIGHT_PX.
            height: {
                default: null,
                parseHTML: element => imageHeight(element.getAttribute('height')),
                renderHTML: attrs => {
                    const height = imageHeight(attrs.height);
                    return height ? { height: String(height) } : {};
                },
            },
            // Width and alignment become inline style: only a CSS length and a known alignment
            // are taken, read and written (see utils/layout.js).
            width: {
                default: DEFAULT_LAYOUT_WIDTH,
                parseHTML: element => cssLength(element.getAttribute('data-width')),
                renderHTML: attrs => {
                    const width = cssLength(attrs.width);
                    return { 'data-width': width, style: `width: ${width}` };
                },
            },
            align: {
                default: DEFAULT_LAYOUT_ALIGN,
                parseHTML: element => layoutAlign(element.getAttribute('data-align')),
                renderHTML: attrs => {
                    const align = layoutAlign(attrs.align);
                    const ml = align === 'left' ? '0' : 'auto';
                    const mr = align === 'right' ? '0' : 'auto';
                    return { 'data-align': align, style: `display: block; margin-left: ${ml}; margin-right: ${mr}` };
                },
            },
        };
    },
});
