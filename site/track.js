// Fire-and-forget page-view ping to the self-hosted viewcounter, run once per page
// load from the site entry. Never blocks rendering and swallows all errors.
//
// Skips localhost/dev on purpose: the viewcounter only accepts requests from the
// production origin (https://inscript-editor.harshankur.com) and 403s anything else,
// so firing from a dev server would be pointless (and we don't want dev traffic near
// the counter). The request stays a normal CORS fetch because the server checks the
// Origin header (do not switch to <img> or sendBeacon).
(() => {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;
    let sessionId;
    try {
        sessionId = sessionStorage.getItem('vc-session') || crypto.randomUUID();
        sessionStorage.setItem('vc-session', sessionId);
    } catch { sessionId = crypto.randomUUID(); }
    fetch('https://views.harshankur.com/registerView?' + new URLSearchParams({
        appId: 'inscript-editor',
        deviceSize: innerWidth < 768 ? 'small' : innerWidth < 1200 ? 'medium' : 'large',
        page: location.pathname,
        title: document.title.slice(0, 200),
        referrer: document.referrer,
        sessionId,
    }), { keepalive: true }).catch(() => {});
})();
