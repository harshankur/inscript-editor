import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '../../dist');
const distExists = fs.existsSync(DIST_DIR);
const maybeDescribe = distExists ? describe : describe.skip;

// Mirrors every named export from src/index.js.
const PUBLIC_SYMBOLS = [
    'useInscriptEditor',
    'InscriptEditor',
    'Youtube',
    'FontSize',
    'CustomTable',
    'CustomImage',
    'getTableNode',
    'isHeaderRowActive',
    'isHeaderColumnActive',
    'setTableLayout',
    'getTextContent',
    'extractYoutubeId',
    'ToolbarButton',
    'TOOLBAR_SIZES',
    'ToolbarDropdown',
    'ToolbarCustomizer',
    'TOOL_REGISTRY',
    'DIVIDER',
    'TOOLBAR_PRESETS',
    'PRESET_LABELS',
    'BUBBLE_PRESETS',
    'ColorSelector',
    'FontSizeSelector',
    'LinkSelector',
    'ResponsiveToolbar',
    'ImageSelectorModal',
    'YoutubeEmbedModal',
    'HistoryView',
    'MiniMap',
    'BibliographyPanel',
    'Citation',
    'TextBubbleMenu',
    'TableBubbleMenu',
    'ImageBubbleMenu',
    'YoutubeBubbleMenu',
];

maybeDescribe('dist build output', () => {
    it('the ES build exposes every public symbol', async () => {
        const mod = await import(path.join(DIST_DIR, 'inscript-editor.es.js'));
        for (const symbol of PUBLIC_SYMBOLS) {
            expect(mod[symbol], `missing ES export: ${symbol}`).toBeDefined();
        }
    });

    it('the CJS build exposes every public symbol', () => {
        const require = createRequire(import.meta.url);
        const mod = require(path.join(DIST_DIR, 'inscript-editor.cjs'));
        for (const symbol of PUBLIC_SYMBOLS) {
            expect(mod[symbol], `missing CJS export: ${symbol}`).toBeDefined();
        }
    });

    it('ships a compiled stylesheet with no leftover @apply directives', () => {
        const cssPath = path.join(DIST_DIR, 'styles', 'inscript-editor.css');
        expect(fs.existsSync(cssPath)).toBe(true);
        const css = fs.readFileSync(cssPath, 'utf-8');
        expect(css).not.toContain('@apply');
        // Sentinel: a class every consumer relies on for editor content styling.
        expect(css).toContain('.ProseMirror');
    });

    it('the ./locales subpath export resolves and provides the registration API', async () => {
        const mod = await import('../../src/locales/index.js');
        expect(typeof mod.registerInscriptEditorTranslations).toBe('function');
        expect(mod.inscriptEditorTranslations.en.undo).toBe('Undo');
    });
});
