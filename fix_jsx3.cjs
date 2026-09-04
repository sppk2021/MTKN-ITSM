const fs = require('fs');
let code = fs.readFileSync('src/pages/ITProjects/ProjectDetailView.tsx', 'utf8');

code = code.replace(
  /\{isSavingNotes \? 'Saving\.\.\.' : 'Save Notes'\}\s*<\/button>\s*<\/div>/,
  "{isSavingNotes ? 'Saving...' : 'Save Notes'}\n                </button>)}\n              </div>"
);

// Also need to check if we started with `{canEdit && <button` without parenthesis
code = code.replace(
  /\{canEdit && <button\s*onClick=\{handleSaveNotes\}/,
  "{canEdit && (<button\n                  onClick={handleSaveNotes}"
);

fs.writeFileSync('src/pages/ITProjects/ProjectDetailView.tsx', code);
console.log("fixed jsx 3");
