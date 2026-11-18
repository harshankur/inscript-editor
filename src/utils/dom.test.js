import { describe, expect, it } from 'vitest';
import { childrenMoved, htmlInteger, isHandlerAttribute } from './dom.js';

describe('dom helpers', () => {
    it('htmlInteger reads leading digits as a browser does, and a percent after them', () => {
        expect(htmlInteger(' +12px')).toEqual({ value: 12, percent: false });
        expect(htmlInteger('50%')).toEqual({ value: 50, percent: true });
        expect(htmlInteger('1e5')).toEqual({ value: 1, percent: false });
        expect(htmlInteger('abc')).toBeNull();
        expect(htmlInteger(null)).toBeNull();
    });

    it('isHandlerAttribute knows a handler by its name or local name, whatever its prefix', () => {
        expect(isHandlerAttribute({ name: 'onload' })).toBe(true);
        expect(isHandlerAttribute({ name: 'xlink:onclick', localName: 'onclick' })).toBe(true);
        expect(isHandlerAttribute({ name: 'href' })).toBe(false);
    });

    it('childrenMoved moves every child into a fragment, in order', () => {
        const holder = document.createElement('div');
        holder.innerHTML = '<b>1</b>2<i>3</i>';
        const fragment = childrenMoved(holder);
        expect(holder.childNodes).toHaveLength(0);
        expect([...fragment.childNodes].map(node => node.textContent)).toEqual(['1', '2', '3']);
    });
});
