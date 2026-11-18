import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { InscriptTrans } from './InscriptTrans.jsx';

const uninitialized = () => createInstance({ react: { useSuspense: false } });
const within = (i18n, node) => render(<I18nextProvider i18n={i18n}>{node}</I18nextProvider>).container;

describe('InscriptTrans with an i18next not initialized yet', () => {
    it('shows its children as they are, placeholders filled', () => {
        const container = within(uninitialized(), <InscriptTrans i18nKey="x" values={{ name: 'Ada' }}>Hello {'{{name}}'}, <b>welcome</b>.</InscriptTrans>);
        expect(container.textContent).toBe('Hello Ada, welcome.');
        expect(container.querySelector('b').textContent).toBe('welcome');
    });

    it('shows `defaults` when it has no children', () => {
        const container = within(uninitialized(), <InscriptTrans i18nKey="x" defaults="Saved {{count}} files" values={{ count: 3 }} />);
        expect(container.textContent).toBe('Saved 3 files');
    });
});

describe('InscriptTrans fallback, as <Trans> shows it', () => {
    it('makes `defaults` tags into their components', () => {
        const container = within(uninitialized(), <InscriptTrans i18nKey="x" defaults="Use the <1>Direct Link</1> tab, {{name}}" components={{ 1: <b /> }} values={{ name: 'Ada' }} />);
        expect(container.textContent).toBe('Use the Direct Link tab, Ada');
        expect(container.querySelector('b').textContent).toBe('Direct Link');
    });

    it('fills placeholders inside nested elements, and object children as <Trans> does', () => {
        const name = 'Ada';
        const container = within(uninitialized(), <InscriptTrans i18nKey="y" values={{ n: 2 }}><b>{'{{n}}'} items</b></InscriptTrans>);
        expect(container.textContent).toBe('2 items');
        const greeting = within(uninitialized(), <InscriptTrans i18nKey="z">Hello <b>{{ name }}</b></InscriptTrans>);
        expect(greeting.textContent).toBe('Hello Ada');
    });

    it('reads the editor\'s own English for a key it ships', () => {
        const container = within(uninitialized(), <InscriptTrans i18nKey="experimentalFeatureDescription" components={{ 1: <b /> }} />);
        expect(container.querySelector('b').textContent).toBe('Direct Link');
    });
});

describe('InscriptTrans values', () => {
    it('keeps a value as text, never a component\'s tag', () => {
        const container = within(uninitialized(), <InscriptTrans i18nKey="x" defaults="Open {{name}} <1>now</1>" components={{ 1: <b /> }} values={{ name: '<1>click</1>' }} />);
        expect(container.textContent).toBe('Open <1>click</1> now');
        expect(container.querySelectorAll('b')).toHaveLength(1);
    });
});

describe('InscriptTrans with a host i18next that does not escape', () => {
    it('keeps a value as text, never a component\'s tag', async () => {
        const host = createInstance();
        await host.init({ lng: 'en', interpolation: { escapeValue: false }, resources: { en: { 'inscript-editor': { open: 'Open {{name}} <1>now</1>' } } } });
        const container = within(host, <InscriptTrans i18nKey="open" components={{ 1: <b /> }} values={{ name: '<1>click</1>' }} />);
        expect(container.textContent).toBe('Open <1>click</1> now');
        expect(container.querySelectorAll('b')).toHaveLength(1);
    });
});

describe('InscriptTrans on the installed react-i18next', () => {
    it('sets no option that react-i18next warns is ignored', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            const host = createInstance();
            await host.init({ lng: 'en', debug: true, resources: { en: { 'inscript-editor': { open: 'Open {{name}} &amp; <1>now</1>' } } } });
            const container = within(host, <InscriptTrans i18nKey="open" components={{ 1: <b /> }} values={{ name: 'Tom & Jerry' }} />);
            expect(container.textContent).toBe('Open Tom & Jerry & now');
            expect(warn.mock.calls.flat().join(' ')).not.toMatch(/shouldUnescape|DEPRECATED_OPTION/);
        } finally {
            warn.mockRestore();
        }
    });
});
