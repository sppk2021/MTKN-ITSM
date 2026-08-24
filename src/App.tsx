import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { 
  LayoutDashboard, Users, BarChart3, CalendarDays, Wrench, LogOut, 
  Ticket, Globe, Server, Shield, Lock, User as UserIcon, LogIn, 
  ChevronLeft, ChevronRight, Download, Menu, X as CloseIcon, 
  UserCheck, Settings2, Sparkles, Sun, Moon
} from "lucide-react";
import { auth, db } from "./lib/firebase";
import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

import ManagementDashboard from "./pages/ManagementDashboard";
import UsersPage from "./pages/UsersPage";
import Reports from "./pages/Reports";
import SupportCalendar from "./pages/SupportCalendar";
import RepairsTracking from "./pages/RepairsTracking";
import SupportTickets from "./pages/SupportTickets";
import SoftwareStatus from "./pages/SoftwareStatus";
import ISPManagement from "./pages/ISPManagement";
import { UserProfileModal } from "./components/UserProfileModal";
import { cn } from "./lib/utils";
import { motion } from "motion/react";
import { PermissionGuard } from "./components/PermissionGuard";
import { TabKey, UserPermissions, DEFAULT_ROLE_PERMISSIONS, UserRole } from "./types";

interface SidebarProps {
  role: string;
  userEmail?: string;
  displayName?: string;
  photoURL?: string;
  userPermissions?: UserPermissions;
  appLogo?: string | null;
  onLogoUpdate?: (newLogo: string) => void;
  onOpenProfile: () => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tabKey: TabKey;
}

