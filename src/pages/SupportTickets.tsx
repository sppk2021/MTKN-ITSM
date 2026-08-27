import React, { useEffect, useState } from "react";
import { collection, query, getDocs, addDoc, updateDoc, doc, serverTimestamp, deleteDoc, deleteField } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { format } from "date-fns";
import { Search, Ticket, X, Sparkles, Bot, Loader2, WifiOff, Database, RefreshCw, CheckCircle2, ChevronRight, SlidersHorizontal, ArrowLeftRight, Edit3, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { SupportTicket, User, OperationType, UserPermissions } from "../types";
import { generateNextTicketCode } from "../lib/idGenerator";
import { 
  saveTicketsLocal, 
  getTicketsLocal, 
  saveUsersLocal, 
  getUsersLocal, 
  addPendingSyncAction, 
  getPendingSyncQueue, 
  clearPendingSyncQueue,
  processAllPendingSyncActions
} from "../lib/offlineStorage";
import { SyncStatusBadge } from "../components/SyncStatusBadge";

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
  payload?: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, payload?: any) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path,
    payload
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo, null, 2));
  alert(`Permission Error: ${errInfo.error}\nCheck console for details.`);
  throw new Error(JSON.stringify(errInfo));
}

interface SupportTicketsProps {
  userRole?: string;
  userPermissions?: UserPermissions;
}

