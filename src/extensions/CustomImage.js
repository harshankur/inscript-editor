// Named import — see the comment in extensions/index.js on why default imports
// from @tiptap/extension-* packages break under CJS-output interop.
import { Image as TiptapImage } from '@tiptap/extension-image';

export const CustomImage = TiptapImage.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            width: {
                default: '100%',
                parseHTML: element => element.getAttribute('data-width') || '100%',
                renderHTML: attrs => ({ 'data-width': attrs.width, style: `width: ${attrs.width}` }),
            },
            align: {
                default: 'center',
                parseHTML: element => element.getAttribute('data-align') || 'center',
                renderHTML: attrs => {
                    const ml = attrs.align === 'left' ? '0' : 'auto';
                    const mr = attrs.align === 'right' ? '0' : 'auto';
                    return { 'data-align': attrs.align, style: `display: block; margin-left: ${ml}; margin-right: ${mr}` };
                },
            },
        };
    },
});
