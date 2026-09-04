import React, { useState, useEffect, useMemo } from 'react';
import { ITProject, ProjectTemplate, TaskStatus } from './types';
import { 
  DEFAULT_TEMPLATES, 
  generateProjectFromTemplate
} from './templates';
import { calculateProjectMetrics, STATUS_CONFIG } from './utils';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  getDocs 
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { format, differenceInDays } from 'date-fns';
import { 
  Briefcase, 
  Plus, 
  Search, 
  X, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  TrendingUp, 
  ArrowUpDown, 
  Clock, 
  Layers, 
  Kanban, 
  AlertCircle, 
  FileCode, 
  ArrowRight,
  Filter,
  Grid,
  List,
  Sparkles,
  Trash2,
  Loader2
} from 'lucide-react';

import { KanbanBoardView } from './components/KanbanBoardView';
import { CalendarScheduleView } from './components/CalendarScheduleView';
import { BlockedIssuesManager } from './components/BlockedIssuesManager';
import { ProjectTemplateBuilder } from './components/ProjectTemplateBuilder';

interface PortfolioViewProps {
  onSelectProject: (project: ITProject) => void;
  userRole?: string;
  userPermissions?: any;
}

type MainViewTab = 'dashboard' | 'projects' | 'kanban' | 'calendar' | 'blocked' | 'templates';

