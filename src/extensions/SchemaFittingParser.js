import { Extension } from '@tiptap/core';
import { DOMParser as ProseMirrorDOMParser } from '@tiptap/pm/model';
import { normalizeForParse } from '../utils/parseDom.js';
import { beginParse } from '../utils/parseRound.js';

/**
 * ProseMirror's DOMParser, reading the DOM as normalizeForParse reshapes it: real comment nodes
 * as source-comment nodes (ProseMirror's parser only ever visits elements and text, so a real
 * comment, what marked, markdown-it and most HTML carry, vanished on load), and a Markdown
 * renderer's images and list items fitted to the schema.
 */
export class SchemaFittingDOMParser extends ProseMirrorDOMParser {
    parse(dom, options) {
        beginParse();
        return super.parse(normalizeForParse(dom, this.schema), options);
    }

    parseSlice(dom, options) {
        beginParse();
        return super.parseSlice(normalizeForParse(dom, this.schema), options);
    }
}

/**
 * Put the schema-fitting parser on an editor's schema. Every parse (initial content, setContent,
 * insertContent, paste) goes through the parser ProseMirror caches on the schema, and beforeCreate
 * runs after the schema exists but before the initial content is parsed: installing it there
 * covers them all.
 * @param {import('@tiptap/core').Editor | undefined} editor
 */
export function installSchemaFittingParser(editor) {
    const schema = editor?.schema;
    if (!schema || schema.cached.domParser instanceof SchemaFittingDOMParser) return;
    schema.cached.domParser = new SchemaFittingDOMParser(schema, ProseMirrorDOMParser.schemaRules(schema));
}

/**
 * Always on: the editor reads HTML fitted to its schema (see SchemaFittingDOMParser), whichever
 * features it has, source comments included or not.
 */
export const SchemaFittingParser = Extension.create({
    name: 'schemaFittingParser',
    onBeforeCreate() {
        installSchemaFittingParser(this.editor);
    },
});
