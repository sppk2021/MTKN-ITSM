const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

// Add 'project_manager' to UserRole
code = code.replace(/export type UserRole = (.*);/, (match, roles) => {
  if (!roles.includes("'project_manager'")) {
    return `export type UserRole = ${roles} | 'project_manager';`;
  }
  return match;
});

// Add default permissions for project_manager
const newRolePerms = `
  project_manager: {
    dashboard: { view: false, edit: false, delete: false },
    users: { view: false, edit: false, delete: false },
    reports: { view: false, edit: false, delete: false },
    calendar: { view: false, edit: false, delete: false },
    repairs: { view: false, edit: false, delete: false },
    tickets: { view: false, edit: false, delete: false },
    software: { view: false, edit: false, delete: false },
    isp: { view: false, edit: false, delete: false },
    projects: { view: true, edit: true, delete: false },
  },
};`;

code = code.replace(/  guest: \{[\s\S]*?\},?\n\};/, match => {
  return match.replace(/};$/, newRolePerms.trim());
});

fs.writeFileSync('src/types.ts', code);
console.log("types updated");
