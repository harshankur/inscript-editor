// A host's saved toolbar layout that was a preset follows that preset, given the release it was saved with.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderHost, stubClientWidth, flush } from './harness.jsx';
import { TOOLBAR_PRESET_HISTORY } from '../../src/toolbar/presetHistory.js';

afterEach(() => vi.restoreAllMocks());

describe('<InscriptEditor configSavedWith>', () => {
    it('shows a layout saved as Full in 0.10.0 as Full is today (Inline Math included)', async () => {
        stubClientWidth(4000);
        const old = [...TOOLBAR_PRESET_HISTORY.full.find(shape => shape.since === '0.10.0').tools];
        renderHost({ initialContent: '<p>x</p>' }, { toolbarConfig: old, configSavedWith: '0.10.0', onToolbarConfigChange: () => {} });
        await flush();
        expect(screen.getByTitle('Inline Math')).toBeTruthy();
    });

    it('shows it as saved without the release', async () => {
        stubClientWidth(4000);
        const old = [...TOOLBAR_PRESET_HISTORY.full.find(shape => shape.since === '0.10.0').tools];
        renderHost({ initialContent: '<p>x</p>' }, { toolbarConfig: old, onToolbarConfigChange: () => {} });
        await flush();
        expect(screen.queryByTitle('Inline Math')).toBeNull();
    });
});
