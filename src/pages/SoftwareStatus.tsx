import React, { useEffect, useState } from "react";
import { collection, query, getDocs, addDoc, updateDoc, doc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { format, differenceInDays } from "date-fns";
import { Plus, X, Server, Globe2, Edit2, ShieldAlert, Key, Trash2 } from "lucide-react";
import { LicenseStatus, OperationType, User, UserPermissions } from "../types";

interface SoftwareStatusProps {
  userRole?: string;
  userPermissions?: UserPermissions;
}

export default function SoftwareStatus({ userRole = 'staff', userPermissions }: SoftwareStatusProps) {
  const canEdit = userRole === 'admin' || (userPermissions?.software?.edit ?? (userRole !== 'management' && userRole !== 'staff'));
  const canDelete = userRole === 'admin' || (userPermissions?.software?.delete ?? false);

  const [licenses, setLicenses] = useState<LicenseStatus[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newLicense, setNewLicense] = useState<Omit<LicenseStatus, 'id' | 'authorId' | 'createdAt' | 'updatedAt'>>({ name: '', type: 'domain', expiryDate: '', notes: '', status: 'active', details: '' });

  const fetchLicenses = async () => {
    try {
      const snap = await getDocs(query(collection(db, "software_licenses")));
      setLicenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as LicenseStatus));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const snap = await getDocs(query(collection(db, "users")));
      setAllUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchLicenses();
    fetchUsers();
  }, []);

  const isAdminAddedData = (license: any) => {
    if (!license) return false;
    if (license.authorRole === 'admin') return true;
    const creator = allUsers.find(u => u.id === license.authorId);
    return creator?.role === 'admin';
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let status = 'active';
      if (newLicense.expiryDate) {
        const diff = differenceInDays(new Date(newLicense.expiryDate), new Date());
        if (diff < 0) status = 'expired';
        else if (diff <= 30) status = 'expiring_soon';
      }

      if (editingId) {
        const license = licenses.find(l => l.id === editingId);
        if (userRole === 'it_assistant' && license && isAdminAddedData(license)) {
          alert("Permission Denied: IT Assistants are not allowed to update admin-created software licenses.");
          return;
        }

        await updateDoc(doc(db, "software_licenses", editingId), {
          ...newLicense,
          status,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, "software_licenses"), {
          ...newLicense,
          status,
          authorId: auth.currentUser?.uid,
          authorRole: userRole,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      setShowModal(false);
      setEditingId(null);
      setNewLicense({ name: '', type: 'domain', expiryDate: '', notes: '', status: 'active', details: '' });
      fetchLicenses();
    } catch (error) {
      console.error(error);
      alert("Failed to save license. Ensure all required fields are filled out.");
    }
  };

  const openEdit = (license: any) => {
    if (!canEdit) {
      alert("Permission Denied: You do not have permission to edit software licenses.");
      return;
    }

    if (userRole === 'it_assistant' && isAdminAddedData(license)) {
      alert("Permission Denied: IT Assistants are not allowed to edit admin-created software licenses.");
      return;
    }

    setNewLicense({
      name: license.name,
      type: license.type,
      expiryDate: license.expiryDate.split('T')[0],
      notes: license.notes || '',
      status: license.status,
      details: license.details || ''
    });
    setEditingId(license.id);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!canDelete) {
      alert("Permission Denied: You do not have permission to delete software licenses.");
      return;
    }

    const license = licenses.find(l => l.id === id);
    if (userRole === 'it_assistant' && license && isAdminAddedData(license)) {
      alert("Permission Denied: IT Assistants are not allowed to delete admin-created software licenses.");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this item?")) return;
    try {
      await deleteDoc(doc(db, "software_licenses", id));
      fetchLicenses();
    } catch (e) {
      console.error(e);
      alert("Failed to delete item.");
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'domain': return <Globe2 className="w-5 h-5 text-blue-500" />;
      case 'server': return <Server className="w-5 h-5 text-purple-500" />;
      case 'microsoft':
      case 'ms_license': return <Key className="w-5 h-5 text-green-500" />;
      default: return <ShieldAlert className="w-5 h-5 text-slate-500" />;
    }
  };

  if (loading) return <div className="p-8 text-slate-500">Loading licenses...</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto flex-1">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Software & Domains</h1>
          <p className="text-slate-500 text-sm mt-1">Manage domains, servers & Microsoft licenses status</p>
        </div>
        <button
          onClick={() => { setEditingId(null); setNewLicense({ name: '', type: 'domain', expiryDate: '', notes: '', status: 'active', details: '' }); setShowModal(true); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {licenses.map(lic => {
          const daysLeft = differenceInDays(new Date(lic.expiryDate), new Date());
          let urgencyClass = "bg-green-50 text-green-700 border-green-200";
          if (daysLeft < 0) urgencyClass = "bg-red-50 text-red-700 border-red-200";
          else if (daysLeft <= 30) urgencyClass = "bg-amber-50 text-amber-700 border-amber-200";

          return (
            <div key={lic.id} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm relative group">
               <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button onClick={() => openEdit(lic)} className={`text-slate-400 hover:text-blue-600 transition-colors ${(userRole === 'it_assistant' && isAdminAddedData(lic)) ? 'hidden' : ''}`}>
                   <Edit2 className="w-4 h-4" />
                 </button>
                 <button onClick={() => handleDelete(lic.id)} className={`text-slate-400 hover:text-red-600 transition-colors ${userRole === 'it_assistant' ? 'hidden' : ''}`}>
                   <Trash2 className="w-4 h-4" />
                 </button>
               </div>
               <div className="flex items-center gap-3 mb-4">
                 <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                    {getTypeIcon(lic.type)}
                 </div>
                 <div>
                   <h3 className="font-bold text-slate-800 tracking-tight">{lic.name}</h3>
                   <p className="text-[11px] text-slate-500 uppercase font-bold tracking-wider">{lic.type.replace('_', ' ')}</p>
                 </div>
               </div>
               
               <div className="space-y-3">
                 <div className="flex items-center justify-between text-sm">
                   <span className="text-slate-500">Expiry Date:</span>
                   <span className="font-medium text-slate-700">{format(new Date(lic.expiryDate), 'MMM dd, yyyy')}</span>
                 </div>
                 <div className={`p-2 rounded text-xs font-bold text-center border ${urgencyClass}`}>
                   {daysLeft < 0 ? `Expired ${Math.abs(daysLeft)} days ago` : `Expires in ${daysLeft} days`}
                 </div>
                 {lic.notes && (
                   <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                     {lic.notes}
                   </p>
                 )}
                 {lic.details && (
                   <div className="pt-3 border-t border-slate-100 space-y-1">
                     
                     <p className="text-xs text-slate-600"><span className="font-semibold">Details:</span> {lic.details}</p>
                   </div>
                 )}
               </div>
            </div>
          );
        })}
        {licenses.length === 0 && (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 rounded-xl">
             <Server className="w-8 h-8 text-slate-300 mx-auto mb-3" />
             <p className="text-slate-500 font-medium">No licenses or domains tracked yet</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-base font-bold text-slate-800">{editingId ? 'Edit Item' : 'New Tracker Item'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Name</label>
                  <input required type="text" value={newLicense.name} onChange={e => setNewLicense({...newLicense, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="e.g. mtknitsm.com" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Type</label>
                  <select value={newLicense.type} onChange={e => setNewLicense({...newLicense, type: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                    <option value="domain">Domain</option>
                    <option value="server">Server</option>
                    <option value="ms_license">MS License</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Expiry Date</label>
                  <input required type="date" value={newLicense.expiryDate.split('T')[0]} onChange={e => setNewLicense({...newLicense, expiryDate: new Date(e.target.value).toISOString()})} className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notes / URL</label>
                  <textarea value={newLicense.notes} onChange={e => setNewLicense({...newLicense, notes: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" rows={2}></textarea>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Details / Description</label>
                  <textarea value={newLicense.details} onChange={e => setNewLicense({...newLicense, details: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" rows={2}></textarea>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setNewLicense({ name: '', type: 'domain', expiryDate: '', notes: '', status: 'active', details: '' })}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                >
                  Clear Form
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors cursor-pointer">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-blue-700 transition-colors cursor-pointer">Save</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
