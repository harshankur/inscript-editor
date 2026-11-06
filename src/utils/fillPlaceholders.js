/**
 * Fill `{{name}}` placeholders in a translated string. i18next does this itself once initialized;
 * before that react-i18next hands back the English default untouched, placeholders and all, so a
 * string built from values is filled here too. A nested name (`{{link.target}}`) is looked up in
 * the values; a format (`{{n, number}}`) is ignored and the value written as it is. A placeholder
 * with no value is left as it is.
 * @param {string} text
 * @param {Record<string, unknown>} values
 * @returns {string}
 */
export function fillPlaceholders(text, values) {
    return String(text).replace(/\{\{\s*([\w.]+)\s*(?:,[^}]*)?\}\}/g, (whole, path) => {
        let value = values;
        for (const part of path.split('.')) {
            if (value == null || typeof value !== 'object' || !(part in value)) return whole;
            value = value[part];
        }
        return value == null || typeof value === 'object' ? whole : String(value);
    });
}
