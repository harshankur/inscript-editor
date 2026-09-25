import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { extractContentStyles } from '../../scripts/extract-content-styles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DIST_DIR = path.join(ROOT, 'dist');
const OUTPUTS = ['inscript-editor.es.js', 'inscript-editor.cjs', 'styles/inscript-editor.css', 'styles/content.css'];
const maybeDescribe = fs.existsSync(DIST_DIR) ? describe : describe.skip;

// Hosts link to this checkout's dist/ (a Vite alias, npm link) and read it at any moment, so a
// build must never leave an output missing or half-written, and content.css must come from the
// build itself (a separate script used to make it, which `npm run dev` never ran).
maybeDescribe('dist rebuilds', () => {
    it('content.css is exactly the extraction of the emitted stylesheet', () => {
        const full = fs.readFileSync(path.join(DIST_DIR, 'styles/inscript-editor.css'), 'utf8');
        expect(fs.readFileSync(path.join(DIST_DIR, 'styles/content.css'), 'utf8')).toBe(extractContentStyles(full).css);
    });

    it('leaves no temporary files behind', () => {
        const leftovers = [];
        const walk = dir => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                if (entry.isDirectory()) walk(path.join(dir, entry.name));
                else if (entry.name.endsWith('.tmp')) leftovers.push(entry.name);
            }
        };
        walk(DIST_DIR);
        expect(leftovers).toEqual([]);
    });
});

// Spawns a real `vite build --watch` into a temporary directory and touches a source file, so it
// only runs under `npm run test:dist` (not in `npm test` / prepublishOnly).
const watchDescribe = process.env.npm_lifecycle_event === 'test:dist' && fs.existsSync(DIST_DIR) ? describe : describe.skip;

watchDescribe('vite build --watch (npm run dev)', () => {
    // Inside the project (Vite only ever empties an outDir inside the root, so a regression back
    // to emptying would show here), under node_modules/.cache: gitignored and never scanned.
    const cacheDir = path.join(ROOT, 'node_modules/.cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    const outDir = fs.mkdtempSync(path.join(cacheDir, 'inscript-dist-watch-'));
    let child;
    let log = '';
    afterAll(() => {
        child?.kill();
        fs.rmSync(outDir, { recursive: true, force: true });
    });

    const builds = () => (log.match(/built in/g) || []).length;
    const waitFor = async (predicate, timeoutMs = 30000) => {
        const start = Date.now();
        while (!predicate()) {
            if (Date.now() - start > timeoutMs) throw new Error(`timed out; watcher log:\n${log}`);
            await new Promise(resolve => setTimeout(resolve, 20));
        }
    };

    it('emits content.css on its first build and keeps every output present through a rebuild', async () => {
        child = spawn(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'build', '--watch', '--outDir', outDir], {
            cwd: ROOT,
            // Vitest sets NODE_ENV=test, which builds a differently optimized stylesheet; a
            // developer's `npm run dev` runs with it unset (a production build).
            env: { ...process.env, NODE_ENV: 'production', FORCE_COLOR: '0' },
        });
        child.stdout.on('data', chunk => { log += chunk; });
        child.stderr.on('data', chunk => { log += chunk; });

        await waitFor(() => builds() > 0 && OUTPUTS.every(f => fs.existsSync(path.join(outDir, f))));
        // Same bytes as `npm run build` (which test:dist ran just before).
        expect(fs.readFileSync(path.join(outDir, 'styles/content.css'), 'utf8'))
            .toBe(fs.readFileSync(path.join(DIST_DIR, 'styles/content.css'), 'utf8'));

        // Let the first build settle, then trigger a rebuild and watch the outputs throughout.
        await new Promise(resolve => setTimeout(resolve, 500));
        const before = builds();
        const missing = new Set();
        let polling = true;
        const poll = (async () => {
            while (polling) {
                for (const f of OUTPUTS) {
                    const file = path.join(outDir, f);
                    if (!fs.existsSync(file) || fs.statSync(file).size === 0) missing.add(f);
                }
                await new Promise(resolve => setTimeout(resolve, 2));
            }
        })();
        const touched = path.join(ROOT, 'src/utils/theme.js');
        const now = new Date();
        fs.utimesSync(touched, now, now);
        await waitFor(() => builds() > before);
        await new Promise(resolve => setTimeout(resolve, 200));
        polling = false;
        await poll;

        expect([...missing]).toEqual([]);
        expect(fs.readFileSync(path.join(outDir, 'styles/content.css'), 'utf8'))
            .toBe(fs.readFileSync(path.join(DIST_DIR, 'styles/content.css'), 'utf8'));
    }, 60000);
});
