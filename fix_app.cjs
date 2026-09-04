const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Remove AppLogoSelectorModal from the main return
code = code.replace(/<AppLogoSelectorModal[\s\S]*?currentLogo={appLogo}\s*\/>/m, '');

// 2. Add Outlet to react-router-dom imports
code = code.replace(/import \{ Routes, Route, Navigate, Link, useLocation \} from "react-router-dom";/, 'import { Routes, Route, Navigate, Link, useLocation, Outlet } from "react-router-dom";');

fs.writeFileSync('src/App.tsx', code);
console.log("Fixed");
