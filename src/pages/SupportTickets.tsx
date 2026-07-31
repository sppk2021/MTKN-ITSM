import React, { useEffect, useState } from "react";
import { collection, query, getDocs, addDoc, updateDoc, doc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { format } from "date-fns";
import { Search, Ticket, X, Sparkles, Bot, Loader2 } from "lucide-react";
import { SupportTicket, User, OperationType } from "../types";

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
}

export default function SupportTickets({ userRole = "staff" }: SupportTicketsProps) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [assistants, setAssistants] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState<string | null>(null);
  const [historyNote, setHistoryNote] = useState('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [newTicket, setNewTicket] = useState<Omit<SupportTicket, 'id' | 'ticketCode' | 'authorId' | 'history' | 'createdAt' | 'updatedAt'>>({ title: '', description: '', priority: 'low', supportType: 'hardware', status: 'open', assigneeId: 'unassigned', requestUsername: '', requestDept: '' });

  // Function calling Gemini API to generate preliminary response draft
  const generateTicketDraftResponse = async (ticketData: {
    title: string;
    description: string;
    supportType?: string;
    priority?: string;
    requestUsername?: string;
    requestDept?: string;
  }): Promise<string | null> => {
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
        alert("Could not generate AI draft. Please check your Gemini API configuration.");
      }
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const fetchTickets = async () => {
    try {
      const snap = await getDocs(query(collection(db, "tickets")));
      setTickets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportTicket)));
    } catch (e) {
      console.error(e);
      // Not throwing to avoid breaking the UI for non-fatal errors
      // but you could add handleFirestoreError here if needed.
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
        setNewTicket(prev => ({ ...prev, assigneeId: prev.assigneeId === 'unassigned' ? fetchedAssistants[0].id : prev.assigneeId }));
      }
    } catch (e) {
      console.error(e);
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
    const ticketCode = `TK-${Math.floor(1000 + Math.random() * 9000)}`;

    const initialHistory: Array<{ note: string; date: string }> = [
      { note: "Ticket created", date: new Date().toISOString() }
    ];

    // Automatically generate preliminary response draft using Gemini API upon new ticket submission
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

    const payload = {
      ...newTicket,
      ticketCode,
      authorId: auth.currentUser.uid,
      authorRole: userRole,
      history: initialHistory,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    try {
      await addDoc(collection(db, "tickets"), payload);
      setShowModal(false);
      setNewTicket({ title: '', description: '', priority: 'low', supportType: 'hardware', status: 'open', assigneeId: assistants.length > 0 ? assistants[0].id : 'unassigned', requestUsername: '', requestDept: '' });
      fetchTickets();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "tickets", payload);
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

    try {
      const newHistory = [...(currentHistory || []), { note: historyNote, date: new Date().toISOString() }];
      await updateDoc(doc(db, "tickets", ticketId), {
        history: newHistory,
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
    if (userRole === 'it_assistant') {
      alert("Permission Denied: IT Assistants are not allowed to delete tickets.");
      return;
    }

    const ticket = tickets.find(t => t.id === id);
    if (userRole === 'it_assistant' && ticket && isAdminAddedData(ticket)) {
      alert("Permission Denied: IT Assistants are not allowed to delete admin-created tickets.");
      return;
    }

    if (!window.confirm("Delete this support ticket?")) return;
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

    try {
      const updates: any = {
        [field]: value,
        updatedAt: serverTimestamp() 
      };

      if (field === 'status' && (value === 'resolved' || value === 'closed')) {
        updates.resolvedAt = new Date().toISOString();
      } else if (field === 'status' && (value === 'open' || value === 'in_progress')) {
        updates.resolvedAt = null;
      }

      await updateDoc(doc(db, "tickets", id), updates);
      fetchTickets();
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, "tickets", { [field]: value });
    }
  };

  const filteredTickets = tickets.filter(ticket => {
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
      <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Support Tickets</h1>
          <p className="text-xs text-slate-500">Manage IT support requests</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded shadow-sm hover:bg-blue-700 transition-colors"
        >
          New Ticket
        </button>
      </header>

      <div className="flex-1 p-8 overflow-y-auto">
        <div className="mb-6 flex items-center relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3" />
          <input
            type="text"
            placeholder="Search tickets or history..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm transition-shadow"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? <div className="text-slate-500 col-span-full">Loading...</div> : filteredTickets.map(ticket => {
            const isAdminTicket = isAdminAddedData(ticket);
            const isItAssistant = userRole === 'it_assistant';
            const disableFields = isItAssistant && isAdminTicket;

            return (
              <div key={ticket.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col h-full">
                <div className="flex justify-between items-start mb-4 gap-2">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 w-fit">{ticket.ticketCode || 'NO CODE'}</div>
                        {ticket.createdAt && (
                          <span className="text-[10px] text-slate-400">
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
                    <h3 className="text-sm font-bold text-slate-800 line-clamp-1">{ticket.title}</h3>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-full ${
                    ticket.status === 'resolved' ? 'bg-green-100 text-green-700' :
                    ticket.status === 'closed' ? 'bg-slate-200 text-slate-600' :
                    ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {ticket.status}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mb-4 flex-1 line-clamp-3">{ticket.description}</p>
                
                <div className="flex flex-col gap-1 mb-4 text-[11px]">
                    {ticket.requestUsername && (
                      <div className="flex items-center text-slate-500">
                        <span className="font-bold mr-1">User:</span> {ticket.requestUsername}
                      </div>
                    )}
                    {ticket.requestDept && (
                      <div className="flex items-center text-slate-500">
                        <span className="font-bold mr-1">Dept:</span> <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">{ticket.requestDept}</span>
                      </div>
                    )}
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                     <div className="col-span-2">
                       <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Support Type</label>
                       <select
                         value={ticket.supportType || 'hardware'}
                         onChange={(e) => updateField(ticket.id, 'supportType', e.target.value)}
                         disabled={disableFields}
                         className="w-full bg-slate-50 border border-slate-200 rounded outline-none px-2 py-1 text-slate-800 focus:border-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                       >
                         <option value="hardware">Hardware</option>
                         <option value="software">Software</option>
                         <option value="network">Network</option>
                         <option value="account">Account Issue</option>
                         <option value="other">Other</option>
                       </select>
                     </div>
                     <div>
                       <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Priority</label>
                       <select
                         value={ticket.priority || 'low'}
                         onChange={(e) => updateField(ticket.id, 'priority', e.target.value)}
                         disabled={disableFields}
                         className="w-full bg-slate-50 border border-slate-200 rounded outline-none px-2 py-1 text-slate-800 focus:border-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                       >
                         <option value="low">Low</option>
                         <option value="medium">Medium</option>
                         <option value="high">High</option>
                         <option value="critical">Critical</option>
                       </select>
                     </div>
                     <div>
                       <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Assignee</label>
                       <select
                         value={ticket.assigneeId || 'unassigned'}
                         onChange={(e) => updateField(ticket.id, 'assigneeId', e.target.value)}
                         disabled={isItAssistant || disableFields}
                         className="w-full bg-slate-50 border border-slate-200 rounded outline-none px-2 py-1 text-slate-800 focus:border-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                       >
                         <option value="unassigned">Unassigned</option>
                         {assistants.map(a => (
                           <option key={a.id} value={a.id}>{a.displayName || a.username || a.email}</option>
                         ))}
                       </select>
                     </div>
                  </div>

                  <div className="text-[11px] text-slate-500 line-clamp-2 mt-2">
                    <span className="font-bold text-slate-700">Latest update:</span> {ticket.history?.[ticket.history.length - 1]?.note || "None"}
                  </div>
                  
                  <div className="flex space-x-2">
                    <select
                      value={ticket.status}
                      onChange={(e) => updateField(ticket.id, 'status', e.target.value)}
                      disabled={disableFields}
                      className="bg-slate-50 border border-slate-200 text-xs rounded outline-none px-2 py-1.5 flex-1 text-slate-800 focus:border-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg border border-slate-200 shadow-xl">
                      <h2 className="text-lg font-bold text-slate-900 mb-4">Ticket History - {ticket.title}</h2>
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
                              <div className="text-slate-800 whitespace-pre-wrap leading-relaxed">{h.note}</div>
                              <div className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-wider">{format(new Date(h.date), 'Pp')}</div>
                            </div>
                          );
                        })}
                        {(!ticket.history || ticket.history.length === 0) && (
                          <div className="text-sm text-slate-500">No updates yet.</div>
                        )}
                      </div>
                      <form onSubmit={(e) => handleAddHistory(e, ticket.id, ticket.history || [])}>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-bold text-slate-700">Add New Update / Note</label>
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
                          className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 mb-4 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          rows={4}
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
            );
          })}
          {filteredTickets.length === 0 && !loading && <div className="text-slate-500 col-span-full">No support tickets found.</div>}
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 backdrop-blur-[2px]">
            <div className="bg-white rounded-xl p-6 w-full max-w-md border border-slate-200 shadow-xl">
              <h2 className="text-lg font-bold text-slate-900 mb-5">New Support Ticket</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Issue / Title</label>
                  <input required type="text" value={newTicket.title} onChange={e => setNewTicket({...newTicket, title: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Description</label>
                  <textarea required value={newTicket.description} onChange={e => setNewTicket({...newTicket, description: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" rows={3}></textarea>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Request Username (Optional)</label>
                    <input type="text" value={newTicket.requestUsername} onChange={e => setNewTicket({...newTicket, requestUsername: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="e.g. jdoe" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Department (Optional)</label>
                    <input type="text" value={newTicket.requestDept} onChange={e => setNewTicket({...newTicket, requestDept: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="e.g. Sales, HR" />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Support Type</label>
                    <select value={newTicket.supportType} onChange={e => setNewTicket({...newTicket, supportType: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
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
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Priority</label>
                    <select value={newTicket.priority} onChange={e => setNewTicket({...newTicket, priority: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Assign To</label>
                    <select value={newTicket.assigneeId} onChange={e => setNewTicket({...newTicket, assigneeId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded text-slate-800 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                      <option value="unassigned">Unassigned</option>
                      {assistants.map(a => (
                        <option key={a.id} value={a.id}>{a.displayName || a.username || a.email}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">Cancel</button>
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
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
