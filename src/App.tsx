import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { LayoutDashboard, Users, BarChart3, CalendarDays, Wrench, LogOut, Ticket, Globe, Server, Shield, Lock, User as UserIcon, LogIn, ChevronLeft, ChevronRight } from "lucide-react";
import { auth, db } from "./lib/firebase";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, signInWithEmailAndPassword } from "firebase/auth";
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

interface SidebarProps {
  role: string;
  userEmail?: string;
}

function Sidebar({ role, userEmail }: SidebarProps) {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem("sidebar_collapsed") === "true");

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("sidebar_collapsed", String(next));
      return next;
    });
  };

  const allNavigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Users', href: '/users', icon: Users, minRole: 'admin' },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
    { name: 'Calendar', href: '/calendar', icon: CalendarDays },
    { name: 'Repairs', href: '/repairs', icon: Wrench },
    { name: 'Tickets', href: '/tickets', icon: Ticket },
    { name: 'Licenses', href: '/software', icon: Server },
    { name: 'ISP Mgmt', href: '/isp', icon: Globe },
  ];

  // Restrict sidebar items based on role
  const navigation = allNavigation.filter(item => {
    if (role === 'management') {
      // Management only gets access to the ready-to-use Reports and executive Overview Dashboard
      return item.name === 'Dashboard' || item.name === 'Reports';
    }
    if (item.minRole === 'admin' && role !== 'admin') {
      return false;
    }
    return true;
  });

  return (
    <aside className={cn(
      "bg-slate-900 flex flex-col border-r border-slate-200 transition-all duration-300 ease-in-out shrink-0 overflow-hidden",
      isCollapsed ? "w-16" : "w-60"
    )}>
      <div className={cn("p-6 flex-1 flex flex-col min-h-0", isCollapsed && "px-3 py-6")}>
        <div className={cn("flex items-center mb-8", isCollapsed ? "justify-center" : "justify-between")}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white shrink-0">MT</div>
            {!isCollapsed && <span className="text-white font-semibold text-lg tracking-tight truncate">MTKN ITSM</span>}
          </div>
          {!isCollapsed && (
            <button 
              onClick={toggleCollapse}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {isCollapsed && (
          <button 
            onClick={toggleCollapse}
            className="text-slate-400 hover:text-white p-2 rounded hover:bg-slate-800 transition-colors mx-auto mb-6 flex items-center justify-center bg-slate-800/30"
            title="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        <nav className="space-y-1 flex-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  isCollapsed ? "justify-center px-2" : "",
                  isActive
                    ? "bg-blue-600/10 text-blue-400 font-medium"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )}
                title={isCollapsed ? item.name : undefined}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {!isCollapsed && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="mt-auto p-4 space-y-4 shrink-0">
        <div className={cn("bg-slate-800 rounded-lg p-3", isCollapsed && "p-2 text-center")}>
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div 
                className="w-7 h-7 bg-blue-600/20 text-blue-400 rounded-full flex items-center justify-center font-bold text-xs uppercase"
                title={`Role: ${role.replace('_', ' ').toUpperCase()}`}
              >
                {role[0].toUpperCase()}
              </div>
              <button
                onClick={() => signOut(auth)}
                className="text-slate-400 hover:text-white p-1.5 rounded hover:bg-slate-700 transition-colors"
                title={`Sign Out (${userEmail || 'System User'})`}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-2">Role: {role.replace('_', ' ').toUpperCase()}</p>
              <button
                onClick={() => signOut(auth)}
                className="flex items-center justify-between w-full text-left"
              >
               <div className="overflow-hidden">
                  <p className="text-xs text-white font-medium truncate">{userEmail || 'System User'}</p>
                  <p className="text-[10px] text-slate-500 uppercase">Sign Out</p>
               </div>
               <LogOut className="w-4 h-4 text-slate-400 flex-shrink-0" />
              </button>
            </>
          )}
        </div>
        {!isCollapsed && (
          <div className="text-[10px] text-slate-500 text-center font-mono tracking-wider pt-2 border-t border-slate-800/50">
            Developed by <span className="text-slate-400 font-sans font-medium">Saw Pyae Phyo Kyaw</span>
          </div>
        )}
      </div>
    </aside>
  );
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("staff");
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
        const userRef = doc(db, "users", u.uid);
        const userSnap = await getDoc(userRef);
        let activeRole = "staff";
        
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            email: u.email,
            displayName: u.displayName || "",
            role: "admin", // default to admin for demo
            status: "active",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          activeRole = "admin";
        } else {
          activeRole = userSnap.data()?.role || "staff";
        }
        
        setUserRole(activeRole);
        setUser(u);
      } else {
        setUser(null);
        setUserRole("staff");
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 font-sans">Loading...</div>;
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
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg shadow-sm text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {isLoggingIn ? "Signing in..." : <><LogIn className="w-4 h-4" /> Sign In</>}
            </button>
          </form>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest"><span className="bg-white px-2 text-slate-400">Or continue with</span></div>
          </div>

          <button
            onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg shadow-sm text-sm font-semibold hover:bg-slate-50 transition-colors mb-6"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fillRule="evenodd" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fillRule="evenodd" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fillRule="evenodd" />
            </svg>
            Google Login
          </button>

          <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-400 font-medium font-sans">
            Developed by <span className="text-slate-700 font-semibold">Saw Pyae Phyo Kyaw</span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <Router>
      <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden">
        <Sidebar role={userRole} userEmail={user?.email} />
        <main className="flex-1 flex flex-col overflow-y-auto">
          <Routes>
            <Route path="/" element={<ManagementDashboard />} />
            <Route path="/reports" element={<Reports />} />
            
            <Route 
              path="/users" 
              element={
                <PermissionGuard userRole={userRole} allowedRoles={["admin"]}>
                  <UsersPage />
                </PermissionGuard>
              } 
            />
            <Route 
              path="/calendar" 
              element={
                <PermissionGuard userRole={userRole} allowedRoles={["admin", "it_assistant", "staff"]}>
                  <SupportCalendar userRole={userRole} />
                </PermissionGuard>
              } 
            />
            <Route 
              path="/repairs" 
              element={
                <PermissionGuard userRole={userRole} allowedRoles={["admin", "it_assistant", "staff"]}>
                  <RepairsTracking userRole={userRole} />
                </PermissionGuard>
              } 
            />
            <Route 
              path="/tickets" 
              element={
                <PermissionGuard userRole={userRole} allowedRoles={["admin", "it_assistant", "staff"]}>
                  <SupportTickets userRole={userRole} />
                </PermissionGuard>
              } 
            />
            <Route 
              path="/software" 
              element={
                <PermissionGuard userRole={userRole} allowedRoles={["admin", "it_assistant", "staff"]}>
                  <SoftwareStatus userRole={userRole} />
                </PermissionGuard>
              } 
            />
            <Route 
              path="/isp" 
              element={
                <PermissionGuard userRole={userRole} allowedRoles={["admin", "it_assistant", "staff"]}>
                  <ISPManagement userRole={userRole} />
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
