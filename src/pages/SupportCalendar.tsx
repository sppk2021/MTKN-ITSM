import React, { useEffect, useState } from "react";
import { collection, query, getDocs, addDoc, updateDoc, doc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { ChevronDown, ChevronUp } from "lucide-react";
import { User, UserPermissions } from "../types";
import { 
  saveCalendarEventsLocal, 
  getCalendarEventsLocal, 
  saveUsersLocal, 
  getUsersLocal, 
  addPendingSyncAction 
} from "../lib/offlineStorage";
import { SyncStatusBadge } from "../components/SyncStatusBadge";

interface SupportCalendarProps {
  userRole?: string;
  userPermissions?: UserPermissions;
}

export default function SupportCalendar({ userRole = 'staff', userPermissions }: SupportCalendarProps) {
  const canEdit = userRole === 'admin' || (userPermissions?.calendar?.edit ?? (userRole !== 'management' && userRole !== 'staff'));
  const canDelete = userRole === 'admin' || (userPermissions?.calendar?.delete ?? false);

  const [events, setEvents] = useState<any[]>([]);
  const [assistants, setAssistants] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});
  const [newEvent, setNewEvent] = useState({ title: '', description: '', startTime: '', endTime: '', dueDate: '', location: '', assigneeId: '', status: 'scheduled', eventType: 'standard' });

  const toggleExpand = (id: string) => {
    setExpandedEvents(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const fetchEvents = async () => {
    try {
      if (!navigator.onLine) {
        const cached = await getCalendarEventsLocal();
        if (cached.length > 0) {
          setEvents(cached);
        }
        return;
      }
      const snap = await getDocs(query(collection(db, "calendarEvents")));
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEvents(list);
      await saveCalendarEventsLocal(list);
    } catch (error) {
      console.error(error);
      const cached = await getCalendarEventsLocal();
      if (cached.length > 0) {
        setEvents(cached);
      }
    }
  };

  const fetchUsers = async () => {
    try {
      if (!navigator.onLine) {
        const cached = await getUsersLocal();
        if (cached.length > 0) {
          setAllUsers(cached);
          setAssistants(cached.filter(u => u.role === 'it_assistant' || u.role === 'admin'));
        }
        return;
      }
      const snap = await getDocs(query(collection(db, "users")));
      const fetchedAll = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setAllUsers(fetchedAll);
      setAssistants(fetchedAll.filter(u => u.role === 'it_assistant' || u.role === 'admin'));
      await saveUsersLocal(fetchedAll);
    } catch (e) {
      console.error(e);
      const cached = await getUsersLocal();
      if (cached.length > 0) {
        setAllUsers(cached);
        setAssistants(cached.filter(u => u.role === 'it_assistant' || u.role === 'admin'));
      }
    }
  };

  useEffect(() => {
    Promise.all([fetchEvents(), fetchUsers()]).finally(() => setLoading(false));
  }, []);

  const isAdminAddedData = (event: any) => {
    if (!event) return false;
    if (event.authorRole === 'admin') return true;
    const creator = allUsers.find(u => u.id === event.authorId);
    return creator?.role === 'admin';
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        ...newEvent,
        authorId: auth.currentUser?.uid || '',
        authorRole: userRole
      };
      if (!payload.dueDate) {
        delete payload.dueDate;
      }

      if (!navigator.onLine) {
        const localEvt = {
          id: `local_evt_${Date.now()}`,
          ...payload,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        const updated = [localEvt, ...events];
        setEvents(updated);
        await saveCalendarEventsLocal(updated);
        await addPendingSyncAction('CREATE_CALENDAR_EVENT', payload);
        setShowModal(false);
        setNewEvent({ title: '', description: '', startTime: '', endTime: '', dueDate: '', location: '', assigneeId: '', status: 'scheduled', eventType: 'standard' });
        alert("Event saved locally in IndexedDB!");
        return;
      }

      await addDoc(collection(db, "calendarEvents"), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setShowModal(false);
      setNewEvent({ title: '', description: '', startTime: '', endTime: '', dueDate: '', location: '', assigneeId: '', status: 'scheduled', eventType: 'standard' });
      fetchEvents();
    } catch (error) {
      console.error(error);
      alert("Failed to add event");
    }
  };

  const toggleStatus = async (id: string, current: string) => {
    if (!canEdit) {
      alert("Permission Denied: You do not have permission to update calendar events.");
      return;
    }

    const evt = events.find(e => e.id === id);
    if (userRole === 'it_assistant' && evt && isAdminAddedData(evt)) {
      alert("Permission Denied: IT Assistants are not allowed to update admin-created calendar events.");
      return;
    }

    try {
      const nextStatus = current === 'scheduled' ? 'in_progress' : current === 'in_progress' ? 'resolved' : 'scheduled';

      if (!navigator.onLine) {
        const updated = events.map(e => e.id === id ? { ...e, status: nextStatus, updatedAt: new Date().toISOString() } : e);
        setEvents(updated);
        await saveCalendarEventsLocal(updated);
        await addPendingSyncAction('UPDATE_CALENDAR_EVENT', { id, updates: { status: nextStatus } });
        return;
      }

      await updateDoc(doc(db, "calendarEvents", id), { status: nextStatus, updatedAt: serverTimestamp() });
      fetchEvents();
    } catch (e) {
      console.error(e);
    }
  };

  const deleteEvent = async (id: string) => {
    if (!canDelete) {
      alert("Permission Denied: You do not have permission to delete calendar events.");
      return;
    }

    const evt = events.find(e => e.id === id);
    if (userRole === 'it_assistant' && evt && isAdminAddedData(evt)) {
      alert("Permission Denied: IT Assistants are not allowed to delete admin-created calendar events.");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this event?")) return;

    if (!navigator.onLine) {
      const updated = events.filter(e => e.id !== id);
      setEvents(updated);
      await saveCalendarEventsLocal(updated);
      await addPendingSyncAction('DELETE_CALENDAR_EVENT', { id });
      alert("Event deleted locally in IndexedDB!");
      return;
    }

    try {
      await deleteDoc(doc(db, "calendarEvents", id));
      fetchEvents();
    } catch (e) {
      console.error(e);
    }
  };

  const startDate = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));

  return (
    <>
      <header className="min-h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-8 py-3 sm:py-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2.5 flex-wrap">
            <span>IT Support Calendar</span>
            <SyncStatusBadge onSynced={fetchEvents} />
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Manage and schedule tasks with local-first offline sync</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="w-full sm:w-auto px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition-colors cursor-pointer min-h-[44px]"
        >
          Create Event
        </button>
      </header>

      <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col mb-8">
           <div className="p-5 border-b border-slate-100 dark:border-slate-800">
             <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase">Upcoming Schedule (List View)</h2>
           </div>
           <div className="p-5 space-y-4">
             {loading ? <div className="text-slate-500 dark:text-slate-400 text-sm">Loading...</div> : events.map(evt => {
               const assignee = assistants.find(a => a.id === evt.assigneeId);
               return (
                 <div key={evt.id} className="flex flex-col md:flex-row gap-4 items-start md:items-center border-b border-slate-50 pb-4 last:border-0 last:pb-0">
                   <div className="flex-1">
                     <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                          {evt.title}
                          <span className={`inline-block px-1.5 py-0.5 text-[10px] rounded font-bold uppercase tracking-wider ${ evt.eventType === 'urgent' ? 'bg-red-100 text-red-700' : evt.eventType === 'maintenance' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600' }`}>
                            {evt.eventType || 'standard'}
                          </span>
                      </h3>
                     <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        {evt.description && evt.description.length > 80 ? (
                          <>
                            {expandedEvents[evt.id] ? (
                              <p className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded p-2 text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">{evt.description}</p>
                            ) : (
                              <p className="line-clamp-2">{evt.description}</p>
                            )}
                            <button onClick={() => toggleExpand(evt.id)} className="flex items-center text-blue-600 font-medium mt-1 hover:underline">
                              {expandedEvents[evt.id] ? <><ChevronUp className="w-3 h-3 mr-1" /> Hide</> : <><ChevronDown className="w-3 h-3 mr-1" /> Show more</>}
                            </button>
                          </>
                        ) : (
                          <p>{evt.description}</p>
                        )}
                      </div>
                     <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] text-slate-500 dark:text-slate-400">
                       <span>{evt.startTime.replace("T", " ")} - {evt.endTime.replace("T", " ")}</span>
                       {evt.dueDate && <span className="text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">Due: {evt.dueDate.replace("T", " ")}</span>}
                       <span className="inline-block bg-slate-100 dark:bg-slate-800/50 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">{evt.location}</span>
                       <span>Assignee: <span className="text-slate-700 dark:text-slate-300 font-medium">{assignee?.displayName || assignee?.username || assignee?.email || 'Unassigned'}</span></span>
                       <span className={`capitalize font-bold ${evt.status === 'resolved' ? 'text-green-600' : evt.status === 'in_progress' ? 'text-blue-600' : 'text-amber-600'}`}>
                         State: {evt.status.replace('_', ' ')}
                       </span>
                     </div>
                   </div>
                   <div className="flex space-x-2 shrink-0">
                     <button onClick={() => toggleStatus(evt.id, evt.status)} disabled={userRole === 'it_assistant' && isAdminAddedData(evt)} className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded text-xs font-semibold text-slate-600 dark:text-slate-400 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                       Cycle Status
                     </button>
                     <button onClick={() => deleteEvent(evt.id)} className={`px-3 py-1.5 bg-white dark:bg-slate-800 border border-red-200 hover:bg-red-50 rounded text-xs font-semibold text-red-600 shadow-sm transition-colors ${userRole === 'it_assistant' ? 'hidden' : ''}`}>
                       Delete
                     </button>
                   </div>
                 </div>
               )
             })}
             {events.length === 0 && !loading && <div className="text-slate-500 dark:text-slate-400 text-sm">No scheduled events.</div>}
           </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 backdrop-blur-[2px]">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-700 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-5">Create Event</h2>
            <form onSubmit={handleAddEvent} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Title</label>
                  <input required type="text" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Event Type</label>
                  <select value={newEvent.eventType} onChange={e => setNewEvent({...newEvent, eventType: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                    <option value="standard">Standard Event</option>
                    <option value="maintenance">Monthly Maintenance</option>
                    <option value="urgent">Urgent Support</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Description</label>
                <input type="text" value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Start Time</label>
                  <input required type="datetime-local" value={newEvent.startTime} onChange={e => setNewEvent({...newEvent, startTime: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">End Time</label>
                  <input required type="datetime-local" value={newEvent.endTime} onChange={e => setNewEvent({...newEvent, endTime: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Due Date</label>
                  <input type="datetime-local" value={newEvent.dueDate} onChange={e => setNewEvent({...newEvent, dueDate: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Location / Branch</label>
                <input required type="text" value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Assignee</label>
                <select required value={newEvent.assigneeId} onChange={e => setNewEvent({...newEvent, assigneeId: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                  <option value="">Select IT Assistant</option>
                  {assistants.map(a => <option key={a.id} value={a.id}>{a.displayName || a.username || a.email}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setNewEvent({ title: '', description: '', startTime: '', endTime: '', dueDate: '', location: '', assigneeId: '', status: 'scheduled', eventType: 'standard' })}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                >
                  Clear Form
                </button>
                <div className="flex space-x-2">
                  <button type="button" onClick={() => setShowModal(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 transition-colors cursor-pointer">Cancel</button>
                  <button type="submit" className="px-4 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold shadow-sm hover:bg-blue-700 transition-colors cursor-pointer">Save Event</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
