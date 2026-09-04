const fs = require('fs');
let code = fs.readFileSync('src/pages/UsersPage.tsx', 'utf8');

// Replace the <select> options for roles
code = code.replace(/<option value="staff">Staff<\/option>/g, '<option value="staff">Staff</option>\n                            <option value="project_manager">Project Manager</option>');
code = code.replace(/<option value="admin">Admin<\/option>/g, '<option value="admin">Admin</option>');

fs.writeFileSync('src/pages/UsersPage.tsx', code);
console.log("users page updated");
