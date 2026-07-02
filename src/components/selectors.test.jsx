import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Palette } from 'lucide-react';
import { ColorSelector } from './ColorSelector.jsx';
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