function Sidebar({ role, userEmail, displayName, photoURL, userPermissions, appLogo, onLogoUpdate, onOpenProfile, isDarkMode, toggleTheme }: SidebarProps) {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem("sidebar_collapsed") === "true");
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    }
    return false;
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      alert("To install MTKN ITSM app on your device:\n\nAndroid (Chrome / Edge):\n1. Tap the 3 dots menu (⋮) at top right\n2. Select 'Add to Home screen' or 'Install app'\n\niOS (Safari):\n1. Tap the Share button\n2. Select 'Add to Home Screen'");
    }
  };

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("sidebar_collapsed", String(next));
      return next;
    });
  };

  const allNavigation: NavItem[] = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, tabKey: 'dashboard' },
    { name: 'Users', href: '/users', icon: Users, tabKey: 'users' },
    { name: 'Reports', href: '/reports', icon: BarChart3, tabKey: 'reports' },
    { name: 'Calendar', href: '/calendar', icon: CalendarDays, tabKey: 'calendar' },
    { name: 'Repairs', href: '/repairs', icon: Wrench, tabKey: 'repairs' },
    { name: 'Tickets', href: '/tickets', icon: Ticket, tabKey: 'tickets' },
    { name: 'Licenses', href: '/software', icon: Server, tabKey: 'software' },
    { name: 'ISP Mgmt', href: '/isp', icon: Globe, tabKey: 'isp' },
  ];

  // Restrict sidebar items based on granular tab permissions or admin override
  const navigation = allNavigation.filter(item => {
    if (role === 'admin') return true;
    const effectivePerms = userPermissions || (DEFAULT_ROLE_PERMISSIONS[role as UserRole] ?? DEFAULT_ROLE_PERMISSIONS.staff);
    return effectivePerms[item.tabKey]?.view === true;
  });

  const userInitials = (displayName || userEmail || "U")
    .split(" ")
    .map(n => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Image must be smaller than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result && onLogoUpdate) {
          onLogoUpdate(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const sidebarContent = (
    <div className={cn("flex-1 flex flex-col min-h-0", isCollapsed && !isMobileOpen ? "p-3 py-5" : "p-6")}>
      <input 
        type="file" 
        accept="image/*" 
        ref={fileInputRef} 
        onChange={handleLogoFileChange} 
        className="hidden" 
      />
      {/* Header / Brand */}
      <div className={cn("flex items-center mb-6 shrink-0", isCollapsed && !isMobileOpen ? "flex-col gap-3 justify-center" : "justify-between")}>
        <div className={cn("flex items-center gap-3 min-w-0 group relative", isCollapsed && !isMobileOpen && "justify-center")}>
          <button
            onClick={isCollapsed && !isMobileOpen ? toggleCollapse : undefined}
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shrink-0 shadow-md transition-transform active:scale-95 overflow-hidden relative",
              !appLogo && "bg-blue-600 shadow-blue-500/20",
              isCollapsed && !isMobileOpen && !appLogo && "cursor-pointer hover:bg-blue-500"
            )}
            title={isCollapsed && !isMobileOpen ? "Click to expand sidebar" : "MTKN ITSM"}
          >
            {appLogo ? (
              <img src={appLogo} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              "MT"
            )}
            {role === 'admin' && (
              <div 
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                title="Edit Logo"
              >
                <Settings2 className="w-4 h-4 text-white" />
              </div>
            )}
          </button>
          {(!isCollapsed || isMobileOpen) && (
            <span className="text-white font-bold text-lg tracking-tight truncate flex-1">
              MTKN ITSM
            </span>
          )}
        </div>

        {/* Toggle Collapse Buttons */}
        {!isCollapsed && !isMobileOpen && (
          <button 
            onClick={toggleCollapse}
            className="hidden md:flex text-slate-400 hover:text-white w-9 h-9 rounded-lg hover:bg-slate-800 transition-colors items-center justify-center cursor-pointer"
            title="Collapse sidebar"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {isCollapsed && !isMobileOpen && (
          <button 
            onClick={toggleCollapse}
            className="hidden md:flex text-slate-400 hover:text-white w-8 h-8 rounded-lg hover:bg-slate-800 transition-colors items-center justify-center bg-slate-800/50 cursor-pointer"
            title="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {isMobileOpen && (
          <button 
            onClick={() => setIsMobileOpen(false)}
            className="md:hidden text-slate-400 hover:text-white w-9 h-9 rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer"
            title="Close menu"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Links with Floating Tooltips in Collapsed Mode */}
      <nav className="space-y-1.5 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <div key={item.name} className="relative group">
              <Link
                to={item.href}
                onClick={() => setIsMobileOpen(false)}
                className={cn(
                  "flex items-center transition-all min-h-[42px]",
                  isCollapsed && !isMobileOpen 
                    ? "w-11 h-11 mx-auto justify-center rounded-xl" 
                    : "gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium",
                  isActive
                    ? isCollapsed && !isMobileOpen
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
                      : "bg-blue-600/15 text-blue-400 font-semibold border border-blue-500/20"
                    : "text-slate-400 hover:bg-slate-800/80 hover:text-white"
                )}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {(!isCollapsed || isMobileOpen) && <span className="truncate">{item.name}</span>}
              </Link>

              {/* Floating Tooltip for Collapsed Sidebar */}
              {isCollapsed && !isMobileOpen && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-slate-950 text-white text-xs font-semibold rounded-lg shadow-2xl border border-slate-700 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 flex items-center gap-1.5">
                  <span>{item.name}</span>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                </div>
              )}
            </div>
          );
        })}

        {/* PWA Install Button */}
        {!isInstalled && (
          <div className="relative group pt-2">
            <button
              onClick={handleInstallClick}
              className={cn(
                "flex items-center transition-all min-h-[42px] cursor-pointer",
                isCollapsed && !isMobileOpen
                  ? "w-11 h-11 mx-auto justify-center rounded-xl bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 shadow-sm"
                  : "w-full gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600/15 text-emerald-400 hover:bg-emerald-600/25 border border-emerald-500/30 shadow-sm"
              )}
            >
              <Download className="w-5 h-5 flex-shrink-0 text-emerald-400" />
              {(!isCollapsed || isMobileOpen) && <span className="truncate">Install App</span>}
            </button>

            {isCollapsed && !isMobileOpen && (
              <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-slate-950 text-emerald-300 text-xs font-semibold rounded-lg shadow-2xl border border-slate-700 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
                Install Application (PWA)
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Theme Switcher */}
      <div className="mt-auto pt-4 pb-2 shrink-0 border-b border-slate-800">
        <div className="relative group">
          <button
            onClick={toggleTheme}
            className={cn(
              "flex items-center transition-all min-h-[42px] cursor-pointer text-slate-400 hover:bg-slate-800/80 hover:text-white",
              isCollapsed && !isMobileOpen
                ? "w-11 h-11 mx-auto justify-center rounded-xl"
                : "w-full gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium"
            )}
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun className="w-5 h-5 flex-shrink-0" /> : <Moon className="w-5 h-5 flex-shrink-0" />}
            {(!isCollapsed || isMobileOpen) && <span className="truncate">{isDarkMode ? "Light Mode" : "Dark Mode"}</span>}
          </button>
          {isCollapsed && !isMobileOpen && (
            <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-slate-950 text-white text-xs font-semibold rounded-lg shadow-2xl border border-slate-700 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
              {isDarkMode ? "Light Mode" : "Dark Mode"}
            </div>
          )}
        </div>
      </div>

      {/* User Profile Section in Sidebar */}
      <div className="pt-3 shrink-0">
        {isCollapsed && !isMobileOpen ? (
          /* Collapsed User Controls */
          <div className="flex flex-col items-center gap-2 pt-2 border-t border-slate-800">
            {/* Avatar Button with Tooltip */}
            <div className="relative group">
              <button
                onClick={() => onOpenProfile()}
                className="w-11 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-white transition-all cursor-pointer relative"
              >
                {photoURL ? (
                  <img src={photoURL} alt="Profile" className="w-full h-full rounded-xl object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-xs">
                    {userInitials}
                  </div>
                )}
                <div className={cn("absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900", isOnline ? "bg-emerald-500" : "bg-rose-500")} title={isOnline ? "Online" : "Offline"} />
              </button>

              <div className="pointer-events-none absolute left-full bottom-0 ml-3 px-3 py-2 bg-slate-950 text-white text-xs rounded-xl shadow-2xl border border-slate-700 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="font-bold text-white">{displayName || userEmail || "My Profile"}</p>
                  <span className={cn("w-1.5 h-1.5 rounded-full", isOnline ? "bg-emerald-500" : "bg-rose-500")}></span>
                  <span className={cn("text-[10px] font-medium", isOnline ? "text-emerald-400" : "text-rose-400")}>{isOnline ? "Online" : "Offline"}</span>
                </div>
                <p className="text-[11px] text-blue-400 capitalize">{role.replace('_', ' ')} • Click to edit profile</p>
              </div>
            </div>

            {/* Logout Button with Tooltip */}
            <div className="relative group">
              <button
                onClick={() => signOut(auth)}
                className="w-10 h-10 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 transition-colors flex items-center justify-center cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>

              <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-slate-950 text-rose-300 text-xs font-semibold rounded-lg shadow-2xl border border-slate-700 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
                Sign Out
              </div>
            </div>
          </div>
        ) : (
          /* Expanded User Controls */
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-3 space-y-2.5">
            {/* Clickable Profile Card */}
            <button
              type="button"
              onClick={() => {
                setIsMobileOpen(false);
                onOpenProfile();
              }}
              className="w-full flex items-center gap-3 text-left p-1.5 rounded-xl hover:bg-slate-700/60 transition-all cursor-pointer group"
              title="Click to edit full name, upload avatar, and change password"
            >
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-600 bg-slate-700 flex items-center justify-center text-white font-bold text-xs group-hover:border-blue-400 transition-colors">
                  {photoURL ? (
                    <img src={photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                      {userInitials}
                    </div>
                  )}
                </div>
                <div className={cn("absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-800", isOnline ? "bg-emerald-500" : "bg-rose-500")} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
                    {displayName || userEmail?.split('@')[0] || "My Profile"}
                  </p>
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    <span className={cn("w-1.5 h-1.5 rounded-full", isOnline ? "bg-emerald-500" : "bg-rose-500")}></span>
                    <span className={cn("text-[9px] font-medium tracking-wide", isOnline ? "text-emerald-400" : "text-rose-400")}>{isOnline ? "ONLINE" : "OFFLINE"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider bg-blue-950/80 px-1.5 py-0.2 rounded border border-blue-800/60">
                    {role.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate font-mono">
                    Edit Profile
                  </span>
                </div>
              </div>

              <Settings2 className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors shrink-0" />
            </button>

            {/* Sign out button */}
            <div className="pt-2 border-t border-slate-700/50 flex items-center justify-between px-1">
              <span className="text-[10px] text-slate-400 truncate max-w-[120px] font-mono">
                {userEmail || 'user@mtknitsm.local'}
              </span>
              <button
                onClick={() => signOut(auth)}
                className="text-slate-400 hover:text-rose-400 text-[11px] font-semibold flex items-center gap-1 hover:bg-rose-500/10 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                title="Sign out of account"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        )}

        {(!isCollapsed || isMobileOpen) && (
          <div className="text-[10px] text-slate-500 text-center font-mono tracking-wider pt-2">
            Developed by <span className="text-slate-400 font-sans font-medium">Saw Pyae Phyo Kyaw</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 h-14 flex items-center justify-between shrink-0 text-white z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center font-bold text-xs shadow-sm">MT</div>
          <span className="font-semibold text-sm tracking-tight">MTKN ITSM</span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Mobile Profile Trigger Button */}
          <button
            onClick={onOpenProfile}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-full border border-slate-700 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Open User Profile"
          >
            <div className="w-6 h-6 rounded-full overflow-hidden bg-blue-600 flex items-center justify-center text-[10px] font-bold">
              {photoURL ? (
                <img src={photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                userInitials
              )}
            </div>
            <span className="max-w-[80px] truncate font-medium text-[11px]">{displayName || "Profile"}</span>
          </button>

          <button
            onClick={() => setIsMobileOpen(true)}
            className="text-slate-300 hover:text-white p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden md:flex bg-slate-900 flex-col border-r border-slate-800 transition-all duration-300 ease-in-out shrink-0 overflow-visible relative z-30",
        isCollapsed ? "w-20" : "w-64"
      )}>
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop & Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileOpen(false)}
          />
          <aside className="relative bg-slate-900 w-72 max-w-[80vw] h-full flex flex-col z-10 shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("staff");
  const [userDisplayName, setUserDisplayName] = useState<string>("");
  const [userPhotoURL, setUserPhotoURL] = useState<string>("");
  const [userPermissions, setUserPermissions] = useState<UserPermissions | undefined>(undefined);
  const [appLogo, setAppLogo] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem("theme") === "dark";
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(prev => !prev);

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const docRef = doc(db, "settings", "app_config");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().logoBase64) {
          const logoData = docSnap.data().logoBase64;
          setAppLogo(logoData);
          let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.getElementsByTagName('head')[0].appendChild(link);
          }
          link.href = logoData;
        }
      } catch (err) {
        console.error("Error fetching app logo:", err);
      }
    };
    fetchLogo();
  }, []);

  const handleLogoUpdate = async (newLogo: string) => {
    try {
      await setDoc(doc(db, "settings", "app_config"), { logoBase64: newLogo }, { merge: true });
      setAppLogo(newLogo);
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = newLogo;
    } catch (err) {
      console.error("Error updating logo:", err);
      alert("Failed to update logo");
    }
  };

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);
    try {
      const email = username.includes("@") ? username : `${username.toLowerCase()}@mtknitsm.local`;
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error("Login error:", error);
      setLoginError("Invalid username or password. If you just added this user, ensure Email/Password auth is enabled in Firebase Console.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleProfileUpdated = (updatedData: { displayName: string; photoURL?: string }) => {
    if (updatedData.displayName) {
      setUserDisplayName(updatedData.displayName);
    }
    if (updatedData.photoURL !== undefined) {
      setUserPhotoURL(updatedData.photoURL);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const userRef = doc(db, "users", u.uid);
          const userSnap = await getDoc(userRef);
          let activeRole: UserRole = "staff";
          let activePermissions: UserPermissions = DEFAULT_ROLE_PERMISSIONS.staff;
          let activeDisplayName = u.displayName || "";
          let activePhotoURL = u.photoURL || "";
          
          if (!userSnap.exists()) {
            const initialRole: UserRole = "admin";
            const initialPerms = DEFAULT_ROLE_PERMISSIONS.admin;
            await setDoc(userRef, {
              email: u.email,
              displayName: activeDisplayName,
              fullName: activeDisplayName,
              photoURL: activePhotoURL || null,
              role: initialRole,
              permissions: initialPerms,
              status: "active",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            activeRole = initialRole;
            activePermissions = initialPerms;
          } else {
            const data = userSnap.data();
            activeRole = (data?.role || "staff") as UserRole;
            activePermissions = data?.permissions || DEFAULT_ROLE_PERMISSIONS[activeRole] || DEFAULT_ROLE_PERMISSIONS.staff;
            if (data?.displayName) activeDisplayName = data.displayName;
            if (data?.fullName && !activeDisplayName) activeDisplayName = data.fullName;
            if (data?.photoURL) activePhotoURL = data.photoURL;
          }
          
          setUserRole(activeRole);
          setUserPermissions(activePermissions);
          setUserDisplayName(activeDisplayName);
          setUserPhotoURL(activePhotoURL);
          setUser(u);
        } catch (err) {
          console.error("Error retrieving user document:", err);
          setUser(u);
          setUserRole("staff");
          setUserPermissions(DEFAULT_ROLE_PERMISSIONS.staff);
          setUserDisplayName(u.displayName || "");
          setUserPhotoURL(u.photoURL || "");
        }
      } else {
        setUser(null);
        setUserRole("staff");
        setUserPermissions(undefined);
        setUserDisplayName("");
        setUserPhotoURL("");
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-sans">Loading MTKN ITSM Portal...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans p-4">
        <motion.div
          initial={{ opacity: 0, y: 15, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white dark:bg-slate-800 p-8 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl text-center max-w-md w-full"
        >
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3 group hover:rotate-0 transition-transform overflow-hidden">
            {appLogo ? (
              <img src={appLogo} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <Shield className="w-8 h-8 text-white" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">MTKN ITSM</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">Secure Enterprise IT Operations Portal</p>
          
          <form onSubmit={handleCustomLogin} className="space-y-4 mb-6 text-left">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Username</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white transition-all"
                  placeholder="Username"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
            {loginError && <p className="text-red-500 dark:text-red-400 text-[10px] bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-100 dark:border-red-900/50">{loginError}</p>}
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-blue-600 text-white rounded-lg shadow-sm text-sm font-semibold hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors disabled:opacity-50 min-h-[44px] cursor-pointer"
            >
              {isLoggingIn ? "Signing in..." : <><LogIn className="w-4 h-4" /> Sign In</>}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700/50 text-[11px] text-slate-400 dark:text-slate-500 font-medium font-sans">
            Developed by <span className="text-slate-700 dark:text-slate-300 font-semibold">Saw Pyae Phyo Kyaw</span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <Router>
      <div className="flex flex-col md:flex-row h-screen bg-slate-50 dark:bg-slate-900 font-sans text-slate-800 dark:text-slate-200 overflow-hidden">
        <Sidebar 
          role={userRole} 
          userEmail={user?.email} 
          displayName={userDisplayName}
          photoURL={userPhotoURL}
          userPermissions={userPermissions}
          appLogo={appLogo}
          onLogoUpdate={handleLogoUpdate}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          isDarkMode={isDarkMode}
          toggleTheme={toggleTheme}
        />
        <main className="flex-1 flex flex-col overflow-y-auto bg-slate-50 dark:bg-slate-900">
          <Routes>
            <Route 
              path="/" 
              element={
                <PermissionGuard tabKey="dashboard" userRole={userRole} userPermissions={userPermissions}>
                  <ManagementDashboard userRole={userRole} userPermissions={userPermissions} />
                </PermissionGuard>
              } 
            />
            
            <Route 
              path="/reports" 
              element={
                <PermissionGuard tabKey="reports" userRole={userRole} userPermissions={userPermissions}>
                  <Reports userRole={userRole} userPermissions={userPermissions} />
                </PermissionGuard>
              } 
            />
            
            <Route 
              path="/users" 
              element={
                <PermissionGuard tabKey="users" userRole={userRole} userPermissions={userPermissions}>
                  <UsersPage userRole={userRole} userPermissions={userPermissions} />
                </PermissionGuard>
              } 
            />

            <Route 
              path="/calendar" 
              element={
                <PermissionGuard tabKey="calendar" userRole={userRole} userPermissions={userPermissions}>
                  <SupportCalendar userRole={userRole} userPermissions={userPermissions} />
                </PermissionGuard>
              } 
            />

            <Route 
              path="/repairs" 
              element={
                <PermissionGuard tabKey="repairs" userRole={userRole} userPermissions={userPermissions}>
                  <RepairsTracking userRole={userRole} userPermissions={userPermissions} />
                </PermissionGuard>
              } 
            />

            <Route 
              path="/tickets" 
              element={
                <PermissionGuard tabKey="tickets" userRole={userRole} userPermissions={userPermissions}>
                  <SupportTickets userRole={userRole} userPermissions={userPermissions} />
                </PermissionGuard>
              } 
            />

            <Route 
              path="/software" 
              element={
                <PermissionGuard tabKey="software" userRole={userRole} userPermissions={userPermissions}>
                  <SoftwareStatus userRole={userRole} userPermissions={userPermissions} />
                </PermissionGuard>
              } 
            />

            <Route 
              path="/isp" 
              element={
                <PermissionGuard tabKey="isp" userRole={userRole} userPermissions={userPermissions}>
                  <ISPManagement userRole={userRole} userPermissions={userPermissions} />
                </PermissionGuard>
              } 
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* User Profile Modal */}
        <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          currentUser={user}
          userRole={userRole}
          userPermissions={userPermissions}
          onProfileUpdated={handleProfileUpdated}
        />
      </div>
    </Router>
  );
}

