// The public API contract: every runtime export of src/index.js is declared in src/types.d.ts
// and every declared value exists at runtime, and a few declared shapes match the runtime.
import fs from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Extension, Mark, Node } from '@tiptap/core';
import * as api from '../../src/index.js';

vi.mock('@tiptap/react/menus', () => ({ BubbleMenu: () => null, FloatingMenu: () => null }));

const types = fs.readFileSync(path.resolve(process.cwd(), 'src/types.d.ts'), 'utf8');
const declaredValues = new Set();
for (const m of types.matchAll(/^export\s+(?:declare\s+)?(?:const|function|class|let|var)\s+([A-Za-z0-9_$]+)/gm)) declaredValues.add(m[1]);
for (const m of types.matchAll(/^export\s*\{([^}]*)\}/gm)) m[1].split(',').map(s => s.trim().split(/\s+as\s+/).pop()).filter(Boolean).forEach(n => declaredValues.add(n));

describe('exports vs types.d.ts', () => {
    const runtime = Object.keys(api).filter(k => k !== 'default');
    it('every runtime export is declared', () => {
        expect(runtime.filter(n => !declaredValues.has(n))).toEqual([]);
    });
    it('every declared value is exported at runtime', () => {
        expect([...declaredValues].filter(n => !(n in api))).toEqual([]);
    });
    it('declared extension kinds match the runtime (Node / Mark / Extension)', () => {
        const kinds = {};
        for (const m of types.matchAll(/^export const (\w+): import\('@tiptap\/core'\)\.(Node|Mark|Extension);/gm)) kinds[m[1]] = m[2];
        const actual = Object.fromEntries(Object.keys(kinds).map(k => [k, api[k] instanceof Node ? 'Node' : api[k] instanceof Mark ? 'Mark' : api[k] instanceof Extension ? 'Extension' : '?']));
        expect(actual).toEqual(kinds);
    });
});

describe('ToolbarDropdown used as its declared type says', () => {
    it('an item with onClick (the declared field) is called when picked', () => {
        const onClick = vi.fn();
        render(<api.ToolbarDropdown title="Pick" items={[{ id: 'a', label: 'Alpha', onClick }]} />);
        fireEvent.click(screen.getByTitle('Pick'));
        expect(() => fireEvent.click(screen.getByText('Alpha'))).not.toThrow();
        expect(onClick).toHaveBeenCalled();
    });
});

describe('component props used at runtime are declared', () => {
    const src = (f) => fs.readFileSync(path.resolve(process.cwd(), f), 'utf8');
    it.each([
        ['TextBubbleMenu', 'src/components/bubble-menus/TextBubbleMenu.jsx'],
        ['YoutubeBubbleMenu', 'src/components/bubble-menus/YoutubeBubbleMenu.jsx'],
        ['EmbedBubbleMenu', 'src/components/bubble-menus/EmbedBubbleMenu.jsx'],
        ['HighlightSelector', 'src/components/HighlightSelector.jsx'],
        ['LinkSelector', 'src/components/LinkSelector.jsx'],
        ['ImageSelectorModal', 'src/components/ImageSelectorModal.jsx'],
    ])('%s', (name, file) => {
        const m = new RegExp(`export const ${name} = \\(\\{([^}]*)\\}`).exec(src(file));
        const props = m[1].split(',').map(s => s.trim().split(/[\s=:]/)[0]).filter(Boolean);
        let decl = new RegExp(`export const ${name}: \\(props: ([\\s\\S]*?)\\) => ReactNode;`).exec(types)[1];
        // Props shared through a named interface (BubbleMenuBaseProps) count as declared too.
        for (const iface of decl.match(/\b[A-Z]\w*Props\b/g) || []) {
            const body = new RegExp(`interface ${iface} \\{([\\s\\S]*?)\\n\\}`).exec(types);
            if (body) decl += body[1];
        }
        expect(props.filter(p => !new RegExp(`\\b${p}\\??:`).test(decl))).toEqual([]);
    });
});
