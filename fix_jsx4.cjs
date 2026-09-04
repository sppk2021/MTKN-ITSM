const fs = require('fs');
let code = fs.readFileSync('src/pages/ITProjects/ProjectDetailView.tsx', 'utf8');

code = code.replace(/<\/div>\)\}/g, '</div>');

code = code.replace(
  /<div className="flex items-center gap-2 mb-6">/g,
  '{canEdit && (<div className="flex items-center gap-2 mb-6">'
);

code = code.replace(
  /Add Entry\s*<\/button>\s*<\/div>\s*\{\/\* Activity Timeline \*\/\}/g,
  `Add Entry\n                </button>\n              </div>)}\n              {/* Activity Timeline */}`
);


fs.writeFileSync('src/pages/ITProjects/ProjectDetailView.tsx', code);
console.log("fixed jsx 4");
