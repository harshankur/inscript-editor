import { TOOL_REGISTRY } from './toolRegistry.js';
import { slotsWithoutStrayDividers } from './slotsWithoutStrayDividers.js';

/**
 * Can this editor show the tool? A tool whose node or mark the host turned off (its registry
 * entry's `requires`: `editorOptions.keyboardInput: false`, `details: false`) cannot. Every other
 * tool can.
 * @param {import('@tiptap/core').Editor|null|undefined} editor
 * @param {string} id
 * @returns {boolean}
 */
export function toolIsAvailable(editor, id) {
    const needs = TOOL_REGISTRY[id]?.requires;
    if (!needs || !editor) return true;
    return needs.mark ? !!editor.schema.marks[needs.mark] : !!editor.schema.nodes[needs.node];
}

/** The tool ids this editor cannot show. */
export const unavailableToolIds = editor => Object.keys(TOOL_REGISTRY).filter(id => !toolIsAvailable(editor, id));

/**
 * The slots of a toolbar or menu config this editor shows: tools it has an entry for and can show,
 * with the dividers that leaves stranded dropped.
 * @param {string[]} config
 * @param {Record<string, unknown>} toolMap
 * @param {import('@tiptap/core').Editor|null|undefined} editor
 * @returns {string[]}
 */
export const visibleSlots = (config, toolMap, editor) => slotsWithoutStrayDividers(config, id => !!toolMap[id] && toolIsAvailable(editor, id));
