import { act, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useInscriptEditor } from '../../src/hooks/useInscriptEditor.js';
import { InscriptEditor } from '../../src/InscriptEditor.jsx';
import { createEditor } from '../helpers/createEditor.js';

vi.mock('@tiptap/react/menus', () => ({
    BubbleMenu: ({ children }) => <div>{children}</div>,
    FloatingMenu: ({ children }) => <div>{children}</div>,
}));

describe('wikilink node view', () => {
    let editor;
    afterEach(() => editor?.destroy?.());

    it('uses translated tooltips and theme tokens, and re-resolves on refreshWikilinks()', async () => {
        const pages = new Set();
        const resolver = target => ({ exists: pages.has(target), href: `/wiki/${target}` });
        const ref = {};
        function Host() {
            const api = useInscriptEditor({ contentKey: 'w', editorOptions: { wikilink: { enabled: true, resolver } } });
            ref.editor = api.editor;
            return <InscriptEditor {...api} isReadonly />;
        }
        const { container } = render(<Host />);
        act(() => { ref.editor.commands.setContent('<p><a data-wikilink="true" data-target="Fjords">Fjords</a></p>'); });

        const link = () => container.querySelector('a.wikilink');
        // React node views mount once the editor has initialized (a tick after creation).
        await waitFor(() => expect(link()).not.toBeNull());
        expect(link().getAttribute('title')).toBe('Create Fjords');
        expect(link().className).toContain('--inscript-color-muted');

        // The host creates the page: nothing changes until it asks for a refresh.
        pages.add('Fjords');
        act(() => { ref.editor.commands.refreshWikilinks(); });
        await waitFor(() => expect(link().getAttribute('title')).toBe('Go to Fjords'));
        expect(link().className).toContain('--inscript-color-link');
        expect(link().className).not.toContain('indigo');
    });

    it('refreshWikilinks() changes neither the document nor the undo stack', () => {
        editor = createEditor({ content: '<p><a data-wikilink="true" data-target="A">A</a></p>' }, { wikilink: { enabled: true } });
        const before = editor.getHTML();
        const depth = editor.can().undo();
        editor.commands.refreshWikilinks();
        expect(editor.getHTML()).toBe(before);
        expect(editor.can().undo()).toBe(depth);
    });
});
