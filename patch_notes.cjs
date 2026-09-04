const fs = require('fs');
let code = fs.readFileSync('src/pages/ITProjects/ProjectDetailView.tsx', 'utf8');

code = code.replace(
  /<button\s+onClick=\{handleSaveNotes\}/g,
  `{canEdit && <button\n                  onClick={handleSaveNotes}`
);

code = code.replace(
  /\{isSavingNotes \? 'Saving\.\.\.' : 'Save Notes'\}\s+<\/button>/g,
  `{isSavingNotes ? 'Saving...' : 'Save Notes'}\n                </button>}`
);

fs.writeFileSync('src/pages/ITProjects/ProjectDetailView.tsx', code);
console.log("Notes patched");
