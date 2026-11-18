/**
 * The text of an error a node view keeps: a message as a library gave it (a string), or one of the
 * editor's own (`{ say: t => … }`), said now in the editor's `t`, in the language of the moment.
 * @param {string | { say: (t: Function) => string } | null} error
 * @param {(key: string, fallback?: string) => string} t
 * @returns {string | null}
 */
export const saidError = (error, t) => (error && typeof error === 'object' ? error.say(t) : error);
