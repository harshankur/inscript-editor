import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InscriptEditor, useInscriptEditor } from '../src/index.js';

function Host({ theme }) {
    return <InscriptEditor {...useInscriptEditor({ initialContent: '<p>Hello</p>' })} theme={theme} />;
}

describe('spacing tokens', () => {
    it('the content column falls back to the old 0.5rem and 2rem, in Tailwind v4 and v3', () => {
        const { container } = render(<Host />);
        const column = container.querySelector('.inscript-editor-container');
        expect(column.className).toContain('px-[var(--inscript-gutter,calc(var(--spacing,0.25rem)*2))]');
        expect(column.className).toContain('md:px-[var(--inscript-gutter,calc(var(--spacing,0.25rem)*8))]');
        expect(column.className).not.toMatch(/(^|\s)px-2(\s|$)/);
    });

    it('the editable area keeps 2rem unless the token is set', () => {
        const css = readFileSync(path.resolve(process.cwd(), 'src/styles/index.css'), 'utf8');
        expect(css).toContain('padding: var(--inscript-padding, 2rem);');
    });

    it('a theme sets both variables on the editor', () => {
        const { container } = render(<Host theme={{ gutter: '4px', padding: '12px' }} />);
        const scoped = [...container.querySelectorAll('*')].find((node) => node.style?.getPropertyValue('--inscript-gutter'));
        expect(scoped.style.getPropertyValue('--inscript-gutter')).toBe('4px');
        expect(scoped.style.getPropertyValue('--inscript-padding')).toBe('12px');
    });
});
