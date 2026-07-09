export function extractHeadings(editor) {
    const headings = [];
    if (!editor || !editor.state) return headings;
    
    editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
            headings.push({
                level: node.attrs.level,
                text: node.textContent,
                pos: pos
            });
        }
    });
    
    return headings;
}
