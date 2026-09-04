const fs = require('fs');
let code = fs.readFileSync('src/pages/ITProjects/ProjectDetailView.tsx', 'utf8');

code = code.replace(
  /          <\/div>\s*<button\s*type="button"\s*onClick=\{\(\) => \{\s*setEditFormData/g,
  `          </div>\n          {canEdit && <button\n            type="button"\n            onClick={() => {\n              setEditFormData`
);

code = code.replace(
  /<span className="font-semibold">Edit Info<\/span>\s*<\/button>/g,
  `<span className="font-semibold">Edit Info</span>\n          </button>}`
);

fs.writeFileSync('src/pages/ITProjects/ProjectDetailView.tsx', code);
console.log("patched!");
