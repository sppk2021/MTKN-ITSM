const fs = require('fs');
let code = fs.readFileSync('src/pages/ITProjects/ProjectDetailView.tsx', 'utf8');

code = code.replace(/<\/button>\}\}/g, '</button>}');
code = code.replace(/\{\!isEditingFocus \? \(\s*\{canEdit && <button/g, '{!isEditingFocus ? (\n                  canEdit && <button');
code = code.replace(/\{isSavingNotes \? 'Saving\.\.\.' : 'Save Notes'\}\s*<\/button>\}/g, "{isSavingNotes ? 'Saving...' : 'Save Notes'}\n                </button>");

fs.writeFileSync('src/pages/ITProjects/ProjectDetailView.tsx', code);
console.log("fixed jsx");
