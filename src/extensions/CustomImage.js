// Named import — see the comment in extensions/index.js on why default imports
// from @tiptap/extension-* packages break under CJS-output interop.
import { Image as TiptapImage } from '@tiptap/extension-image';
import { DEFAULT_LAYOUT_ALIGN, DEFAULT_LAYOUT_WIDTH, cssLength, layoutAlign } from '../utils/layout.js';

export const CustomImage = TiptapImage.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
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
