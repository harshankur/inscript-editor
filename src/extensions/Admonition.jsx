import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { useTranslation } from 'react-i18next';
import { Info, Lightbulb, AlertTriangle, AlertOctagon, Flame } from 'lucide-react';

/** The kinds of admonition (callout), as GitHub and officeParser name them. */
export const ADMONITION_TYPES = Object.freeze(['note', 'tip', 'important', 'warning', 'caution']);
export const DEFAULT_ADMONITION_TYPE = 'note';

/**
 * `value` as one of ADMONITION_TYPES, or the default. The type becomes a class name, so a document
 * must not be able to put anything else there (`note fixed inset-0` would cover the page).
 */
export const resolveAdmonitionType = value => (ADMONITION_TYPES.includes(value) ? value : DEFAULT_ADMONITION_TYPE);

/** Each type's name, in the UI language: translation key and English default. */
export const ADMONITION_TYPE_LABELS = Object.freeze({
    note: ['admonitionTypeNote', 'Note'],
    tip: ['admonitionTypeTip', 'Tip'],
    important: ['admonitionTypeImportant', 'Important'],
    warning: ['admonitionTypeWarning', 'Warning'],
    caution: ['admonitionTypeCaution', 'Caution'],
});

const icons = {
    note: Info,
    tip: Lightbulb,
    important: AlertTriangle, // Or something else
    warning: AlertOctagon,
    caution: Flame,
};

const AdmonitionComponent = ({ node }) => {
    const { t } = useTranslation('inscript-editor');
    const type = resolveAdmonitionType(node.attrs.admonitionType);
    const Icon = icons[type] || Info;
    const [labelKey, labelDefault] = ADMONITION_TYPE_LABELS[type];

    return (
        <NodeViewWrapper className={`admonition admonition-${type}`} data-type={type}>
            <div className="admonition-header" contentEditable={false}>
                <Icon size={20} className="admonition-icon" />
                <span className="admonition-title">{t(labelKey, labelDefault)}</span>
            </div>
            <NodeViewContent className="admonition-content" />
        </NodeViewWrapper>
    );
};

export const Admonition = Node.create({
    name: 'admonition',

    group: 'block',

    content: 'block+',

    defining: true,

    addAttributes() {
        return {
            admonitionType: {
                default: DEFAULT_ADMONITION_TYPE,
                parseHTML: element => resolveAdmonitionType(element.getAttribute('data-type')),
                renderHTML: attributes => {
                    const type = resolveAdmonitionType(attributes.admonitionType);
                    return { 'data-type': type, class: `admonition admonition-${type}` };
                },
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div.admonition',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
    },

    addNodeView() {
        return ReactNodeViewRenderer(AdmonitionComponent);
    },

    addCommands() {
        return {
            // Inside an admonition this changes its type; elsewhere it wraps the selection in one.
            setAdmonition: (type = DEFAULT_ADMONITION_TYPE) => ({ editor, commands }) => {
                const admonitionType = resolveAdmonitionType(type);
                if (editor.isActive(this.name)) return commands.updateAttributes(this.name, { admonitionType });
                return commands.wrapIn(this.name, { admonitionType });
            },
            toggleAdmonition: (type = DEFAULT_ADMONITION_TYPE) => ({ commands }) => {
                return commands.toggleNode(this.name, 'paragraph', { admonitionType: resolveAdmonitionType(type) });
            },
        };
    },
});
