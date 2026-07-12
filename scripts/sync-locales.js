import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCALES_DIR = path.join(__dirname, '../src/locales');
const EN_PATH = path.join(LOCALES_DIR, 'en.json');

const syncLocales = () => {
    const enContent = fs.readFileSync(EN_PATH, 'utf-8');
    const enJson = JSON.parse(enContent);
    const enKeys = Object.keys(enJson);

    const files = fs.readdirSync(LOCALES_DIR);

    for (const file of files) {
        if (!file.endsWith('.json') || file === 'en.json') continue;

        const filePath = path.join(LOCALES_DIR, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const fileJson = JSON.parse(fileContent);

        let changed = false;
        for (const key of enKeys) {
            if (!(key in fileJson)) {
                fileJson[key] = enJson[key];
                changed = true;
            }
        }

        // Also remove any extra keys that might not be in en.json
        const fileKeys = Object.keys(fileJson);
        for (const key of fileKeys) {
            if (!(key in enJson)) {
                delete fileJson[key];
                changed = true;
            }
        }

        if (changed) {
            // Sort keys alphabetically
            const sortedJson = {};
            Object.keys(fileJson).sort().forEach(k => {
                sortedJson[k] = fileJson[k];
            });

            fs.writeFileSync(filePath, JSON.stringify(sortedJson, null, 2) + '\n', 'utf-8');
            console.log(`Synced ${file}`);
        }
    }
};

syncLocales();
