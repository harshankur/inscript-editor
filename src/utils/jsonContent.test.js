import { describe, expect, it } from 'vitest';
import { mapJsonNodes } from './jsonContent.js';

describe('mapJsonNodes', () => {
    it('gives the content itself when nothing changes, and copies only the way to a change', () => {
        const kept = { type: 'paragraph' };
        const changed = { type: 'heading' };
        const content = { type: 'doc', content: [kept, { type: 'blockquote', content: [changed] }] };
        expect(mapJsonNodes(content, node => node)).toBe(content);
        const out = mapJsonNodes(content, node => (node === changed ? { type: 'paragraph' } : node));
        expect(out).not.toBe(content);
        expect(out.content[0]).toBe(kept);
        expect(out.content[1].content[0]).toEqual({ type: 'paragraph' });
    });

    it('leaves out a node given null, and visits children before their parent', () => {
        const order = [];
        const out = mapJsonNodes({ type: 'doc', content: [{ type: 'image' }, { type: 'p' }] }, node => {
            order.push(node.type);
            return node.type === 'image' ? null : node;
        });
        expect(out.content).toEqual([{ type: 'p' }]);
        expect(order).toEqual(['image', 'p', 'doc']);
    });
});
