const fs = require('fs');
let code = fs.readFileSync('src/pages/ITProjects/ProjectDetailView.tsx', 'utf8');

code = code.replace(/Edit Focus\s*<\/button>\}/g, 'Edit Focus\n                  </button>');

fs.writeFileSync('src/pages/ITProjects/ProjectDetailView.tsx', code);
console.log("fixed jsx 2");
