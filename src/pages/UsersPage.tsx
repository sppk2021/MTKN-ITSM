import React, { useEffect, useState } from "react";
import { collection, query, getDocs, doc, updateDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { UserPlus, Shield, X } from "lucide-react";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'it_assistant' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = async () => {
    try {
      const snap = await getDocs(query(collection(db, "users")));
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole, updatedAt: serverTimestamp() });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (error) {
      console.error(error);
      alert("Failed to update user role");
    }
  };

  const toggleStatus = async (userId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "active" ? "disabled" : "active";
      await updateDoc(doc(db, "users", userId), { status: newStatus, updatedAt: serverTimestamp() });
      setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    } catch (error) {
      console.error(error);
      alert("Failed to toggle status");
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) {
      alert("Username and password are required.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Use a consistent domain for username-based login
      const domain = "mtknitsm.local";
      const email = `${newUser.username.toLowerCase()}@${domain}`;
      
      // We will try to create the user in Firebase Auth
      // Note: This might fail if the current user doesn't have permissions or if email/pass is not enabled.
      // But for this use case, we are implementing what the user requested.
      const userCredential = await createUserWithEmailAndPassword(auth, email, newUser.password);
      const uid = userCredential.user.uid;

      await setDoc(doc(db, "users", uid), {
        username: newUser.username,
        email: email,
        role: newUser.role,
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setShowAddModal(false);
      setNewUser({ username: '', password: '', role: 'it_assistant' });
      fetchUsers();
    } catch (error: any) {
      console.error("Error adding user:", error);
      alert(`Error: ${error.message}. Make sure Email/Password is enabled in Firebase Console.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">User Management</h1>
          <p className="text-xs text-slate-500">Manage access and permissions</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add User</span>
        </button>
      </header>
      
      <div className="flex-1 p-8 space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-slate-100 text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Username / Email</th>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Role</th>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-5 py-4 text-center text-slate-400">Loading...</td>
                </tr>
              ) : users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 whitespace-nowrap font-medium text-slate-800">
                    <div>{user.username || user.email?.split('@')[0]}</div>
                    <div className="text-[10px] text-slate-400">{user.email}</div>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-slate-500">
                    <select
                      value={user.role || 'none'}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow"
                    >
                      <option value="admin">Admin</option>
                      <option value="management">Management</option>
                      <option value="it_assistant">IT Assistant</option>
                      <option value="staff">Staff</option>
                    </select>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-right font-medium">
                    <button
                      onClick={() => toggleStatus(user.id, user.status)}
                      className={`text-xs font-semibold ${user.status === 'active' ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}
                    >
                      {user.status === 'active' ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-4 text-center text-slate-500">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 backdrop-blur-[2px]">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm border border-slate-200 shadow-xl">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                <span>Add System User</span>
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Username</label>
                <input required type="text" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="e.g. jsmith" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Password</label>
                <input required type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="Minimum 6 characters" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Assigned Role</label>
                <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                  <option value="staff">Staff</option>
                  <option value="it_assistant">IT Assistant</option>
                  <option value="management">Management</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="pt-2">
                <button type="submit" disabled={isSubmitting} className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {isSubmitting ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
