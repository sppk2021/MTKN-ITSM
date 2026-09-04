const fs = require('fs');
let code = fs.readFileSync('src/pages/ITProjects/ProjectDetailView.tsx', 'utf8');

code = code.replace(
  /<div className="flex gap-2">/g,
  `{canEdit && (<div className="flex gap-2">`
);

code = code.replace(
  /Add Entry\s*<\/button>\s*<\/div>\s*\{\/\* Activity Timeline \*\/\}/g,
  `Add Entry\n                </button>\n              </div>)}\n              {/* Activity Timeline */}`
);

fs.writeFileSync('src/pages/ITProjects/ProjectDetailView.tsx', code);
console.log("Activity patched");
