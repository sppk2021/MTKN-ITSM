const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const replacement = `  const renderRoutes = () => (
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
      <AppLogoSelectorModal 
        isOpen={isLogoModalOpen} 
        onClose={() => setIsLogoModalOpen(false)} 
        onSelectLogo={applyAppLogo} 
        onRemoveLogo={() => {
          setAppLogo(null);
          localStorage.removeItem("app_logo_cache");
        }}
        currentLogo={appLogo}
      />
      
      {/* Global Search Bar Modal */}
      <GlobalSearchBar
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
        onOpen={() => setIsGlobalSearchOpen(true)}
        userRole={userRole}
      />

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={user}
        userRole={userRole}
        userPermissions={userPermissions}
        onProfileUpdated={handleProfileUpdated}
      />

      <Routes>
        <Route path="/login" element={<Login appLogo={appLogo} />} />

        {userRole === 'guest' ? (
          <Route element={<PublicLayout appLogo={appLogo} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />}>
            <Route path="/" element={<PermissionGuard tabKey="dashboard" userRole={userRole} userPermissions={userPermissions}><ManagementDashboard userRole={userRole} userPermissions={userPermissions} /></PermissionGuard>} />
            <Route path="/reports" element={<PermissionGuard tabKey="reports" userRole={userRole} userPermissions={userPermissions}><Reports userRole={userRole} userPermissions={userPermissions} /></PermissionGuard>} />
            <Route path="/projects" element={<PermissionGuard tabKey="projects" userRole={userRole} userPermissions={userPermissions}><ClientProjects userRole={userRole} userPermissions={userPermissions} /></PermissionGuard>} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Route>
        ) : (
          <Route element={
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
                onOpenSearch={() => setIsGlobalSearchOpen(true)}
                isDarkMode={isDarkMode}
                toggleTheme={toggleTheme}
              />
              <main className="flex-1 flex flex-col overflow-y-auto bg-slate-50 dark:bg-slate-900 pb-20 md:pb-6">
                <TopNavbar
                  onOpenSearch={() => setIsGlobalSearchOpen(true)}
                  userRole={userRole}
                  displayName={userDisplayName}
                  userEmail={user?.email}
                  photoURL={userPhotoURL}
                  onOpenProfile={() => setIsProfileModalOpen(true)}
                  isDarkMode={isDarkMode}
                  toggleTheme={toggleTheme}
                />
                <Outlet />
              </main>
              {/* Mobile Bottom Navigation Bar for iOS & Android Web App UX */}
              <nav aria-label="Mobile Navigation" className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center justify-around shadow-xl pb-[env(safe-area-inset-bottom)]">
                <Link
                  to="/"
                  className="flex flex-col items-center justify-center p-1.5 rounded-xl text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors"
                >
                  <LayoutDashboard className="w-5 h-5 mb-0.5" />
                  <span>Home</span>
                </Link>
                <Link
                  to="/tickets"
                  className="flex flex-col items-center justify-center p-1.5 rounded-xl text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors"
                >
                  <Ticket className="w-5 h-5 mb-0.5" />
                  <span>Tickets</span>
                </Link>
                <Link
                  to="/repairs"
                  className="flex flex-col items-center justify-center p-1.5 rounded-xl text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors"
                >
                  <Wrench className="w-5 h-5 mb-0.5" />
                  <span>Repairs</span>
                </Link>
                <Link
                  to="/isp"
                  className="flex flex-col items-center justify-center p-1.5 rounded-xl text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors"
                >
                  <Globe className="w-5 h-5 mb-0.5" />
                  <span>ISP</span>
                </Link>
                <Link
                  to="/reports"
                  className="flex flex-col items-center justify-center p-1.5 rounded-xl text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors"
                >
                  <BarChart3 className="w-5 h-5 mb-0.5" />
                  <span>Reports</span>
                </Link>
              </nav>
            </div>
          }>
            <Route path="/" element={<PermissionGuard tabKey="dashboard" userRole={userRole} userPermissions={userPermissions}><ManagementDashboard userRole={userRole} userPermissions={userPermissions} /></PermissionGuard>} />
            <Route path="/reports" element={<PermissionGuard tabKey="reports" userRole={userRole} userPermissions={userPermissions}><Reports userRole={userRole} userPermissions={userPermissions} /></PermissionGuard>} />
            <Route path="/users" element={<PermissionGuard tabKey="users" userRole={userRole} userPermissions={userPermissions}><UsersPage userRole={userRole} userPermissions={userPermissions} /></PermissionGuard>} />
            <Route path="/calendar" element={<PermissionGuard tabKey="calendar" userRole={userRole} userPermissions={userPermissions}><SupportCalendar userRole={userRole} userPermissions={userPermissions} /></PermissionGuard>} />
            <Route path="/repairs" element={<PermissionGuard tabKey="repairs" userRole={userRole} userPermissions={userPermissions}><RepairsTracking userRole={userRole} userPermissions={userPermissions} /></PermissionGuard>} />
            <Route path="/tickets" element={<PermissionGuard tabKey="tickets" userRole={userRole} userPermissions={userPermissions}><SupportTickets userRole={userRole} userPermissions={userPermissions} /></PermissionGuard>} />
            <Route path="/software" element={<PermissionGuard tabKey="software" userRole={userRole} userPermissions={userPermissions}><SoftwareStatus userRole={userRole} userPermissions={userPermissions} /></PermissionGuard>} />
            <Route path="/isp" element={<PermissionGuard tabKey="isp" userRole={userRole} userPermissions={userPermissions}><ISPManagement userRole={userRole} userPermissions={userPermissions} /></PermissionGuard>} />
            <Route path="/projects" element={<PermissionGuard tabKey="projects" userRole={userRole} userPermissions={userPermissions}><ClientProjects userRole={userRole} userPermissions={userPermissions} /></PermissionGuard>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </>
  );
`;

const splitString = "  return (\n      <div className=\"flex flex-col md:flex-row h-screen bg-slate-50 dark:bg-slate-900 font-sans text-slate-800 dark:text-slate-200 overflow-hidden\">";

const parts = code.split(splitString);
if (parts.length === 2) {
  const newCode = parts[0] + replacement + "\n}\n";
  fs.writeFileSync('src/App.tsx', newCode);
  console.log("Success");
} else {
  console.log("Failed to split", parts.length);
}
