/**
 * JSON content (a document's, as ProseMirror writes it) with each node given by `visit`: the node
 * itself, a node to put in its place, or null to leave it out. Only the nodes on the way to a changed
 * one are copied; the content itself is returned when nothing changes. A node's children are visited
 * before it. Walked with a stack of its own, never by recursion: deeply nested content cannot
 * overflow the call stack. Content that holds itself (a node among its own descendants, which no JSON
 * can be) throws a RangeError rather than being walked for ever.
 * @param {unknown} content
 * @param {(node: object) => object | null} visit
 * @returns {unknown}
 */
export function mapJsonNodes(content, visit) {
    let result = content;
    // Each frame: a node, how many of its children are done, and their results.
    const stack = [{ node: content, next: 0, done: [] }];
    // The nodes being walked (a node and its ancestors): one met again holds itself.
    const walking = new Set([content]);
    const deliver = value => {
        if (stack.length) stack[stack.length - 1].done.push(value);
        else result = value;
    };
    while (stack.length) {
        const frame = stack[stack.length - 1];
        const { node } = frame;
        const children = node && typeof node === 'object' && Array.isArray(node.content) ? node.content : null;
        if (children && frame.next < children.length) {
            const child = children[frame.next];
            if (child && typeof child === 'object') {
                if (walking.has(child)) throw new RangeError('Content holds itself');
                walking.add(child);
            }
            stack.push({ node: child, next: 0, done: [] });
            frame.next += 1;
            continue;
        }
        stack.pop();
        walking.delete(node);
        if (!node || typeof node !== 'object') {
            deliver(node);
            continue;
        }
        let next = node;
        if (children) {
            const kept = frame.done.filter(child => child !== null);
            if (kept.length !== children.length || kept.some((child, index) => child !== children[index])) next = { ...node, content: kept };
        }
        deliver(visit(next));
    }
    return result;
}
