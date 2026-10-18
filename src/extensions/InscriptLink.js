import { Link } from '@tiptap/extension-link';
import { Plugin } from '@tiptap/pm/state';

/** The key TipTap's autolink plugin registers under (`autolink$`, with ProseMirror's suffix). */
const AUTOLINK_KEY_PREFIX = 'autolink$';

/** Does this transaction replace the whole document in one step (setContent, a load)? */
function replacesWholeDocument(tr) {
    const size = tr.before.content.size;
    return tr.steps.some(step => step.from === 0 && step.to === size && step.slice !== undefined);
}

/**
 * TipTap's Link, with autolink limited to what the writer types or pastes. Its autolink plugin also
 * ran on content set as a whole (`editor.commands.setContent`, opening or restoring a document) and
 * linked a plain-text URL there: an opened document was changed before anyone touched it, and a link
 * the writer had removed came back when the version was restored.
 */
export const InscriptLink = Link.extend({
    addProseMirrorPlugins() {
        return (this.parent?.() ?? []).map(plugin => {
            if (!plugin.key?.startsWith(AUTOLINK_KEY_PREFIX)) return plugin;
            const { appendTransaction } = plugin.spec;
            return new Plugin({
                ...plugin.spec,
                appendTransaction: (transactions, oldState, newState) => (
                    transactions.some(replacesWholeDocument) ? null : appendTransaction(transactions, oldState, newState)
                ),
            });
        });
    },
});
