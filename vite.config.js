import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    build: {
        lib: {
            entry: path.resolve(__dirname, 'src/index.js'),
            formats: ['es', 'cjs'],
            // The package sets "type": "module", so a CJS file named *.cjs.js would be
            // parsed as ESM by Node regardless of its contents (extension wins over
            // package "type" only for .mjs/.cjs) — use the real .cjs extension so
            // require()-based consumers don't hit "exports is not defined".
            fileName: (fmt) => fmt === 'cjs' ? 'inscript-editor.cjs' : `inscript-editor.${fmt}.js`,
        },
        rollupOptions: {
            external: [
                'react',
                'react-dom',
                'react/jsx-runtime',
                /^@tiptap\/.*/,
                /^@floating-ui\/.*/,
                'lucide-react',
                'diff',
                'react-i18next',
                'i18next',
                // Code highlighting engine — required peer, needed synchronously at
                // schema-build time, so kept external rather than bundled.
                'lowlight',
                // Heavy OPTIONAL peers, dynamically imported inside their node views
                // (Math.jsx / Mermaid.jsx). External so the runtime import() resolves
                // against the consumer's install and they never bloat this bundle.
                'katex',
                /^katex\/.*/,
                'mermaid',
            ],
            output: {
                assetFileNames: 'styles/inscript-editor[extname]',
            },
        },
        cssCodeSplit: false,
    },
});
