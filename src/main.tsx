import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import App from './App.tsx';
import './index.css';

import { purgeAllProjects } from './lib/purgeProjects';

// Expose utility globally for safe manual execution via browser console
(window as any).purgeAllProjects = purgeAllProjects;
console.log("🛠️ Utility loaded: Run `await window.purgeAllProjects()` in the console to wipe all demo projects.");

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