export default function PortfolioView({ onSelectProject, userRole, userPermissions }: PortfolioViewProps) {
  const [activeTab, setActiveTab] = useState<MainViewTab>('dashboard');
  const [projects, setProjects] = useState<ITProject[]>([]);
  const [templates, setTemplates] = useState<ProjectTemplate[]>(DEFAULT_TEMPLATES);
  const [loading, setLoading] = useState(true);

  // Deletion permissions & state
  const canDelete = userRole === 'admin' || (userPermissions ? !!userPermissions?.projects?.delete : true);
  const canEdit = userRole === 'admin' || (userPermissions ? !!userPermissions?.projects?.edit : true);
  const [projectToDelete, setProjectToDelete] = useState<ITProject | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  // Filters & Sorting for Projects tab
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [sortBy, setSortBy] = useState<'dueDate' | 'progress' | 'priority'>('dueDate');

  // Modal State for New Project
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(DEFAULT_TEMPLATES[0].id);
  const [newProjectName, setNewProjectName] = useState('');
  const [newClient, setNewClient] = useState('');
  const [newOwner, setNewOwner] = useState('Saw Pyae Phyo Kyaw');
  const [newStartDate, setNewStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTargetDate, setNewTargetDate] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [newNextAction, setNewNextAction] = useState('');

  // 1. Fetch & Subscribe to Projects from Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'it_projects'), async (snapshot) => {
      if (!snapshot.empty) {
        const loadedProjects: ITProject[] = snapshot.docs.map(d => {
          const data = d.data() as any;
          let projType = data.projectType;
          let needsTypeUpdate = false;

          // Normalize to updated template names
          if (projType === 'Library / Matrix Project' || projType === 'Library / Matrix' || data.templateId === 'template_library_matrix') {
            if (projType !== 'Matrix') { projType = 'Matrix'; needsTypeUpdate = true; }
          } else if (projType === 'UBook Store (Phase 1 & 2)' || projType === 'UBook Store' || data.templateId === 'template_ubook_store') {
            if (projType !== 'UbookStore') { projType = 'UbookStore'; needsTypeUpdate = true; }
          } else if (projType === 'LMS Development' || projType === 'LMS' || data.templateId === 'template_lms') {
            if (projType !== 'DIR LMS') { projType = 'DIR LMS'; needsTypeUpdate = true; }
          } else if (projType === 'Website Development' || data.templateId === 'template_website_dev') {
            if (projType !== 'Website') { projType = 'Website'; needsTypeUpdate = true; }
          }

          // Clean up any steps with 'blocked' status so no blocked item exists
          let hasBlockedStep = false;
          const cleanedPhases = (data.phases || []).map((phase: any) => ({
            ...phase,
            steps: (phase.steps || []).map((step: any) => {
              if (step.status === 'blocked') {
                hasBlockedStep = true;
                return {
                  ...step,
                  status: 'on_hold' as const,
                  blockedReason: step.blockedReason || 'Task on hold'
                };
              }
              return step;
            })
          }));

          if (needsTypeUpdate || hasBlockedStep) {
            const updatePayload: any = {};
            if (needsTypeUpdate) updatePayload.projectType = projType;
            if (hasBlockedStep) updatePayload.phases = cleanedPhases;
            updateDoc(doc(db, 'it_projects', d.id), updatePayload).catch(() => {});
          }

          const tempProj = { ...data, id: d.id, projectType: projType, phases: cleanedPhases };
          const metrics = calculateProjectMetrics(tempProj);
          return {
            ...tempProj,
            progressPercent: metrics.progressPercent,
            health: metrics.health
          };
        });
        setProjects(loadedProjects);
      } else {
        setProjects([]);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error loading projects:', error);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // 2. Fetch Templates from Firestore or fallback to DEFAULT_TEMPLATES
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const tSnap = await getDocs(collection(db, 'it_project_templates'));
        if (!tSnap.empty) {
          const loadedTpls: ProjectTemplate[] = tSnap.docs.map(d => ({ ...d.data(), id: d.id } as ProjectTemplate));
          
          const oldDefaultNames: Record<string, string> = {
            'template_library_matrix': 'Matrix',
            'template_ubook_store': 'UbookStore',
            'template_lms': 'DIR LMS',
            'template_website_dev': 'Website'
          };

          // Merge with defaults ensuring updated template names
          const merged = DEFAULT_TEMPLATES.map(dt => {
            const remote = loadedTpls.find(lt => lt.id === dt.id);
            if (remote) {
              const expectedName = oldDefaultNames[dt.id] || dt.name;
              if (remote.name !== expectedName && (
                remote.name === 'Library / Matrix Project' ||
                remote.name === 'Library / Matrix' ||
                remote.name === 'UBook Store (Phase 1 & 2)' ||
                remote.name === 'UBook Store' ||
                remote.name === 'LMS Development' ||
                remote.name === 'Website Development'
              )) {
                updateDoc(doc(db, 'it_project_templates', remote.id), { name: expectedName }).catch(() => {});
                return { ...remote, name: expectedName };
              }
              return remote;
            }
            return dt;
          });

          // Add custom user templates
          loadedTpls.forEach(lt => {
            if (!merged.some(m => m.id === lt.id)) {
              merged.push(lt);
            }
          });
          setTemplates(merged);
        } else {
          setTemplates(DEFAULT_TEMPLATES);
        }
      } catch {
        // Fallback to DEFAULT_TEMPLATES
        setTemplates(DEFAULT_TEMPLATES);
      }
    };
    fetchTemplates();
  }, []);

  // Save template (custom or edited)
  const handleSaveTemplate = async (tpl: ProjectTemplate) => {
    try {
      await updateDoc(doc(db, 'it_project_templates', tpl.id), {
        ...tpl,
        updatedAt: serverTimestamp()
      }).catch(async () => {
        // If doesn't exist, create it
        await addDoc(collection(db, 'it_project_templates'), {
          ...tpl,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });

      setTemplates(prev => {
        const idx = prev.findIndex(t => t.id === tpl.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = tpl;
          return updated;
        }
        return [...prev, tpl];
      });
    } catch (err) {
      console.error('Error saving template:', err);
    }
  };

  // Create Project handler
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    const chosenTemplate = templates.find(t => t.id === selectedTemplateId) || DEFAULT_TEMPLATES[0];

    const projectData = generateProjectFromTemplate(chosenTemplate, {
      name: newProjectName.trim(),
      client: newClient.trim() || 'Internal IT',
      projectOwner: newOwner.trim() || 'Saw Pyae Phyo Kyaw',
      startDate: newStartDate,
      targetDate: newTargetDate || undefined,
      priority: newPriority,
      nextAction: newNextAction.trim() || undefined
    });

    try {
      const docRef = await addDoc(collection(db, 'it_projects'), {
        ...projectData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setShowNewModal(false);
      // Reset form
      setNewProjectName('');
      setNewClient('');
      setNewNextAction('');

      // Open new project
      onSelectProject({
        ...projectData,
        id: docRef.id
      } as ITProject);
    } catch (err) {
      console.error('Failed to create project:', err);
    }
  };

  // Update Project handler
  const handleUpdateProject = async (updatedProject: ITProject) => {
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
    if (!updatedProject.id) return;
    try {
      const pRef = doc(db, 'it_projects', updatedProject.id);
      const cleanData = JSON.parse(JSON.stringify({
        ...updatedProject,
        updatedAt: serverTimestamp()
      }));
      await updateDoc(pRef, cleanData);
    } catch (err) {
      console.error('Error updating project:', err);
    }
  };

  // Delete Project handler
  const handleDeleteProject = async () => {
    if (!projectToDelete?.id) return;
    if (!canDelete) {
      alert("Permission Denied: You do not have permission to delete projects.");
      return;
    }
    try {
      setIsDeletingProject(true);
      await deleteDoc(doc(db, 'it_projects', projectToDelete.id));
      setProjectToDelete(null);
    } catch (err) {
      console.error('Error deleting project in Firestore:', err);
      handleFirestoreError(err, OperationType.DELETE, `it_projects/${projectToDelete.id}`);
      alert("Failed to delete project: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsDeletingProject(false);
    }
  };

  // High-level summary metrics for Dashboard
  const summaryMetrics = useMemo(() => {
    let total = projects.length;
    let active = 0;
    let waiting = 0;
    let completed = 0;
    let overdue = 0;
    let totalBlockedItems = 0;

    const now = new Date();

    projects.forEach(p => {
      const metrics = calculateProjectMetrics(p);
      if (p.status === 'completed') {
        completed++;
      } else if (p.status === 'waiting') {
        waiting++;
        active++;
      } else {
        active++;
      }

      if (metrics.isOverdue) {
        overdue++;
      }

      totalBlockedItems += metrics.blockedItems.length;
    });

    return { total, active, waiting, completed, overdue, totalBlockedItems };
  }, [projects]);

  // Extract all On Hold/Waiting items for executive alert banner
  const portfolioBlockedItems = useMemo(() => {
    const list: Array<{
      projectId: string;
      projectName: string;
      stepTitle: string;
      status: 'blocked' | 'waiting' | 'on_hold';
      reason: string;
    }> = [];

    projects.forEach(p => {
      (p.phases || []).forEach(phase => {
        (phase.steps || []).forEach(step => {
          if (step.status === 'blocked' || step.status === 'on_hold' || step.status === 'waiting') {
            list.push({
              projectId: p.id,
              projectName: p.name,
              stepTitle: step.title,
              status: (step.status === 'blocked' ? 'on_hold' : step.status) as any,
              reason: step.blockedReason || (step.status === 'waiting' ? 'Waiting for external input' : 'Task on hold')
            });
          }
        });
      });
    });

    return list;
  }, [projects]);

  // Filtered and sorted projects list for Projects tab
  const filteredProjects = useMemo(() => {
    return projects.filter(proj => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = proj.name.toLowerCase().includes(q) || (proj.title || '').toLowerCase().includes(q);
        const matchesClient = (proj.client || proj.department || '').toLowerCase().includes(q);
        const matchesOwner = (proj.projectOwner || '').toLowerCase().includes(q);
        const matchesStep = (proj.currentStep || '').toLowerCase().includes(q);
        const matchesNext = (proj.nextAction || '').toLowerCase().includes(q);
        if (!matchesName && !matchesClient && !matchesOwner && !matchesStep && !matchesNext) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'active' && proj.status === 'completed') return false;
        if (statusFilter === 'completed' && proj.status !== 'completed') return false;
        if (statusFilter === 'waiting' && proj.status !== 'waiting') return false;
        if (statusFilter === 'overdue') {
          const metrics = calculateProjectMetrics(proj);
          if (!metrics.isOverdue) return false;
        }
      }

      // Type / Template filter
      if (typeFilter !== 'all') {
        const normFilter = typeFilter.toLowerCase();
        const projType = (proj.projectType || '').toLowerCase();
        const templateUsed = (proj.templateUsed || '').toLowerCase();
        const isMatch = projType === normFilter || 
                        templateUsed === normFilter ||
                        (normFilter === 'matrix' && (projType.includes('matrix') || templateUsed.includes('library'))) ||
                        (normFilter === 'ubookstore' && (projType.includes('ubook') || templateUsed.includes('ecommerce'))) ||
                        (normFilter === 'dir lms' && (projType.includes('lms') || templateUsed.includes('lms'))) ||
                        (normFilter === 'website' && (projType.includes('website') || templateUsed.includes('website')));
        if (!isMatch) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'priority') {
        const pOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
        return (pOrder[b.priority || 'medium'] || 0) - (pOrder[a.priority || 'medium'] || 0);
      }
      if (sortBy === 'progress') {
        return (b.progressPercent || 0) - (a.progressPercent || 0);
      }
      // Default: due date
      const dateA = a.targetDate || a.targetEndDate || '9999';
      const dateB = b.targetDate || b.targetEndDate || '9999';
      return dateA.localeCompare(dateB);
    });
  }, [projects, searchQuery, statusFilter, typeFilter, sortBy]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Top Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Briefcase className="w-7 h-7 text-blue-600 dark:text-blue-500" />
            IT Project Portfolio
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Unified Project Management System with reusable process templates, phase pipelines, and subtask tracking.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
          {canDelete && (
            <button
              onClick={async () => {
                if (!window.confirm("Are you sure you want to purge all existing projects? This will give you a clean slate for production. Templates will remain intact.")) return;
                try {
                  setIsDeletingProject(true);
                  const { writeBatch } = await import('firebase/firestore');
                  const q = collection(db, 'it_projects');
                  const snap = await getDocs(q);
                  const batch = writeBatch(db);
                  let count = 0;
                  snap.forEach((d) => {
                    batch.delete(d.ref);
                    count++;
                  });
                  await batch.commit();
                  alert(`Successfully purged ${count} projects. The system is now ready for production.`);
                } catch (err) {
                  console.error('Error purging projects:', err);
                  alert('Error purging projects. See console.');
                } finally {
                  setIsDeletingProject(false);
                }
              }}
              disabled={isDeletingProject}
              className="bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 px-3 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              title="Purge All Projects"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Purge Data</span>
            </button>
          )}
          {canEdit && (<button
              onClick={() => setShowNewModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-black shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Project</span>
          </button>)}
        </div>
      </header>

      {/* Main Navigation Tabs */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 flex gap-6 shrink-0 overflow-x-auto">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`py-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap flex items-center gap-2 transition-colors ${
            activeTab === 'dashboard' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <TrendingUp className="w-4 h-4" /> Portfolio Dashboard
        </button>

        <button
          onClick={() => setActiveTab('projects')}
          className={`py-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap flex items-center gap-2 transition-colors ${
            activeTab === 'projects' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Layers className="w-4 h-4" /> All Projects ({projects.length})
        </button>

        <button
          onClick={() => setActiveTab('kanban')}
          className={`py-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap flex items-center gap-2 transition-colors ${
            activeTab === 'kanban' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Kanban className="w-4 h-4" /> Kanban View
        </button>

        <button
          onClick={() => setActiveTab('calendar')}
          className={`py-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap flex items-center gap-2 transition-colors ${
            activeTab === 'calendar' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Calendar className="w-4 h-4" /> Calendar
        </button>

        <button
          onClick={() => setActiveTab('blocked')}
          className={`py-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap flex items-center gap-2 transition-colors ${
            activeTab === 'blocked' ? 'border-amber-600 text-amber-600 dark:text-amber-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Clock className="w-4 h-4 text-amber-500" /> Issues & On Hold
          {summaryMetrics.totalBlockedItems > 0 && (
            <span className="bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
              {summaryMetrics.totalBlockedItems}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('templates')}
          className={`py-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap flex items-center gap-2 transition-colors ${
            activeTab === 'templates' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <FileCode className="w-4 h-4 text-blue-500" /> Template Builder
        </button>
      </div>

      {/* Main View Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        {/* ================= VIEW 1: DASHBOARD ================= */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 max-w-7xl mx-auto">
            {/* Executive Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">Total Projects</span>
                <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">{summaryMetrics.total}</span>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] uppercase font-black tracking-wider text-blue-600 dark:text-blue-400">Active</span>
                <span className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 mt-1">{summaryMetrics.active}</span>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] uppercase font-black tracking-wider text-amber-600 dark:text-amber-400">Waiting</span>
                <span className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">{summaryMetrics.waiting}</span>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] uppercase font-black tracking-wider text-emerald-600 dark:text-emerald-400">Completed</span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{summaryMetrics.completed}</span>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] uppercase font-black tracking-wider text-red-600 dark:text-red-400">Overdue</span>
                <span className="text-2xl sm:text-3xl font-black text-red-600 dark:text-red-400 mt-1">{summaryMetrics.overdue}</span>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] uppercase font-black tracking-wider text-amber-700 dark:text-amber-300">On Hold Items</span>
                <span className="text-2xl sm:text-3xl font-black text-amber-700 dark:text-amber-300 mt-1">{summaryMetrics.totalBlockedItems}</span>
              </div>
            </div>

            {/* On Hold & Waiting Executive Alert Banner */}
            {portfolioBlockedItems.length > 0 && (
              <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-extrabold text-xs uppercase tracking-wider">
                    <Clock className="w-4 h-4 text-amber-600" />
                    Attention Needed: On Hold & Waiting Items Across Portfolio ({portfolioBlockedItems.length})
                  </div>
                  <button
                    onClick={() => setActiveTab('blocked')}
                    className="text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1"
                  >
                    Manage on-hold items <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {portfolioBlockedItems.slice(0, 3).map((b, i) => (
                    <div 
                      key={i} 
                      onClick={() => {
                        const proj = projects.find(p => p.id === b.projectId);
                        if (proj) onSelectProject(proj);
                      }}
                      className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-900/50 shadow-xs cursor-pointer hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate">
                          {b.projectName}
                        </span>
                        <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                          b.status === 'blocked' || b.status === 'on_hold' ? 'bg-amber-100 text-amber-800' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {b.status === 'blocked' || b.status === 'on_hold' ? 'On Hold' : b.status}
                        </span>
                      </div>
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {b.stepTitle}
                      </h5>
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-1 font-medium line-clamp-2">
                        <strong>Reason:</strong> {b.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Projects Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/30">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Active Projects Portfolio
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Clear snapshot of current step, next action, automated progress %, and health.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('projects')}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  View All Projects & Filters <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700">
                      <th className="p-4 font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Project Name</th>
                      <th className="p-4 font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Type</th>
                      <th className="p-4 font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Client / Dept</th>
                      <th className="p-4 font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Progress</th>
                      <th className="p-4 font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Current Step Focus</th>
                      <th className="p-4 font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Next Action</th>
                      <th className="p-4 font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Status</th>
                      <th className="p-4 font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {projects.map(proj => {
                      const metrics = calculateProjectMetrics(proj);
                      const targetStr = proj.targetDate || proj.targetEndDate;

                      return (
                        <tr 
                          key={proj.id}
                          onClick={() => onSelectProject(proj)}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                        >
                          <td className="p-4">
                            <span className="font-extrabold text-slate-900 dark:text-white text-xs block">
                              {proj.name}
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              Owner: {proj.projectOwner}
                            </span>
                          </td>

                          <td className="p-4">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              {proj.projectType}
                            </span>
                          </td>

                          <td className="p-4">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {proj.client || proj.department}
                            </span>
                          </td>

                          <td className="p-4 min-w-[130px]">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${metrics.health === 'red' ? 'bg-red-500' : metrics.health === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                  style={{ width: `${metrics.progressPercent}%` }}
                                />
                              </div>
                              <span className="font-bold text-slate-700 dark:text-slate-300 w-8">
                                {metrics.progressPercent}%
                              </span>
                            </div>
                          </td>

                          <td className="p-4 max-w-[170px]">
                            <span className="font-bold text-blue-700 dark:text-blue-400 block truncate">
                              {proj.currentStep || 'Initial Setup'}
                            </span>
                          </td>

                          <td className="p-4 max-w-[200px]">
                            <span className="font-medium text-slate-600 dark:text-slate-300 block truncate">
                              {proj.nextAction || 'Continue scheduled pipeline'}
                            </span>
                          </td>

                          <td className="p-4">
                            <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                              proj.status === 'completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' :
                              proj.status === 'waiting' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' :
                              'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                            }`}>
                              {proj.status}
                            </span>
                          </td>

                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => onSelectProject(proj)}
                                className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                              >
                                Open <ArrowRight className="w-3 h-3" />
                              </button>
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => setProjectToDelete(proj)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                                  title={`Delete ${proj.name}`}
                                  aria-label={`Delete ${proj.name}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= VIEW 2: ALL PROJECTS ================= */}
        {activeTab === 'projects' && (
          <div className="space-y-6 max-w-7xl mx-auto">
            {/* Filter Bar */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                {/* Search */}
                <div className="relative flex-1 min-w-[220px] max-w-sm">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search projects, client, step, next action..."
                    className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-1">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="text-xs font-bold px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active Only</option>
                    <option value="waiting">Waiting Only</option>
                    <option value="completed">Completed Only</option>
                    <option value="overdue">Overdue Only</option>
                  </select>
                </div>

                {/* Template / Type Filter */}
                <div className="flex items-center gap-1">
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="text-xs font-bold px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white outline-none"
                  >
                    <option value="all">All Templates</option>
                    <option value="Matrix">Matrix</option>
                    <option value="UbookStore">UbookStore</option>
                    <option value="DIR LMS">DIR LMS</option>
                    <option value="Website">Website</option>
                  </select>
                </div>

                {/* Sort By */}
                <div className="flex items-center gap-1">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="text-xs font-bold px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white outline-none"
                  >
                    <option value="dueDate">Sort by Due Date</option>
                    <option value="progress">Sort by Progress %</option>
                    <option value="priority">Sort by Priority</option>
                  </select>
                </div>
              </div>

              {/* View Mode Toggle: Table vs Cards */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/60 p-1 rounded-xl">
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg text-xs font-bold transition-colors ${
                    viewMode === 'table' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
                  }`}
                  title="Table View"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={`p-1.5 rounded-lg text-xs font-bold transition-colors ${
                    viewMode === 'cards' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
                  }`}
                  title="Cards View"
                >
                  <Grid className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content: Cards or Table */}
            {viewMode === 'cards' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredProjects.map(proj => {
                  const metrics = calculateProjectMetrics(proj);

                  return (
                    <div
                      key={proj.id}
                      onClick={() => onSelectProject(proj)}
                      className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                            {proj.projectType}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            metrics.health === 'red' ? 'bg-red-100 text-red-700' :
                            metrics.health === 'amber' ? 'bg-amber-100 text-amber-700' :
                            'bg-emerald-100 text-emerald-700'
                          }`}>
                            {metrics.health}
                          </span>
                        </div>

                        <h4 className="text-base font-black text-slate-900 dark:text-white mb-1">
                          {proj.name}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                          Client: {proj.client || proj.department}
                        </p>

                        {/* Progress */}
                        <div className="space-y-1 mb-4">
                          <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                            <span>Progress</span>
                            <span>{metrics.progressPercent}%</span>
                          </div>
                          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${metrics.health === 'red' ? 'bg-red-500' : metrics.health === 'amber' ? 'bg-amber-500' : 'bg-blue-600'}`}
                              style={{ width: `${metrics.progressPercent}%` }}
                            />
                          </div>
                        </div>

                        {/* Current focus */}
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Step Focus</span>
                            <span className="font-bold text-blue-600 dark:text-blue-400">{proj.currentStep || 'In Progress'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Next Action</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300 line-clamp-1">{proj.nextAction || 'Continue tasks'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs text-slate-400">
                        <span>Target: {proj.targetDate || 'Not set'}</span>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setProjectToDelete(proj)}
                              className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                              title={`Delete ${proj.name}`}
                              aria-label={`Delete ${proj.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onSelectProject(proj)}
                            className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            Open <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700">
                        <th className="p-4 font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Project Name</th>
                        <th className="p-4 font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Type</th>
                        <th className="p-4 font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Client / Dept</th>
                        <th className="p-4 font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Priority</th>
                        <th className="p-4 font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Progress</th>
                        <th className="p-4 font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Current Step Focus</th>
                        <th className="p-4 font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Next Action</th>
                        <th className="p-4 font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Target Date</th>
                        <th className="p-4 font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredProjects.map(proj => {
                        const metrics = calculateProjectMetrics(proj);
                        return (
                          <tr 
                            key={proj.id}
                            onClick={() => onSelectProject(proj)}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                          >
                            <td className="p-4">
                              <span className="font-extrabold text-slate-900 dark:text-white text-xs block">
                                {proj.name}
                              </span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                {proj.projectOwner}
                              </span>
                            </td>

                            <td className="p-4">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                {proj.projectType}
                              </span>
                            </td>

                            <td className="p-4">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {proj.client || proj.department}
                              </span>
                            </td>

                            <td className="p-4">
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                proj.priority === 'critical' ? 'bg-red-100 text-red-700' :
                                proj.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {proj.priority}
                              </span>
                            </td>

                            <td className="p-4 min-w-[120px]">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-blue-600"
                                    style={{ width: `${metrics.progressPercent}%` }}
                                  />
                                </div>
                                <span className="font-bold text-slate-700 dark:text-slate-300 w-8">
                                  {metrics.progressPercent}%
                                </span>
                              </div>
                            </td>

                            <td className="p-4 max-w-[150px]">
                              <span className="font-bold text-blue-700 dark:text-blue-400 block truncate">
                                {proj.currentStep || 'In Progress'}
                              </span>
                            </td>

                            <td className="p-4 max-w-[180px]">
                              <span className="font-medium text-slate-600 dark:text-slate-300 block truncate">
                                {proj.nextAction || 'Next action'}
                              </span>
                            </td>

                            <td className="p-4 text-slate-500 dark:text-slate-400 text-xs">
                              {proj.targetDate || 'Not set'}
                            </td>

                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => onSelectProject(proj)}
                                  className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                                >
                                  Open <ArrowRight className="w-3 h-3" />
                                </button>
                                {canDelete && (
                                  <button
                                    type="button"
                                    onClick={() => setProjectToDelete(proj)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                                    title={`Delete ${proj.name}`}
                                    aria-label={`Delete ${proj.name}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= VIEW 3: KANBAN ================= */}
        {activeTab === 'kanban' && (
          <div className="max-w-7xl mx-auto">
            <KanbanBoardView 
              projects={projects}
              onUpdateProject={handleUpdateProject}
            />
          </div>
        )}

        {/* ================= VIEW 4: CALENDAR ================= */}
        {activeTab === 'calendar' && (
          <div className="max-w-7xl mx-auto">
            <CalendarScheduleView 
              projects={projects}
              onSelectProject={onSelectProject}
            />
          </div>
        )}

        {/* ================= VIEW 5: ISSUES & BLOCKED ================= */}
        {activeTab === 'blocked' && (
          <div className="max-w-7xl mx-auto">
            <BlockedIssuesManager 
              projects={projects}
              onUpdateProject={handleUpdateProject}
              onSelectProject={onSelectProject}
            />
          </div>
        )}

        {/* ================= VIEW 6: TEMPLATES BUILDER ================= */}
        {activeTab === 'templates' && (
          <div className="max-w-7xl mx-auto">
            <ProjectTemplateBuilder 
              templates={templates}
              onSaveTemplate={handleSaveTemplate}
              onSelectTemplateToCreate={(tpl) => {
                setSelectedTemplateId(tpl.id);
                setNewProjectName(`${tpl.name} Instance`);
                setShowNewModal(true);
              }}
            />
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg my-8 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Create Project From Reusable Template
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Pre-loads all phase workflows, steps, and subtasks automatically.
                </p>
              </div>
              <button 
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="p-6 space-y-4">
              {/* Template Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Choose Process Template
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer"
                >
                  {templates.map(tpl => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name} ({tpl.defaultPhases?.length || 1} phase(s))
                    </option>
                  ))}
                </select>
              </div>

              {/* Project Name */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Project Name
                </label>
                <input
                  required
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g., Library Management – Matrix, ABC Company Website"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Client & Owner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Client / Department
                  </label>
                  <input
                    required
                    type="text"
                    value={newClient}
                    onChange={(e) => setNewClient(e.target.value)}
                    placeholder="e.g. Central University Library, ABC Corp"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Project Owner
                  </label>
                  <input
                    required
                    type="text"
                    value={newOwner}
                    onChange={(e) => setNewOwner(e.target.value)}
                    placeholder="Saw Pyae Phyo Kyaw"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Timeline & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Target End Date
                  </label>
                  <input
                    type="date"
                    value={newTargetDate}
                    onChange={(e) => setNewTargetDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Priority
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              {/* Initial Next Action */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Initial Next Action Focus
                </label>
                <input
                  type="text"
                  value={newNextAction}
                  onChange={(e) => setNewNextAction(e.target.value)}
                  placeholder="e.g. Schedule kickoff & collect initial requirements"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm"
                >
                  Instantiate Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {projectToDelete && (
        <div 
          id="modal-delete-project-portfolio"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => !isDeletingProject && setProjectToDelete(null)}
        >
          <div 
            className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Project</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">This action cannot be undone</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-700/50">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Project Name</p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{projectToDelete.name || projectToDelete.title}</p>
              {(projectToDelete.client || projectToDelete.department) && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Department / Client: <strong className="text-slate-700 dark:text-slate-300">{projectToDelete.client || projectToDelete.department}</strong>
                </p>
              )}
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to delete this project? All associated process phases, steps, subtasks, notes, milestones, and governance logs will be permanently deleted from the database.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                id="btn-cancel-delete-project-portfolio"
                disabled={isDeletingProject}
                onClick={() => setProjectToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-delete-project-portfolio"
                disabled={isDeletingProject}
                onClick={handleDeleteProject}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeletingProject ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Yes, Delete Project</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
