const fs = require('fs');
let code = fs.readFileSync('src/pages/ITProjects/PortfolioView.tsx', 'utf8');

if (!code.includes('const canEdit = userRole')) {
  code = code.replace(
    /const canDelete = userRole === 'admin' \|\| \(userPermissions \? !!userPermissions\?\.projects\?\.delete : true\);/,
    `const canDelete = userRole === 'admin' || (userPermissions ? !!userPermissions?.projects?.delete : true);
  const canEdit = userRole === 'admin' || (userPermissions ? !!userPermissions?.projects?.edit : true);`
  );
}

// Disable new project buttons if !canEdit
code = code.replace(
  /<button\s+onClick=\{\(\) => setShowNewModal\(true\)\}\s+className="bg-blue-600/g,
  `{canEdit && (<button\n              onClick={() => setShowNewModal(true)}\n              className="bg-blue-600`
);

code = code.replace(
  /<\/button>\s*<\/div>\s*<\/div>\s*\{\/\* Projects List \*\/\}/g,
  `</button>)}
            </div>
          </div>

          {/* Projects List */}`
);

// Second New Project button? Let's check where `setShowNewModal(true)` is.
fs.writeFileSync('src/pages/ITProjects/PortfolioView.tsx', code);
console.log("PortfolioView patched");
