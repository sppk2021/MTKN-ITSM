import React, { useEffect, useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { collection, query, getDocs, doc, updateDoc, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { createUserWithEmailAndPassword, updatePassword } from "firebase/auth";
import { 
  UserPlus, Shield, X, Key, Trash2, RefreshCw, Eye, EyeOff, 
  Copy, Check, Sliders, Lock, Search, ShieldCheck, CheckCircle2,
  Mail, Edit2, Building2, Phone, User as UserIcon
} from "lucide-react";
import { saveTicketsLocal } from "../lib/offlineStorage";
import { 
  User, 
  UserRole, 
  UserPermissions, 
  DEFAULT_ROLE_PERMISSIONS, 
  TabPermissions 
} from "../types";
import { PermissionsEditor, formatPermissionsSummary } from "../components/PermissionsEditor";

interface UsersPageProps {
  userRole?: string;
  userPermissions?: UserPermissions;
}

export default function UsersPage({ userRole = 'admin', userPermissions }: UsersPageProps) {
  const location = useLocation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('search') || (location.state as any)?.searchQuery;
    if (q) {
      setSearchQuery(q);
    }
  }, [location.search, location.state]);
  
  // Add User state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState<{
    username: string;
    email: string;
    password: string;
    role: UserRole;
    permissions: UserPermissions;
  }>({ 
    username: '', 
    email: '',
    password: '', 
    role: 'it_assistant',
    permissions: JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS.it_assistant))
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit User Details (Email, Name, Role, Dept, Phone) state
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
  const [editFormData, setEditFormData] = useState<{
    email: string;
    displayName: string;
    fullName: string;
    role: UserRole;
    department: string;
    phone: string;
    status: string;
  }>({
    email: '',
    displayName: '',
    fullName: '',
    role: 'staff',
    department: '',
    phone: '',
    status: 'active'
  });
  const [isSavingUserEdit, setIsSavingUserEdit] = useState(false);

  // Edit Permissions state
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState<User | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<UserPermissions | null>(null);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  // Password visibility state
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Password change state
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<User | null>(null);
  const [changePasswordValue, setChangePasswordValue] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // System Wipe state
  const [isClearingData, setIsClearingData] = useState(false);

  // Permission checks for current user
  const canEditUsers = userRole === 'admin' || (userPermissions?.users?.edit ?? false);
  const canDeleteUsers = userRole === 'admin' || (userPermissions?.users?.delete ?? false);

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const getUserPassword = (user: any) => {
    if (user.password) return user.password;
    if (user.initialPassword) return user.initialPassword;
    const emailLower = (user.email || '').toLowerCase();
    if (emailLower.includes('admin')) return 'admin123';
    return '123456';
  };

  const copyPassword = (userId: string, pass: string) => {
    navigator.clipboard.writeText(pass);
    setCopiedId(userId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(query(collection(db, "users")));
      const list = snap.docs.map(docItem => {
        const data = docItem.data();
        const role = (data.role || 'staff') as UserRole;
        const effectivePerms = data.permissions || DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.staff;
        return { 
          id: docItem.id, 
          ...data,
          role,
          permissions: effectivePerms
        } as User;
      });
      setUsers(list);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!canEditUsers) {
      alert("Permission Denied: You do not have permission to modify user roles.");
      return;
    }
    try {
      const roleKey = newRole as UserRole;
      const roleDefaultPerms = DEFAULT_ROLE_PERMISSIONS[roleKey] || DEFAULT_ROLE_PERMISSIONS.staff;
      
      await updateDoc(doc(db, "users", userId), { 
        role: newRole, 
        permissions: roleDefaultPerms,
        updatedAt: serverTimestamp() 
      });
      setUsers(users.map(u => u.id === userId ? { ...u, role: roleKey, permissions: roleDefaultPerms } : u));
    } catch (error) {
      console.error(error);
      alert("Failed to update user role");
    }
  };

  const handleOpenPermissionsModal = (user: User) => {
    setSelectedUserForPermissions(user);
    const initialPerms = user.permissions 
      ? JSON.parse(JSON.stringify(user.permissions))
      : JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS[user.role] || DEFAULT_ROLE_PERMISSIONS.staff));
    setEditingPermissions(initialPerms);
  };

  const handleSavePermissions = async () => {
    if (!selectedUserForPermissions || !editingPermissions) return;
    if (!canEditUsers) {
      alert("Permission Denied: You do not have permission to modify user permissions.");
      return;
    }

    setIsSavingPermissions(true);
    try {
      await updateDoc(doc(db, "users", selectedUserForPermissions.id), {
        permissions: editingPermissions,
        updatedAt: serverTimestamp()
      });

      setUsers(users.map(u => u.id === selectedUserForPermissions.id ? { ...u, permissions: editingPermissions } : u));
      setSelectedUserForPermissions(null);
      setEditingPermissions(null);
      alert(`Permissions updated successfully for user ${selectedUserForPermissions.username || selectedUserForPermissions.email}`);
    } catch (error: any) {
      console.error("Error updating permissions:", error);
      alert(`Failed to save permissions: ${error.message}`);
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const toggleStatus = async (userId: string, currentStatus: string) => {
    if (!canEditUsers) {
      alert("Permission Denied: You do not have permission to change user status.");
      return;
    }
    try {
      const newStatus = currentStatus === "active" ? "disabled" : "active";
      await updateDoc(doc(db, "users", userId), { status: newStatus, updatedAt: serverTimestamp() });
      setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    } catch (error) {
      console.error(error);
      alert("Failed to toggle status");
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForPassword || !changePasswordValue) return;

    if (!canEditUsers) {
      alert("Permission Denied: You do not have permission to update passwords.");
      return;
    }

    if (changePasswordValue.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    setIsChangingPassword(true);
    try {
      if (auth.currentUser && selectedUserForPassword.id === auth.currentUser.uid) {
        await updatePassword(auth.currentUser, changePasswordValue);
      }

      await updateDoc(doc(db, "users", selectedUserForPassword.id), {
        password: changePasswordValue,
        passwordResetAt: serverTimestamp(),
        lastUpdatedBy: auth.currentUser?.email || "admin",
        updatedAt: serverTimestamp()
      });

      setUsers(users.map(u => u.id === selectedUserForPassword.id ? { ...u, password: changePasswordValue } : u));
      alert(`Password updated successfully for user ${selectedUserForPassword.username || selectedUserForPassword.email}`);
      setSelectedUserForPassword(null);
      setChangePasswordValue('');
    } catch (error: any) {
      console.error("Password update error:", error);
      alert(`Notice: ${error.message}. User doc metadata updated.`);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleOpenEditModal = (user: User) => {
    setSelectedUserForEdit(user);
    setEditFormData({
      email: user.email || '',
      displayName: user.displayName || user.username || '',
      fullName: user.fullName || '',
      role: user.role || 'staff',
      department: user.department || '',
      phone: user.phone || '',
      status: user.status || 'active'
    });
  };

  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForEdit) return;

    if (!canEditUsers) {
      alert("Permission Denied: You do not have permission to modify user details.");
      return;
    }

    const trimmedEmail = editFormData.email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      alert("Please provide a valid email address.");
      return;
    }

    setIsSavingUserEdit(true);
    try {
      const updatePayload: Record<string, any> = {
        email: trimmedEmail,
        displayName: editFormData.displayName.trim() || editFormData.fullName.trim() || selectedUserForEdit.username,
        fullName: editFormData.fullName.trim(),
        role: editFormData.role,
        department: editFormData.department.trim(),
        phone: editFormData.phone.trim(),
        status: editFormData.status,
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, "users", selectedUserForEdit.id), updatePayload);

      setUsers(users.map(u => u.id === selectedUserForEdit.id ? { 
        ...u, 
        ...updatePayload 
      } : u));

      setSelectedUserForEdit(null);
      alert(`User profile for "${updatePayload.displayName || trimmedEmail}" updated successfully!`);
    } catch (error: any) {
      console.error("Error updating user details:", error);
      alert(`Failed to save user updates: ${error.message}`);
    } finally {
      setIsSavingUserEdit(false);
    }
  };

  const handleClearSystemData = async () => {
    if (!canDeleteUsers) {
      alert("Permission Denied: Only administrators with delete privileges can clear system data.");
      return;
    }

    const confirmation = window.confirm(
      "WARNING: Are you sure you want to clear ALL operational data?\n\nThis will permanently delete all Support Tickets, ISP records, Repairs, Software Licenses, and Calendar events.\n\nONLY User Account records will remain!"
    );

    if (!confirmation) return;

    setIsClearingData(true);
    try {
      const collectionsToClear = ["tickets", "isps", "isp_accounts", "repairs", "licenses", "software_licenses", "calendar", "calendarEvents"];

      for (const colName of collectionsToClear) {
        try {
          const snap = await getDocs(query(collection(db, colName)));
          for (const docItem of snap.docs) {
            await deleteDoc(doc(db, colName, docItem.id));
          }
        } catch (e) {
          console.warn(`Collection ${colName} clear warning:`, e);
        }
      }

      // Clear local IndexedDB store
      await saveTicketsLocal([]);

      alert("System Data Cleared Successfully!\n\nAll tickets, ISPs, software licenses, and repairs records have been wiped. Only User Accounts remain.");
    } catch (error) {
      console.error("Failed to clear system data:", error);
      alert("An error occurred while clearing system data.");
    } finally {
      setIsClearingData(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) {
      alert("Username and password are required.");
      return;
    }
    if (newUser.password.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const email = newUser.email.trim() || `${newUser.username.toLowerCase()}@mtknitsm.local`;
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, newUser.password);
      const uid = userCredential.user.uid;

      await setDoc(doc(db, "users", uid), {
        username: newUser.username,
        email: email,
        password: newUser.password,
        role: newUser.role,
        permissions: newUser.permissions,
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setShowAddModal(false);
      setNewUser({ 
        username: '', 
        email: '',
        password: '', 
        role: 'it_assistant',
        permissions: JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS.it_assistant))
      });
      fetchUsers();
      alert(`User account "${newUser.username}" (${email}) created successfully!`);
    } catch (error: any) {
      console.error("Error adding user:", error);
      alert(`Error creating user: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const term = searchQuery.toLowerCase();
      return (
        (u.username?.toLowerCase() || '').includes(term) ||
        (u.email?.toLowerCase() || '').includes(term) ||
        (u.role?.toLowerCase() || '').includes(term) ||
        (u.status?.toLowerCase() || '').includes(term)
      );
    });
  }, [users, searchQuery]);

  return (
    <>
      <header className="min-h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-8 py-3 sm:py-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            User Management & Permissions
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Manage user accounts, roles, security credentials, and granular tab view/edit/delete permissions</p>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {canDeleteUsers && (
            <button
              onClick={handleClearSystemData}
              disabled={isClearingData}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3 py-2 rounded-lg text-xs font-semibold transition-colors shadow-sm cursor-pointer min-h-[44px]"
              title="Wipe all tickets, ISPs, and repairs data leaving only user accounts"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
              <span>{isClearingData ? "Clearing Data..." : "Clear System Data"}</span>
            </button>
          )}

          {canEditUsers && (
            <button
              onClick={() => {
                setNewUser({
                  username: '',
                  password: '',
                  role: 'it_assistant',
                  permissions: JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS.it_assistant))
                });
                setShowAddModal(true);
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm cursor-pointer min-h-[44px]"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add User</span>
            </button>
          )}
        </div>
      </header>
      
      <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">
        {/* Search and Filters Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search user accounts by username, email, or role..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0">
            <span>Total Accounts: <strong className="text-slate-800 dark:text-slate-200 font-bold">{users.length}</strong></span>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800 text-left">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-5 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Username / Email</th>
                  <th className="px-5 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Password</th>
                  <th className="px-5 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Role</th>
                  <th className="px-5 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tab Permissions</th>
                  <th className="px-5 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-right text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400 dark:text-slate-500">Loading user accounts...</td>
                  </tr>
                ) : filteredUsers.map((user) => {
                  const permSummary = formatPermissionsSummary(user.permissions);
                  return (
                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <td className="px-5 py-3.5 whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 border border-slate-300 dark:border-slate-600 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
                            {user.photoURL ? (
                              <img src={user.photoURL} alt={user.displayName || user.username} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              (user.displayName || user.fullName || user.username || user.email || 'U').substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{user.displayName || user.fullName || user.username || user.email?.split('@')[0]}</span>
                              {user.id === auth.currentUser?.uid && (
                                <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-bold uppercase">You</span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-slate-700 dark:text-slate-300 font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded text-slate-800 dark:text-slate-200 tracking-wider font-semibold">
                            {visiblePasswords[user.id]
                              ? getUserPassword(user)
                              : "••••••••"}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(user.id)}
                            className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                            title={visiblePasswords[user.id] ? "Hide password" : "Show password"}
                          >
                            {visiblePasswords[user.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyPassword(user.id, getUserPassword(user))}
                            className="p-1 text-slate-400 dark:text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                            title="Copy password"
                          >
                            {copiedId === user.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-slate-500 dark:text-slate-400">
                        {canEditUsers ? (
                          <select
                            value={user.role || 'staff'}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1 outline-none text-slate-800 dark:text-slate-200 font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow min-h-[36px]"
                          >
                            <option value="admin">Admin</option>
                            <option value="management">Management</option>
                            <option value="it_assistant">IT Assistant</option>
                            <option value="staff">Staff</option>
                          </select>
                        ) : (
                          <span className="font-semibold text-slate-700 dark:text-slate-300 uppercase text-[11px]">{user.role}</span>
                        )}
                      </td>

                      {/* Granular Permissions Column */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${ permSummary.tone === 'full' ? 'bg-blue-50 text-blue-700 border-blue-200' : permSummary.tone === 'none' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200' }`}>
                            {permSummary.label}
                          </span>
                          {canEditUsers && (
                            <button
                              type="button"
                              onClick={() => handleOpenPermissionsModal(user)}
                              className="p-1 text-slate-400 dark:text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                              title="Edit manual tab permissions (View, Edit, Delete)"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-right font-medium flex items-center justify-end gap-1.5">
                        {canEditUsers && (
                          <button
                            onClick={() => handleOpenPermissionsModal(user)}
                            className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer min-h-[36px]"
                            title="Edit Permissions"
                          >
                            <Sliders className="w-3.5 h-3.5 text-blue-600" />
                            <span className="hidden lg:inline">Permissions</span>
                          </button>
                        )}

                        {canEditUsers && (
                          <button
                            onClick={() => setSelectedUserForPassword(user)}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer min-h-[36px]"
                            title="Change Password"
                          >
                            <Key className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Password</span>
                          </button>
                        )}

                        {canEditUsers && (
                          <button
                            onClick={() => toggleStatus(user.id, user.status)}
                            className={`text-xs font-semibold min-h-[36px] px-2 rounded cursor-pointer ${user.status === 'active' ? 'text-red-600 hover:text-red-800 hover:bg-red-50' : 'text-green-600 hover:text-green-800 hover:bg-green-50'}`}
                          >
                            {user.status === 'active' ? 'Disable' : 'Enable'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!loading && filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-500 dark:text-slate-400">No user accounts found matching your query.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit User Permissions Modal */}
      {selectedUserForPermissions && editingPermissions && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-xl border border-slate-200 dark:border-slate-700 shadow-2xl my-8">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-blue-600" />
                  <span>Manual Tab Permissions</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Configure custom View, Edit, and Delete access for <strong className="text-slate-800 dark:text-slate-200">{selectedUserForPermissions.username || selectedUserForPermissions.email}</strong> (Role: <span className="uppercase text-blue-600 font-semibold">{selectedUserForPermissions.role}</span>)
                </p>
              </div>
              <button 
                onClick={() => { setSelectedUserForPermissions(null); setEditingPermissions(null); }} 
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <PermissionsEditor
                permissions={editingPermissions}
                onChange={setEditingPermissions}
                currentRole={selectedUserForPermissions.role}
              />

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => { setSelectedUserForPermissions(null); setEditingPermissions(null); }}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePermissions}
                  disabled={isSavingPermissions}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer min-h-[44px] flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isSavingPermissions ? "Saving Permissions..." : "Save Tab Permissions"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {selectedUserForPassword && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-sm border border-slate-200 dark:border-slate-700 shadow-xl">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-blue-600" />
                <span>Change User Password</span>
              </h2>
              <button onClick={() => setSelectedUserForPassword(null)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Updating password for <strong className="text-slate-800 dark:text-slate-200">{selectedUserForPassword.username || selectedUserForPassword.email}</strong>
            </p>
            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">New Password</label>
                <input
                  required
                  type="password"
                  value={changePasswordValue}
                  onChange={e => setChangePasswordValue(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[44px]"
                  placeholder="At least 6 characters"
                />
              </div>
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserForPassword(null)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50 min-h-[44px]"
                >
                  {isChangingPassword ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add User Modal with Tab Permissions Configuration */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-2xl border border-slate-200 dark:border-slate-700 shadow-2xl my-8">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-blue-600" />
                  <span>Create User Account with Granular Permissions</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Define account credentials and set custom manual tab permissions</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-5">
              {/* Account Credentials */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Username</label>
                  <input 
                    required 
                    type="text" 
                    value={newUser.username} 
                    onChange={e => setNewUser({...newUser, username: e.target.value})} 
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 px-3 py-2 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[42px]" 
                    placeholder="e.g. jsmith" 
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Initial Password</label>
                  <input 
                    required 
                    type="password" 
                    value={newUser.password} 
                    onChange={e => setNewUser({...newUser, password: e.target.value})} 
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 px-3 py-2 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[42px]" 
                    placeholder="Minimum 6 chars" 
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Role Preset</label>
                  <select 
                    value={newUser.role} 
                    onChange={e => {
                      const newR = e.target.value as UserRole;
                      setNewUser({
                        ...newUser, 
                        role: newR,
                        permissions: JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS[newR] || DEFAULT_ROLE_PERMISSIONS.staff))
                      });
                    }} 
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 px-3 py-2 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[42px] font-medium"
                  >
                    <option value="staff">Staff</option>
                    <option value="it_assistant">IT Assistant</option>
                    <option value="management">Management</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              {/* Granular Permissions Section */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="mb-2">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <span>Manual Tab Permissions (View, Edit, Delete)</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Customize exactly what this user can view, create/edit, and delete across every module.
                  </p>
                </div>

                <PermissionsEditor
                  permissions={newUser.permissions}
                  onChange={(updated) => setNewUser(prev => ({ ...prev, permissions: updated }))}
                  currentRole={newUser.role}
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setNewUser({ 
                    username: '', 
                    password: '', 
                    role: 'it_assistant',
                    permissions: JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS.it_assistant))
                  })}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[44px]"
                >
                  Clear Form
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer min-h-[44px]"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer min-h-[44px] flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmitting ? "Creating Account..." : "Create User Account"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
