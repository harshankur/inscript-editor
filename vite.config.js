import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    build: {
        lib: {
            entry: path.resolve(__dirname, 'src/index.js'),
            formats: ['es', 'cjs'],
            fileName: (fmt) => `inscript-editor.${fmt}.js`,
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
            ],
            output: {
                assetFileNames: 'styles/inscript-editor[extname]',
            },
        },
        cssCodeSplit: false,
    },
});
