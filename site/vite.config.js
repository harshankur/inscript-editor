import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';

const root = import.meta.dirname;

// Standalone site/demo app for GitHub Pages. It imports the library from source so the
// demo always reflects the repo, and the compiled dist stylesheet for the editor's look.
export default {
    root,
    base: './',                        // relative asset URLs → works at any Pages mount path
    plugins: [react()],
    server: { port: 5210, fs: { strict: false } },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: resolve(root, 'index.html'),
                embed: resolve(root, 'embed.html'),
            },
        },
    },
};
