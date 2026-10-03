import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Palette } from 'lucide-react';
import { ColorSelector } from './ColorSelector.jsx';
import { HighlightSelector } from './HighlightSelector.jsx';
import { FontSizeSelector } from './FontSizeSelector.jsx';
import { LinkSelector } from './LinkSelector.jsx';
import { createEditor } from '../../tests/helpers/createEditor.js';

describe('selector popovers', () => {
    let editor;

    beforeEach(() => {
        editor = createEditor();
        editor.commands.setContent('<p>hello</p>');
        editor.commands.selectAll();
    });

    afterEach(() => {
        editor.destroy();
    });

    describe('ColorSelector', () => {
        it('opens the popover and applies a preset color via onChange', () => {
            const onChange = () => {};
            let applied = null;
            render(
                <ColorSelector
                    icon={Palette}
                    title="Text Color"
                    activeColor={undefined}
                    onChange={(c) => { applied = c; }}
                    onRemove={() => {}}
                    presets={['#000000', '#2563eb']}
                    variant="text"
                />
            );
            fireEvent.click(screen.getByTitle('Text Color'));
            fireEvent.click(screen.getByTitle('#2563eb'));
            expect(applied).toBe('#2563eb');
        });

        it('calls onRemove via the reset action', () => {
            let removed = false;
            render(
                <ColorSelector
                    icon={Palette}
                    title="Text Color"
                    activeColor="#2563eb"
                    onChange={() => {}}
                    onRemove={() => { removed = true; }}
                    presets={['#000000']}
                    variant="text"
                />
            );
            fireEvent.click(screen.getByTitle('Text Color'));
            fireEvent.click(screen.getByText('Reset to Default'));
            expect(removed).toBe(true);
        });
    });

    describe('ColorSelector default swatch', () => {
        const renderWith = (swatch, extra = {}) => render(
            <ColorSelector
                icon={Palette}
                title="Highlight"
                activeColor={undefined}
                onChange={() => {}}
                onRemove={() => {}}
                presets={['#bbf7d0']}
                variant="highlight"
                defaultSwatch={swatch}
                {...extra}
            />
        );

        it('renders first, labelled, and runs its own action instead of onChange', () => {
            let picked = 0;
            let changed = 0;
            renderWith({ css: 'rgb(1, 2, 3)', title: 'Default highlight', active: false, onSelect: () => { picked += 1; } }, { onChange: () => { changed += 1; } });
            fireEvent.click(screen.getByTitle('Highlight'));
            const swatch = screen.getByRole('button', { name: 'Default highlight' });
            expect(swatch.style.backgroundColor).toBe('rgb(1, 2, 3)');
            expect(swatch.getAttribute('aria-pressed')).toBe('false');
            expect(swatch.nextElementSibling.getAttribute('title')).toBe('#bbf7d0');
            fireEvent.click(swatch);
            expect(picked).toBe(1);
            expect(changed).toBe(0);
            // Picking it closes the popover, like a preset does.
            expect(screen.queryByRole('button', { name: 'Default highlight' })).toBeNull();
        });

        it('marks the button and the swatch active when the default is the current choice', () => {
            renderWith({ css: 'rgb(1, 2, 3)', title: 'Default highlight', active: true, onSelect: () => {} });
            const button = screen.getByTitle('Highlight');
            expect(button.querySelector('span[style]').style.backgroundColor).toBe('rgb(1, 2, 3)');
            fireEvent.click(button);
            expect(screen.getByRole('button', { name: 'Default highlight' }).getAttribute('aria-pressed')).toBe('true');
        });

        it('is absent unless asked for', () => {
            render(<ColorSelector icon={Palette} title="Text Color" onChange={() => {}} onRemove={() => {}} presets={['#000000']} variant="text" />);
            fireEvent.click(screen.getByTitle('Text Color'));
            expect(screen.queryByRole('button', { name: 'Default highlight' })).toBeNull();
        });
    });

    describe('HighlightSelector', () => {
        const open = () => fireEvent.click(screen.getByTitle('Highlight'));
        const pick = name => { open(); fireEvent.click(screen.getByTitle(name)); };

        it('applies the default highlight as a plain <mark>, with no colour', () => {
            render(<HighlightSelector editor={editor} title="Highlight" />);
            pick('Default highlight');
            expect(editor.getHTML()).toBe('<p><mark>hello</mark></p>');
        });

        it('applies a preset colour as before', () => {
            render(<HighlightSelector editor={editor} title="Highlight" />);
            pick('#bbf7d0');
            expect(editor.getHTML()).toContain('<mark data-color="#bbf7d0"');
        });

        it('switches a coloured highlight to the default instead of removing it', () => {
            editor.commands.setHighlight({ color: '#bbf7d0' });
            render(<HighlightSelector editor={editor} title="Highlight" />);
            pick('Default highlight');
            expect(editor.getHTML()).toBe('<p><mark>hello</mark></p>');
        });

        it('removes the default highlight when it is picked again, and via No Highlight', () => {
            editor.commands.setHighlight({ color: null });
            const { rerender } = render(<HighlightSelector editor={editor} title="Highlight" />);
            pick('Default highlight');
            expect(editor.getHTML()).toBe('<p>hello</p>');

            editor.commands.setHighlight({ color: null });
            rerender(<HighlightSelector editor={editor} title="Highlight" />);
            open();
            fireEvent.click(screen.getByText('No Highlight'));
            expect(editor.getHTML()).toBe('<p>hello</p>');
        });

        it('shows the default as the active choice for a plain highlight, and a colour for a coloured one', () => {
            editor.commands.setHighlight({ color: null });
            const { rerender } = render(<HighlightSelector editor={editor} title="Highlight" />);
            open();
            expect(screen.getByRole('button', { name: 'Default highlight' }).getAttribute('aria-pressed')).toBe('true');
            fireEvent.click(screen.getByTitle('Highlight'));

            editor.commands.setHighlight({ color: '#bbf7d0' });
            rerender(<HighlightSelector editor={editor} title="Highlight" />);
            open();
            expect(screen.getByRole('button', { name: 'Default highlight' }).getAttribute('aria-pressed')).toBe('false');
        });

        it('renders with no editor', () => {
            expect(() => render(<HighlightSelector editor={null} title="Highlight" />)).not.toThrow();
        });
    });

    describe('FontSizeSelector', () => {
        it('opens the popover and applies a size to the editor', () => {
            render(<FontSizeSelector editor={editor} />);
            fireEvent.click(screen.getByTitle('Font Size'));
            fireEvent.click(screen.getByText('24px'));
            expect(editor.getAttributes('textStyle').fontSize).toBe(24);
        });

        it('resets the font size via the Reset action', () => {
            editor.commands.setFontSize(24);
            render(<FontSizeSelector editor={editor} />);
            fireEvent.click(screen.getByTitle('Font Size'));
            fireEvent.click(screen.getByText('Reset'));
            expect(editor.getAttributes('textStyle').fontSize).toBeFalsy();
        });
    });

    describe('LinkSelector', () => {
        it('opens the popover, types a URL, and applies it as a link', () => {
            render(<LinkSelector editor={editor} />);
            fireEvent.click(screen.getByTitle('Insert Link'));
            fireEvent.change(screen.getByPlaceholderText('Enter URL...'), { target: { value: 'https://example.com' } });
            fireEvent.click(screen.getByText('Apply'));
            expect(editor.getAttributes('link').href).toBe('https://example.com');
        });

        it('removes the link via the remove-link action', () => {
            editor.commands.setLink({ href: 'https://example.com' });
            render(<LinkSelector editor={editor} />);
            fireEvent.click(screen.getByTitle('Insert Link'));
            fireEvent.click(screen.getByTitle('Remove Link'));
            expect(editor.isActive('link')).toBe(false);
        });
    });
});
