import React, { useEffect, useState, useMemo } from "react";
import { collection, query, getDocs, addDoc, updateDoc, doc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { Plus, X, Globe, Activity, Users, MapPin, Clock, Search } from "lucide-react";
import { format } from "date-fns";
import { ISPAccount, DowntimeRecord, OperationType, User, UserPermissions } from "../types";
import { sendEmailAlert } from "../lib/emailService";

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error(`Firestore Error [${operationType}] on ${path}:`, error);
  alert(`Permission Error: ${error instanceof Error ? error.message : String(error)}`);
}

interface ISPManagementProps {
  userRole?: string;
  userPermissions?: UserPermissions;
}

export default function ISPManagement({ userRole = 'staff', userPermissions }: ISPManagementProps) {
  const canEdit = userRole === 'admin' || (userPermissions?.isp?.edit ?? (userRole !== 'management' && userRole !== 'staff'));
  const canDelete = userRole === 'admin' || (userPermissions?.isp?.delete ?? false);

  const [ispAccounts, setIspAccounts] = useState<ISPAccount[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDowntimeModal, setShowDowntimeModal] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [newAccount, setNewAccount] = useState<Omit<ISPAccount, 'id' | 'downtimeRecords'>>({ ispName: '', branchOffice: '', speed: '', userIdDeviceId: '', contactName: '', currentStatus: 'online' });
  const [newDowntime, setNewDowntime] = useState<Omit<DowntimeRecord, 'addedAt'>>({ date: '', duration: '', reason: '', currentStatus: 'offline', resolvedAt: '', status: 'offline' });
  const [editingDowntimeIndex, setEditingDowntimeIndex] = useState<number | null>(null);

  const fetchAccounts = async () => {
    try {
      const snap = await getDocs(query(collection(db, "isp_accounts")));
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort by status severity then name
      const severity: any = { 'offline': 3, 'degraded': 2, 'maintenance': 1, 'online': 0 };
      docs.sort((a: any, b: any) => {
        const aSev = severity[a.currentStatus] || 0;
        const bSev = severity[b.currentStatus] || 0;
        if (aSev !== bSev) return bSev - aSev;
        return a.ispName.localeCompare(b.ispName);
      });
      setIspAccounts(docs as ISPAccount[]);
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
    fetchAccounts();
    fetchUsers();
  }, []);

  const isAdminAddedData = (account: any) => {
    if (!account) return false;
    if (account.authorRole === 'admin') return true;
    const creator = allUsers.find(u => u.id === account.authorId);
    return creator?.role === 'admin';
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        const account = ispAccounts.find(a => a.id === editingId);
        if (userRole === 'it_assistant' && account && isAdminAddedData(account)) {
          alert("Permission Denied: IT Assistants are not allowed to update admin-created ISP accounts.");
          return;
        }

        await updateDoc(doc(db, "isp_accounts", editingId), {
          ...newAccount,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, "isp_accounts"), {
          ...newAccount,
          downtimeRecords: [],
          authorId: auth.currentUser?.uid,
          authorRole: userRole,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      // Automatically trigger email alerts for outage and update logs
      if (newAccount.currentStatus === 'offline') {
        await sendEmailAlert(
          `🛑 ISP OFFLINE: ${newAccount.ispName} (${newAccount.branchOffice})`,
          `The connection for ${newAccount.ispName} at the ${newAccount.branchOffice} branch office has been reported as OFFLINE.\n\nConnection Details:\n- ISP Name: ${newAccount.ispName}\n- Branch Office: ${newAccount.branchOffice}\n- Speed/Type: ${newAccount.speed}\n- Connection ID: ${newAccount.userIdDeviceId}\n- Technical Contact: ${newAccount.contactName}\n\nPlease check router power and contact ISP support if necessary.`,
          'isp_down'
        );
      } else {
        await sendEmailAlert(
          `📝 ISP Profile Updated: ${newAccount.ispName} (${newAccount.branchOffice})`,
          `The connection profile or operational status for ${newAccount.ispName} at ${newAccount.branchOffice} has been updated.\n\nNew Details:\n- Status: ${newAccount.currentStatus.toUpperCase()}\n- Speed/Type: ${newAccount.speed}\n- Connection ID: ${newAccount.userIdDeviceId}\n- Contact: ${newAccount.contactName}`,
          'log_update'
        );
      }

      setShowModal(false);
      setEditingId(null);
      setNewAccount({ ispName: '', branchOffice: '', speed: '', userIdDeviceId: '', contactName: '', currentStatus: 'online' });
      fetchAccounts();
    } catch (error) {
      console.error(error);
      alert("Failed to save ISP account. Ensure all required fields are filled out.");
    }
  };

  const handleAddDowntime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showDowntimeModal) return;
    
    try {
      const account = ispAccounts.find(a => a.id === showDowntimeModal);
      if (userRole === 'it_assistant' && account && isAdminAddedData(account)) {
        alert("Permission Denied: IT Assistants are not allowed to modify admin-created ISP accounts.");
        return;
      }

      const records = [...(account?.downtimeRecords || [])];
      
      let calculatedDuration = newDowntime.duration;
      if (newDowntime.date && newDowntime.resolvedAt && !newDowntime.duration) {
        const start = new Date(newDowntime.date);
        const end = new Date(newDowntime.resolvedAt);
        const diffMs = end.getTime() - start.getTime();
        const diffHrs = (diffMs / (1000 * 60 * 60)).toFixed(1);
        calculatedDuration = `${diffHrs} hours`;
      }

      const record = {
        date: newDowntime.date || new Date().toISOString(),
        duration: calculatedDuration,
        reason: newDowntime.reason,
        resolvedAt: newDowntime.resolvedAt || (newDowntime.currentStatus === 'online' ? new Date().toISOString() : ''),
        status: newDowntime.currentStatus || 'offline',
        addedAt: new Date().toISOString()
      };

      if (editingDowntimeIndex !== null) {
        records[editingDowntimeIndex] = record;
      } else {
        records.push(record);
      }

      // Determine most severe active status
      const statusSeverity: Record<string, number> = { 'offline': 3, 'degraded': 2, 'maintenance': 1, 'online': 0 };
      const activeOutages = records.filter(r => !r.resolvedAt || r.resolvedAt === '');
      
      let finalStatus = 'online';
      if (activeOutages.length > 0) {
        // Pick the most severe status from active outages
        finalStatus = activeOutages.reduce((max, r) => {
          const rSev = statusSeverity[r.status] || 0;
          const maxSev = statusSeverity[max] || 0;
          return rSev > maxSev ? r.status : max;
        }, 'maintenance');
      }

      await updateDoc(doc(db, "isp_accounts", showDowntimeModal), {
        downtimeRecords: records,
        currentStatus: finalStatus,
        updatedAt: serverTimestamp()
      });

      // Send automated alert emails on downtime creation
      if (finalStatus === 'offline') {
        await sendEmailAlert(
          `🛑 ISP OFFLINE: ${account?.ispName} (${account?.branchOffice})`,
          `A critical network outage incident has been logged for ${account?.ispName} at ${account?.branchOffice}.\n\nIncident Details:\n- Start Date: ${record.date}\n- Reason: ${record.reason || "N/A"}\n- Connection Status: OFFLINE\n- Logged By: System Administrator`,
          'isp_down'
        );
      } else {
        await sendEmailAlert(
          `📝 ISP Downtime Logged: ${account?.ispName} (${account?.branchOffice})`,
          `A network status update has been logged for ${account?.ispName} at ${account?.branchOffice}.\n\nIncident Details:\n- Date: ${record.date}\n- Status: ${record.status.toUpperCase()}\n- Reason: ${record.reason || "N/A"}\n- Logged By: System Administrator`,
          'log_update'
        );
      }

      setShowDowntimeModal(null);
      setEditingDowntimeIndex(null);
      setNewDowntime({ date: '', duration: '', reason: '', currentStatus: 'offline', resolvedAt: '', status: 'offline' });
      fetchAccounts();
    } catch (error) {
      console.error(error);
      alert("Failed to add downtime.");
    }
  };

  const resolveDowntime = async (accountId: string, index: number) => {
    try {
      const account = ispAccounts.find(a => a.id === accountId);
      if (userRole === 'it_assistant' && account && isAdminAddedData(account)) {
        alert("Permission Denied: IT Assistants are not allowed to modify admin-created ISP accounts.");
        return;
      }

      const records = [...(account?.downtimeRecords || [])];
      const record = { ...records[index] };
      
      const start = new Date(record.date);
      const end = new Date();
      const diffMs = end.getTime() - start.getTime();
      const diffHrs = (diffMs / (1000 * 60 * 60)).toFixed(1);
      
      record.resolvedAt = end.toISOString();
      record.duration = `${diffHrs} hours`;
      records[index] = record;

      // Determine most severe active status among REMAINING outages
      const statusSeverity: Record<string, number> = { 'offline': 3, 'degraded': 2, 'maintenance': 1, 'online': 0 };
      const activeOutages = records.filter(r => !r.resolvedAt || r.resolvedAt === '');
      
      let finalStatus = 'online';
      if (activeOutages.length > 0) {
        finalStatus = activeOutages.reduce((max, r) => {
          const rSev = statusSeverity[r.status] || 0;
          const maxSev = statusSeverity[max] || 0;
          return rSev > maxSev ? r.status : max;
        }, 'maintenance');
      }

      await updateDoc(doc(db, "isp_accounts", accountId), {
        downtimeRecords: records,
        currentStatus: finalStatus,
        updatedAt: serverTimestamp()
      });

      // Send automated email log update when recovered
      await sendEmailAlert(
        `✅ ISP RECOVERY: ${account?.ispName} (${account?.branchOffice})`,
        `The network connection for ${account?.ispName} at the ${account?.branchOffice} branch office has recovered and is now RESOLVED.\n\nOutage Summary:\n- Start Date/Time: ${record.date}\n- Recovery Date/Time: ${record.resolvedAt}\n- Total Downtime Duration: ${record.duration}\n- Current Connection Status: ${finalStatus.toUpperCase()}`,
        'log_update'
      );

      fetchAccounts();
    } catch (e) {
      console.error(e);
    }
  };

  const openEditDowntime = (accountId: string, index: number) => {
    const account = ispAccounts.find(a => a.id === accountId);
    if (userRole === 'it_assistant' && account && isAdminAddedData(account)) {
      alert("Permission Denied: IT Assistants are not allowed to modify admin-created ISP accounts.");
      return;
    }

    const dt = account.downtimeRecords[index];
    setNewDowntime({
      date: dt.date,
      duration: dt.duration || '',
      reason: dt.reason || '',
      currentStatus: account.currentStatus || 'offline',
      resolvedAt: dt.resolvedAt || ''
    });
    setEditingDowntimeIndex(index);
    setShowDowntimeModal(accountId);
  };

  const deleteAccount = async (id: string) => {
    if (!canDelete) {
      alert("Permission Denied: You do not have permission to delete ISP accounts.");
      return;
    }

    const account = ispAccounts.find(a => a.id === id);
    if (userRole === 'it_assistant' && account && isAdminAddedData(account)) {
      alert("Permission Denied: IT Assistants are not allowed to delete admin-created ISP accounts.");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this ISP connection?")) return;
    try {
      await deleteDoc(doc(db, "isp_accounts", id));
      fetchAccounts();
    } catch (e) {
      console.error(e);
    }
  };

  const deleteDowntime = async (accountId: string, index: number) => {
    if (!canDelete) {
      alert("Permission Denied: You do not have permission to delete downtime records.");
      return;
    }

    const account = ispAccounts.find(a => a.id === accountId);
    if (userRole === 'it_assistant' && account && isAdminAddedData(account)) {
      alert("Permission Denied: IT Assistants are not allowed to modify admin-created ISP accounts.");
      return;
    }

    if (!window.confirm("Delete this downtime record?")) return;
    try {
      const records = [...(account?.downtimeRecords || [])];
      records.splice(index, 1);

      // Recalculate status
      const statusSeverity: Record<string, number> = { 'offline': 3, 'degraded': 2, 'maintenance': 1, 'online': 0 };
      const activeOutages = records.filter(r => !r.resolvedAt || r.resolvedAt === '');
      let finalStatus = 'online';
      if (activeOutages.length > 0) {
        finalStatus = activeOutages.reduce((max, r) => {
          const rSev = statusSeverity[r.status] || 0;
          const maxSev = statusSeverity[max] || 0;
          return rSev > maxSev ? r.status : max;
        }, 'maintenance');
      }

      await updateDoc(doc(db, "isp_accounts", accountId), {
        downtimeRecords: records,
        currentStatus: finalStatus,
        updatedAt: serverTimestamp()
      });
      fetchAccounts();
    } catch (e) {
      console.error(e);
    }
  };

  const openEdit = (acc: any) => {
    if (userRole === 'it_assistant' && isAdminAddedData(acc)) {
      alert("Permission Denied: IT Assistants are not allowed to edit admin-created ISP accounts.");
      return;
    }

    setNewAccount({
      ispName: acc.ispName,
      branchOffice: acc.branchOffice,
      speed: acc.speed || '',
      userIdDeviceId: acc.userIdDeviceId || '',
      contactName: acc.contactName || '',
      currentStatus: acc.currentStatus || 'online'
    });
    setEditingId(acc.id);
    setShowModal(true);
  };

  const filteredAccounts = useMemo(() => {
    return ispAccounts.filter(acc => 
      acc.ispName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.branchOffice.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (acc.userIdDeviceId && acc.userIdDeviceId.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [ispAccounts, searchQuery]);

  if (loading) return <div className="p-8 text-slate-500">Loading ISP accounts...</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto flex-1">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">ISP Management</h1>
          <p className="text-slate-500 text-sm mt-1">Track branch ISPs, speeds, and downtime</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search ISP or Branch..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm"
            />
          </div>
          <button
            onClick={() => { setEditingId(null); setNewAccount({ ispName: '', branchOffice: '', speed: '', userIdDeviceId: '', contactName: '', currentStatus: 'online' }); setShowModal(true); }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add ISP Connection
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {filteredAccounts.map(acc => (
          <div key={acc.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
            <div className="bg-slate-50 p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 tracking-tight text-lg">{acc.ispName}</h3>
                  <div className="flex items-center text-sm text-slate-500 gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{acc.branchOffice}</span>
                    <span className="mx-2 text-slate-300">•</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${acc.currentStatus === 'online' || !acc.currentStatus ? 'bg-green-50 text-green-700 border-green-200' : acc.currentStatus === 'offline' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      {acc.currentStatus ? acc.currentStatus.toUpperCase() : 'ONLINE'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openEdit(acc)} className={`text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors ${(userRole === 'it_assistant' && isAdminAddedData(acc)) ? 'hidden' : ''}`}>
                  Edit Details
                </button>
                <button onClick={() => deleteAccount(acc.id)} className={`text-slate-400 hover:text-red-600 transition-colors ${userRole === 'it_assistant' ? 'hidden' : ''}`}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-6 flex-1">
               <div>
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Speed</p>
                 <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                   <Activity className="w-4 h-4 text-emerald-500" />
                   {acc.speed || 'Not specified'}
                 </div>
               </div>
               <div>
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">User / Device ID</p>
                 <p className="font-mono text-xs font-semibold text-slate-700 bg-slate-50 p-1.5 rounded">{acc.userIdDeviceId || 'N/A'}</p>
               </div>
               <div>
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Contact</p>
                 <div className="flex items-center gap-2 text-sm text-slate-700">
                   <Users className="w-4 h-4 text-slate-400" />
                   {acc.contactName || 'None'}
                 </div>
               </div>
            </div>

            <div className="bg-slate-50 border-t border-slate-100 p-4">
               <div className="flex items-center justify-between mb-3">
                 <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                   <Clock className="w-4 h-4 text-slate-400" /> Downtime History
                 </h4>
                 {acc.downtimeRecords && acc.downtimeRecords.length > 0 && (
                   <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                     TOTAL: {acc.downtimeRecords.reduce((sum: number, dt: any) => {
                       const hrs = parseFloat(dt.duration || '0');
                       return sum + (isNaN(hrs) ? 0 : hrs);
                     }, 0).toFixed(1)} HRS
                   </span>
                 )}
                 <button onClick={() => setShowDowntimeModal(acc.id)} className={`text-xs font-semibold text-blue-600 hover:underline ml-auto ${(userRole === 'it_assistant' && isAdminAddedData(acc)) ? 'hidden' : ''}`}>
                   Log Downtime
                 </button>
               </div>
               {acc.downtimeRecords && acc.downtimeRecords.length > 0 ? (
                 <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                   {[...acc.downtimeRecords].reverse().map((dt: any, revIdx: number) => {
                     const actualIdx = acc.downtimeRecords.length - 1 - revIdx;
                     const isUnresolved = !dt.duration || dt.duration === '';
                     return (
                       <div key={actualIdx} className="bg-white border border-slate-200 rounded p-2 text-xs group">
                         <div className="flex justify-between items-start mb-1">
                           <div>
                             <p className="font-semibold text-slate-700">{format(new Date(dt.date), 'MMM dd, h:mm a')}</p>
                             <p className="text-slate-500 mt-0.5">{dt.reason}</p>
                           </div>
                             <div className="flex flex-col items-end gap-1">
                               <div className="flex items-center gap-1">
                                 <span className={`text-[9px] font-bold uppercase px-1 rounded border ${dt.status === 'offline' ? 'bg-red-50 text-red-600 border-red-100' : dt.status === 'degraded' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                                   {dt.status || 'OFFLINE'}
                                 </span>
                                 <span className={`font-medium px-1.5 py-0.5 rounded border whitespace-nowrap ${isUnresolved ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                   {isUnresolved ? 'In Progress' : dt.duration}
                                 </span>
                               </div>
                               <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                               <button onClick={() => openEditDowntime(acc.id, actualIdx)} className={`text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-1 rounded transition-colors ${(userRole === 'it_assistant' && isAdminAddedData(acc)) ? 'hidden' : ''}`}>Edit</button>
                               {isUnresolved && (
                                 <button onClick={() => resolveDowntime(acc.id, actualIdx)} className={`text-[10px] bg-green-600 hover:bg-green-700 text-white px-1 rounded transition-colors font-bold ${(userRole === 'it_assistant' && isAdminAddedData(acc)) ? 'hidden' : ''}`}>Resolve</button>
                               )}
                               <button onClick={() => deleteDowntime(acc.id, actualIdx)} className={`text-[10px] bg-red-100 hover:bg-red-200 text-red-600 px-1 rounded transition-colors ${(userRole === 'it_assistant' && isAdminAddedData(acc)) ? 'hidden' : ''}`}>Delete</button>
                             </div>
                           </div>
                         </div>
                         {dt.resolvedAt && <p className="text-[10px] text-slate-400">Resolved at: {format(new Date(dt.resolvedAt), 'MMM dd, h:mm a')}</p>}
                       </div>
                     );
                   })}
                 </div>
               ) : (
                 <p className="text-xs text-slate-500 italic">No historical downtime recorded.</p>
               )}
            </div>
          </div>
        ))}

        {ispAccounts.length === 0 && (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 rounded-xl">
             <Globe className="w-8 h-8 text-slate-300 mx-auto mb-3" />
             <p className="text-slate-500 font-medium">No ISP accounts tracked yet</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-base font-bold text-slate-800">{editingId ? 'Edit Connection' : 'New ISP Connection'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">ISP Name</label>
                  <input required type="text" value={newAccount.ispName} onChange={e => setNewAccount({...newAccount, ispName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="e.g. Starlink, AT&T" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Branch Office Link</label>
                    <input required type="text" value={newAccount.branchOffice} onChange={e => setNewAccount({...newAccount, branchOffice: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="e.g. HQ, NY Office" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Current Status</label>
                    <select value={newAccount.currentStatus} onChange={e => setNewAccount({...newAccount, currentStatus: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                      <option value="online">Online</option>
                      <option value="offline">Offline</option>
                      <option value="degraded">Degraded</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Speed</label>
                    <input type="text" value={newAccount.speed} onChange={e => setNewAccount({...newAccount, speed: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="e.g. 500 Mbps" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">User / Device ID</label>
                    <input type="text" value={newAccount.userIdDeviceId} onChange={e => setNewAccount({...newAccount, userIdDeviceId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="Acc No." />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Contact Person (For Complaints)</label>
                  <input type="text" value={newAccount.contactName} onChange={e => setNewAccount({...newAccount, contactName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="Name & Phone" />
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setNewAccount({ ispName: '', branchOffice: '', speed: '', userIdDeviceId: '', contactName: '', currentStatus: 'online' })}
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

      {showDowntimeModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-red-50/50">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-red-500"/> 
                {editingDowntimeIndex !== null ? 'Edit Downtime Log' : 'Log Downtime'}
              </h3>
              <button 
                onClick={() => {
                  setShowDowntimeModal(null);
                  setEditingDowntimeIndex(null);
                  setNewDowntime({ date: '', duration: '', reason: '', currentStatus: 'offline', resolvedAt: '' });
                }} 
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddDowntime} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Start Date & Time</label>
                  <input required type="datetime-local" value={newDowntime.date ? newDowntime.date.split('.')[0].slice(0, 16) : ''} onChange={e => setNewDowntime({...newDowntime, date: e.target.value ? new Date(e.target.value).toISOString() : ''})} className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Resolved At (Optional)</label>
                  <input type="datetime-local" value={newDowntime.resolvedAt ? newDowntime.resolvedAt.split('.')[0].slice(0, 16) : ''} onChange={e => setNewDowntime({...newDowntime, resolvedAt: e.target.value ? new Date(e.target.value).toISOString() : ''})} className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Update ISP Status To</label>
                  <select 
                    value={newDowntime.currentStatus} 
                    onChange={e => {
                      const newStatus = e.target.value;
                      setNewDowntime({
                        ...newDowntime, 
                        currentStatus: newStatus,
                        resolvedAt: newStatus === 'online' && !newDowntime.resolvedAt ? new Date().toISOString() : newDowntime.resolvedAt
                      });
                    }} 
                    className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  >
                    <option value="offline">Offline</option>
                    <option value="degraded">Degraded</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="online">Online (Resolved)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Duration (e.g. 2.5 hours)</label>
                  <input type="text" value={newDowntime.duration} onChange={e => setNewDowntime({...newDowntime, duration: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500" placeholder="e.g. 2.5 hours" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Reason</label>
                  <textarea required value={newDowntime.reason} onChange={e => setNewDowntime({...newDowntime, reason: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500" rows={2} placeholder="Brief description of the outage..."></textarea>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setNewDowntime({ date: '', duration: '', reason: '', currentStatus: 'offline', resolvedAt: '' })}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                >
                  Clear Form
                </button>
                <div className="flex gap-2">
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowDowntimeModal(null);
                      setEditingDowntimeIndex(null);
                      setNewDowntime({ date: '', duration: '', reason: '', currentStatus: 'offline', resolvedAt: '' });
                    }} 
                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-red-700 transition-colors cursor-pointer">
                    {editingDowntimeIndex !== null ? 'Update Log' : 'Log It'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
