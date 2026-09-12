import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useInscriptEditor } from '../../src/hooks/useInscriptEditor.js';
import { InscriptEditor } from '../../src/InscriptEditor.jsx';

vi.mock('@tiptap/react/menus', () => ({
    BubbleMenu: ({ children }) => <div>{children}</div>,
    FloatingMenu: ({ children }) => <div>{children}</div>,
}));

function Harness(props) {
    const hook = useInscriptEditor({ contentKey: 'theme-test.md' });
    return <InscriptEditor editor={hook.editor} {...props} />;
}

const scopeOf = async (container) =>
    waitFor(() => {
        const el = container.querySelector('.inscript-editor');
        expect(el).toBeTruthy();
        return el;
    });

describe('InscriptEditor theming', () => {
    it('applies theme tokens as inline --inscript-* custom properties on the editor scope', async () => {
        const { container } = render(
            <Harness theme={{ accent: '#7c3aed', surface: '#101010', text: '#eeeeee', radius: '1rem', fontFamily: 'Georgia' }} />,
        );
        const root = await scopeOf(container);
        expect(root.style.getPropertyValue('--inscript-color-accent')).toBe('#7c3aed');
        expect(root.style.getPropertyValue('--inscript-color-surface')).toBe('#101010');
        expect(root.style.getPropertyValue('--inscript-color-text')).toBe('#eeeeee');
        expect(root.style.getPropertyValue('--inscript-radius')).toBe('1rem');
        expect(root.style.getPropertyValue('--inscript-font-family')).toBe('Georgia');
    });

    it('resolves max-width on the content container, not on the theme scope', async () => {
        const { container } = render(<Harness theme={{ maxWidth: '60ch' }} />);
        await scopeOf(container);
        const scope = container.querySelector('.inscript-editor');
        const inner = container.querySelector('.inscript-editor-container');
        expect(scope.style.getPropertyValue('--inscript-max-width')).toBe('');
        expect(inner.style.getPropertyValue('--inscript-max-width')).toBe('60ch');
    });

    it('focus mode overrides max-width with focusMaxWidth', async () => {
        const { container } = render(<Harness focusMode theme={{ maxWidth: '60ch', focusMaxWidth: '40rem' }} />);
        await waitFor(() => expect(container.querySelector('.inscript-editor-container')).toBeTruthy());
        const inner = container.querySelector('.inscript-editor-container');
        expect(inner.style.getPropertyValue('--inscript-max-width')).toBe('40rem');
    });

    it('supports the legacy flat fontFamily prop as a fallback', async () => {
        const { container } = render(<Harness fontFamily="Inter" />);
        const root = await scopeOf(container);
        expect(root.style.getPropertyValue('--inscript-font-family')).toBe('Inter');
    });

    it('lets the theme object win over the matching legacy flat prop', async () => {
        const { container } = render(<Harness fontFamily="Inter" theme={{ fontFamily: 'Georgia' }} />);
        const root = await scopeOf(container);
        expect(root.style.getPropertyValue('--inscript-font-family')).toBe('Georgia');
    });

    it('renders the content surface through the surface token', async () => {
        const { container } = render(<Harness />);
        await scopeOf(container);
        expect(container.querySelector('[class*="inscript-color-surface"]')).toBeTruthy();
    });

    it('sets no theme custom properties when no theme is provided', async () => {
        const { container } = render(<Harness />);
        const root = await scopeOf(container);
        expect(root.style.getPropertyValue('--inscript-color-accent')).toBe('');
        expect(root.style.getPropertyValue('--inscript-font-family')).toBe('');
    });
});
