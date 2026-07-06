import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Lets a consuming app's Tailwind config point its content scanner at this
// package without hand-typing a path through node_modules. import.meta.url
// resolves correctly regardless of node_modules layout (flat, pnpm, hoisted
// workspaces, or a local `file:` link), unlike a relative glob written from
// the consumer's side.
export const contentGlob = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist/**/*.js');
