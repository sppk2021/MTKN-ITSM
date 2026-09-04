import React from 'react';
import { Shield, LayoutDashboard, BarChart3, FolderKanban, Moon, Sun, LogIn } from 'lucide-react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { cn } from '../lib/utils';

interface PublicLayoutProps {
  appLogo?: string | null;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

export function PublicLayout({ appLogo, isDarkMode, toggleTheme }: PublicLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Reports", href: "/reports", icon: BarChart3 },
    { name: "IT Projects", href: "/projects", icon: FolderKanban },
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900 font-sans text-slate-800 dark:text-slate-200 overflow-hidden">
      {/* Clean Top Navigation for Public View */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 h-16 flex items-center justify-between px-4 sm:px-6 shrink-0 z-20">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shadow-sm overflow-hidden", !appLogo && "bg-blue-600 text-white")}>
              {appLogo ? (
                <img src={appLogo} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Shield className="w-5 h-5" />
              )}
            </div>
            <span className="font-bold text-lg tracking-tight hidden sm:block">MTKN Executive Portal</span>
            <span className="font-bold text-lg tracking-tight sm:hidden">MTKN</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-1 ml-4">
            {navItems.map(item => (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  location.pathname === item.href 
                    ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400" 
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300"
            title="Toggle Dark Mode"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
          
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white transition-colors cursor-pointer text-xs sm:text-sm font-semibold shadow-sm"
          >
            <LogIn className="w-4 h-4" />
            <span className="hidden sm:inline">Sign In</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0 relative">
        <Outlet />
      </main>

      {/* Mobile Navigation (bottom) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center justify-around shadow-xl pb-[env(safe-area-inset-bottom)]">
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.href}
            className={cn(
              "flex flex-col items-center justify-center p-2 min-w-[64px] rounded-xl transition-colors",
              location.pathname === item.href
                ? "text-blue-600 dark:text-blue-400"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            )}
          >
            <item.icon className={cn("w-5 h-5 mb-1", location.pathname === item.href ? "fill-blue-50/50 dark:fill-blue-900/20" : "")} />
            <span className="text-[10px] font-semibold">{item.name}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
