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
