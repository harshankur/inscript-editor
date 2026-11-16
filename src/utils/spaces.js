/**
 * Text with each run of spaces and line breaks made one space, as a reader sees it in HTML. Shared by
 * what reads text that way (a key's text, a comment's chip), so they always agree.
 * @param {string} text
 * @returns {string}
 */
export const runSpacesTogether = text => String(text).replace(/\s+/g, ' ');
