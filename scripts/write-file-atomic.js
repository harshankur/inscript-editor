import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

let sequence = 0;

/**
 * Write a file so no reader ever sees it missing or half-written: the content goes to a
 * temporary file in the same directory, which is then renamed over the target (a rename within
 * one directory is atomic). Hosts linked to this checkout's dist/ read it while it rebuilds.
 *
 * The temporary name starts with a dot, so file scanners that skip dotfiles (Tailwind's
 * `@source`, most watchers' defaults) never pick it up.
 */
export function writeFileAtomic(file, data) {
    const dir = path.dirname(file);
    mkdirSync(dir, { recursive: true });
    sequence += 1;
    const temp = path.join(dir, `.${path.basename(file)}.${process.pid}.${sequence}.tmp`);
    try {
        writeFileSync(temp, data);
        renameSync(temp, file);
    } catch (error) {
        rmSync(temp, { force: true });
        throw error;
    }
}
