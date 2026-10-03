import { afterEach, describe, expect, it } from 'vitest';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { createEditor } from '../../tests/helpers/createEditor.js';
import { applyInscriptEditorTurndownRules } from '../markdown/turndownRules.js';

describe('task lists from GFM-rendered HTML', () => {
    let editor;
    afterEach(() => editor?.destroy());

    const items = ed => {
        const found = [];
        ed.state.doc.descendants(n => { if (n.type.name === 'taskItem') found.push([n.textContent, n.attrs.checked]); });
        return found;
    };

    it('reads a tight marked/GitHub task list as a checklist', () => {
        editor = createEditor({ content: '<ul>\n<li><input checked="" disabled="" type="checkbox"> Book</li>\n<li><input disabled="" type="checkbox"> Room</li>\n</ul>' });
        expect(editor.state.doc.firstChild.type.name).toBe('taskList');
        expect(items(editor)).toEqual([['Book', true], ['Room', false]]);
        expect(editor.getHTML()).toContain('data-type="taskList"');
        expect(editor.getHTML()).not.toContain('disabled');
    });

    it('reads a loose task list (checkbox inside the paragraph)', () => {
        editor = createEditor({ content: '<ul><li><p><input type="checkbox" checked> Book</p></li><li><p><input type="checkbox"> Room</p></li></ul>' });
        expect(items(editor)).toEqual([['Book', true], ['Room', false]]);
    });

    it("reads GitHub's contains-task-list markup", () => {
        editor = createEditor({ content: '<ul class="contains-task-list"><li class="task-list-item"><input type="checkbox" class="task-list-item-checkbox" disabled checked> Ship</li></ul>' });
        expect(items(editor)).toEqual([['Ship', true]]);
    });

    it('leaves a list with some plain items as an ordinary list', () => {
        editor = createEditor({ content: '<ul><li><input type="checkbox"> Task</li><li>Plain</li></ul>' });
        expect(editor.state.doc.firstChild.type.name).toBe('bulletList');
    });

    // officeParser's editor-bound HTML: a declared task list whose items carry data-checked but no
    // data-type="taskItem". It used to load as one EMPTY task item plus a plain bullet list.
    it('reads items of a declared task list that lack data-type="taskItem", keeping their state', () => {
        editor = createEditor({ content: '<ul data-type="taskList">\n<li data-checked="false" style="text-align: left"><label><input type="checkbox"><span></span></label><div>open task</div></li>\n<li data-checked="true" style="text-align: left"><label><input type="checkbox" checked><span></span></label><div>done task</div></li></ul>' });
        expect(items(editor)).toEqual([['open task', false], ['done task', true]]);
        expect(editor.state.doc.firstChild.type.name).toBe('taskList');
        const types = [];
        editor.state.doc.descendants(n => { types.push(n.type.name); });
        expect(types).not.toContain('bulletList'); // no stray plain list holding the texts
        // Serialized in the editor's own shape, so the next load needs no special handling.
        expect(editor.getHTML()).toContain('<ul data-type="taskList"><li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>open task</p></div></li><li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>done task</p></div></li></ul>');
    });

    it('reads the checked state from the label checkbox when data-checked is absent too', () => {
        editor = createEditor({ content: '<ul data-type="taskList"><li><label><input type="checkbox" checked><span></span></label><div>done</div></li><li><label><input type="checkbox"><span></span></label><div>open</div></li><li><div>bare</div></li></ul>' });
        expect(items(editor)).toEqual([['done', true], ['open', false], ['bare', false]]);
    });

    it('lets data-checked win over the checkbox inside the item', () => {
        editor = createEditor({ content: '<ul data-type="taskList"><li data-checked="false"><label><input type="checkbox" checked><span></span></label><div>stated</div></li><li data-checked=""><label><input type="checkbox"><span></span></label><div>empty means checked</div></li></ul>' });
        expect(items(editor)).toEqual([['stated', false], ['empty means checked', true]]);
    });

    it('does not turn items of an ordinary list into task items', () => {
        editor = createEditor({ content: '<ul><li data-checked="true"><label><input type="checkbox" checked><span></span></label><div>not a task list</div></li></ul>' });
        expect(editor.state.doc.firstChild.type.name).toBe('bulletList');
        expect(items(editor)).toEqual([]);
    });

    it("still reads the editor's own data-type shape", () => {
        editor = createEditor({ content: '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>Done</p></li></ul>' });
        expect(items(editor)).toEqual([['Done', true]]);
    });

    it('round-trips a checklist through Markdown-rendered HTML', () => {
        editor = createEditor({ content: '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>Done</p></li><li data-type="taskItem" data-checked="false"><p>Todo</p></li></ul>' });
        const td = new TurndownService();
        td.use(gfm);
        applyInscriptEditorTurndownRules(td);
        expect(td.turndown(editor.getHTML())).toMatch(/\[x\] Done[\s\S]*\[ \] Todo/);
        // What marked renders for that Markdown (a loose list):
        editor.commands.setContent('<ul><li><p><input checked="" disabled="" type="checkbox"> Done</p></li><li><p><input disabled="" type="checkbox"> Todo</p></li></ul>');
        expect(items(editor)).toEqual([['Done', true], ['Todo', false]]);
    });

    it('is off with taskList: false (plain lists stay plain)', () => {
        editor = createEditor({ content: '<ul><li><input type="checkbox" checked> Book</li></ul>' }, { taskList: false });
        expect(editor.state.doc.firstChild.type.name).toBe('bulletList');
    });
});
