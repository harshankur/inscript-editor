import { useTranslation } from 'react-i18next';
import { useEditorState } from '@tiptap/react';
import { Highlighter } from 'lucide-react';
import { ColorSelector } from './ColorSelector.jsx';
import { DEFAULT_HIGHLIGHT_CSS, HIGHLIGHT_MARK, HIGHLIGHT_PRESETS } from '../constants.js';

/**
 * The highlight picker, shared by the toolbar and the selection bubble menu.
 *
 * Its first swatch is the default highlight: a plain `<mark>` with no colour of its own, drawn
 * from the theme's mark token. That is the one highlight a Markdown round trip can keep as
 * `==text==`; a coloured highlight has to be written as styled HTML. The other swatches and the
 * custom colour set a colour as before.
 *
 * @param {object} props
 * @param {import('@tiptap/core').Editor|null} props.editor
 * @param {string} props.title - The button's tooltip.
 */
export const HighlightSelector = ({ editor, title }) => {
    const { t } = useTranslation('inscript-editor');
    // Read from the editor as it changes (used on its own, nothing else re-renders this).
    const { color, isDefaultActive } = useEditorState({
        editor,
        selector: ({ editor: current }) => {
            const active = current?.getAttributes(HIGHLIGHT_MARK).color;
            return { color: active, isDefaultActive: !!current?.isActive(HIGHLIGHT_MARK) && !active };
        },
    }) ?? {};
    // Picking the default again removes it, like picking the active colour again does. Otherwise
    // set it with an explicit null colour: setHighlight() alone would keep the colour of a
    // highlight already there.
    const selectDefault = () => {
        const chain = editor.chain().focus();
        (isDefaultActive ? chain.unsetHighlight() : chain.setHighlight({ color: null })).run();
    };
    return (
        <ColorSelector
            icon={Highlighter}
            title={title}
            activeColor={color}
            onChange={(next) => editor.chain().focus().toggleHighlight({ color: next }).run()}
            onRemove={() => editor.chain().focus().unsetHighlight().run()}
            presets={HIGHLIGHT_PRESETS}
            variant="highlight"
            defaultSwatch={{
                css: DEFAULT_HIGHLIGHT_CSS,
                title: t('highlightDefault', 'Default highlight'),
                active: isDefaultActive,
                onSelect: selectDefault,
            }}
        />
    );
};
