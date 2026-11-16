import { DIVIDER } from './toolRegistry.js';

/**
 * A toolbar or menu config with the tools this editor cannot show left out (a feature the host
 * turned off), and with each group they empty, the divider that set it off: no empty group shows
 * for them. Dividers the layout itself places (at an end, or side by side) stay, as laid out.
 * @param {string[]} config - Tool ids and DIVIDER.
 * @param {(id: string) => boolean} shows - Whether this editor shows the tool.
 * @returns {string[]}
 */
export function slotsWithoutStrayDividers(config, shows) {
    // The groups between dividers; divider k sits between group k and group k + 1.
    const groups = [[]];
    for (const entry of config) {
        if (entry === DIVIDER) groups.push([]);
        else groups[groups.length - 1].push(entry);
    }
    const shown = groups.map(group => group.filter(shows));
    const dropped = new Set();
    groups.forEach((group, k) => {
        if (group.length === 0 || shown[k].length > 0) return;
        // A group emptied by a hidden tool goes with the divider before it, or else the one after.
        if (k > 0 && !dropped.has(k - 1)) dropped.add(k - 1);
        else if (k < groups.length - 1) dropped.add(k);
    });
    // No tool at all: nothing, not a bar or menu of dividers.
    if (!shown.some(group => group.length > 0)) return [];
    const slots = [];
    shown.forEach((group, k) => {
        slots.push(...group);
        if (k < groups.length - 1 && !dropped.has(k)) slots.push(DIVIDER);
    });
    // Nor one at an end the layout did not put there (left by a group emptied next to a double).
    if (config[0] !== DIVIDER) while (slots[0] === DIVIDER) slots.shift();
    if (config[config.length - 1] !== DIVIDER) while (slots[slots.length - 1] === DIVIDER) slots.pop();
    return slots;
}
