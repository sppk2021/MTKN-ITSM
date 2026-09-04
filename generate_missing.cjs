const fs = require('fs');

const missingCode = `
          <AppLogoSelectorModal
            isOpen={isLogoModalOpen}
            onClose={() => setIsLogoModalOpen(false)}
            currentLogo={appLogo || null}
            onSelectLogo={newLogo => {
              if (onLogoUpdate) onLogoUpdate(newLogo);
            }}
          />
          {(!isCollapsed || isMobileOpen) && (
            <span className="text-slate-900 dark:text-white font-bold text-lg tracking-tight truncate flex-1">
              MTKN ITSM
            </span>
          )}
        </div>
        
        {(!isCollapsed || isMobileOpen) && (
          <button
            onClick={toggleCollapse}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className={cn(
        "mb-4 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-xl border border-blue-100 dark:border-blue-900/50 flex items-center justify-between transition-all",
        isCollapsed && !isMobileOpen ? "opacity-0 invisible h-0 overflow-hidden py-0 mb-0" : "opacity-100 visible h-auto"
      )}>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 shrink-0" />
          <span className="text-xs font-semibold capitalize tracking-wide">{role.replace('_', ' ')} Portal</span>
        </div>
        <SyncStatusBadge isOnline={isOnline} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1 custom-scrollbar">
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
                      : "bg-blue-50 dark:bg-blue-600/15 text-blue-600 dark:text-blue-400 font-semibold border border-blue-200 dark:border-blue-500/20"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {(!isCollapsed || isMobileOpen) && <span className="truncate">{item.name}</span>}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* User Profile Section in Sidebar */}
      {role === 'guest' ? (
        <div className="pt-3 shrink-0">
          <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-2 flex justify-center">
             <Link
               to="/login"
               className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
             >
               <LogIn className="w-4 h-4" />
               {!isCollapsed || isMobileOpen ? "Sign In" : ""}
             </Link>
          </div>
        </div>
      ) : (
        <div className="pt-3 shrink-0">
          {isCollapsed && !isMobileOpen ? (
            /* Collapsed User Controls */
            <div className="flex flex-col items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              {/* Avatar Button with Tooltip */}
              <div className="relative group">
                <button
                  onClick={() => onOpenProfile()}
                  className="w-11 h-11 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-900 dark:text-white transition-all cursor-pointer relative"
                >
                  {photoURL ? (
                    <img src={photoURL} alt="Profile" className="w-full h-full rounded-xl object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-xs">
                      {userInitials}
                    </div>
                  )}
                  <div className={cn("absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900", isOnline ? "bg-emerald-500" : "bg-rose-500")} title={isOnline ? "Online" : "Offline"} />
                </button>

                <div className="pointer-events-none absolute left-full bottom-0 ml-3 px-3 py-2 bg-slate-800 dark:bg-slate-950 text-white text-xs rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
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
                  className="w-10 h-10 rounded-xl text-slate-400 dark:text-slate-500 hover:text-rose-400 hover:bg-rose-500/15 transition-colors flex items-center justify-center cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>

                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-slate-800 dark:bg-slate-950 text-rose-400 dark:text-rose-300 text-xs font-semibold rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
                  Sign Out
                </div>
              </div>
            </div>
          ) : (
            /* Expanded User Controls */
            <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-3 space-y-2.5">
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
                  <div className={cn("absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-200 dark:border-slate-800", isOnline ? "bg-emerald-500" : "bg-rose-500")} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {displayName || userEmail?.split('@')[0] || "My Profile"}
                    </p>
                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      <span className={cn("w-1.5 h-1.5 rounded-full", isOnline ? "bg-emerald-500" : "bg-rose-500")}></span>
                      <span className={cn("text-[9px] font-medium tracking-wide", isOnline ? "text-emerald-400" : "text-rose-400")}>{isOnline ? "ONLINE" : "OFFLINE"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/80 px-1.5 py-0.2 rounded border border-blue-200 dark:border-blue-800/60">
                      {role.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate font-mono">
                      Edit Profile
                    </span>
                  </div>
                </div>

                <Settings2 className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-blue-400 transition-colors shrink-0" />
              </button>

              {/* Sign out button */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/50 flex items-center justify-between px-1">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[120px] font-mono">
                  {userEmail || 'user@mtknitsm.local'}
                </span>
                <button
                  onClick={() => signOut(auth)}
                  className="text-slate-400 dark:text-slate-500 hover:text-rose-400 text-[11px] font-semibold flex items-center gap-1 hover:bg-rose-500/10 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                  title="Sign out of account"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {(!isCollapsed || isMobileOpen) && (
        <div className="text-[10px] text-slate-500 dark:text-slate-400 text-center font-mono tracking-wider pt-2">
          Developed by <span className="text-slate-400 dark:text-slate-500 font-sans font-medium">Saw Pyae Phyo Kyaw</span>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 h-14 flex items-center justify-between shrink-0 text-slate-900 dark:text-white z-20">
        <div className="flex items-center gap-2.5">
          <div className={cn("w-7 h-7 rounded flex items-center justify-center font-bold text-xs shadow-sm overflow-hidden", !appLogo && "bg-blue-600 text-white")}>
            {appLogo ? (
              <img src={appLogo} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              "MT"
            )}
          </div>
          <span className="font-semibold text-sm tracking-tight">MTKN ITSM</span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Mobile Global Search Button */}
          {onOpenSearch && (
            <button
              onClick={onOpenSearch}
              className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Search className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="p-2 -mr-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            {isMobileOpen ? <CloseIcon className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={cn(
          "fixed md:static inset-y-0 left-0 z-50 h-[100dvh] flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-2xl md:shadow-none",
          isMobileOpen ? "translate-x-0 w-[280px]" : "-translate-x-full md:translate-x-0",
          !isMobileOpen && isCollapsed ? "md:w-20" : "md:w-[280px]"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("guest");
  const [userDisplayName, setUserDisplayName] = useState<string>("");
  const [userPhotoURL, setUserPhotoURL] = useState<string>("");
  const [userPermissions, setUserPermissions] = useState<UserPermissions | undefined>(undefined);
  const [appLogo, setAppLogo] = useState<string | null>(() => {
    return localStorage.getItem("app_logo_cache") || null;
  });
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const savedTheme = localStorage.getItem("theme");
    return savedTheme === "dark" || (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches);
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

  const applyAppLogo = (logoData: string) => {
    setAppLogo(logoData);
    localStorage.setItem("app_logo_cache", logoData);
  };

  const handleLogoUpdate = (newLogo: string) => {
    applyAppLogo(newLogo);
  };

  const handleProfileUpdated = (updatedData: { displayName: string; photoURL?: string; email?: string }) => {
    if (updatedData.displayName) {
      setUserDisplayName(updatedData.displayName);
    }
    if (updatedData.photoURL !== undefined) {
      setUserPhotoURL(updatedData.photoURL);
    }
    if (updatedData.email && user) {
      setUser({ ...user, email: updatedData.email });
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
        } catch (error) {
          console.error("Error fetching user data:", error);
          setUser(u);
          setUserRole("guest");
          setUserPermissions(DEFAULT_ROLE_PERMISSIONS.guest);
          setUserDisplayName(u.displayName || "");
          setUserPhotoURL(u.photoURL || "");
        }
      } else {
        setUser(null);
        setUserRole("guest");
        setUserPermissions(DEFAULT_ROLE_PERMISSIONS.guest);
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

  const renderRoutes = () => (
    <Routes>
      <Route path="/login" element={<Login appLogo={appLogo} />} />

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

      <Route 
        path="/projects" 
        element={
          <PermissionGuard tabKey="projects" userRole={userRole} userPermissions={userPermissions}>
            <ClientProjects userRole={userRole} userPermissions={userPermissions} />
          </PermissionGuard>
        } 
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );

  return (
    <>
`;

let code = fs.readFileSync('src/App.tsx', 'utf8');

// Insert it right after the Settings2 text-white
const splitToken = "<Settings2 className=\"w-4 h-4 text-white\" />\n              </div>\n            )}\n          </button>";
const parts = code.split(splitToken);

if (parts.length === 2) {
  // Now we need to remove everything that was duplicated or wrong up to `{/* Global Search Bar Modal */}`
  const bottomSplitToken = "{/* Global Search Bar Modal */}";
  const bottomParts = parts[1].split(bottomSplitToken);
  
  if (bottomParts.length === 2) {
    fs.writeFileSync('src/App.tsx', parts[0] + splitToken + missingCode + bottomSplitToken + bottomParts[1]);
    console.log("Successfully rebuilt!");
  } else {
    console.log("Bottom token not found!");
  }
} else {
  console.log("Top token not found!", parts.length);
}

