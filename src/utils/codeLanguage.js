/**
 * A code block's language as a name, or null: it is written into the code's class, and handed to the
 * highlighter, so anything else (`js fixed inset-0`, a number or an object from a document given as
 * JSON) would add classes of its own, or stop the highlighter.
 */
const LANGUAGE_NAME = /^[A-Za-z0-9_+#.-]{1,40}$/;
export const codeLanguage = value => (typeof value === 'string' && LANGUAGE_NAME.test(value) ? value : null);
