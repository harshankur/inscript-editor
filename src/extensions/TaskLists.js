import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';

// Checklists also parse from the HTML that Markdown renderers produce for GFM task lists
// (`- [x] Book`), which is what the turndown rules write back. marked, markdown-it and GitHub
// render a plain list whose items start with a checkbox:
//   tight: <li><input type="checkbox" checked disabled> Book</li>
//   loose: <li><p><input type="checkbox"> Book</p></li>
//   GitHub adds ul.contains-task-list > li.task-list-item, same shape.
// Only the parse rules are added; what getHTML() emits is unchanged (the data-type shape).

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

/** A list is a GFM task list when every item opens with a checkbox (the editor can't mix). */
function isGfmTaskList(list) {
    const items = Array.from(list.children).filter(child => child.nodeName === 'LI');
    return items.length > 0 && items.every(li => gfmTaskCheckbox(li) !== null);
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
                // data-checked wins (the editor's own shape); otherwise read the GFM checkbox.
                parseHTML: element => {
                    if (element.hasAttribute('data-checked')) {
                        const dataChecked = element.getAttribute('data-checked');
                        return dataChecked === '' || dataChecked === 'true';
                    }
                    const checkbox = gfmTaskCheckbox(element);
                    return checkbox ? checkbox.hasAttribute('checked') || checkbox.checked === true : false;
                },
            },
        };
    },

    parseHTML() {
        return [
            ...(this.parent?.() ?? []),
            // Only inside a list this extension claimed as a task list, so a stray checkbox item
            // in an ordinary list stays an ordinary list item.
            {
                tag: 'li',
                priority: 51,
                getAttrs: node => (gfmTaskCheckbox(node) && node.parentElement && isGfmTaskList(node.parentElement) ? null : false),
            },
        ];
    },
});
