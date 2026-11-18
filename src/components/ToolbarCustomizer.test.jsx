import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { ToolbarCustomizer } from './ToolbarCustomizer.jsx';

describe('ToolbarCustomizer containment', () => {
    afterEach(() => vi.restoreAllMocks());

    it('covers the viewport (fixed) by default', () => {
        const { container } = render(
            <ToolbarCustomizer currentConfig={['bold']} onSave={() => {}} onClose={() => {}} />,
        );
        const backdrop = container.querySelector('.inset-0.z-\\[80\\]');
        expect(backdrop).not.toBeNull();
        expect(backdrop.className).toContain('fixed');
        expect(backdrop.className).not.toContain('absolute');
    });

    it('renders into and scopes to a container element (absolute) when provided', () => {
        const host = document.createElement('div');
        document.body.appendChild(host);

        const { container } = render(
            <ToolbarCustomizer currentConfig={['bold']} onSave={() => {}} onClose={() => {}} container={host} />,
        );

        // Portaled out of the React tree into the host element.
        expect(container.querySelector('.z-\\[80\\]')).toBeNull();
        const backdrop = host.querySelector('.inset-0.z-\\[80\\]');
        expect(backdrop).not.toBeNull();
        expect(backdrop.className).toContain('absolute');
        expect(backdrop.className).not.toContain('fixed');

        host.remove();
    });
});

describe('ToolbarCustomizer drawer layer', () => {
    it('is scrolled nowhere while the drawer slides in: the drawer stays at its edge', () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        render(<ToolbarCustomizer currentConfig={['bold']} onSave={() => {}} onClose={() => {}} container={host} />);
        const layer = host.querySelector('.inset-0.z-\\[80\\]');
        // As an engine does while the drawer is still out of view (by script, focus, or bringing
        // something into view): the layer scrolled by more than the drawer's width.
        layer.scrollLeft = 1000;
        layer.scrollTop = 50;
        layer.dispatchEvent(new Event('scroll'));
        expect(layer.scrollLeft).toBe(0);
        expect(layer.scrollTop).toBe(0);
        host.remove();
    });

    it('clips the drawer to the layer, never giving it a scroll position (clip, hidden where clip is unknown)', async () => {
        const { readFileSync } = await import('node:fs');
        const { resolve } = await import('node:path');
        const css = readFileSync(resolve(process.cwd(), 'src/styles/index.css'), 'utf8');
        const flat = css.replace(/\s+/g, ' ');
        expect(flat).toContain('.inscript-editor-customizer-layer { overflow: hidden; }');
        expect(flat).toContain('@supports (overflow: clip) { .inscript-editor-customizer-layer { overflow: clip; } }');
    });
});
