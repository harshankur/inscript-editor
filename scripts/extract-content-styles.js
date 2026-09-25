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
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import postcss from 'postcss';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inputPath = path.resolve(__dirname, '../dist/styles/inscript-editor.css');
const outputPath = path.resolve(__dirname, '../dist/styles/content.css');

const css = readFileSync(inputPath, 'utf8');
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
    throw new Error('extract-content-styles: no .ProseMirror rules found in ' + inputPath);
}

writeFileSync(outputPath, extracted.toString() + '\n');
console.log(`extract-content-styles: wrote ${extracted.nodes.length} rules to ${path.relative(process.cwd(), outputPath)}`);
