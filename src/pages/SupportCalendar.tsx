import React, { useEffect, useState, useMemo } from "react";
import { collection, query, getDocs, addDoc, updateDoc, doc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isToday, 
  addMonths, 
  subMonths, 
  addWeeks, 
  subWeeks,
  parseISO,
  isValid
} from "date-fns";
import { 
  Calendar as CalendarIcon, 
  CalendarDays, 
  List, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Search, 
  Filter, 
  Clock, 
  MapPin, 
  User as UserIcon, 
  CheckCircle2, 
  AlertTriangle, 
  Wrench, 
  Trash2, 
  Edit, 
  X, 
  Eye, 
  ShieldAlert,
  Activity,
  Layers
} from "lucide-react";
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

export interface CalendarEventItem {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  dueDate?: string;
  location: string;
  assigneeId: string;
  status: 'scheduled' | 'in_progress' | 'resolved';
  eventType: 'standard' | 'maintenance' | 'urgent';
  authorId?: string;
  authorRole?: string;
  createdAt?: any;
  updatedAt?: any;
}

export default function SupportCalendar({ userRole = 'staff', userPermissions }: SupportCalendarProps) {
  const canEdit = userRole === 'admin' || (userPermissions?.calendar?.edit ?? (userRole !== 'management' && userRole !== 'staff'));
  const canDelete = userRole === 'admin' || (userPermissions?.calendar?.delete ?? false);

  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [assistants, setAssistants] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // View state
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'list'>('month');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'scheduled' | 'in_progress' | 'resolved'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'standard' | 'maintenance' | 'urgent'>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');

  // Modals & Drawers
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventItem | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEventItem | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});

  // New/Edit form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    dueDate: '',
    location: '',
    assigneeId: '',
    status: 'scheduled' as 'scheduled' | 'in_progress' | 'resolved',
    eventType: 'standard' as 'standard' | 'maintenance' | 'urgent'
  });

  const toggleExpand = (id: string) => {
    setExpandedEvents(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Safe date parser
  const parseSafeDate = (dateStr?: string): Date | null => {
    if (!dateStr) return null;
    try {
      const parsed = parseISO(dateStr);
      if (isValid(parsed)) return parsed;
      const fallback = new Date(dateStr);
      if (isValid(fallback)) return fallback;
    } catch {
      return null;
    }
    return null;
  };

  const fetchEvents = async () => {
    try {
      if (!navigator.onLine) {
        const cached = await getCalendarEventsLocal();
        if (cached.length > 0) {
          setEvents(cached as CalendarEventItem[]);
        }
        return;
      }
      const snap = await getDocs(query(collection(db, "calendarEvents")));
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CalendarEventItem[];
      setEvents(list);
      await saveCalendarEventsLocal(list);
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      const cached = await getCalendarEventsLocal();
      if (cached.length > 0) {
        setEvents(cached as CalendarEventItem[]);
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
      console.error("Error fetching users:", e);
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

  const isAdminAddedData = (event: CalendarEventItem) => {
    if (!event) return false;
    if (event.authorRole === 'admin') return true;
    const creator = allUsers.find(u => u.id === event.authorId);
    return creator?.role === 'admin';
  };

  // Open Create Modal (optionally for a specific date)
  const openCreateForDate = (date?: Date) => {
    const targetDate = date || new Date();
    const dateFormatted = format(targetDate, "yyyy-MM-dd");
    setFormData({
      title: '',
      description: '',
      startTime: `${dateFormatted}T09:00`,
      endTime: `${dateFormatted}T10:00`,
      dueDate: `${dateFormatted}T17:00`,
      location: '',
      assigneeId: assistants[0]?.id || '',
      status: 'scheduled',
      eventType: 'standard'
    });
    setEditingEvent(null);
    setShowCreateModal(true);
  };

  // Open Edit Modal
  const openEditModal = (evt: CalendarEventItem) => {
    setEditingEvent(evt);
    setFormData({
      title: evt.title,
      description: evt.description || '',
      startTime: evt.startTime ? evt.startTime.slice(0, 16) : '',
      endTime: evt.endTime ? evt.endTime.slice(0, 16) : '',
      dueDate: evt.dueDate ? evt.dueDate.slice(0, 16) : '',
      location: evt.location || '',
      assigneeId: evt.assigneeId || '',
      status: evt.status || 'scheduled',
      eventType: evt.eventType || 'standard'
    });
    setShowCreateModal(true);
    setSelectedEvent(null);
  };

  // Form Submit (Create or Edit)
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        ...formData,
        authorId: editingEvent ? (editingEvent.authorId || auth.currentUser?.uid || '') : (auth.currentUser?.uid || ''),
        authorRole: editingEvent ? (editingEvent.authorRole || userRole) : userRole
      };
      if (!payload.dueDate) {
        delete payload.dueDate;
      }

      if (editingEvent) {
        // Edit existing
        if (!navigator.onLine) {
          const updated = events.map(ev => ev.id === editingEvent.id ? { ...ev, ...payload, updatedAt: new Date().toISOString() } : ev);
          setEvents(updated);
          await saveCalendarEventsLocal(updated);
          await addPendingSyncAction('UPDATE_CALENDAR_EVENT', { id: editingEvent.id, updates: payload });
          setShowCreateModal(false);
          setEditingEvent(null);
          return;
        }

        await updateDoc(doc(db, "calendarEvents", editingEvent.id), {
          ...payload,
          updatedAt: serverTimestamp()
        });
      } else {
        // Create new
        if (!navigator.onLine) {
          const localEvt: CalendarEventItem = {
            id: `local_evt_${Date.now()}`,
            ...payload,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          const updated = [localEvt, ...events];
          setEvents(updated);
          await saveCalendarEventsLocal(updated);
          await addPendingSyncAction('CREATE_CALENDAR_EVENT', payload);
          setShowCreateModal(false);
          return;
        }

        await addDoc(collection(db, "calendarEvents"), {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      setShowCreateModal(false);
      setEditingEvent(null);
      fetchEvents();
    } catch (error) {
      console.error("Error saving event:", error);
      alert("Failed to save event. Please check inputs.");
    }
  };

  // Cycle Event Status (scheduled -> in_progress -> resolved -> scheduled)
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
      const nextStatus: 'scheduled' | 'in_progress' | 'resolved' = 
        current === 'scheduled' ? 'in_progress' : current === 'in_progress' ? 'resolved' : 'scheduled';

      if (!navigator.onLine) {
        const updated = events.map(e => e.id === id ? { ...e, status: nextStatus, updatedAt: new Date().toISOString() } : e);
        setEvents(updated);
        if (selectedEvent && selectedEvent.id === id) {
          setSelectedEvent({ ...selectedEvent, status: nextStatus });
        }
        await saveCalendarEventsLocal(updated);
        await addPendingSyncAction('UPDATE_CALENDAR_EVENT', { id, updates: { status: nextStatus } });
        return;
      }

      await updateDoc(doc(db, "calendarEvents", id), { status: nextStatus, updatedAt: serverTimestamp() });
      if (selectedEvent && selectedEvent.id === id) {
        setSelectedEvent({ ...selectedEvent, status: nextStatus });
      }
      fetchEvents();
    } catch (e) {
      console.error("Error updating status:", e);
    }
  };

  // Delete event
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

    if (!window.confirm("Are you sure you want to delete this scheduled event?")) return;

    if (!navigator.onLine) {
      const updated = events.filter(e => e.id !== id);
      setEvents(updated);
      await saveCalendarEventsLocal(updated);
      await addPendingSyncAction('DELETE_CALENDAR_EVENT', { id });
      if (selectedEvent?.id === id) setSelectedEvent(null);
      return;
    }

    try {
      await deleteDoc(doc(db, "calendarEvents", id));
      if (selectedEvent?.id === id) setSelectedEvent(null);
      fetchEvents();
    } catch (e) {
      console.error("Error deleting event:", e);
    }
  };

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter(evt => {
      // Search text
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const assignee = assistants.find(a => a.id === evt.assigneeId);
        const assigneeName = (assignee?.displayName || assignee?.username || assignee?.email || '').toLowerCase();
        const match = 
          evt.title.toLowerCase().includes(q) ||
          (evt.description && evt.description.toLowerCase().includes(q)) ||
          evt.location.toLowerCase().includes(q) ||
          assigneeName.includes(q);
        if (!match) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && evt.status !== statusFilter) {
        return false;
      }

      // Event Type filter
      if (typeFilter !== 'all' && evt.eventType !== typeFilter) {
        return false;
      }

      // Assignee filter
      if (assigneeFilter !== 'all' && evt.assigneeId !== assigneeFilter) {
        return false;
      }

      return true;
    });
  }, [events, searchQuery, statusFilter, typeFilter, assigneeFilter, assistants]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = events.length;
    const scheduled = events.filter(e => e.status === 'scheduled').length;
    const inProgress = events.filter(e => e.status === 'in_progress').length;
    const resolved = events.filter(e => e.status === 'resolved').length;
    const urgent = events.filter(e => e.eventType === 'urgent' && e.status !== 'resolved').length;
    return { total, scheduled, inProgress, resolved, urgent };
  }, [events]);

  // Calendar Calculation for Month View
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const monthDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Calendar Calculation for Week View
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Navigation handlers
  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(prev => subMonths(prev, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(prev => subWeeks(prev, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(prev => addMonths(prev, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(prev => addWeeks(prev, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Helper to get events occurring on a specific date
  const getEventsForDay = (day: Date) => {
    return filteredEvents.filter(evt => {
      const sDate = parseSafeDate(evt.startTime);
      if (sDate && isSameDay(sDate, day)) return true;
      const dDate = parseSafeDate(evt.dueDate);
      if (dDate && isSameDay(dDate, day)) return true;
      return false;
    });
  };

  // Helper for event type styling
  const getEventTypeStyles = (type: string) => {
    switch (type) {
      case 'urgent':
        return {
          badge: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800',
          chip: 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
          indicator: 'bg-red-500',
          icon: <ShieldAlert className="w-3.5 h-3.5 text-red-500 shrink-0" />
        };
      case 'maintenance':
        return {
          badge: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
          chip: 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900',
          indicator: 'bg-purple-500',
          icon: <Wrench className="w-3.5 h-3.5 text-purple-500 shrink-0" />
        };
      default:
        return {
          badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
          chip: 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900',
          indicator: 'bg-blue-500',
          icon: <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
        };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
        return {
          label: 'Resolved',
          badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
          dot: 'bg-emerald-500'
        };
      case 'in_progress':
        return {
          label: 'In Progress',
          badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
          dot: 'bg-blue-500'
        };
      default:
        return {
          label: 'Scheduled',
          badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
          dot: 'bg-amber-500'
        };
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Header Bar */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 rounded-xl border border-blue-100 dark:border-blue-900 text-blue-600 dark:text-blue-400 shrink-0">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                IT Support Calendar
              </h1>
              <SyncStatusBadge onSynced={fetchEvents} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Interactive team schedules, maintenance windows, and task dispatching
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* View Switcher Tabs */}
          <div className="bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-1">
            <button
              id="view-mode-month"
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'month'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/60 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Month</span>
            </button>
            <button
              id="view-mode-week"
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'week'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/60 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Week</span>
            </button>
            <button
              id="view-mode-list"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/60 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List ({filteredEvents.length})</span>
            </button>
          </div>

          <button
            id="btn-create-calendar-event"
            onClick={() => openCreateForDate(new Date())}
            className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create Event</span>
          </button>
        </div>
      </header>

      {/* Metric Quick-Pills & Filter Bar */}
      <div className="bg-white dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-3 space-y-3 shrink-0">
        {/* Metric Summaries */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Total Events</span>
            <span className="text-sm font-extrabold text-slate-900 dark:text-white font-mono">{metrics.total}</span>
          </div>
          <div className="bg-amber-50/50 dark:bg-amber-950/20 p-2.5 rounded-lg border border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">Scheduled</span>
            <span className="text-sm font-extrabold text-amber-700 dark:text-amber-300 font-mono">{metrics.scheduled}</span>
          </div>
          <div className="bg-blue-50/50 dark:bg-blue-950/20 p-2.5 rounded-lg border border-blue-200/60 dark:border-blue-900/40 flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400">In Progress</span>
            <span className="text-sm font-extrabold text-blue-700 dark:text-blue-300 font-mono">{metrics.inProgress}</span>
          </div>
          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">Resolved</span>
            <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300 font-mono">{metrics.resolved}</span>
          </div>
          <div className="col-span-2 sm:col-span-1 bg-red-50/50 dark:bg-red-950/20 p-2.5 rounded-lg border border-red-200/60 dark:border-red-900/40 flex items-center justify-between">
            <span className="text-[11px] font-bold text-red-700 dark:text-red-400 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" /> Urgent Active
            </span>
            <span className="text-sm font-extrabold text-red-700 dark:text-red-300 font-mono">{metrics.urgent}</span>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
          {/* Navigation Controls */}
          <div className="flex items-center gap-2">
            <button
              id="btn-calendar-prev"
              onClick={handlePrev}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              id="btn-calendar-today"
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            >
              Today
            </button>
            <button
              id="btn-calendar-next"
              onClick={handleNext}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white ml-2">
              {viewMode === 'month' && format(currentDate, "MMMM yyyy")}
              {viewMode === 'week' && `Week of ${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`}
              {viewMode === 'list' && "All Scheduled Events"}
            </span>
          </div>

          {/* Search and Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative min-w-[160px] sm:min-w-[200px] flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search title, location, staff..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            >
              <option value="all">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>

            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as any)}
              className="text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            >
              <option value="all">All Types</option>
              <option value="standard">Standard Event</option>
              <option value="maintenance">Maintenance</option>
              <option value="urgent">Urgent Support</option>
            </select>

            <select
              value={assigneeFilter}
              onChange={e => setAssigneeFilter(e.target.value)}
              className="text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium max-w-[140px] truncate"
            >
              <option value="all">All Assignees</option>
              {assistants.map(a => (
                <option key={a.id} value={a.id}>{a.displayName || a.username || a.email}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6">
        
        {/* ======================================================== */}
        {/* MONTH VIEW (Calendar Grid) */}
        {/* ======================================================== */}
        {viewMode === 'month' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden flex flex-col h-full min-h-[640px]">
            {/* Day of Week Headers */}
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/60 text-center text-xs font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wider py-2.5">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span className="text-blue-600 dark:text-blue-400">Sat</span>
              <span className="text-red-500 dark:text-red-400">Sun</span>
            </div>

            {/* Month Day Cells */}
            <div className="grid grid-cols-7 flex-1 auto-rows-fr divide-x divide-y divide-slate-100 dark:divide-slate-800/80 border-b border-slate-200 dark:border-slate-700 bg-slate-100/30 dark:bg-slate-900/30">
              {monthDays.map((day) => {
                const dayEvents = getEventsForDay(day);
                const isCurrMonth = isSameMonth(day, monthStart);
                const isCurrentToday = isToday(day);

                return (
                  <div
                    key={day.toISOString()}
                    className={`min-h-[105px] p-1.5 sm:p-2 transition-colors flex flex-col group relative ${
                      isCurrMonth 
                        ? 'bg-white dark:bg-slate-800/90 hover:bg-slate-50/70 dark:hover:bg-slate-800' 
                        : 'bg-slate-50/60 dark:bg-slate-900/40 text-slate-400 dark:text-slate-600'
                    }`}
                  >
                    {/* Date Cell Header */}
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                          isCurrentToday
                            ? 'bg-blue-600 text-white font-extrabold shadow-xs'
                            : isCurrMonth
                            ? 'text-slate-800 dark:text-slate-200'
                            : 'text-slate-400 dark:text-slate-600'
                        }`}
                      >
                        {format(day, 'd')}
                      </span>

                      {/* Quick Add button on hover */}
                      <button
                        onClick={() => openCreateForDate(day)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded transition-opacity"
                        title={`Add event on ${format(day, 'MMM d')}`}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Events List in Day Cell */}
                    <div className="flex-1 space-y-1 overflow-y-auto max-h-[85px] sm:max-h-[110px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                      {dayEvents.map(evt => {
                        const style = getEventTypeStyles(evt.eventType);
                        const statusBadge = getStatusBadge(evt.status);
                        const assignee = assistants.find(a => a.id === evt.assigneeId);

                        return (
                          <div
                            key={evt.id}
                            onClick={() => setSelectedEvent(evt)}
                            className={`px-1.5 py-1 rounded text-[10px] sm:text-[11px] font-semibold border transition-all cursor-pointer truncate flex items-center justify-between gap-1 shadow-2xs ${style.chip}`}
                            title={`${evt.title} (${evt.eventType}) - ${evt.status} - ${assignee?.displayName || 'Unassigned'}`}
                          >
                            <div className="flex items-center gap-1 truncate">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusBadge.dot}`} />
                              <span className="truncate">{evt.title}</span>
                            </div>
                            {evt.startTime && (
                              <span className="text-[9px] opacity-70 shrink-0 font-mono">
                                {evt.startTime.split('T')[1]?.slice(0, 5)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* WEEK VIEW (7 Column Timeline View) */}
        {/* ======================================================== */}
        {viewMode === 'week' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden flex flex-col h-full min-h-[640px]">
            {/* Week Header */}
            <div className="grid grid-cols-1 md:grid-cols-7 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/60 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-700">
              {weekDays.map(day => {
                const isCurrentToday = isToday(day);
                return (
                  <div key={day.toISOString()} className="p-3 text-center">
                    <p className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {format(day, 'EEE')}
                    </p>
                    <p className={`text-base font-extrabold mt-0.5 inline-block px-2 py-0.5 rounded-full ${
                      isCurrentToday ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-900 dark:text-white'
                    }`}>
                      {format(day, 'MMM d')}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Week Day Columns */}
            <div className="grid grid-cols-1 md:grid-cols-7 flex-1 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800 bg-slate-50/30 dark:bg-slate-900/20 overflow-y-auto">
              {weekDays.map(day => {
                const dayEvents = getEventsForDay(day);

                return (
                  <div key={day.toISOString()} className="p-2 sm:p-3 flex flex-col min-h-[300px] group bg-white dark:bg-slate-800/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                        {dayEvents.length} {dayEvents.length === 1 ? 'task' : 'tasks'}
                      </span>
                      <button
                        onClick={() => openCreateForDate(day)}
                        className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    </div>

                    <div className="space-y-2 flex-1">
                      {dayEvents.map(evt => {
                        const style = getEventTypeStyles(evt.eventType);
                        const statusBadge = getStatusBadge(evt.status);
                        const assignee = assistants.find(a => a.id === evt.assigneeId);

                        return (
                          <div
                            key={evt.id}
                            onClick={() => setSelectedEvent(evt)}
                            className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs hover:shadow-xs transition-all cursor-pointer space-y-1.5"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <span className={`text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded border ${style.badge}`}>
                                {evt.eventType}
                              </span>
                              <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${statusBadge.badge}`}>
                                {statusBadge.label}
                              </span>
                            </div>

                            <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
                              {evt.title}
                            </p>

                            <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span className="font-mono">{evt.startTime.split('T')[1]?.slice(0, 5)} - {evt.endTime.split('T')[1]?.slice(0, 5)}</span>
                              </div>
                              <div className="flex items-center gap-1 truncate">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{evt.location}</span>
                              </div>
                              <div className="flex items-center gap-1 truncate">
                                <UserIcon className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate font-medium text-slate-700 dark:text-slate-300">
                                  {assignee?.displayName || assignee?.username || assignee?.email || 'Unassigned'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {dayEvents.length === 0 && (
                        <div 
                          onClick={() => openCreateForDate(day)}
                          className="h-24 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer text-xs"
                        >
                          <Plus className="w-4 h-4 mb-1" />
                          <span className="text-[10px] font-medium">Add task</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* LIST / AGENDA VIEW */}
        {/* ======================================================== */}
        {viewMode === 'list' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Support Schedule & Tasks ({filteredEvents.length})
              </h2>
              <span className="text-xs font-medium text-slate-500">
                Sorted by schedule time
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <div className="p-8 text-center text-slate-400 text-sm">Loading events...</div>
              ) : filteredEvents.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  No scheduled events match the selected criteria.
                </div>
              ) : (
                filteredEvents.map(evt => {
                  const assignee = assistants.find(a => a.id === evt.assigneeId);
                  const style = getEventTypeStyles(evt.eventType);
                  const statusBadge = getStatusBadge(evt.status);

                  return (
                    <div
                      key={evt.id}
                      className="p-4 sm:p-5 hover:bg-slate-50/70 dark:hover:bg-slate-800/60 transition-colors flex flex-col md:flex-row gap-4 items-start md:items-center justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap mb-1">
                          <h3 
                            onClick={() => setSelectedEvent(evt)}
                            className="text-sm sm:text-base font-bold text-slate-900 dark:text-white hover:text-blue-600 cursor-pointer transition-colors"
                          >
                            {evt.title}
                          </h3>
                          <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full border ${style.badge}`}>
                            {evt.eventType}
                          </span>
                          <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full border ${statusBadge.badge}`}>
                            {statusBadge.label}
                          </span>
                        </div>

                        {/* Description */}
                        {evt.description && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {evt.description.length > 90 ? (
                              <>
                                {expandedEvents[evt.id] ? (
                                  <p className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-2.5 text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap mt-1">
                                    {evt.description}
                                  </p>
                                ) : (
                                  <p className="line-clamp-1">{evt.description}</p>
                                )}
                                <button
                                  onClick={() => toggleExpand(evt.id)}
                                  className="inline-flex items-center text-blue-600 dark:text-blue-400 font-bold mt-1 text-[11px] hover:underline"
                                >
                                  {expandedEvents[evt.id] ? (
                                    <><ChevronUp className="w-3 h-3 mr-1" /> Show less</>
                                  ) : (
                                    <><ChevronDown className="w-3 h-3 mr-1" /> View full details</>
                                  )}
                                </button>
                              </>
                            ) : (
                              <p>{evt.description}</p>
                            )}
                          </div>
                        )}

                        {/* Event Metadata Pills */}
                        <div className="flex flex-wrap items-center gap-2.5 mt-2.5 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {evt.startTime.replace("T", " ")} → {evt.endTime.replace("T", " ")}
                          </span>
                          {evt.dueDate && (
                            <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900">
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                              Due: {evt.dueDate.replace("T", " ")}
                            </span>
                          )}
                          <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {evt.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <UserIcon className="w-3 h-3 text-slate-400" />
                            Assignee: <strong className="text-slate-700 dark:text-slate-300">{assignee?.displayName || assignee?.username || assignee?.email || 'Unassigned'}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                        <button
                          onClick={() => setSelectedEvent(evt)}
                          className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" /> Details
                        </button>
                        <button
                          onClick={() => toggleStatus(evt.id, evt.status)}
                          disabled={userRole === 'it_assistant' && isAdminAddedData(evt)}
                          className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Cycle Status
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => openEditModal(evt)}
                            className="p-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg text-xs transition-colors"
                            title="Edit Event"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDelete && userRole !== 'it_assistant' && (
                          <button
                            onClick={() => deleteEvent(evt.id)}
                            className="p-1.5 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-600 rounded-lg text-xs transition-colors"
                            title="Delete Event"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* EVENT DETAILS MODAL */}
      {/* ======================================================== */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-lg border border-slate-200 dark:border-slate-700 shadow-2xl space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full border ${getEventTypeStyles(selectedEvent.eventType).badge}`}>
                    {selectedEvent.eventType}
                  </span>
                  <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full border ${getStatusBadge(selectedEvent.status).badge}`}>
                    {getStatusBadge(selectedEvent.status).label}
                  </span>
                </div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  {selectedEvent.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Event Info Grid */}
            <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-4 border border-slate-200/80 dark:border-slate-700 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-500" /> Start Time:
                </span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">
                  {selectedEvent.startTime.replace("T", " ")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-500" /> End Time:
                </span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">
                  {selectedEvent.endTime.replace("T", " ")}
                </span>
              </div>
              {selectedEvent.dueDate && (
                <div className="flex items-center justify-between text-amber-700 dark:text-amber-400">
                  <span className="font-medium flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Target Due Date:
                  </span>
                  <span className="font-bold font-mono">
                    {selectedEvent.dueDate.replace("T", " ")}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" /> Location / Branch:
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {selectedEvent.location}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" /> Assigned Specialist:
                </span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {assistants.find(a => a.id === selectedEvent.assigneeId)?.displayName ||
                   assistants.find(a => a.id === selectedEvent.assigneeId)?.username ||
                   assistants.find(a => a.id === selectedEvent.assigneeId)?.email || 'Unassigned'}
                </span>
              </div>
            </div>

            {/* Description */}
            {selectedEvent.description && (
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Task Scope / Notes
                </h4>
                <p className="text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 leading-relaxed whitespace-pre-wrap">
                  {selectedEvent.description}
                </p>
              </div>
            )}

            {/* Footer Action Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                {canDelete && userRole !== 'it_assistant' && (
                  <button
                    onClick={() => deleteEvent(selectedEvent.id)}
                    className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                )}
                {canEdit && (
                  <button
                    onClick={() => openEditModal(selectedEvent)}
                    className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleStatus(selectedEvent.id, selectedEvent.status)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                >
                  Advance Status ({selectedEvent.status === 'scheduled' ? 'Start' : selectedEvent.status === 'in_progress' ? 'Resolve' : 'Re-open'})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* CREATE / EDIT EVENT MODAL */}
      {/* ======================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-lg border border-slate-200 dark:border-slate-700 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700 mb-5">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                {editingEvent ? "Edit Scheduled Event" : "Create Calendar Event"}
              </h2>
              <button
                onClick={() => { setShowCreateModal(false); setEditingEvent(null); }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Event Title *
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Core Switch Firmware Upgrade"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Event Type
                  </label>
                  <select
                    value={formData.eventType}
                    onChange={e => setFormData({ ...formData, eventType: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                  >
                    <option value="standard">Standard Support Task</option>
                    <option value="maintenance">Monthly / Routine Maintenance</option>
                    <option value="urgent">Urgent Escalation</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Description / Task Scope
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed breakdown of tasks, equipment serial numbers, or contact notes..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Start Time *
                  </label>
                  <input
                    required
                    type="datetime-local"
                    value={formData.startTime}
                    onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    End Time *
                  </label>
                  <input
                    required
                    type="datetime-local"
                    value={formData.endTime}
                    onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Due Date
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.dueDate}
                    onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Location / Branch *
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g., HQ Server Room / Branch B"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Assignee *
                  </label>
                  <select
                    required
                    value={formData.assigneeId}
                    onChange={e => setFormData({ ...formData, assigneeId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                  >
                    <option value="">Select IT Specialist</option>
                    {assistants.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.displayName || a.username || a.email} ({a.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  {editingEvent ? "Update Event" : "Save to Calendar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
