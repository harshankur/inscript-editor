import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { inscriptEditorTranslations } from '../src/locales/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, '../src');

function walk(dir) {
    let files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'locales') continue;
            files = files.concat(walk(full));
        } else if (/\.(jsx?|cjs)$/.test(entry.name) && !entry.name.endsWith('.test.js') && !entry.name.endsWith('.test.jsx')) {
            files.push(full);
        }
    }
    return files;
}

function extractKeys(source) {
    const keys = new Set();
    // t('key' ...) / t("key" ...)
    for (const m of source.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g)) {
        keys.add(m[1]);
    }
    // i18next.t('key', { ns: 'inscript-editor', ... })
    for (const m of source.matchAll(/i18next\.t\(\s*['"]([a-zA-Z0-9_.]+)['"]/g)) {
        keys.add(m[1]);
    }
    // <Trans i18nKey="key" ...>
    for (const m of source.matchAll(/i18nKey=["']([a-zA-Z0-9_.]+)["']/g)) {
        keys.add(m[1]);
    }
    return keys;
}

describe('i18n key coverage', () => {
    const en = inscriptEditorTranslations.en;
    const files = walk(SRC_DIR);
    const usedKeys = new Set();
    for (const file of files) {
        const source = fs.readFileSync(file, 'utf-8');
        for (const key of extractKeys(source)) usedKeys.add(key);
    }

    it('found t()/Trans usages to check (sanity: the scan itself works)', () => {
        expect(usedKeys.size).toBeGreaterThan(30);
    });

    it('every t()/Trans key referenced in src/ exists in en.json', () => {
        const missing = [...usedKeys].filter((key) => !(key in en));
        expect(missing).toEqual([]);
    });

    it('en.json has no empty string values', () => {
        const empties = Object.entries(en).filter(([, v]) => !v || !v.trim());
        expect(empties).toEqual([]);
    });
});
