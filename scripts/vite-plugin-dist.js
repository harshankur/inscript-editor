import path from 'node:path';
import { extractContentStyles } from './extract-content-styles.js';
import { writeFileAtomic } from './write-file-atomic.js';

const FULL_CSS = 'styles/inscript-editor.css';
const CONTENT_CSS = 'styles/content.css';

/**
 * Keeps dist/ usable while it rebuilds, for hosts linked to this checkout (a Vite alias, `npm
 * link`, a `file:` dependency) that read it at any moment:
 *
 * - every output is written atomically (a temp file renamed into place), so a host never reads
 *   a missing or half-written bundle; the files are taken over from the bundler's own writer;
 * - dist/styles/content.css is produced by the build itself, from the stylesheet just emitted,
 *   so `vite build --watch` (`npm run dev`) keeps it current on every rebuild. It used to come
 *   from a separate script that only `npm run build` ran, so the watcher never rewrote it.
 *
 * Pair with `build.emptyOutDir: false` (the default empties dist/ at the start of every build).
 * Output names are stable, so overwriting in place leaves nothing stale; `npm run clean` empties
 * dist/ before publishing.
 */
export function inscriptDist() {
    let outDir = 'dist';
    return {
        name: 'inscript-editor:dist',
        apply: 'build',
        enforce: 'post',
        configResolved(config) {
            outDir = path.resolve(config.root, config.build.outDir);
        },
        generateBundle(outputOptions, bundle) {
            // With source maps the bundler also writes .map files and sourceMappingURL comments;
            // leave that output to it rather than reimplement it.
            if (outputOptions.sourcemap) return;
            const dir = outputOptions.dir ? path.resolve(outputOptions.dir) : outDir;
            for (const [fileName, output] of Object.entries(bundle)) {
                const data = output.type === 'chunk' ? output.code : output.source;
                writeFileAtomic(path.join(dir, fileName), data);
                if (fileName === FULL_CSS) {
                    const css = typeof data === 'string' ? data : Buffer.from(data).toString('utf8');
                    writeFileAtomic(path.join(dir, CONTENT_CSS), extractContentStyles(css).css);
                }
                delete bundle[fileName];
            }
        },
    };
}
