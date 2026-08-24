import React, { useEffect, useState, useMemo } from "react";
import { collection, query, getDocs, addDoc, updateDoc, doc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { 
  FolderKanban, Plus, Search, CheckCircle2, Clock, AlertTriangle, 
  FileText, Wrench, Globe, BookOpen, GraduationCap, X, Trash2, Edit3, 
  UserCheck, Calendar, DollarSign, ExternalLink, ShieldCheck, Upload, GripVertical, Download, Copy, Bell, BellOff
} from "lucide-react";
import { format } from "date-fns";
import { SchoolProject, BugTask, User, UserPermissions, OperationType, ProjectTemplate } from "../types";
import { SyncStatusBadge } from "../components/SyncStatusBadge";
import { SpiderVerseDiagram } from "../components/SpiderVerseDiagram";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable Checklist Item Component
function SortableChecklistItem({ step, onToggle }: { step: any, onToggle: () => void, key?: React.Key }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: step.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs">
      <div className="flex items-center gap-3 flex-1">
        <div {...attributes} {...listeners} className="cursor-grab text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
          <GripVertical className="w-4 h-4" />
        </div>
        <button
          onClick={onToggle}
          className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${step.completed ? 'bg-emerald-500 text-white' : 'border border-slate-300 dark:border-slate-600 hover:border-emerald-500'}`}
        >
          {step.completed && <CheckCircle2 className="w-3.5 h-3.5" />}
        </button>
        <span className={step.completed ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white font-medium'}>
          {step.title}
        </span>
      </div>
      <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${step.completed ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
        {step.completed ? 'Finished' : 'Remaining'}
      </span>
    </div>
  );
}

interface ClientProjectsProps {
  userRole?: string;
  userPermissions?: UserPermissions;
}

export default function ClientProjects({ userRole = 'staff', userPermissions }: ClientProjectsProps) {
  const canEdit = userRole === 'admin' || (userPermissions?.projects?.edit ?? (userRole !== 'management' && userRole !== 'staff'));
  const canDelete = userRole === 'admin' || (userPermissions?.projects?.delete ?? false);

  const [projects, setProjects] = useState<SchoolProject[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<SchoolProject | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    category: 'lms' as SchoolProject['category'],
    clientSchool: '',
    status: 'planning' as SchoolProject['status'],
    priority: 'medium' as SchoolProject['priority'],
    assignedDeveloper: '',
    budgetOrCost: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    targetCompletionDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    description: '',
    notificationsEnabled: true,
  });

  // Bug & Task Logging inside detail view
  const [newBugText, setNewBugText] = useState('');
  const [newStepText, setNewStepText] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  // Attachment upload simulation
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  
  // Templates
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [showSaveTemplatePrompt, setShowSaveTemplatePrompt] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | 'none'>('none');

  const [showSpiderVerse, setShowSpiderVerse] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent, projectId: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !selectedProject) return;

    const oldIndex = (selectedProject.steps || []).findIndex(s => s.id === active.id);
    const newIndex = (selectedProject.steps || []).findIndex(s => s.id === over.id);

    const newSteps = arrayMove(selectedProject.steps || [], oldIndex, newIndex);
    
    // Optimistic update
    setSelectedProject({ ...selectedProject, steps: newSteps });

    try {
      await updateDoc(doc(db, "school_projects", projectId), {
        steps: newSteps,
        activityHistory: [
          createActivityLog(`Reordered checklist step '${(newSteps[newIndex] as any).title}'`),
          ...(selectedProject.activityHistory || [])
        ],
        updatedAt: serverTimestamp(),
      });
      fetchProjects();
    } catch (err) {
      console.error("Error reordering steps:", err);
    }
  };

  const handleExportCSV = (project: SchoolProject) => {
    const headers = [
      'Project Title',
      'Client School',
      'Category',
      'Status',
      'Priority',
      'Assigned Developer',
      'Target Completion Date',
      'Checklist Progress'
    ];
    
    const stepsCompleted = (project.steps || []).filter(s => s.completed).length;
    const totalSteps = (project.steps || []).length;
    const progress = totalSteps > 0 ? `${stepsCompleted}/${totalSteps} (${Math.round((stepsCompleted / totalSteps) * 100)}%)` : '0/0 (0%)';
    
    const row = [
      project.title,
      project.clientSchool,
      project.category,
      project.status,
      project.priority,
      project.assignedDeveloper,
      project.targetCompletionDate || 'N/A',
      progress
    ].map(field => `"${(field || '').replace(/"/g, '""')}"`);

    const csvContent = headers.join(',') + '\n' + row.join(',');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${project.title.replace(/\s+/g, '_')}_details.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchProjects = async () => {
    try {
      const snap = await getDocs(query(collection(db, "school_projects")));
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolProject));
      docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setProjects(docs);
    } catch (e) {
      console.warn("Error fetching school projects:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const snap = await getDocs(query(collection(db, "users")));
      const users = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setAllUsers(users);
    } catch (e) {
      console.warn("Error fetching users:", e);
    }
  };

  const fetchTemplates = async () => {
    try {
      const snap = await getDocs(query(collection(db, "project_templates")));
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjectTemplate));
      docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setTemplates(docs);
    } catch (e) {
      console.warn("Error fetching templates:", e);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchTemplates();
    fetchUsers();
  }, []);

  const createActivityLog = (action: string) => ({
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    action,
    timestamp: format(new Date(), 'yyyy-MM-dd HH:mm'),
  });

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.clientSchool) {
      alert("Please provide a project title and client school name.");
      return;
    }

    try {
      if (editingId) {
        const project = projects.find(p => p.id === editingId);
        const docRef = doc(db, "school_projects", editingId);
        const updates: any = { ...formData, updatedAt: serverTimestamp() };
        
        if (project && project.status !== formData.status) {
           const history = project.activityHistory || [];
           updates.activityHistory = [createActivityLog(`Status changed to ${formData.status}`), ...history];
        }

        await updateDoc(docRef, updates);
      } else {
        let initialSteps = [
          { id: 's1', title: 'Requirements Gathering & Scope Approval', completed: true },
          { id: 's2', title: 'Database & System Setup', completed: false },
          { id: 's3', title: 'Core Feature & LMS/Matrix Implementation', completed: false },
          { id: 's4', title: 'Testing & Developer Bug Fixing', completed: false },
          { id: 's5', title: 'Deployment & Client School Handover', completed: false }
        ];

        if (selectedTemplateId !== 'none') {
          const template = templates.find(t => t.id === selectedTemplateId);
          if (template) {
            initialSteps = template.steps.map(s => ({ ...s, id: `s-${Date.now()}-${Math.random()}` }));
          }
        }

        await addDoc(collection(db, "school_projects"), {
          ...formData,
          bugFixLog: [],
          attachments: [],
          activityHistory: [createActivityLog('Project Created')],
          steps: initialSteps,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setShowSpiderVerse(true);
      }
      setShowModal(false);
      setEditingId(null);
      setSelectedTemplateId('none');
      setFormData({
        title: '',
        category: 'lms',
        clientSchool: '',
        status: 'planning',
        priority: 'medium',
        assignedDeveloper: '',
        budgetOrCost: '',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        targetCompletionDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        description: '',
                  notificationsEnabled: true,
      });
      fetchProjects();
    } catch (err) {
      console.error("Error saving project:", err);
      alert("Failed to save project. Check console for permissions.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!canDelete) {
      alert("You do not have permission to delete projects.");
      return;
    }
    if (confirm("Are you sure you want to delete this project?")) {
      try {
        await deleteDoc(doc(db, "school_projects", id));
        fetchProjects();
        if (selectedProject?.id === id) setSelectedProject(null);
      } catch (err) {
        console.error("Error deleting project:", err);
      }
    }
  };

  const handleAddBug = async (projectId: string) => {
    if (!newBugText.trim()) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const newBug: BugTask = {
      id: `bug-${Date.now()}`,
      bugDescription: newBugText.trim(),
      status: 'open',
      reportedBy: auth.currentUser?.email || 'Admin',
      date: format(new Date(), 'yyyy-MM-dd HH:mm'),
    };

    const updatedBugs = [...(project.bugFixLog || []), newBug];
    try {
      await updateDoc(doc(db, "school_projects", projectId), {
        bugFixLog: updatedBugs,
        updatedAt: serverTimestamp(),
      });
      setNewBugText('');
      fetchProjects();
      if (selectedProject) {
        setSelectedProject({ ...selectedProject, bugFixLog: updatedBugs });
      }
    } catch (err) {
      console.error("Error adding bug fix task:", err);
    }
  };

  const handleToggleNotifications = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const newState = !project.notificationsEnabled;
    try {
      await updateDoc(doc(db, "school_projects", projectId), {
        notificationsEnabled: newState,
        updatedAt: serverTimestamp(),
      });
      fetchProjects();
      if (selectedProject?.id === projectId) {
        setSelectedProject({ ...selectedProject, notificationsEnabled: newState });
      }
    } catch (err) {
      console.error("Error toggling notifications:", err);
    }
  };

  const handleToggleBugStatus = async (projectId: string, bugId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const updatedBugs = (project.bugFixLog || []).map(b => 
      b.id === bugId ? { ...b, status: (b.status === 'open' ? 'fixed' : 'open') as BugTask['status'] } : b
    );

    try {
      await updateDoc(doc(db, "school_projects", projectId), {
        bugFixLog: updatedBugs,
        updatedAt: serverTimestamp(),
      });
      fetchProjects();
      if (selectedProject) {
        setSelectedProject({ ...selectedProject, bugFixLog: updatedBugs });
      }
    } catch (err) {
      console.error("Error updating bug status:", err);
    }
  };

  const handleToggleStep = async (projectId: string, stepId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const step = (project.steps || []).find(s => s.id === stepId);
    if (!step) return;

    const newCompletedState = !step.completed;
    const updatedSteps = (project.steps || []).map(s => 
      s.id === stepId ? { ...s, completed: newCompletedState } : s
    );

    const updatedHistory = [
      createActivityLog(`Checklist step '${step.title}' ${newCompletedState ? 'completed' : 'uncompleted'}`),
      ...(project.activityHistory || [])
    ];

    try {
      await updateDoc(doc(db, "school_projects", projectId), {
        steps: updatedSteps,
        activityHistory: updatedHistory,
        updatedAt: serverTimestamp(),
      });
      fetchProjects();
      if (selectedProject) {
        setSelectedProject({ ...selectedProject, steps: updatedSteps, activityHistory: updatedHistory });
      }
    } catch (err) {
      console.error("Error updating step status:", err);
    }
  };

  const handleSaveTemplate = async () => {
    if (!selectedProject || !newTemplateName.trim()) return;
    try {
      const templateData = {
        name: newTemplateName.trim(),
        steps: (selectedProject.steps || []).map(s => ({ ...s, completed: false })),
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, "project_templates"), templateData);
      setShowSaveTemplatePrompt(false);
      setNewTemplateName('');
      fetchTemplates();
    } catch (err) {
      console.error("Error saving template:", err);
    }
  };

  const handleAddStep = async (projectId: string) => {
    if (!newStepText.trim()) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const newStep = {
      id: `step-${Date.now()}`,
      title: newStepText.trim(),
      completed: false,
    };

    const updatedSteps = [...(project.steps || []), newStep];
    const updatedHistory = [
      createActivityLog(`Added checklist step: '${newStep.title}'`),
      ...(project.activityHistory || [])
    ];
    try {
      await updateDoc(doc(db, "school_projects", projectId), {
        steps: updatedSteps,
        activityHistory: updatedHistory,
        updatedAt: serverTimestamp(),
      });
      setNewStepText('');
      fetchProjects();
      if (selectedProject) {
        setSelectedProject({ ...selectedProject, steps: updatedSteps, activityHistory: updatedHistory });
      }
    } catch (err) {
      console.error("Error adding step:", err);
    }
  };

  const handleAddNote = async (projectId: string) => {
    if (!newNoteText.trim()) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const newNote = {
      id: `note-${Date.now()}`,
      note: newNoteText.trim(),
      author: auth.currentUser?.email || 'Admin',
      date: format(new Date(), 'yyyy-MM-dd HH:mm'),
    };

    const updatedNotes = [...(project.projectNotes || []), newNote];
    const updatedHistory = [
      createActivityLog('Added a new project note'),
      ...(project.activityHistory || [])
    ];
    try {
      await updateDoc(doc(db, "school_projects", projectId), {
        projectNotes: updatedNotes,
        activityHistory: updatedHistory,
        updatedAt: serverTimestamp(),
      });
      setNewNoteText('');
      fetchProjects();
      if (selectedProject) {
        setSelectedProject({ ...selectedProject, projectNotes: updatedNotes, activityHistory: updatedHistory });
      }
    } catch (err) {
      console.error("Error adding project note:", err);
    }
  };

  const handleAddAttachment = async (projectId: string) => {
    if (!attachmentName.trim()) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const newAtt = {
      name: attachmentName.trim(),
      url: attachmentUrl.trim() || '#',
      uploadedAt: format(new Date(), 'yyyy-MM-dd'),
    };

    const updatedAtts = [...(project.attachments || []), newAtt];
    try {
      await updateDoc(doc(db, "school_projects", projectId), {
        attachments: updatedAtts,
        updatedAt: serverTimestamp(),
      });
      setAttachmentName('');
      setAttachmentUrl('');
      fetchProjects();
      if (selectedProject) {
        setSelectedProject({ ...selectedProject, attachments: updatedAtts });
      }
    } catch (err) {
      console.error("Error adding attachment:", err);
    }
  };

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchQuery = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.clientSchool.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.assignedDeveloper.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchQuery && matchCat && matchStatus;
    });
  }, [projects, searchQuery, categoryFilter, statusFilter]);

  const getCategoryIcon = (cat: string) => {
    switch(cat) {
      case 'lms': return <GraduationCap className="w-4 h-4 text-blue-500" />;
      case 'library': return <BookOpen className="w-4 h-4 text-purple-500" />;
      case 'website': return <Globe className="w-4 h-4 text-emerald-500" />;
      case 'bugfix': return <Wrench className="w-4 h-4 text-amber-500" />;
      default: return <FolderKanban className="w-4 h-4 text-indigo-500" />;
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch(cat) {
      case 'lms': return 'LMS Support & Data';
      case 'library': return 'Library Matrix System';
      case 'website': return 'Website Creation';
      case 'bugfix': return 'Bug Fixing & Sprint';
      case 'custom_it': return 'Custom IT Solutions';
      default: return cat || 'Custom IT Project';
    }
  };

  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>(['lms', 'library', 'website', 'bugfix', 'custom_it']);
    projects.forEach(p => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [projects]);

  const getStatusBadge = (status: SchoolProject['status']) => {
    switch(status) {
      case 'planning':
        return <span className="px-2.5 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-semibold rounded-full flex items-center gap-1.5"><Clock className="w-3 h-3" /> Planning</span>;
      case 'development':
        return <span className="px-2.5 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs font-semibold rounded-full flex items-center gap-1.5"><Wrench className="w-3 h-3" /> In Development</span>;
      case 'testing':
        return <span className="px-2.5 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-xs font-semibold rounded-full flex items-center gap-1.5"><AlertTriangle className="w-3 h-3" /> Testing & QA</span>;
      case 'deployed':
        return <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold rounded-full flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" /> Deployed (Live)</span>;
      case 'maintenance':
        return <span className="px-2.5 py-1 bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20 text-xs font-semibold rounded-full flex items-center gap-1.5"><ShieldCheck className="w-3 h-3" /> Maintenance</span>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-600/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
              <FolderKanban className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">School IT Solutions & Standalone Projects</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Track LMS support, library matrix systems, school website builds, and developer bug fixes</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <SyncStatusBadge />
          {canEdit && (
            <button
              onClick={() => {
                setEditingId(null);
                setFormData({
                  title: '',
                  category: 'lms',
                  clientSchool: '',
                  status: 'planning',
                  priority: 'medium',
                  assignedDeveloper: '',
                  budgetOrCost: '',
                  startDate: format(new Date(), 'yyyy-MM-dd'),
                  targetCompletionDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
                  description: '',
                  notificationsEnabled: true,
                });
                setShowModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Project</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search projects, school client, developer, code..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="md:w-48 shrink-0">
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option className="bg-white dark:bg-slate-800" value="all">All Categories</option>
            {uniqueCategories.map(cat => (
              <option key={cat} className="bg-white dark:bg-slate-800" value={cat}>{getCategoryLabel(cat)}</option>
            ))}
          </select>
        </div>

        <div className="md:w-48 shrink-0">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option className="bg-white dark:bg-slate-800" value="all">All Statuses</option>
            <option className="bg-white dark:bg-slate-800" value="planning">Planning</option>
            <option className="bg-white dark:bg-slate-800" value="development">Development</option>
            <option className="bg-white dark:bg-slate-800" value="testing">Testing & QA</option>
            <option className="bg-white dark:bg-slate-800" value="deployed">Deployed (Live)</option>
            <option className="bg-white dark:bg-slate-800" value="maintenance">Maintenance</option>
          </select>
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">Loading school projects...</div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8">
          <FolderKanban className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">No projects found</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Get started by adding an LMS support, school website, or library matrix project.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map(project => {
            const bugCount = project.bugFixLog?.length || 0;
            const openBugs = project.bugFixLog?.filter(b => b.status === 'open').length || 0;
            const attCount = project.attachments?.length || 0;

            const isDeadlineApproaching = project.targetCompletionDate && (new Date(project.targetCompletionDate).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000) && (new Date(project.targetCompletionDate).getTime() > Date.now());
            const hasRecentActivity = project.activityHistory && project.activityHistory.length > 0 && (Date.now() - new Date(project.activityHistory[0].timestamp).getTime() < 24 * 60 * 60 * 1000);
            const isAlerting = project.notificationsEnabled && (isDeadlineApproaching || hasRecentActivity);

            return (
              <div 
                key={project.id}
                onClick={() => setSelectedProject(project)}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group relative"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    {getStatusBadge(project.status)}
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleToggleNotifications(project.id); }}
                      className={`p-1.5 rounded-full transition-colors relative ${project.notificationsEnabled ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' : 'text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-50 dark:bg-slate-800'}`}
                      title={project.notificationsEnabled ? "Notifications On" : "Notifications Off"}
                    >
                      {project.notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                      {isAlerting && (
                        <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full animate-pulse ring-2 ring-white dark:ring-slate-900"></span>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mb-1.5">
                    {getCategoryIcon(project.category)}
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {getCategoryLabel(project.category)}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors line-clamp-1">
                    {project.title}
                  </h3>

                  <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-semibold">
                    <span>🏫 {project.clientSchool}</span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 line-clamp-2">
                    {project.description || "No description provided."}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1" title="Assigned Developer">
                      <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate max-w-[100px]">{project.assignedDeveloper || "Unassigned"}</span>
                    </span>
                    {bugCount > 0 && (
                      <span className={`px-2 py-0.5 rounded-md font-medium flex items-center gap-1 ${openBugs > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                        🐛 {openBugs} open bugs
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {attCount > 0 && (
                      <span className="flex items-center gap-1 text-slate-400">
                        <FileText className="w-3.5 h-3.5" />
                        {attCount}
                      </span>
                    )}
                    {canEdit && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(project.id);
                          setFormData({
                            title: project.title,
                            category: project.category,
                            clientSchool: project.clientSchool,
                            status: project.status,
                            priority: project.priority,
                            assignedDeveloper: project.assignedDeveloper,
                            budgetOrCost: project.budgetOrCost || '',
                            startDate: project.startDate,
                            targetCompletionDate: project.targetCompletionDate,
                            description: project.description,
                            notificationsEnabled: project.notificationsEnabled ?? true,
                          });
                          setShowModal(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                        title="Edit Project"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Project Detail / Bug Tracking Modal */}
      {selectedProject && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">{selectedProject.title}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Client School: <span className="font-semibold text-blue-600">{selectedProject.clientSchool}</span></p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleNotifications(selectedProject.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${selectedProject.notificationsEnabled ? 'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-900/60' : 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                  title={selectedProject.notificationsEnabled ? "Notifications On" : "Enable Notifications"}
                >
                  {selectedProject.notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => handleExportCSV(selectedProject)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  title="Export to CSV"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
                <button 
                  onClick={() => setSelectedProject(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <span className="text-slate-500 block">Category</span>
                <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">{getCategoryLabel(selectedProject.category)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Status</span>
                <div className="mt-1">{getStatusBadge(selectedProject.status)}</div>
              </div>
              <div>
                <span className="text-slate-500 block">Assigned Developer</span>
                <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">{selectedProject.assignedDeveloper || "Unassigned"}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Target Completion</span>
                <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">{selectedProject.targetCompletionDate || "N/A"}</span>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Description & Scope</h4>
              <p className="text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 leading-relaxed">
                {selectedProject.description || "No description provided."}
              </p>
            </div>

            {/* Steps & Milestones Tracker */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Project Step & Milestone Tracker (Finished vs Remaining)
                </h4>
                {(() => {
                  const steps = selectedProject.steps || [];
                  const finished = steps.filter(s => s.completed).length;
                  const total = steps.length;
                  const pct = total > 0 ? Math.round((finished / total) * 100) : 0;
                  return (
                    <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full">
                      {finished}/{total} Finished ({pct}%)
                    </span>
                  );
                })()}
              </div>

              <div className="space-y-2">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(e) => handleDragEnd(e, selectedProject.id)}
                >
                  <SortableContext
                    items={(selectedProject.steps || []).map(s => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {(selectedProject.steps || []).map(step => (
                      <SortableChecklistItem
                        key={step.id}
                        step={step}
                        onToggle={() => handleToggleStep(selectedProject.id, step.id)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>

              {canEdit && (
                <div className="flex flex-col gap-2 pt-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add custom milestone or task step..."
                      value={newStepText}
                      onChange={e => setNewStepText(e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                    />
                    <button
                      onClick={() => handleAddStep(selectedProject.id)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      Add Step
                    </button>
                  </div>
                  <div className="flex justify-end mt-1">
                    {!showSaveTemplatePrompt ? (
                      <button
                        onClick={() => setShowSaveTemplatePrompt(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        Save as Template
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 w-full max-w-sm ml-auto">
                        <input
                          type="text"
                          placeholder="Template Name..."
                          value={newTemplateName}
                          onChange={e => setNewTemplateName(e.target.value)}
                          className="flex-1 px-2 py-1.5 text-[10px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                          autoFocus
                        />
                        <button
                          onClick={handleSaveTemplate}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-semibold cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setShowSaveTemplatePrompt(false);
                            setNewTemplateName('');
                          }}
                          className="px-2 py-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Developer Bug & Task Tracking */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-500" />
                  Developer Bug Fixing & Task Log
                </h4>
                <span className="text-xs text-slate-500">{(selectedProject.bugFixLog || []).length} items</span>
              </div>

              <div className="space-y-2">
                {(selectedProject.bugFixLog || []).map(bug => (
                  <div key={bug.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggleBugStatus(selectedProject.id, bug.id)}
                        className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${bug.status === 'fixed' ? 'bg-emerald-500 text-white' : 'border border-slate-300 dark:border-slate-600 hover:border-emerald-500'}`}
                      >
                        {bug.status === 'fixed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </button>
                      <span className={bug.status === 'fixed' ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white font-medium'}>
                        {bug.bugDescription}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-400">
                      <span>{bug.reportedBy}</span>
                      <span>{bug.date}</span>
                    </div>
                  </div>
                ))}
              </div>

              {canEdit && (
                <div className="flex gap-2 pt-2">
                  <input
                    type="text"
                    placeholder="Add bug fix task or feature request note..."
                    value={newBugText}
                    onChange={e => setNewBugText(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                  <button
                    onClick={() => handleAddBug(selectedProject.id)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Add Task
                  </button>
                </div>
              )}
            </div>

            {/* Attachments / Data Uploads */}
            <div className="space-y-3 pt-2">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-500" />
                Uploaded Project Specs & Documents
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(selectedProject.attachments || []).map((att, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="font-medium text-slate-900 dark:text-white truncate">{att.name}</span>
                    </div>
                    <span className="text-slate-400 shrink-0">{att.uploadedAt}</span>
                  </div>
                ))}
              </div>

              {canEdit && (
                <div className="flex gap-2 pt-2">
                  <input
                    type="text"
                    placeholder="Document or LMS data file name..."
                    value={attachmentName}
                    onChange={e => setAttachmentName(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                  <button
                    onClick={() => handleAddAttachment(selectedProject.id)}
                    className="px-4 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Attach File
                  </button>
                </div>
              )}
            </div>

            {/* Project Notes & Meeting Logs */}
            <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  Project Notes & Meeting Updates
                </h4>
                <span className="text-xs text-slate-500">{(selectedProject.projectNotes || []).length} notes</span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(selectedProject.projectNotes || []).map((noteItem) => (
                  <div key={noteItem.id} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs space-y-1">
                    <p className="text-slate-900 dark:text-white whitespace-pre-wrap leading-relaxed">{noteItem.note}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-200/50 dark:border-slate-800">
                      <span>By: {noteItem.author}</span>
                      <span>{noteItem.date}</span>
                    </div>
                  </div>
                ))}
                {(!selectedProject.projectNotes || selectedProject.projectNotes.length === 0) && (
                  <p className="text-xs text-slate-400 italic py-2">No dated meeting logs or project notes recorded yet.</p>
                )}
              </div>

              {canEdit && (
                <div className="space-y-2 pt-2">
                  <textarea
                    rows={2}
                    placeholder="Add dated text entry for meeting notes or significant updates..."
                    value={newNoteText}
                    onChange={e => setNewNoteText(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white resize-none"
                  />
                  <button
                    onClick={() => handleAddNote(selectedProject.id)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Add Project Note
                  </button>
                </div>
              )}
            </div>

            {/* Activity History Logs */}
            <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-500" />
                  Activity History
                </h4>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pl-2 border-l-2 border-slate-100 dark:border-slate-800">
                {(selectedProject.activityHistory || []).map((log) => (
                  <div key={log.id} className="relative flex items-start gap-3 text-xs p-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-lg">
                    <div className="absolute -left-[9px] top-4 w-4 h-4 bg-white dark:bg-slate-900 border-2 border-emerald-500 rounded-full"></div>
                    <div className="ml-2">
                      <p className="font-medium text-slate-900 dark:text-white">{log.action}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{log.timestamp}</p>
                    </div>
                  </div>
                ))}
                {(!selectedProject.activityHistory || selectedProject.activityHistory.length === 0) && (
                  <p className="text-xs text-slate-400 italic py-2 ml-2">No activity history recorded yet.</p>
                )}
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
              {canDelete && (
                <button
                  onClick={() => handleDelete(selectedProject.id)}
                  className="px-4 py-2 bg-red-500/10 text-red-600 hover:bg-red-500/20 rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Project
                </button>
              )}
              <button
                onClick={() => setSelectedProject(null)}
                className="px-5 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingId ? 'Edit School IT Project' : 'Add Standalone Project / School Solution'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Client School Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Yangon International School"
                    value={formData.clientSchool}
                    onChange={e => setFormData({ ...formData, clientSchool: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Project Title / Solution Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LMS Support & Cloud Data Migration / Library Matrix System"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              {!editingId && (
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1 flex items-center gap-2">
                    <Copy className="w-3.5 h-3.5 text-blue-500" />
                    Project Checklist Template (Optional)
                  </label>
                  <select
                    value={selectedTemplateId}
                    onChange={e => setSelectedTemplateId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white appearance-none"
                  >
                    <option className="bg-white dark:bg-slate-800" value="none">Use default steps</option>
                    {templates.map(t => (
                      <option className="bg-white dark:bg-slate-800" key={t.id} value={t.id}>{t.name} ({t.steps.length} steps)</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Category / Type</label>
                  <input
                    type="text"
                    required
                    list="category-options"
                    placeholder="e.g. LMS Support, Library Matrix, Network Infrastructure"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                  <datalist id="category-options">
                    {uniqueCategories.map(cat => (
                      <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Project Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as SchoolProject['status'] })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    <option className="bg-white dark:bg-slate-800" value="planning">Planning</option>
                    <option className="bg-white dark:bg-slate-800" value="development">In Development</option>
                    <option className="bg-white dark:bg-slate-800" value="testing">Testing & QA</option>
                    <option className="bg-white dark:bg-slate-800" value="deployed">Deployed (Live)</option>
                    <option className="bg-white dark:bg-slate-800" value="maintenance">Maintenance</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Assigned Developer</label>
                  <select
                    value={formData.assignedDeveloper}
                    onChange={e => setFormData({ ...formData, assignedDeveloper: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    <option className="bg-white dark:bg-slate-800" value="">-- Select Developer / IT Staff --</option>
                    {allUsers.map(u => (
                      <option className="bg-white dark:bg-slate-800" key={u.id} value={u.displayName || u.username || u.email}>
                        {u.displayName || u.username || u.email} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value as SchoolProject['priority'] })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    <option className="bg-white dark:bg-slate-800" value="low">Low</option>
                    <option className="bg-white dark:bg-slate-800" value="medium">Medium</option>
                    <option className="bg-white dark:bg-slate-800" value="high">High</option>
                    <option className="bg-white dark:bg-slate-800" value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Target Completion Date</label>
                  <input
                    type="date"
                    value={formData.targetCompletionDate}
                    onChange={e => setFormData({ ...formData, targetCompletionDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Project Scope & Specifications</label>
                <textarea
                  rows={3}
                  placeholder="Describe requirements, LMS data upload specs, bug fixes, or library matrix system features..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="notificationsToggle"
                  checked={formData.notificationsEnabled}
                  onChange={e => setFormData({ ...formData, notificationsEnabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-slate-800 dark:bg-slate-700 dark:border-slate-600 cursor-pointer"
                />
                <label htmlFor="notificationsToggle" className="text-slate-700 dark:text-slate-300 font-medium cursor-pointer flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-slate-400" />
                  Enable Alert Notifications
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold cursor-pointer shadow-sm"
                >
                  {editingId ? 'Update Project' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <SpiderVerseDiagram show={showSpiderVerse} onComplete={() => setShowSpiderVerse(false)} />
    </div>
  );
}
