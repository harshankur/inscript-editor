// Language switch: every user-facing string should come from the inscript-editor namespace.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18next from 'i18next';
import { Editor } from '@tiptap/core';
import { buildExtensions } from '../../src/extensions/index.js';
import { BibliographyPanel } from '../../src/components/BibliographyPanel.jsx';
import { renderHost, flush, stubClientWidth } from './harness.jsx';

vi.mock('@tiptap/react/menus', () => ({ BubbleMenu: () => null, FloatingMenu: () => null }));

const DE = {
    youtubeConsentTitle: 'YouTube-Video', youtubeConsentLoad: 'Video laden',
    bibliography: 'Literatur', noTitle: 'Keine Angaben.',
    admonitionTypeTip: 'Tipp',
    save: 'Speichern', cancel: 'Abbrechen', citationInlineLabel: 'Kurzbeleg', citationFullEntry: 'Vollständiger Eintrag',
    editCitation: 'Beleg bearbeiten', locateInText: 'Im Text zeigen',
};
afterEach(async () => {
    await act(async () => { await i18next.changeLanguage('en'); });
    document.body.innerHTML = '';
    vi.restoreAllMocks();
});

describe('language switch', () => {
    it('an on-screen YouTube consent placeholder follows a language switch', async () => {
        i18next.addResourceBundle('de', 'inscript-editor', DE, true, true);
        const { container } = renderHost({ initialContent: '<div data-youtube-video="dQw4w9WgXcQ"></div>', editorOptions: { youtube: { facade: 'local' } } });
        await flush();
        expect(container.querySelector('[data-youtube-consent] button').textContent).toBe('Load video');
        await act(async () => { await i18next.changeLanguage('de'); });
        await flush();
        expect(container.querySelector('[data-youtube-consent] button').textContent).toBe('Video laden');
    });

    it('BibliographyPanel controls follow the UI language (Save / Cancel / field labels)', async () => {
        i18next.addResourceBundle('de', 'inscript-editor', DE, true, true);
        await act(async () => { await i18next.changeLanguage('de'); });
        const element = document.createElement('div');
        document.body.appendChild(element);
        const editor = new Editor({ element, extensions: buildExtensions({}), content: '<p><span class="citation" data-key="k" data-label="K">[K]</span></p>' });
        const { container } = render(<BibliographyPanel editor={editor} />);
        expect(within(container).getByTitle('Im Text zeigen')).toBeInTheDocument();
        fireEvent.click(within(container).getByTitle('Beleg bearbeiten'));
        expect(within(container).getByTitle('Speichern')).toBeInTheDocument();
        expect(within(container).getByTitle('Abbrechen')).toBeInTheDocument();
        expect(container.textContent).toContain('Kurzbeleg');
        expect(container.textContent).toContain('Vollständiger Eintrag');
        editor.destroy();
    });

    it('the Admonition header shows a translated type name', async () => {
        i18next.addResourceBundle('de', 'inscript-editor', DE, true, true);
        await act(async () => { await i18next.changeLanguage('de'); });
        const { container } = renderHost({ initialContent: '<div class="admonition" data-type="tip"><p>x</p></div>' });
        await flush();
        expect(container.querySelector('.admonition-title').textContent).toBe('Tipp');
    });

    it('a language with no bundle falls back to English, never to raw keys', async () => {
        const restore = stubClientWidth(100000);
        await act(async () => { await i18next.changeLanguage('xx'); });
        const { container } = renderHost({ initialContent: '<p>x</p>' }, { toolbarConfig: ['bold', 'admonitions', 'math'] });
        await flush();
        expect(screen.getByTitle('Bold')).toBeInTheDocument();
        expect(container.innerHTML).not.toMatch(/title="(slash\.|admonition[A-Z])/);
        restore();
    });
});
