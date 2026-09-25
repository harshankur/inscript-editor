#!/usr/bin/env node
// Splits out the .ProseMirror rules from the standalone Tailwind build.
//
// The standalone bundle (dist/styles/inscript-editor.css) is a full,
// self-contained Tailwind build (reset + theme tokens + utilities) meant for
// consumers that don't already run their own Tailwind pipeline. An app that
// already builds Tailwind itself (like the Inscript CMS) must NOT also import
// that full bundle: two independently-generated `utilities` layers merged
// into one stylesheet tie-break on source order, so a plain `.hidden` or
// `.fixed` declared later in one bundle silently beats a `dark:`/`md:` variant
// declared earlier in the other. Importing only the custom `.ProseMirror`
// rules (which resolve against the host app's own theme CSS variables) avoids
// that collision entirely, so the host app's classes always win.
//
// The build runs this through the Vite plugin in scripts/vite-plugin-dist.js, on every build
// and every `vite build --watch` rebuild. Run directly, it re-extracts from an existing
// dist/styles/inscript-editor.css.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import postcss from 'postcss';
import { writeFileAtomic } from './write-file-atomic.js';

/**
 * The content-only stylesheet (dist/styles/content.css) for the full bundle's CSS.
 *
 * @param {string} css - The compiled dist/styles/inscript-editor.css.
 * @returns {{ css: string, count: number }} The extracted stylesheet and its top-level node count.
 */
export function extractContentStyles(css) {
    const root = postcss.parse(css);
    const extracted = postcss.root();

    // Keep the content rules (.ProseMirror*), the editor scope/container rules
    // (.inscript-editor*), and any rule that defines the theme tokens (the :root /
    // .dark blocks that set --inscript-* custom properties). Without the token rules
    // the content route would render with no colors/surfaces; without the container
    // rule it would lose max-width. Tailwind's own :root theme block (which defines
    // --color-* / --spacing, not --inscript-*) is deliberately not matched.
    root.walkRules(rule => {
        const sel = rule.selector;
        const definesToken = rule.some(node => node.type === 'decl' && node.prop && node.prop.startsWith('--inscript-'));
        if (sel.includes('ProseMirror') || sel.includes('inscript-editor') || definesToken) {
            extracted.append(rule.clone());
        }
    });

    // @keyframes are at-rules, which walkRules never visits (and their `to {}` steps don't match
    // the selector filter), so an extracted `animation` would point at nothing: the gap cursor
    // didn't blink on the content route. Copy every @keyframes an extracted rule animates with,
    // plus any inscript/ProseMirror one.
    const animated = new Set();
    extracted.walkDecls(/^animation(-name)?$/, decl => {
        for (const token of decl.value.split(/[\s,]+/)) if (token) animated.add(token);
    });
    root.walkAtRules(/^(-webkit-)?keyframes$/, atRule => {
        const name = atRule.params.trim();
        if (animated.has(name) || /^(ProseMirror|inscript)-/.test(name)) {
            extracted.append(atRule.clone());
        }
    });

    if (extracted.nodes.length === 0) {
        throw new Error('extract-content-styles: no .ProseMirror rules found in the compiled stylesheet');
    }
    return { css: extracted.toString() + '\n', count: extracted.nodes.length };
}

// Run directly: re-extract from the built bundle.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/styles');
    const { css, count } = extractContentStyles(readFileSync(path.join(dir, 'inscript-editor.css'), 'utf8'));
    const outputPath = path.join(dir, 'content.css');
    writeFileAtomic(outputPath, css);
    console.log(`extract-content-styles: wrote ${count} rules to ${path.relative(process.cwd(), outputPath)}`);
}
