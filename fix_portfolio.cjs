const fs = require('fs');
let code = fs.readFileSync('src/pages/ITProjects/PortfolioView.tsx', 'utf8');

code = code.replace(/<span>Create Project<\/span>\s*<\/button>/g, '<span>Create Project</span>\n          </button>)}');

// Wait, I replaced `</button>)}` earlier maybe in PortfolioView?
// Let's check `</button>)}` existence.
fs.writeFileSync('src/pages/ITProjects/PortfolioView.tsx', code);
console.log("fixed portfolio");
