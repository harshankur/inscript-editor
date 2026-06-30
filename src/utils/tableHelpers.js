export const getTableNode = (state) => {
    if (!state) return null;
    const { selection } = state;
    const $pos = selection.$anchorCell || selection.$from;
    if (!$pos) return null;
    for (let d = $pos.depth; d > 0; d--) {
        const node = $pos.node(d);
        if (node.type.name === 'table') {
            return { node, pos: $pos.before(d) };
        }
    }
    return null;
};

export const isHeaderRowActive = (editor) => {
    if (!editor) return false;
    const info = getTableNode(editor.state);
    if (!info) return false;
    const firstRow = info.node.firstChild;
    return firstRow?.firstChild?.type.name === 'tableHeader';
};

export const isHeaderColumnActive = (editor) => {
    if (!editor) return false;
    const info = getTableNode(editor.state);
    if (!info) return false;
    let active = info.node.childCount > 0;
    info.node.forEach(row => { if (row.firstChild?.type.name !== 'tableHeader') active = false; });
    return active;
};

export const setTableLayout = (editor, attrs) => {
    if (!editor) return;
    const info = getTableNode(editor.state);
    if (!info) return;
    editor.chain().focus().command(({ tr }) => {
        tr.setNodeMarkup(info.pos, undefined, { ...info.node.attrs, ...attrs });
        return true;
    }).run();
};
