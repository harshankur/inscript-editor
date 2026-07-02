import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../src/locales/en.json';
import { INSCRIPT_EDITOR_NAMESPACE } from '../src/locales/index.js';

afterEach(() => {
    cleanup();
});

// Real `en` bundle under the library's namespace, so `t()` resolves actual
// strings in tests instead of falling back to raw keys/defaultValues only.
i18next.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    ns: [INSCRIPT_EDITOR_NAMESPACE],
    defaultNS: INSCRIPT_EDITOR_NAMESPACE,
    resources: {
        en: { [INSCRIPT_EDITOR_NAMESPACE]: en },
    },
    interpolation: { escapeValue: false },
});

// --- ResizeObserver mock with an instance registry, so tests can drive resize
// callbacks manually (e.g. ResponsiveToolbar overflow tests). ---
class ResizeObserverMock {
    static instances = [];

    constructor(callback) {
        this.callback = callback;
        this.observed = new Set();
        ResizeObserverMock.instances.push(this);
    }

    observe(target) {
        this.observed.add(target);
    }

    unobserve(target) {
        this.observed.delete(target);
    }

    disconnect() {
        this.observed.clear();
        const idx = ResizeObserverMock.instances.indexOf(this);
        if (idx !== -1) ResizeObserverMock.instances.splice(idx, 1);
    }

    trigger(entries = []) {
        this.callback(entries, this);
    }
}

globalThis.ResizeObserver = ResizeObserverMock;

// --- ProseMirror-in-jsdom shims ---
// jsdom doesn't implement layout, so ProseMirror's view code (which measures
// selection/DOM rects to position cursors and decorations) needs these stubbed.
if (typeof document.elementFromPoint !== 'function') {
    document.elementFromPoint = () => null;
}

Range.prototype.getBoundingClientRect = () => ({
    top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() { return this; },
});

Range.prototype.getClientRects = () => ({
    length: 0,
    item: () => null,
    [Symbol.iterator]: function* () {},
});

if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
}

if (!window.matchMedia) {
    window.matchMedia = (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    });
}
