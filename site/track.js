// Page views on the self-hosted viewcounter, through its tracker script. Call
// trackPageView() once from the site entry: it adds the script tag, and the tracker then
// counts the view, how long the page was visible, how far it was scrolled, and clicks on
// links out and downloads. It stores nothing on the device. Never blocks rendering (the
// script loads async) and a failed load is simply a view not counted.
//
// Exported as a called function (not a bare side-effect import) on purpose: the root
// package.json marks every non-CSS module side-effect-free, so a side-effect-only
// `import './track.js'` would be tree-shaken out of the bundle. Calling an exported
// function keeps it in.
//
// Only the production site counts. Anywhere else (the dev server, a preview build, a LAN
// address) the script is not even requested, and data-hosts makes the tracker itself hold
// to the same rule. The viewcounter also refuses any other origin.
const TRACKER_SRC = 'https://views.harshankur.com/tracker.js';
const APP_ID = 'inscript-editor';
const PRODUCTION_HOST = 'inscript-editor.harshankur.com';

export function trackPageView() {
    if (location.hostname !== PRODUCTION_HOST) return;
    if (document.querySelector(`script[src="${TRACKER_SRC}"]`)) return;
    const script = document.createElement('script');
    script.src = TRACKER_SRC;
    script.async = true;
    script.dataset.app = APP_ID;
    script.dataset.hosts = PRODUCTION_HOST;
    document.head.append(script);
}
