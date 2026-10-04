import { describe, expect, it } from 'vitest';
import { documentForReplacement } from './history.js';

// Where a replacement editor's document comes from, when an editor is replaced for the same
// document. The data-loss case this guards: an editor that was never given its content left an
// empty document, which blanked the real one.
describe('documentForReplacement', () => {
    const outgoing = { name: 'outgoing editor' };
    const replacement = { name: 'replacement editor' };
    const active = { id: 'v2', html: '<p>recorded</p>' };
    const carry = (over = {}) => ({ html: '<p>left behind</p>', from: outgoing, isEmpty: false, hasUncommittedEdit: false, ...over });
    const decide = (over = {}) => documentForReplacement({ carry: carry(), replacement, lastSyncedHtml: '<p>recorded</p>', activeEntry: active, ...over });

    it('uses what the outgoing editor left', () => {
        expect(decide()).toEqual({ html: '<p>left behind</p>', hasUncommittedEdit: false });
    });

    it('reports an edit the outgoing editor never committed', () => {
        expect(decide({ carry: carry({ hasUncommittedEdit: true }) })).toEqual({ html: '<p>left behind</p>', hasUncommittedEdit: true });
    });

    it('never applies a leftover to the instance it was read from', () => {
        expect(decide({ carry: carry({ from: replacement }) })).toEqual({ html: '<p>recorded</p>', hasUncommittedEdit: false });
        expect(decide({ carry: carry({ from: replacement }), activeEntry: undefined })).toBeNull();
    });

    describe('an empty leftover', () => {
        const empty = (over = {}) => carry({ html: '<p></p>', isEmpty: true, ...over });

        it('is not believed on its own: the active version is the document', () => {
            expect(decide({ carry: empty() })).toEqual({ html: '<p>recorded</p>', hasUncommittedEdit: false });
        });

        it('is believed when the document really is empty (it is the last synced state)', () => {
            expect(decide({ carry: empty(), lastSyncedHtml: '<p></p>' })).toEqual({ html: '<p></p>', hasUncommittedEdit: false });
        });

        it('is believed when an edit was pending (the user just emptied it)', () => {
            expect(decide({ carry: empty({ hasUncommittedEdit: true }) })).toEqual({ html: '<p></p>', hasUncommittedEdit: true });
        });

        it('restores nothing when there is no version either, leaving the replacement as created', () => {
            expect(decide({ carry: empty(), lastSyncedHtml: null, activeEntry: undefined })).toBeNull();
        });
    });

    it('falls back to the active version when nothing was left', () => {
        expect(decide({ carry: null })).toEqual({ html: '<p>recorded</p>', hasUncommittedEdit: false });
    });

    it('restores nothing with neither a leftover nor a version', () => {
        expect(decide({ carry: null, activeEntry: undefined })).toBeNull();
        expect(decide({ carry: undefined, activeEntry: null })).toBeNull();
    });
});
