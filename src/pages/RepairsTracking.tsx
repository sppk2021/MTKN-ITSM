import React, { useEffect, useState } from "react";
import { collection, query, getDocs, addDoc, updateDoc, doc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { format } from "date-fns";
import { Search, X } from "lucide-react";
import { Repair, User, OperationType } from "../types";

interface RepairsTrackingProps {
  userRole?: string;
}

export default function RepairsTracking({ userRole = 'staff' }: RepairsTrackingProps) {
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [assistants, setAssistants] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState<string | null>(null);
  const [historyNote, setHistoryNote] = useState('');
  const [newRepair, setNewRepair] = useState<Omit<Repair, 'id' | 'repairCode' | 'history' | 'createdAt' | 'updatedAt'>>({ title: '', device: '', status: 'pending', mechanicId: 'unassigned' });

  const fetchRepairs = async () => {
    try {
      const snap = await getDocs(query(collection(db, "repairs")));
      setRepairs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Repair)));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUsers = async () => {
    try {
      const snap = await getDocs(query(collection(db, "users")));
      const fetchedAll = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setAllUsers(fetchedAll);
      const fetchedAssistants = fetchedAll.filter(u => ['it_assistant', 'admin', 'management'].includes(u.role));
      setAssistants(fetchedAssistants);
      if (fetchedAssistants.length > 0) {
        setNewRepair(prev => ({ ...prev, mechanicId: prev.mechanicId === 'unassigned' ? fetchedAssistants[0].id : prev.mechanicId }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    Promise.all([fetchRepairs(), fetchUsers()]).finally(() => setLoading(false));
  }, []);

  const isAdminAddedData = (repair: any) => {
    if (!repair) return false;
    if (repair.authorRole === 'admin') return true;
    const creator = allUsers.find(u => u.id === repair.authorId);
    return creator?.role === 'admin';
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const repairCode = `RP-${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      await addDoc(collection(db, "repairs"), {
        ...newRepair,
        repairCode,
        authorId: auth.currentUser?.uid || '',
        authorRole: userRole,
        history: [{ note: "Repair ticket created", date: new Date().toISOString() }],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setShowModal(false);
      setNewRepair({ title: '', device: '', reportedIssues: '', shopCenterName: '', status: 'pending', mechanicId: assistants.length > 0 ? assistants[0].id : 'unassigned' });
      fetchRepairs();
    } catch (error) {
      console.error(error);
      alert("Failed to add repair");
    }
  };

  const handleAddHistory = async (e: React.FormEvent, repairId: string, currentHistory: any[]) => {
    e.preventDefault();
    const repair = repairs.find(r => r.id === repairId);
    if (userRole === 'it_assistant' && repair && isAdminAddedData(repair)) {
      alert("Permission Denied: IT Assistants are not allowed to update admin-created repairs.");
      return;
    }

    try {
      const newHistory = [...currentHistory, { note: historyNote, date: new Date().toISOString() }];
      await updateDoc(doc(db, "repairs", repairId), {
        history: newHistory,
        updatedAt: serverTimestamp()
      });
      setHistoryNote('');
      setShowHistoryModal(null);
      fetchRepairs();
    } catch (e) {
      console.error(e);
    }
  };

  const deleteRepair = async (id: string) => {
    if (userRole === 'it_assistant') {
      alert("Permission Denied: IT Assistants are not allowed to delete repairs.");
      return;
    }

    const repair = repairs.find(r => r.id === id);
    if (userRole === 'it_assistant' && repair && isAdminAddedData(repair)) {
      alert("Permission Denied: IT Assistants are not allowed to delete admin-created repairs.");
      return;
    }

    if (!window.confirm("Delete this repair record?")) return;
    try {
      await deleteDoc(doc(db, "repairs", id));
      fetchRepairs();
    } catch (e) {
      console.error(e);
    }
  };

  const updateField = async (id: string, field: string, value: string) => {
    const repair = repairs.find(r => r.id === id);
    if (userRole === 'it_assistant' && repair && isAdminAddedData(repair)) {
      alert("Permission Denied: IT Assistants are not allowed to modify admin-created repairs.");
      return;
    }

    try {
      const payload: any = {
        [field]: value,
        updatedAt: serverTimestamp()
      };
      if (field === 'status' && value === 'completed') payload.completionDate = new Date().toISOString();
      if (field === 'status' && value !== 'completed') payload.completionDate = null;
      await updateDoc(doc(db, "repairs", id), payload);
      fetchRepairs();
    } catch (e) {
      console.error(e);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    return updateField(id, 'status', status);
  };

  const filteredRepairs = repairs.filter(repair => {
    if (!searchQuery.trim()) return true;
    const lowerQ = searchQuery.toLowerCase();
    
    if (repair.title?.toLowerCase().includes(lowerQ)) return true;
    if (repair.repairCode?.toLowerCase().includes(lowerQ)) return true;
    if (repair.device?.toLowerCase().includes(lowerQ)) return true;
    if (repair.status?.toLowerCase().includes(lowerQ)) return true;
    if (repair.history?.some((h: any) => h.note?.toLowerCase().includes(lowerQ))) return true;
    
    return false;
  });

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Repairs Tracking</h1>
          <p className="text-xs text-slate-500">Log hardware and system repairs</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded shadow-sm hover:bg-blue-700 transition-colors"
        >
          New Repair Ticket
        </button>
      </header>

      <div className="flex-1 p-8 overflow-y-auto">
        <div className="mb-6 flex items-center relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3" />
          <input
            type="text"
            placeholder="Search tickets, devices, or history..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm transition-shadow"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? <div className="text-slate-500 col-span-full">Loading...</div> : filteredRepairs.map(repair => {
            const mechanicName = assistants.find(a => a.id === repair.mechanicId)?.email || 'Unassigned';
            const isAdminRepair = isAdminAddedData(repair);
            const isItAssistant = userRole === 'it_assistant';
            const disableFields = isItAssistant && isAdminRepair;

            return (
              <div key={repair.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col h-full">
                <div className="flex justify-between items-start mb-4 gap-2">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 w-fit">{repair.repairCode || 'NO CODE'}</div>
                      {!isItAssistant && (
                        <button onClick={() => deleteRepair(repair.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 line-clamp-1">{repair.title}</h3>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-full ${
                    repair.status === 'completed' ? 'bg-green-100 text-green-700' :
                    repair.status === 'ongoing' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {repair.status}
                  </span>
                </div>
                <div className="mb-4">
                  <p className="text-xs text-slate-500 flex-1 mb-1">Device: <span className="font-medium text-slate-700">{repair.device}</span></p>
                  {repair.shopCenterName && <p className="text-xs text-slate-500 flex-1 mb-1">Sent to: <span className="font-medium text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-100">{repair.shopCenterName}</span></p>}
                  {repair.reportedIssues && <p className="text-xs text-slate-500 line-clamp-2">Issues: <span className="text-slate-700">{repair.reportedIssues}</span></p>}
                </div>
                
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                     <div>
                       <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Mechanic</label>
                       <select
                         value={repair.mechanicId || 'unassigned'}
                         onChange={(e) => updateField(repair.id, 'mechanicId', e.target.value)}
                         disabled={disableFields}
                         className="w-full bg-slate-50 border border-slate-200 rounded outline-none px-2 py-1 text-slate-800 focus:border-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                       >
                         <option value="unassigned">Unassigned</option>
                         {assistants.map(a => (
                           <option key={a.id} value={a.id}>{a.email}</option>
                         ))}
                       </select>
                     </div>
                     <div>
                       <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Ext. Shop / Center</label>
                       <input
                         type="text"
                         className="w-full bg-slate-50 border border-slate-200 rounded outline-none px-2 py-1 text-slate-800 focus:border-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                         value={repair.shopCenterName || ''}
                         placeholder="e.g. Apple Store"
                         disabled={disableFields}
                         onChange={(e) => updateField(repair.id, 'shopCenterName', e.target.value)}
                       />
                     </div>
                  </div>

                  <div className="text-[11px] text-slate-500 line-clamp-2">
                    <span className="font-bold text-slate-700">Latest update:</span> {repair.history?.[repair.history.length - 1]?.note}
                    {repair.completionDate && <div className="mt-1 text-green-600 font-medium">Completed: {format(new Date(repair.completionDate), 'MMM d, yyyy h:mm a')}</div>}
                  </div>
                  
                  <div className="flex space-x-2">
                    <select
                      value={repair.status}
                      onChange={(e) => updateStatus(repair.id, e.target.value)}
                      disabled={disableFields}
                      className="bg-slate-50 border border-slate-200 text-xs rounded outline-none px-2 py-1.5 flex-1 text-slate-800 focus:border-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <option value="pending">Pending</option>
                      <option value="ongoing">Ongoing</option>
                      <option value="completed">Completed</option>
                    </select>
                    <button
                      onClick={() => setShowHistoryModal(repair.id)}
                      disabled={disableFields}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-xs font-semibold text-white rounded transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Log Update
                    </button>
                  </div>
                </div>

                {/* History Modal for this repair */}
              {showHistoryModal === repair.id && (
                <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 backdrop-blur-[2px]">
                  <div className="bg-white rounded-xl p-6 w-full max-w-lg border border-slate-200 shadow-xl">
                    <h2 className="text-lg font-bold text-slate-900 mb-4">Repair History - {repair.title}</h2>
                    <div className="max-h-60 overflow-y-auto mb-4 space-y-2 pr-2">
                      {repair.history?.map((h: any, i: number) => (
                        <div key={i} className="bg-slate-50 border border-slate-100 p-3 rounded text-sm">
                          <div className="text-slate-800">{h.note}</div>
                          <div className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-wider">{format(new Date(h.date), 'Pp')}</div>
                        </div>
                      ))}
                    </div>
                    <form onSubmit={(e) => handleAddHistory(e, repair.id, repair.history || [])}>
                      <textarea required
                        placeholder="Add new update/note..."
                        className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 mb-4 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        rows={3}
                        value={historyNote}
                        onChange={e => setHistoryNote(e.target.value)}
                      ></textarea>
                      <div className="flex justify-end space-x-2">
                        <button type="button" onClick={() => setShowHistoryModal(null)} className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">Close</button>
                        <button type="submit" className="px-4 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold shadow-sm hover:bg-blue-700 transition-colors">Add Note</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )})}
          {filteredRepairs.length === 0 && !loading && <div className="text-slate-500 col-span-full">No repair records found.</div>}
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 backdrop-blur-[2px]">
            <div className="bg-white rounded-xl p-6 w-full max-w-md border border-slate-200 shadow-xl">
              <h2 className="text-lg font-bold text-slate-900 mb-5">New Repair Ticket</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Issue / Title</label>
                  <input required type="text" value={newRepair.title} onChange={e => setNewRepair({...newRepair, title: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Specific Issues (Tracking)</label>
                  <textarea value={newRepair.reportedIssues} onChange={e => setNewRepair({...newRepair, reportedIssues: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" rows={2}></textarea>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Device / Hardware</label>
                  <input required type="text" value={newRepair.device} onChange={e => setNewRepair({...newRepair, device: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">External Shop / Center Name (Optional)</label>
                  <input type="text" value={newRepair.shopCenterName} onChange={e => setNewRepair({...newRepair, shopCenterName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="Leave blank if repairing internally" />
                </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Assign Mechanic</label>
                    <select value={newRepair.mechanicId} onChange={e => setNewRepair({...newRepair, mechanicId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                      <option value="unassigned">Unassigned</option>
                      {assistants.map(a => (
                        <option key={a.id} value={a.id}>{a.displayName || a.username || a.email}</option>
                      ))}
                    </select>
                  </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">Cancel</button>
                  <button type="submit" className="px-4 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold shadow-sm hover:bg-blue-700 transition-colors">Create Ticket</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
