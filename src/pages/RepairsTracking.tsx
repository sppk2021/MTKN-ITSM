import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { collection, query, getDocs, addDoc, updateDoc, doc, serverTimestamp, deleteDoc, deleteField } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { format } from "date-fns";
import { Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Repair, User, OperationType, UserPermissions } from "../types";
import { generateNextRepairCode } from "../lib/idGenerator";
import { 
  saveRepairsLocal, 
  getRepairsLocal, 
  addPendingSyncAction, 
  saveUsersLocal, 
  getUsersLocal 
} from "../lib/offlineStorage";
import { SyncStatusBadge } from "../components/SyncStatusBadge";

interface RepairsTrackingProps {
  userRole?: string;
  userPermissions?: UserPermissions;
}

export default function RepairsTracking({ userRole = 'staff', userPermissions }: RepairsTrackingProps) {
  const location = useLocation();
  const canEdit = userRole === 'admin' || (userPermissions?.repairs?.edit ?? (userRole !== 'management' && userRole !== 'staff'));
  const canDelete = userRole === 'admin' || (userPermissions?.repairs?.delete ?? false);

  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [assistants, setAssistants] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('active');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('search') || (location.state as any)?.searchQuery;
    if (q) {
      setSearchQuery(q);
      setStatusFilter('all');
      setCurrentPage(1);
    }
  }, [location.search, location.state]);
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState<string | null>(null);
  const [historyNote, setHistoryNote] = useState('');
  const [newRepair, setNewRepair] = useState<Omit<Repair, 'id' | 'repairCode' | 'history' | 'createdAt' | 'updatedAt'>>({ title: '', device: '', status: 'pending', mechanicId: 'unassigned' });

  const resetNewRepair = () => {
    setNewRepair({
      title: '',
      device: '',
      reportedIssues: '',
      shopCenterName: '',
      status: 'pending',
      mechanicId: assistants.length > 0 ? assistants[0].id : 'unassigned'
    });
  };

  const clearAllFiltersAndInputs = () => {
    setSearchQuery('');
    setStatusFilter('active');
    resetNewRepair();
    setHistoryNote('');
  };

  const fetchRepairs = async () => {
    try {
      if (!navigator.onLine) {
        const cached = await getRepairsLocal();
        if (cached.length > 0) {
          setRepairs(cached);
        }
        return;
      }
      const snap = await getDocs(query(collection(db, "repairs")));
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Repair));
      setRepairs(list);
      await saveRepairsLocal(list);
    } catch (e) {
      console.error(e);
      const cached = await getRepairsLocal();
      if (cached.length > 0) {
        setRepairs(cached);
      }
    }
  };

  const fetchUsers = async () => {
    try {
      if (!navigator.onLine) {
        const cached = await getUsersLocal();
        if (cached.length > 0) {
          setAllUsers(cached);
          const fetchedAssistants = cached.filter(u => ['it_assistant', 'admin', 'management'].includes(u.role));
          setAssistants(fetchedAssistants);
          if (fetchedAssistants.length > 0) {
            setNewRepair(prev => ({ ...prev, mechanicId: prev.mechanicId === 'unassigned' ? fetchedAssistants[0].id : prev.mechanicId }));
          }
        }
        return;
      }
      const snap = await getDocs(query(collection(db, "users")));
      const fetchedAll = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setAllUsers(fetchedAll);
      await saveUsersLocal(fetchedAll);
      const fetchedAssistants = fetchedAll.filter(u => ['it_assistant', 'admin', 'management'].includes(u.role));
      setAssistants(fetchedAssistants);
      if (fetchedAssistants.length > 0) {
        setNewRepair(prev => ({ ...prev, mechanicId: prev.mechanicId === 'unassigned' ? fetchedAssistants[0].id : prev.mechanicId }));
      }
    } catch (e) {
      console.error(e);
      const cached = await getUsersLocal();
      if (cached.length > 0) {
        setAllUsers(cached);
        const fetchedAssistants = cached.filter(u => ['it_assistant', 'admin', 'management'].includes(u.role));
        setAssistants(fetchedAssistants);
      }
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
    const repairCode = generateNextRepairCode(repairs);
    const repairPayload = {
      ...newRepair,
      repairCode,
      authorId: auth.currentUser?.uid || '',
      authorRole: userRole,
      history: [{ note: "Repair ticket created", date: new Date().toISOString() }],
    };

    if (!navigator.onLine) {
      const localRepair: Repair = {
        id: `local_rp_${Date.now()}`,
        ...repairPayload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const updated = [localRepair, ...repairs];
      setRepairs(updated);
      await saveRepairsLocal(updated);
      await addPendingSyncAction('CREATE_REPAIR', repairPayload);
      setShowModal(false);
      resetNewRepair();
      alert("Repair record saved locally in IndexedDB. Will sync when back online!");
      return;
    }

    try {
      await addDoc(collection(db, "repairs"), {
        ...repairPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setShowModal(false);
      resetNewRepair();
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

    const newHistory = [...(currentHistory || []), { note: historyNote, date: new Date().toISOString() }];

    if (!navigator.onLine) {
      const updated = repairs.map(r => r.id === repairId ? { ...r, history: newHistory, updatedAt: new Date().toISOString() } : r);
      setRepairs(updated);
      await saveRepairsLocal(updated);
      await addPendingSyncAction('UPDATE_REPAIR', { id: repairId, updates: { history: newHistory } });
      setHistoryNote('');
      setShowHistoryModal(null);
      alert("Repair history updated locally in IndexedDB!");
      return;
    }

    try {
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
    if (!canDelete) {
      alert("Permission Denied: You do not have permission to delete repairs.");
      return;
    }

    const repair = repairs.find(r => r.id === id);
    if (userRole === 'it_assistant' && repair && isAdminAddedData(repair)) {
      alert("Permission Denied: IT Assistants are not allowed to delete admin-created repairs.");
      return;
    }

    if (!window.confirm("Delete this repair record?")) return;

    if (!navigator.onLine) {
      const updated = repairs.filter(r => r.id !== id);
      setRepairs(updated);
      await saveRepairsLocal(updated);
      await addPendingSyncAction('DELETE_REPAIR', { id });
      alert("Repair deleted locally in IndexedDB!");
      return;
    }

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

    const updates: any = {
      [field]: value
    };
    if (field === 'status' && value === 'completed') updates.completionDate = new Date().toISOString();
    if (field === 'status' && value !== 'completed') updates.completionDate = null; // Use null for local state initially
    
    const optimisticUpdated = repairs.map(r => r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r);
    setRepairs(optimisticUpdated);

    if (!navigator.onLine) {
      await saveRepairsLocal(optimisticUpdated);
      await addPendingSyncAction('UPDATE_REPAIR', { id, updates });
      return;
    }

    try {
      // For Firestore, if completionDate is null, use deleteField() to properly unset it
      const firestoreUpdates = { ...updates };
      if (firestoreUpdates.completionDate === null) {
        firestoreUpdates.completionDate = deleteField();
      }
      
      await updateDoc(doc(db, "repairs", id), {
        ...firestoreUpdates,
        updatedAt: serverTimestamp()
      });
      fetchRepairs();
    } catch (e) {
      console.error(e);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    return updateField(id, 'status', status);
  };

  const filteredRepairs = repairs.filter(repair => {
    const isCompleted = repair.status === 'completed';
    if (statusFilter === 'active' && isCompleted) return false;
    if (statusFilter === 'completed' && !isCompleted) return false;

    if (!searchQuery.trim()) return true;
    const lowerQ = searchQuery.toLowerCase();
    
    if (repair.title?.toLowerCase().includes(lowerQ)) return true;
    if (repair.repairCode?.toLowerCase().includes(lowerQ)) return true;
    if (repair.device?.toLowerCase().includes(lowerQ)) return true;
    if (repair.status?.toLowerCase().includes(lowerQ)) return true;
    if (repair.history?.some((h: any) => h.note?.toLowerCase().includes(lowerQ))) return true;
    
    return false;
  });

  const totalRepairs = filteredRepairs.length;
  const totalPages = Math.max(1, Math.ceil(totalRepairs / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalRepairs);
  const paginatedRepairs = filteredRepairs.slice(startIndex, endIndex);

  return (
    <>
      <header className="min-h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-8 py-3 sm:py-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2.5 flex-wrap">
            <span>Repairs Tracking</span>
            <SyncStatusBadge onSynced={fetchRepairs} />
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Log hardware and system repairs with local-first offline sync</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="w-full sm:w-auto px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition-colors cursor-pointer min-h-[44px]"
        >
          New Repair Ticket
        </button>
      </header>

      <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center relative max-w-md flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3" />
            <input
              type="text"
              placeholder="Search tickets, devices, or history..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-8 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 rounded cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="w-40 shrink-0">
              <select
                value={statusFilter}
                onChange={e => {
                  setStatusFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm"
              >
                <option value="active">Active Repairs</option>
                <option value="completed">Completed</option>
                <option value="all">All Repairs</option>
              </select>
            </div>

            {/* Page Size Selector */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Show:</span>
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-transparent text-xs font-bold text-blue-600 dark:text-blue-400 focus:outline-none cursor-pointer"
                title="Repair tickets to show on view (10, 30, 50, 100)"
              >
                <option value={10} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">10</option>
                <option value={30} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">30</option>
                <option value={50} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">50</option>
                <option value={100} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">100</option>
              </select>
            </div>

            {(searchQuery || statusFilter !== 'active') && (
              <button
                type="button"
                onClick={() => {
                  clearAllFiltersAndInputs();
                  setCurrentPage(1);
                }}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 font-medium px-2.5 py-2 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? <div className="text-slate-500 dark:text-slate-400 col-span-full">Loading...</div> : paginatedRepairs.map(repair => {
            const mechanicName = assistants.find(a => a.id === repair.mechanicId)?.email || 'Unassigned';
            const isAdminRepair = isAdminAddedData(repair);
            const isItAssistant = userRole === 'it_assistant';
            const disableFields = isItAssistant && isAdminRepair;

            return (
              <div key={repair.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 flex flex-col h-full">
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
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{repair.title}</h3>
                  </div>
                  <span 
                    title={
                      repair.status === 'pending' ? 'Device is queued for repair' :
                      repair.status === 'ongoing' ? 'Mechanic is currently repairing the device' :
                      repair.status === 'completed' ? 'Repair is finished and device is ready' : ''
                    }
                    className={`cursor-help shrink-0 px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-full ${ repair.status === 'completed' ? 'bg-green-100 text-green-700' : repair.status === 'ongoing' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500' }`}
                  >
                    {repair.status}
                  </span>
                </div>
                <div className="mb-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex-1 mb-1">Device: <span className="font-medium text-slate-700 dark:text-slate-300">{repair.device}</span></p>
                  {repair.shopCenterName && <p className="text-xs text-slate-500 dark:text-slate-400 flex-1 mb-1">Sent to: <span className="font-medium text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-100">{repair.shopCenterName}</span></p>}
                  {repair.reportedIssues && <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">Issues: <span className="text-slate-700 dark:text-slate-300">{repair.reportedIssues}</span></p>}
                </div>
                
                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                     <div>
                       <label className="block text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1">Mechanic</label>
                       <select
                         value={repair.mechanicId || 'unassigned'}
                         onChange={(e) => updateField(repair.id, 'mechanicId', e.target.value)}
                         disabled={disableFields}
                         className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded outline-none px-2 py-1 text-slate-800 dark:text-slate-200 focus:border-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                       >
                         <option value="unassigned">Unassigned</option>
                         {assistants.map(a => (
                           <option key={a.id} value={a.id}>{a.email}</option>
                         ))}
                       </select>
                     </div>
                     <div>
                       <label className="block text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1">Ext. Shop / Center</label>
                       <input
                         type="text"
                         className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded outline-none px-2 py-1 text-slate-800 dark:text-slate-200 focus:border-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                         value={repair.shopCenterName || ''}
                         placeholder="e.g. Apple Store"
                         disabled={disableFields}
                         onChange={(e) => updateField(repair.id, 'shopCenterName', e.target.value)}
                       />
                     </div>
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                    <span className="font-bold text-slate-700 dark:text-slate-300">Latest update:</span> {repair.history?.[repair.history.length - 1]?.note}
                    {repair.completionDate && <div className="mt-1 text-green-600 font-medium">Completed: {format(new Date(repair.completionDate), 'MMM d, yyyy h:mm a')}</div>}
                  </div>
                  
                  <div className="flex space-x-2">
                    <select
                      value={repair.status}
                      onChange={(e) => updateStatus(repair.id, e.target.value)}
                      disabled={disableFields}
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs rounded outline-none px-2 py-1.5 flex-1 text-slate-800 dark:text-slate-200 focus:border-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-lg border border-slate-200 dark:border-slate-700 shadow-xl">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Repair History - {repair.title}</h2>
                    <div className="max-h-60 overflow-y-auto mb-4 space-y-2 pr-2">
                      {repair.history?.map((h: any, i: number) => (
                        <div key={i} className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded text-sm">
                          <div className="text-slate-800 dark:text-slate-200">{h.note}</div>
                          <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider">{format(new Date(h.date), 'Pp')}</div>
                        </div>
                      ))}
                    </div>
                    <form onSubmit={(e) => handleAddHistory(e, repair.id, repair.history || [])}>
                      <textarea required
                        placeholder="Add new update/note..."
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 px-3 py-2 mb-4 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        rows={3}
                        value={historyNote}
                        onChange={e => setHistoryNote(e.target.value)}
                      ></textarea>
                      <div className="flex justify-end space-x-2">
                        <button type="button" onClick={() => setShowHistoryModal(null)} className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 transition-colors">Close</button>
                        <button type="submit" className="px-4 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold shadow-sm hover:bg-blue-700 transition-colors">Add Note</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )})}
          {filteredRepairs.length === 0 && !loading && <div className="text-slate-500 dark:text-slate-400 col-span-full">No repair records found.</div>}
        </div>

        {/* Pagination Navigation Footer */}
        {totalRepairs > 0 && (
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Showing <span className="font-bold text-slate-900 dark:text-white">{startIndex + 1}</span> to <span className="font-bold text-slate-900 dark:text-white">{endIndex}</span> of <span className="font-bold text-slate-900 dark:text-white">{totalRepairs}</span> repairs
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={validCurrentPage === 1}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    return page === 1 || page === totalPages || Math.abs(page - validCurrentPage) <= 1;
                  })
                  .map((page, idx, arr) => {
                    const prevPage = arr[idx - 1];
                    const hasGap = prevPage && page - prevPage > 1;

                    return (
                      <React.Fragment key={page}>
                        {hasGap && <span className="px-1 text-slate-400 text-xs">...</span>}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(page)}
                          className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            validCurrentPage === page
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                          }`}
                        >
                          {page}
                        </button>
                      </React.Fragment>
                    );
                  })}

                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={validCurrentPage === totalPages}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 backdrop-blur-[2px]">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-700 shadow-xl">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-5">New Repair Ticket</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Issue / Title</label>
                  <input required type="text" value={newRepair.title} onChange={e => setNewRepair({...newRepair, title: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Specific Issues (Tracking)</label>
                  <textarea value={newRepair.reportedIssues} onChange={e => setNewRepair({...newRepair, reportedIssues: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" rows={2}></textarea>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Device / Hardware</label>
                  <input required type="text" value={newRepair.device} onChange={e => setNewRepair({...newRepair, device: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">External Shop / Center Name (Optional)</label>
                  <input type="text" value={newRepair.shopCenterName} onChange={e => setNewRepair({...newRepair, shopCenterName: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="Leave blank if repairing internally" />
                </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Assign Mechanic</label>
                    <select value={newRepair.mechanicId} onChange={e => setNewRepair({...newRepair, mechanicId: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                      <option value="unassigned">Unassigned</option>
                      {assistants.map(a => (
                        <option key={a.id} value={a.id}>{a.displayName || a.username || a.email}</option>
                      ))}
                    </select>
                  </div>
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={resetNewRepair}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                  >
                    Clear Form
                  </button>
                  <div className="flex space-x-2">
                    <button type="button" onClick={() => setShowModal(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 transition-colors cursor-pointer">Cancel</button>
                    <button type="submit" className="px-4 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold shadow-sm hover:bg-blue-700 transition-colors cursor-pointer">Create Ticket</button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
