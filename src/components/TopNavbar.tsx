import React from "react";
import { useLocation } from "react-router-dom";
import { 
  Search, Command, LayoutDashboard, Users, BarChart3, 
  CalendarDays, Wrench, Ticket, Server, Globe, FolderKanban,
  Sun, Moon, Shield, Settings2, Wifi, WifiOff
} from "lucide-react";
import { SyncStatusBadge } from "./SyncStatusBadge";
import { TabKey, TAB_LABELS } from "../types";

interface TopNavbarProps {
  onOpenSearch: () => void;
  userRole?: string;
  displayName?: string;
  userEmail?: string;
  photoURL?: string;
  onOpenProfile: () => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

export function TopNavbar({
  onOpenSearch,
  userRole,
  displayName,
  userEmail,
  photoURL,
  onOpenProfile,
  isDarkMode,
  toggleTheme
}: TopNavbarProps) {
  const location = useLocation();

  // Determine current page metadata
  const getPageInfo = () => {
    switch (location.pathname) {
      case '/':
        return { title: 'Dashboard', icon: LayoutDashboard, category: 'Overview' };
      case '/tickets':
        return { title: 'Support Tickets', icon: Ticket, category: 'Helpdesk' };
      case '/repairs':
        return { title: 'Repairs Tracking', icon: Wrench, category: 'Maintenance' };
      case '/projects':
        return { title: 'Projects & Solutions', icon: FolderKanban, category: 'Governance' };
      case '/users':
        return { title: 'User Management', icon: Users, category: 'Administration' };
      case '/reports':
        return { title: 'Reports & Analytics', icon: BarChart3, category: 'Analytics' };
      case '/calendar':
        return { title: 'Support Calendar', icon: CalendarDays, category: 'Scheduling' };
      case '/software':
        return { title: 'Licenses & Domains', icon: Server, category: 'Assets' };
      case '/isp':
        return { title: 'ISP Management', icon: Globe, category: 'Network' };
      default:
        return { title: 'MTKN ITSM Portal', icon: LayoutDashboard, category: 'System' };
    }
  };

  const pageInfo = getPageInfo();
  const IconComponent = pageInfo.icon;

  const userInitials = (displayName || userEmail || "U")
    .split(" ")
    .map(n => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  // Detect Mac vs Windows/Linux for keyboard shortcut badge
  const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  return (
    <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 shadow-xs">
      {/* Left: Active View Breadcrumb / Title */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 shadow-2xs">
          <IconComponent className="w-5 h-5" />
        </div>
        <div className="min-w-0 hidden sm:block">
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate tracking-tight">
              {pageInfo.title}
            </h1>
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
              {pageInfo.category}
            </span>
          </div>
        </div>
      </div>

      {/* Center: Global Search Bar Trigger Input */}
      <div className="flex-1 max-w-xl mx-2">
        <button
          type="button"
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between gap-3 px-3.5 py-2 bg-slate-100/90 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl text-left text-slate-500 dark:text-slate-400 transition-all cursor-pointer group shadow-2xs hover:border-blue-400 dark:hover:border-blue-500"
          title="Open Global Search (⌘K or /)"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Search className="w-4 h-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors shrink-0" />
            <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 truncate">
              Search tickets, repairs, projects, users...
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 shadow-2xs group-hover:text-blue-600 dark:group-hover:text-blue-400">
              {isMac ? "⌘K" : "Ctrl+K"}
            </kbd>
            <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 shadow-2xs">
              /
            </kbd>
          </div>
        </button>
      </div>

      {/* Right: Quick actions (Theme switch & Profile avatar trigger) */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Sync Status Badge (Compact) */}
        <div className="hidden lg:block">
          <SyncStatusBadge />
        </div>

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700/80 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700/60"
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* Quick Profile Avatar */}
        <button
          type="button"
          onClick={onOpenProfile}
          className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
          title="Open User Profile & Settings"
        >
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-2xs">
            {photoURL ? (
              <img src={photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              userInitials
            )}
          </div>
          <span className="hidden xl:inline-block text-xs font-semibold text-slate-800 dark:text-slate-200 max-w-[100px] truncate">
            {displayName || userEmail?.split('@')[0] || "Profile"}
          </span>
        </button>
      </div>
    </header>
  );
}
