import { imageAction } from '../extensions/ImageFiles.js';

/**
 * The Image button: the host's media library when it has one, else the browser's file picker with
 * the chosen files going through the host's image-file handler (the one given, else the editor's),
 * only while the editor can be edited; off with neither. (Editability changes without a transaction:
 * the toolbar is built again on it.)
 * @param {import('@tiptap/core').Editor} editor
 * @param {(() => void) | undefined} onShowMediaLibrary
 * @param {((file: File, info: object) => unknown) | undefined} onImageFile
 */
export const imageTool = (editor, onShowMediaLibrary, onImageFile) => {
    // An image chosen in a read-only editor (the library's too) has nowhere to go.
    const action = editor.isEditable ? imageAction(editor, onShowMediaLibrary, onImageFile) : null;
    return { action: action ?? undefined, disabled: !action };
};
