import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Fragment } from '@tiptap/pm/model';

// Checklists also parse from the HTML that Markdown renderers produce for GFM task lists
// (`- [x] Book`), which is what the turndown rules write back. marked, markdown-it and GitHub
// render a plain list whose items start with a checkbox:
//   tight: <li><input type="checkbox" checked disabled> Book</li>
//   loose: <li><p><input type="checkbox"> Book</p></li>
//   GitHub adds ul.contains-task-list > li.task-list-item, same shape.
// A list that declares itself a task list (`ul[data-type="taskList"]`) makes every `li` in it a
// task item, with or without `data-type="taskItem"`: officeParser's editor-bound HTML wrote
//   <li data-checked="true"><label><input type="checkbox" checked><span></span></label><div>…</div></li>
// and TipTap's own rule (`li[data-type="taskItem"]`) skipped those, leaving an empty task item
// followed by a plain bullet list and losing the checked state.
// An empty task item at the very end of a Markdown file is written `- [ ]`, and Markdown trims
// the space after the brackets a renderer needs to see a checkbox, so it arrives as an item whose
// whole text is `[ ]` (or `[x]`): that is read as an empty task item too.
// Only the parse rules are added; what getHTML() emits is unchanged (the data-type shape).

const TASK_LIST_TYPE = 'taskList';
const DATA_TYPE = 'data-type';
const DATA_CHECKED = 'data-checked';

const isBlankText = node => node.nodeType === 3 && !/\S/.test(node.nodeValue);

/** The first meaningful child of `el`, skipping whitespace-only text. */
function firstMeaningfulChild(el) {
    for (const child of el.childNodes) {
        if (!isBlankText(child)) return child;
    }
    return null;
}

const isCheckbox = node => node?.nodeName === 'INPUT' && (node.getAttribute('type') || '').toLowerCase() === 'checkbox';

/** The GFM task checkbox that opens this list item (tight or loose), or null. */
export function gfmTaskCheckbox(li) {
    const first = firstMeaningfulChild(li);
    if (isCheckbox(first)) return first;
    if (first?.nodeName === 'P') {
        const inner = firstMeaningfulChild(first);
        if (isCheckbox(inner)) return inner;
    }
    return null;
}

/** The checkbox inside a task item's own <label> (TipTap's and officeParser's shape), or null. */
function labelledCheckbox(li) {
    for (const child of li.children) {
        if (child.nodeName !== 'LABEL') continue;
        const input = Array.from(child.children).find(isCheckbox);
        if (input) return input;
    }
    return null;
}

const BARE_TASK_MARKER = /^\s*\[([ xX])\]\s*$/;

/**
 * 'checked' / 'unchecked' for an item that is nothing but a task marker as text (`<li>[ ]</li>`,
 * `<li><p>[x]</p></li>`), otherwise null.
 */
export function bareTaskMarker(li) {
    const children = Array.from(li.children);
    if (children.length > 1) return null;
    if (children.length === 1 && (children[0].nodeName !== 'P' || children[0].children.length > 0)) return null;
    const match = BARE_TASK_MARKER.exec(li.textContent || '');
    if (!match) return null;
    return match[1] === ' ' ? 'unchecked' : 'checked';
}

const opensWithTaskMarker = li => gfmTaskCheckbox(li) !== null || bareTaskMarker(li) !== null;

/** A list that declares itself a task list, whatever its items look like. */
const isDeclaredTaskList = list => list?.nodeName === 'UL' && list.getAttribute(DATA_TYPE) === TASK_LIST_TYPE;

const isChecked = checkbox => checkbox.hasAttribute('checked') || checkbox.checked === true;

/** A list is a GFM task list when every item opens with a checkbox (the editor can't mix). */
function isGfmTaskList(list) {
    const items = Array.from(list.children).filter(child => child.nodeName === 'LI');
    return items.length > 0 && items.every(opensWithTaskMarker);
}

export const InscriptTaskList = TaskList.extend({
    parseHTML() {
        return [
            ...(this.parent?.() ?? []),
            // Above the plain bullet/ordered list rules (priority 50), only for all-task lists.
            { tag: 'ul', priority: 51, getAttrs: node => (isGfmTaskList(node) ? null : false) },
            { tag: 'ol', priority: 51, getAttrs: node => (isGfmTaskList(node) ? null : false) },
        ];
    },
});

export const InscriptTaskItem = TaskItem.extend({
    addAttributes() {
        const parent = this.parent?.() ?? {};
        return {
            ...parent,
            checked: {
                ...parent.checked,
                // data-checked wins (the editor's own shape); otherwise read the item's checkbox,
                // the GFM one that opens it or the one in its <label>.
                parseHTML: element => {
                    if (element.hasAttribute(DATA_CHECKED)) {
                        const dataChecked = element.getAttribute(DATA_CHECKED);
                        return dataChecked === '' || dataChecked === 'true';
                    }
                    const checkbox = gfmTaskCheckbox(element) ?? labelledCheckbox(element);
                    if (checkbox) return isChecked(checkbox);
                    return bareTaskMarker(element) === 'checked';
                },
            },
        };
    },

    parseHTML() {
        return [
            ...(this.parent?.() ?? []),
            // An item that is only a task marker as text: an empty task item (its text is the marker).
            {
                tag: 'li',
                priority: 52,
                getAttrs: node => (bareTaskMarker(node) && node.parentElement && isGfmTaskList(node.parentElement) ? null : false),
                getContent: (node, schema) => Fragment.from(schema.nodes.paragraph.create()),
            },
            // Only inside a list this extension claimed as a task list, so a stray checkbox item
            // in an ordinary list stays an ordinary list item.
            {
                tag: 'li',
                priority: 51,
                getAttrs: node => (gfmTaskCheckbox(node) && node.parentElement && isGfmTaskList(node.parentElement) ? null : false),
            },
            // Any item of a declared task list, even without data-type="taskItem".
            {
                tag: 'li',
                priority: 51,
                getAttrs: node => (isDeclaredTaskList(node.parentElement) ? null : false),
            },
        ];
    },
});