export default function SupportTickets({ userRole = "staff", userPermissions }: SupportTicketsProps) {
  const canEdit = userRole === 'admin' || (userPermissions?.tickets?.edit ?? (userRole !== 'management'));
  const canDelete = userRole === 'admin' || (userPermissions?.tickets?.delete ?? false);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [assistants, setAssistants] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('active');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState<string | null>(null);
  const [historyNote, setHistoryNote] = useState('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [newTicket, setNewTicket] = useState<Omit<SupportTicket, 'id' | 'ticketCode' | 'authorId' | 'history' | 'createdAt' | 'updatedAt'>>({ title: '', description: '', priority: 'low', supportType: 'hardware', status: 'open', assigneeId: 'unassigned', requestUsername: '', requestDept: '' });

  const updatePendingCount = async () => {
    const queue = await getPendingSyncQueue();
    setPendingSyncCount(queue.length);
  };

  const resetNewTicketForm = () => {
    setNewTicket({
      title: '',
      description: '',
      priority: 'low',
      supportType: 'hardware',
      status: 'open',
      assigneeId: assistants.length > 0 ? assistants[0].id : 'unassigned',
      requestUsername: '',
      requestDept: ''
    });
  };

  const clearAllFiltersAndInputs = () => {
    setSearchQuery('');
    setStatusFilter('active');
    resetNewTicketForm();
    setHistoryNote('');
  };

  const processSyncQueue = async () => {
    if (!navigator.onLine) return;
    const queue = await getPendingSyncQueue();
    if (queue.length === 0) return;

    setIsSyncing(true);
    try {
      for (const action of queue) {
        if (action.type === 'CREATE_TICKET') {
          await addDoc(collection(db, "tickets"), {
            ...action.payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } else if (action.type === 'UPDATE_TICKET') {
          const { id, updates } = action.payload;
          await updateDoc(doc(db, "tickets", id), {
            ...updates,
            updatedAt: serverTimestamp()
          });
        } else if (action.type === 'DELETE_TICKET') {
          await deleteDoc(doc(db, "tickets", action.payload.id));
        }
      }
      await clearPendingSyncQueue();
      await updatePendingCount();
      await fetchTickets();
    } catch (e) {
      console.error("Error processing offline sync queue:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Monitor online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      processSyncQueue();
    };
    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    updatePendingCount();
    if (navigator.onLine) {
      processSyncQueue();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Function calling Gemini API to generate preliminary response draft
  const generateTicketDraftResponse = async (ticketData: {
    title: string;
    description: string;
    supportType?: string;
    priority?: string;
    requestUsername?: string;
    requestDept?: string;
  }): Promise<string | null> => {
    if (!navigator.onLine) return null;
    try {
      const response = await fetch("/api/generate-ticket-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ticketData),
      });

      if (!response.ok) {
        const errorRes = await response.json().catch(() => ({}));
        console.warn("Gemini draft generation endpoint warning:", errorRes.error || response.statusText);
        return null;
      }

      const data = await response.json();
      return data.draft || null;
    } catch (err) {
      console.error("Failed to generate ticket response draft:", err);
      return null;
    }
  };

  const handleManualDraftGeneration = async (ticket: SupportTicket) => {
    setIsGeneratingDraft(true);
    try {
      const draft = await generateTicketDraftResponse({
        title: ticket.title,
        description: ticket.description,
        supportType: ticket.supportType,
        priority: ticket.priority,
        requestUsername: ticket.requestUsername,
        requestDept: ticket.requestDept,
      });

      if (draft) {
        setHistoryNote(prev => prev ? `${prev}\n\n[AI Draft Response]:\n${draft}` : `[AI Draft Response]:\n${draft}`);
      } else {
        alert("Could not generate AI draft. Device may be offline or Gemini API is unreachable.");
      }
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const fetchTickets = async () => {
    // Local-first load from IndexedDB
    const cached = await getTicketsLocal();
    if (cached && cached.length > 0) {
      setTickets(cached);
    }

    if (navigator.onLine) {
      try {
        const snap = await getDocs(query(collection(db, "tickets")));
        const remoteTickets = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportTicket));
        setTickets(remoteTickets);
        await saveTicketsLocal(remoteTickets);
      } catch (e) {
        console.warn("Network ticket fetch failed, using local IndexedDB data:", e);
      }
    }
  };

  const fetchUsers = async () => {
    const cachedUsers = await getUsersLocal();
    if (cachedUsers && cachedUsers.length > 0) {
      setAllUsers(cachedUsers);
      const fetchedAssistants = cachedUsers.filter(u => ['it_assistant', 'admin', 'management'].includes(u.role));
      setAssistants(fetchedAssistants);
    }

    if (navigator.onLine) {
      try {
        const snap = await getDocs(query(collection(db, "users")));
        const fetchedAll = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        setAllUsers(fetchedAll);
        await saveUsersLocal(fetchedAll);
        const fetchedAssistants = fetchedAll.filter(u => ['it_assistant', 'admin', 'management'].includes(u.role));
        setAssistants(fetchedAssistants);
        if (fetchedAssistants.length > 0) {
          setNewTicket(prev => ({ ...prev, assigneeId: prev.assigneeId === 'unassigned' ? fetchedAssistants[0].id : prev.assigneeId }));
        }
      } catch (e) {
        console.warn("Network users fetch failed, using local cached users:", e);
      }
    }
  };

  useEffect(() => {
    Promise.all([fetchTickets(), fetchUsers()]).finally(() => setLoading(false));
  }, []);

  const isAdminAddedData = (ticket: any) => {
    if (!ticket) return false;
    if (ticket.authorRole === 'admin') return true;
    const creator = allUsers.find(u => u.id === ticket.authorId);
    return creator?.role === 'admin';
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser?.uid) {
      alert("You must be signed in to create a ticket.");
      return;
    }
    setIsSubmittingTicket(true);
    const ticketCode = generateNextTicketCode(tickets);

    const initialHistory: Array<{ note: string; date: string }> = [
      { note: "Ticket created", date: new Date().toISOString() }
    ];

    if (navigator.onLine) {
      try {
        const draft = await generateTicketDraftResponse({
          title: newTicket.title,
          description: newTicket.description,
          supportType: newTicket.supportType,
          priority: newTicket.priority,
          requestUsername: newTicket.requestUsername,
          requestDept: newTicket.requestDept,
        });

        if (draft) {
          initialHistory.push({
            note: `[AI Preliminary Response Draft]:\n${draft}`,
            date: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error("Auto draft generation error:", err);
      }
    }

    const localId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const payload = {
      ...newTicket,
      ticketCode,
      authorId: auth.currentUser.uid,
      authorRole: userRole,
      history: initialHistory,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    if (!navigator.onLine) {
      const offlineTicket: SupportTicket = {
        id: localId,
        ...payload
      } as SupportTicket;

      const updatedTickets = [offlineTicket, ...tickets];
      setTickets(updatedTickets);
      await saveTicketsLocal(updatedTickets);
      await addPendingSyncAction('CREATE_TICKET', payload);
      await updatePendingCount();

      setShowModal(false);
      setNewTicket({ title: '', description: '', priority: 'low', supportType: 'hardware', status: 'open', assigneeId: assistants.length > 0 ? assistants[0].id : 'unassigned', requestUsername: '', requestDept: '' });
      setIsSubmittingTicket(false);
      alert("Device is offline. Support ticket saved locally in IndexedDB and will sync when back online!");
      return;
    }

    try {
      await addDoc(collection(db, "tickets"), payload);
      setShowModal(false);
      setNewTicket({ title: '', description: '', priority: 'low', supportType: 'hardware', status: 'open', assigneeId: assistants.length > 0 ? assistants[0].id : 'unassigned', requestUsername: '', requestDept: '' });
      fetchTickets();
    } catch (error) {
      console.warn("Firestore write failed, falling back to offline storage:", error);
      const offlineTicket: SupportTicket = {
        id: localId,
        ...payload
      } as SupportTicket;
      const updatedTickets = [offlineTicket, ...tickets];
      setTickets(updatedTickets);
      await saveTicketsLocal(updatedTickets);
      await addPendingSyncAction('CREATE_TICKET', payload);
      await updatePendingCount();
      setShowModal(false);
      alert("Network saved locally to IndexedDB.");
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const handleAddHistory = async (e: React.FormEvent, ticketId: string, currentHistory: any[]) => {
    e.preventDefault();
    const ticket = tickets.find(t => t.id === ticketId);
    if (userRole === 'it_assistant' && ticket && isAdminAddedData(ticket)) {
      alert("Permission Denied: IT Assistants are not allowed to update admin-created tickets.");
      return;
    }

    const newHistory = [...(currentHistory || []), { note: historyNote, date: new Date().toISOString() }];

    let updates: any = { history: newHistory };
    if (ticket && (ticket.status === 'resolved' || ticket.status === 'closed')) {
      updates.status = 'open';
      updates.resolvedAt = null;
    }

    if (!navigator.onLine) {
      const updatedTickets = tickets.map(t => t.id === ticketId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t);
      setTickets(updatedTickets);
      await saveTicketsLocal(updatedTickets);
      await addPendingSyncAction('UPDATE_TICKET', { id: ticketId, updates });
      await updatePendingCount();
      setHistoryNote('');
      setShowHistoryModal(null);
      alert("Note saved locally in IndexedDB. Will sync when online!");
      return;
    }

    try {
      const firestoreUpdates = { ...updates };
      if (firestoreUpdates.resolvedAt === null) {
        firestoreUpdates.resolvedAt = deleteField();
      }
      await updateDoc(doc(db, "tickets", ticketId), {
        ...firestoreUpdates,
        updatedAt: serverTimestamp()
      });
      setHistoryNote('');
      setShowHistoryModal(null);
      fetchTickets();
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, "tickets");
    }
  };

  const deleteTicket = async (id: string) => {
    if (!canDelete) {
      alert("Permission Denied: You do not have permission to delete tickets.");
      return;
    }

    const ticket = tickets.find(t => t.id === id);
    if (userRole === 'it_assistant' && ticket && isAdminAddedData(ticket)) {
      alert("Permission Denied: IT Assistants are not allowed to delete admin-created tickets.");
      return;
    }

    if (!window.confirm("Delete this support ticket?")) return;

    if (!navigator.onLine) {
      const updatedTickets = tickets.filter(t => t.id !== id);
      setTickets(updatedTickets);
      await saveTicketsLocal(updatedTickets);
      await addPendingSyncAction('DELETE_TICKET', { id });
      await updatePendingCount();
      alert("Ticket deleted locally in IndexedDB. Will sync deletion when online!");
      return;
    }

    try {
      await deleteDoc(doc(db, "tickets", id));
      fetchTickets();
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, "tickets");
    }
  };

  const updateField = async (id: string, field: string, value: string) => {
    const ticket = tickets.find(t => t.id === id);
    if (userRole === 'it_assistant' && ticket && isAdminAddedData(ticket)) {
      alert("Permission Denied: IT Assistants are not allowed to modify admin-created tickets.");
      return;
    }

    if (userRole === 'it_assistant' && field === 'assigneeId') {
      alert("Permission Denied: IT Assistants are not allowed to change ticket assignee.");
      return;
    }

    const updates: any = {
      [field]: value,
      updatedAt: new Date().toISOString()
    };

    if (field === 'status' && (value === 'resolved' || value === 'closed')) {
      updates.resolvedAt = new Date().toISOString();
    } else if (field === 'status' && (value === 'open' || value === 'in_progress')) {
      updates.resolvedAt = null;
    }

    const optimisticUpdatedTickets = tickets.map(t => t.id === id ? { ...t, ...updates } : t);
    setTickets(optimisticUpdatedTickets);

    if (!navigator.onLine) {
      await saveTicketsLocal(optimisticUpdatedTickets);
      await addPendingSyncAction('UPDATE_TICKET', { id, updates });
      await updatePendingCount();
      return;
    }

    try {
      const firestoreUpdates = { ...updates };
      if (firestoreUpdates.resolvedAt === null) {
        firestoreUpdates.resolvedAt = deleteField();
      }
      await updateDoc(doc(db, "tickets", id), {
        ...firestoreUpdates,
        updatedAt: serverTimestamp()
      });
      fetchTickets();
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, "tickets", { [field]: value });
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const isCompleted = ticket.status === 'resolved' || ticket.status === 'closed';
    if (statusFilter === 'active' && isCompleted) return false;
    if (statusFilter === 'completed' && !isCompleted) return false;

    if (!searchQuery.trim()) return true;
    const lowerQ = searchQuery.toLowerCase();
    
    if (ticket.title?.toLowerCase().includes(lowerQ)) return true;
    if (ticket.ticketCode?.toLowerCase().includes(lowerQ)) return true;
    if (ticket.description?.toLowerCase().includes(lowerQ)) return true;
    if (ticket.status?.toLowerCase().includes(lowerQ)) return true;
    if (ticket.history?.some((h: any) => h.note?.toLowerCase().includes(lowerQ))) return true;
    
    return false;
  });

  return (
    <>
      <header className="min-h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-8 py-3 sm:py-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2.5 flex-wrap">
            <span>Support Tickets</span>
            <SyncStatusBadge onSynced={fetchTickets} />
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Manage IT support requests with local-first offline fallback</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="w-full sm:w-auto px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition-colors cursor-pointer min-h-[44px]"
        >
          New Ticket
        </button>
      </header>

      <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="mb-6 flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center relative max-w-md flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3" />
            <input
              type="text"
              placeholder="Search tickets or history..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-8 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm transition-shadow"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 rounded cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="w-full sm:w-48 shrink-0">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm"
            >
              <option value="active">Active Tickets</option>
              <option value="completed">Completed</option>
              <option value="all">All Tickets</option>
            </select>
          </div>
          {(searchQuery || statusFilter !== 'active') && (
            <button
              type="button"
              onClick={clearAllFiltersAndInputs}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 font-medium px-2.5 py-2 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              Clear Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? <div className="text-slate-500 dark:text-slate-400 col-span-full">Loading...</div> : filteredTickets.map(ticket => {
            const isAdminTicket = isAdminAddedData(ticket);
            const isItAssistant = userRole === 'it_assistant';
            const disableFields = isItAssistant && isAdminTicket;

            return (
              <div key={ticket.id} className="relative overflow-hidden rounded-xl bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
                {/* Background Swipe Actions Revealed on Drag */}
                <div className="absolute inset-0 flex justify-between items-center px-3 bg-slate-900 z-0">
                  {/* Left Actions (Swiped Right) */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateField(ticket.id, 'status', 'resolved')}
                      className="px-2.5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow flex items-center gap-1 active:scale-95 transition-transform cursor-pointer"
                      title="Quick Resolve"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Resolve</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField(ticket.id, 'status', 'in_progress')}
                      className="px-2.5 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold shadow flex items-center gap-1 active:scale-95 transition-transform cursor-pointer"
                      title="Mark In Progress"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Progress</span>
                    </button>
                  </div>

                  {/* Right Actions (Swiped Left) */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowHistoryModal(ticket.id)}
                      className="px-2.5 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold shadow flex items-center gap-1 active:scale-95 transition-transform cursor-pointer"
                      title="Log Update / History"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Update</span>
                    </button>
                    {!isItAssistant && (
                      <button
                        type="button"
                        onClick={() => deleteTicket(ticket.id)}
                        className="px-2.5 py-2 bg-red-600 text-white rounded-lg text-xs font-bold shadow flex items-center gap-1 active:scale-95 transition-transform cursor-pointer"
                        title="Delete Ticket"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Foreground Draggable Card */}
                <motion.div
                  drag="x"
                  dragConstraints={{ left: -140, right: 140 }}
                  dragSnapToOrigin={true}
                  onDragEnd={(_, info) => {
                    const threshold = 65;
                    if (info.offset.x < -threshold) {
                      // Swipe Left action: open Log Update / History
                      setShowHistoryModal(ticket.id);
                    } else if (info.offset.x > threshold) {
                      // Swipe Right action: Quick resolve
                      if (!disableFields) {
                        updateField(ticket.id, 'status', ticket.status === 'resolved' ? 'open' : 'resolved');
                      }
                    }
                  }}
                  className="bg-white dark:bg-slate-800 p-5 flex flex-col h-full relative z-10 touch-pan-y"
                >
                  {/* Mobile Swipe Action Hint Bar */}
                  <div className="md:hidden flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="flex items-center gap-1 font-medium">
                      <ArrowLeftRight className="w-3 h-3 text-blue-500 animate-pulse" />
                      Swipe left to update/delete, right to resolve
                    </span>
                  </div>

                  <div className="flex justify-between items-start mb-4 gap-2">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 w-fit">{ticket.ticketCode || 'NO CODE'}</div>
                        {ticket.createdAt && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {(() => {
                              try {
                                if (ticket.createdAt.toDate) {
                                  return format(ticket.createdAt.toDate(), 'MMM dd, yyyy HH:mm');
                                } else if (ticket.createdAt.seconds) {
                                  return format(new Date(ticket.createdAt.seconds * 1000), 'MMM dd, yyyy HH:mm');
                                } else {
                                  return format(new Date(ticket.createdAt as any), 'MMM dd, yyyy HH:mm');
                                }
                              } catch {
                                return '';
                              }
                            })()}
                          </span>
                        )}
                      </div>
                      {!isItAssistant && (
                        <button onClick={() => deleteTicket(ticket.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{ticket.title}</h3>
                  </div>
                  <span 
                    title={
                      ticket.status === 'open' ? 'Ticket is logged and waiting for an assignee' :
                      ticket.status === 'in_progress' ? 'IT staff is actively working on this issue' :
                      ticket.status === 'resolved' ? 'Issue has been fixed and confirmed' :
                      ticket.status === 'closed' ? 'Ticket is closed and no further action is needed' : ''
                    }
                    className={`cursor-help shrink-0 px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-full ${ ticket.status === 'resolved' ? 'bg-green-100 text-green-700' : ticket.status === 'closed' ? 'bg-slate-200 text-slate-600' : ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700' }`}
                  >
                    {ticket.status}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 flex-1 line-clamp-3">{ticket.description}</p>
                
                <div className="flex flex-col gap-1 mb-4 text-[11px]">
                    {ticket.requestUsername && (
                      <div className="flex items-center text-slate-500 dark:text-slate-400">
                        <span className="font-bold mr-1">User:</span> {ticket.requestUsername}
                      </div>
                    )}
                    {ticket.requestDept && (
                      <div className="flex items-center text-slate-500 dark:text-slate-400">
                        <span className="font-bold mr-1">Dept:</span> <span className="bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">{ticket.requestDept}</span>
                      </div>
                    )}
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                     <div className="col-span-2">
                       <label className="block text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1">Support Type</label>
                       <select
                         value={ticket.supportType || 'hardware'}
                         onChange={(e) => updateField(ticket.id, 'supportType', e.target.value)}
                         disabled={disableFields}
                         className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded outline-none px-2 py-1 text-slate-800 dark:text-slate-200 focus:border-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                       >
                         <option value="hardware">Hardware</option>
                         <option value="software">Software</option>
                         <option value="network">Network</option>
                         <option value="account">Account Issue</option>
                         <option value="other">Other</option>
                       </select>
                     </div>
                     <div>
                       <label className="block text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1">Priority</label>
                       <select
                         value={ticket.priority || 'low'}
                         onChange={(e) => updateField(ticket.id, 'priority', e.target.value)}
                         disabled={disableFields}
                         className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded outline-none px-2 py-1 text-slate-800 dark:text-slate-200 focus:border-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                       >
                         <option value="low">Low</option>
                         <option value="medium">Medium</option>
                         <option value="high">High</option>
                         <option value="critical">Critical</option>
                       </select>
                     </div>
                     <div>
                       <label className="block text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1">Assignee</label>
                       <select
                         value={ticket.assigneeId || 'unassigned'}
                         onChange={(e) => updateField(ticket.id, 'assigneeId', e.target.value)}
                         disabled={isItAssistant || disableFields}
                         className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded outline-none px-2 py-1 text-slate-800 dark:text-slate-200 focus:border-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                       >
                         <option value="unassigned">Unassigned</option>
                         {assistants.map(a => (
                           <option key={a.id} value={a.id}>{a.displayName || a.username || a.email}</option>
                         ))}
                       </select>
                     </div>
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-2">
                    <span className="font-bold text-slate-700 dark:text-slate-300">Latest update:</span> {ticket.history?.[ticket.history.length - 1]?.note || "None"}
                  </div>
                  
                  <div className="flex space-x-2">
                    <select
                      value={ticket.status}
                      onChange={(e) => updateField(ticket.id, 'status', e.target.value)}
                      disabled={disableFields}
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs rounded outline-none px-2 py-1.5 flex-1 text-slate-800 dark:text-slate-200 focus:border-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                    <button
                      onClick={() => setShowHistoryModal(ticket.id)}
                      disabled={disableFields}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-xs font-semibold text-white rounded transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Log Update
                    </button>
                  </div>
                </div>

                {/* History Modal for this ticket */}
                {showHistoryModal === ticket.id && (
                  <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 backdrop-blur-[2px]">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-lg border border-slate-200 dark:border-slate-700 shadow-xl">
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Ticket History - {ticket.title}</h2>
                      <div className="max-h-60 overflow-y-auto mb-4 space-y-2 pr-2">
                        {ticket.history?.map((h: any, i: number) => {
                          const isAiDraft = h.note?.includes('[AI Preliminary Response Draft]') || h.note?.includes('[AI Draft Response]');
                          return (
                            <div key={i} className={`p-3 rounded text-sm border ${isAiDraft ? 'bg-purple-50/70 border-purple-200/80' : 'bg-slate-50 border-slate-100'}`}>
                              {isAiDraft && (
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-purple-700 uppercase tracking-wider mb-1.5">
                                  <Sparkles className="w-3 h-3 text-purple-600" />
                                  <span>AI Generated Preliminary Response</span>
                                </div>
                              )}
                              <div className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{h.note}</div>
                              <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider">{format(new Date(h.date), 'Pp')}</div>
                            </div>
                          );
                        })}
                        {(!ticket.history || ticket.history.length === 0) && (
                          <div className="text-sm text-slate-500 dark:text-slate-400">No updates yet.</div>
                        )}
                      </div>
                      <form onSubmit={(e) => handleAddHistory(e, ticket.id, ticket.history || [])}>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Add New Update / Note</label>
                          <button
                            type="button"
                            disabled={isGeneratingDraft}
                            onClick={() => handleManualDraftGeneration(ticket)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-1 rounded transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                          >
                            {isGeneratingDraft ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                                <span>Drafting Response...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                                <span>Generate AI Draft</span>
                              </>
                            )}
                          </button>
                        </div>
                        <textarea required
                          placeholder="Add new update/note or click 'Generate AI Draft'..."
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 px-3 py-2 mb-4 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          rows={4}
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
                </motion.div>
              </div>
            );
          })}
          {filteredTickets.length === 0 && !loading && <div className="text-slate-500 dark:text-slate-400 col-span-full">No support tickets found.</div>}
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 backdrop-blur-[2px]">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-700 shadow-xl">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-5">New Support Ticket</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Issue / Title</label>
                  <input required type="text" value={newTicket.title} onChange={e => setNewTicket({...newTicket, title: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Description</label>
                  <textarea required value={newTicket.description} onChange={e => setNewTicket({...newTicket, description: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" rows={3}></textarea>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Request Username (Optional)</label>
                    <input type="text" value={newTicket.requestUsername} onChange={e => setNewTicket({...newTicket, requestUsername: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="e.g. jdoe" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Department (Optional)</label>
                    <input type="text" value={newTicket.requestDept} onChange={e => setNewTicket({...newTicket, requestDept: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="e.g. Sales, HR" />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Support Type</label>
                    <select value={newTicket.supportType} onChange={e => setNewTicket({...newTicket, supportType: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                      <option value="hardware">Hardware</option>
                      <option value="software">Software</option>
                      <option value="network">Network</option>
                      <option value="account">Account Issue</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Priority</label>
                    <select value={newTicket.priority} onChange={e => setNewTicket({...newTicket, priority: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Assign To</label>
                    <select value={newTicket.assigneeId} onChange={e => setNewTicket({...newTicket, assigneeId: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                      <option value="unassigned">Unassigned</option>
                      {assistants.map(a => (
                        <option key={a.id} value={a.id}>{a.displayName || a.username || a.email}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={resetNewTicketForm}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                  >
                    Clear Form
                  </button>
                  <div className="flex space-x-2">
                    <button type="button" onClick={() => setShowModal(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 transition-colors cursor-pointer">Cancel</button>
                    <button 
                      type="submit" 
                      disabled={isSubmittingTicket} 
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-60 cursor-pointer"
                    >
                      {isSubmittingTicket ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Creating & Drafting Response...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                          <span>Create Ticket</span>
                        </>
                      )}
                    </button>
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
