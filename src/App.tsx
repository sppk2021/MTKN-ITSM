import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { 
  LayoutDashboard, Users, BarChart3, CalendarDays, Wrench, LogOut, 
  Ticket, Globe, Server, Shield, Lock, User as UserIcon, LogIn, 
  ChevronLeft, ChevronRight, Download, Menu, X as CloseIcon 
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
import { cn } from "./lib/utils";
import { motion } from "motion/react";
import { PermissionGuard } from "./components/PermissionGuard";
import { TabKey, UserPermissions, DEFAULT_ROLE_PERMISSIONS, UserRole } from "./types";

interface SidebarProps {
  role: string;
  userEmail?: string;
  userPermissions?: UserPermissions;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tabKey: TabKey;
}

function Sidebar({ role, userEmail, userPermissions }: SidebarProps) {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem("sidebar_collapsed") === "true");
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    }
    return false;
  });

  useEffect(() => {
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

  const sidebarContent = (
    <div className={cn("p-6 flex-1 flex flex-col min-h-0", isCollapsed && "px-3 py-6")}>
      <div className={cn("flex items-center mb-8", isCollapsed ? "justify-center" : "justify-between")}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white shrink-0">MT</div>
          {(!isCollapsed || isMobileOpen) && <span className="text-white font-semibold text-lg tracking-tight truncate">MTKN ITSM</span>}
        </div>
        <div className="flex items-center gap-1">
          {!isCollapsed && (
            <button 
              onClick={toggleCollapse}
              className="hidden md:flex text-slate-400 hover:text-white min-w-[44px] min-h-[44px] rounded-lg hover:bg-slate-800 transition-colors items-center justify-center"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          {isMobileOpen && (
            <button 
              onClick={() => setIsMobileOpen(false)}
              className="md:hidden text-slate-400 hover:text-white min-w-[44px] min-h-[44px] rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center"
              title="Close menu"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {isCollapsed && (
        <button 
          onClick={toggleCollapse}
          className="hidden md:flex text-slate-400 hover:text-white min-w-[44px] min-h-[44px] rounded-lg hover:bg-slate-800 transition-colors mx-auto mb-6 items-center justify-center bg-slate-800/30"
          title="Expand sidebar"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      <nav className="space-y-1.5 flex-1 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-700/60 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3.5 py-3 rounded-lg text-sm font-medium transition-colors min-h-[44px]",
                isCollapsed && !isMobileOpen ? "justify-center px-2" : "",
                isActive
                  ? "bg-blue-600/10 text-blue-400 font-semibold"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )}
              title={isCollapsed && !isMobileOpen ? item.name : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {(!isCollapsed || isMobileOpen) && <span className="truncate">{item.name}</span>}
            </Link>
          );
        })}

        {!isInstalled && (
          <button
            onClick={handleInstallClick}
            className={cn(
              "w-full flex items-center gap-3 px-3.5 py-3 rounded-lg text-sm font-semibold transition-all min-h-[44px] mt-4",
              "bg-emerald-600/15 text-emerald-400 hover:bg-emerald-600/25 border border-emerald-500/30 shadow-sm cursor-pointer",
              isCollapsed && !isMobileOpen ? "justify-center px-2" : ""
            )}
            title="Install Application"
          >
            <Download className="w-5 h-5 flex-shrink-0 text-emerald-400" />
            {(!isCollapsed || isMobileOpen) && <span className="truncate">Install Application</span>}
          </button>
        )}
      </nav>

      <div className="mt-auto pt-4 space-y-4 shrink-0">
        <div className={cn("bg-slate-800 rounded-xl p-3.5", isCollapsed && !isMobileOpen && "p-2 text-center")}>
          {isCollapsed && !isMobileOpen ? (
            <div className="flex flex-col items-center gap-2.5">
              <div 
                className="w-8 h-8 bg-blue-600/20 text-blue-400 rounded-full flex items-center justify-center font-bold text-xs uppercase"
                title={`Role: ${role.replace('_', ' ').toUpperCase()}`}
              >
                {role[0].toUpperCase()}
              </div>
              <button
                onClick={() => signOut(auth)}
                className="text-slate-400 hover:text-white min-w-[44px] min-h-[44px] rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-center"
                title={`Sign Out (${userEmail || 'System User'})`}
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-2">Role: {role.replace('_', ' ').toUpperCase()}</p>
              <button
                onClick={() => signOut(auth)}
                className="flex items-center justify-between w-full text-left min-h-[44px] py-1 px-1 rounded-lg hover:bg-slate-700/50 transition-colors"
              >
               <div className="overflow-hidden pr-2">
                  <p className="text-xs text-white font-medium truncate">{userEmail || 'System User'}</p>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Sign Out</p>
               </div>
               <LogOut className="w-4 h-4 text-slate-400 flex-shrink-0" />
              </button>
            </>
          )}
        </div>
        {(!isCollapsed || isMobileOpen) && (
          <div className="text-[10px] text-slate-500 text-center font-mono tracking-wider pt-2 border-t border-slate-800/50">
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
          <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center font-bold text-xs">MT</div>
          <span className="font-semibold text-sm tracking-tight">MTKN ITSM</span>
        </div>
        <button
          onClick={() => setIsMobileOpen(true)}
          className="text-slate-300 hover:text-white p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-slate-800 transition-colors"
          title="Open Navigation Menu"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden md:flex bg-slate-900 flex-col border-r border-slate-800 transition-all duration-300 ease-in-out shrink-0 overflow-hidden",
        isCollapsed ? "w-16" : "w-60"
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
  const [userPermissions, setUserPermissions] = useState<UserPermissions | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const userRef = doc(db, "users", u.uid);
          const userSnap = await getDoc(userRef);
          let activeRole: UserRole = "staff";
          let activePermissions: UserPermissions = DEFAULT_ROLE_PERMISSIONS.staff;
          
          if (!userSnap.exists()) {
            const initialRole: UserRole = "admin";
            const initialPerms = DEFAULT_ROLE_PERMISSIONS.admin;
            await setDoc(userRef, {
              email: u.email,
              displayName: u.displayName || "",
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
          }
          
          setUserRole(activeRole);
          setUserPermissions(activePermissions);
          setUser(u);
        } catch (err) {
          console.error("Error retrieving user document:", err);
          setUser(u);
          setUserRole("staff");
          setUserPermissions(DEFAULT_ROLE_PERMISSIONS.staff);
        }
      } else {
        setUser(null);
        setUserRole("staff");
        setUserPermissions(undefined);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 font-sans">Loading MTKN ITSM Portal...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-800 font-sans p-4">
        <motion.div
          initial={{ opacity: 0, y: 15, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white p-8 border border-slate-200 rounded-2xl shadow-xl text-center max-w-md w-full"
        >
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3 group hover:rotate-0 transition-transform">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">MTKN ITSM</h2>
          <p className="text-slate-500 text-sm mb-8">Secure Enterprise IT Operations Portal</p>
          
          <form onSubmit={handleCustomLogin} className="space-y-4 mb-6 text-left">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Username</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="Username"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
            {loginError && <p className="text-red-500 text-[10px] bg-red-50 p-2 rounded border border-red-100">{loginError}</p>}
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg shadow-sm text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50 min-h-[44px] cursor-pointer"
            >
              {isLoggingIn ? "Signing in..." : <><LogIn className="w-4 h-4" /> Sign In</>}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-400 font-medium font-sans">
            Developed by <span className="text-slate-700 font-semibold">Saw Pyae Phyo Kyaw</span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <Router>
      <div className="flex flex-col md:flex-row h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden">
        <Sidebar role={userRole} userEmail={user?.email} userPermissions={userPermissions} />
        <main className="flex-1 flex flex-col overflow-y-auto">
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
      </div>
    </Router>
  );
}
