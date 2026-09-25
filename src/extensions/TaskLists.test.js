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
