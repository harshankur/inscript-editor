const fs = require('fs');
const path = require('path');
const localesDir = path.resolve(__dirname, 'src/locales');
const enPath = path.join(localesDir, 'en.json');

const newKeys = {
  "heading1": "Heading 1",
  "h1Subtitle": "Big section heading",
  "heading2": "Heading 2",
  "h2Subtitle": "Medium section heading",
  "heading3": "Heading 3",
  "h3Subtitle": "Small section heading",
  "bulletList": "Bullet List",
  "bulletListSubtitle": "Create a simple bulleted list",
  "orderedList": "Numbered List",
  "orderedListSubtitle": "Create a list with numbering",
  "taskList": "Task List",
  "taskListSubtitle": "Track tasks with a to-do list",
  "quoteSubtitle": "Capture a quote",
  "codeBlockSubtitle": "Insert a block of code",
  "tableSubtitle": "Insert a 3x3 table",
  "imageSubtitle": "Upload or select an image",
  "youtubeSubtitle": "Embed a YouTube video",
  "horizontalRule": "Divider",
  "hrSubtitle": "Insert a horizontal line",
  "expandOutline": "Expand outline",
  "collapseOutline": "Collapse outline",
  "documentOutline": "Outline",
  "noHeadings": "No headings yet",
  "admonitionNote": "Admonition ▸ Note",
  "admonitionNoteSubtitle": "Add a note admonition",
  "admonitionTip": "Admonition ▸ Tip",
  "admonitionTipSubtitle": "Add a tip admonition",
  "admonitionImportant": "Admonition ▸ Important",
  "admonitionImportantSubtitle": "Add an important admonition",
  "admonitionWarning": "Admonition ▸ Warning",
  "admonitionWarningSubtitle": "Add a warning admonition",
  "admonitionCaution": "Admonition ▸ Caution",
  "admonitionCautionSubtitle": "Add a caution admonition",
  "footnote": "Footnote",
  "footnoteSubtitle": "Insert a footnote reference"
};

for (const file of fs.readdirSync(localesDir)) {
    if (!file.endsWith('.json')) continue;
    const filePath = path.join(localesDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    for (const [k, v] of Object.entries(newKeys)) {
        if (!data[k]) data[k] = v;
    }
    const sorted = {};
    Object.keys(data).sort().forEach(k => sorted[k] = data[k]);
    fs.writeFileSync(filePath, JSON.stringify(sorted, null, 2) + '\n');
}
