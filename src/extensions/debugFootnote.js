import { createEditor } from '../../tests/helpers/createEditor.js';

const editor = createEditor({}, { footnote: true });
editor.commands.setContent('<p>Reference<sup data-footnote-ref="fn-123"></sup></p>');
console.log('Empty sup JSON:', JSON.stringify(editor.getJSON(), null, 2));

editor.commands.setContent('<p>Reference<sup data-footnote-ref="fn-123">1</sup></p>');
console.log('With text sup JSON:', JSON.stringify(editor.getJSON(), null, 2));

editor.commands.setContent('<p>Reference<span data-footnote-ref="fn-123"></span></p>');
console.log('Span JSON:', JSON.stringify(editor.getJSON(), null, 2));

editor.destroy();
