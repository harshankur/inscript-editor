export const getTextContent = (html) => {
    if (typeof DOMParser === 'undefined') {
        return (html || '').replace(/<[^>]*>/g, '');
    }
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
};
