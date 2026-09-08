import React from 'react';
import { createRoot } from 'react-dom/client';
import { Demo } from './demoApp.jsx';

// Bare full-viewport editor, used both as a shareable standalone demo and to capture
// clean feature screenshots (?theme=dark, ?focus=1, ?nomap=1).
const params = new URLSearchParams(location.search);
if (params.get('theme') === 'dark') document.documentElement.classList.add('dark');

createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <Demo focusMode={params.get('focus') === '1'} showMiniMap={params.get('nomap') !== '1'} />
    </React.StrictMode>
);
