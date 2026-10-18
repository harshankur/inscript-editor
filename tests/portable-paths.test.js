// The suite runs in CI and on other machines: no source or test file may name a path that only
// exists on one machine (a home directory, a temp or scratch folder). A test that wrote its debug
// output to such a path passed locally and failed in CI.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['src', 'tests', 'scripts', 'site'];
const SKIP = new Set(['node_modules', 'dist']);
const MACHINE_PATH = /\/private\/tmp\/|\/Users\/[^/\s'"`]+\/|\/home\/[^/\s'"`]+\/|[A-Z]:\\\\Users\\\\|scratchpad/;

function files(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        if (SKIP.has(entry.name)) return [];
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return files(full);
        return /\.(jsx?|cjs|mjs|ts|html|css|json)$/.test(entry.name) ? [full] : [];
    });
}

describe('portable paths', () => {
    it('no source, test or site file names a machine-specific path', () => {
        const offenders = [];
        for (const dir of DIRS) {
            for (const file of files(path.join(ROOT, dir))) {
                if (file === fileURLToPath(import.meta.url)) continue;
                fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
                    if (MACHINE_PATH.test(line)) offenders.push(`${path.relative(ROOT, file)}:${i + 1}`);
                });
            }
        }
        expect(offenders).toEqual([]);
    });
});
