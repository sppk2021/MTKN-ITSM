const fs = require('fs');
let code = fs.readFileSync('src/pages/ITProjects/ProjectDetailView.tsx', 'utf8');

if (!code.includes('const canEdit = userRole')) {
  code = code.replace(
    /const canDelete = userRole === 'admin' \|\| \(userPermissions \? !!userPermissions\?\.projects\?\.delete : true\);/,
    `const canDelete = userRole === 'admin' || (userPermissions ? !!userPermissions?.projects?.delete : true);
  const canEdit = userRole === 'admin' || (userPermissions ? !!userPermissions?.projects?.edit : true);`
  );
}

// Add canEdit prop to ProcessHierarchyView
code = code.replace(
  /<ProcessHierarchyView\s+processes=\{project\.processes\}\s+onUpdate=\{handleUpdateProcesses\}\s+\/>/g,
  `<ProcessHierarchyView\n              processes={project.processes}\n              onUpdate={handleUpdateProcesses}\n              canEdit={canEdit}\n            />`
);

// We should also check for `setIsEditing` inside ProjectDetailView
fs.writeFileSync('src/pages/ITProjects/ProjectDetailView.tsx', code);
console.log("ProjectDetailView patched");
