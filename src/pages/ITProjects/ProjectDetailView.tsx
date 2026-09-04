import React, { useState, useMemo, useEffect } from 'react';
import { ITProject, TaskStatus } from './types';
import { calculateProjectMetrics, STATUS_CONFIG } from './utils';
import { 
  ArrowLeft, CheckCircle2, Clock, AlertTriangle, FileText, 
  LayoutDashboard, ListChecks, Calendar, User, 
  ArrowRight, Edit3, Plus, Trash2, Kanban, AlertCircle,
  TrendingUp, Layers, CheckSquare, Sparkles, MessageSquare,
  Loader2
} from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { doc, updateDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';

import { WhatRemainsCard } from './components/WhatRemainsCard';
import { ProcessHierarchyView } from './components/ProcessHierarchyView';
import { KanbanBoardView } from './components/KanbanBoardView';
import MilestoneTrackingView from './components/MilestoneTrackingView';
import ChangeRequestManager from './components/ChangeRequestManager';
import RisksAndIssuesManager from './components/RisksAndIssuesManager';

interface ProjectDetailViewProps {
  project: ITProject;
  onBack: () => void;
  userRole?: string;
  userPermissions?: any;
}

export default function ProjectDetailView({ 
  project: initialProject, 
  onBack,
  userRole,
  userPermissions
}: ProjectDetailViewProps) {
  const [project, setProject] = useState<ITProject>(initialProject);
  const [activeTab, setActiveTab] = useState<'overview' | 'process' | 'kanban' | 'blocked' | 'activity' | 'governance'>('overview');
  
  // Quick in-place editing for Current Step & Next Action
  const [isEditingFocus, setIsEditingFocus] = useState(false);
  const [editCurrentStep, setEditCurrentStep] = useState(project.currentStep || '');
  const [editNextAction, setEditNextAction] = useState(project.nextAction || '');

  // Notes state
  const [projectNotes, setProjectNotes] = useState(project.notes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Deletion state & permissions
  const canDelete = userRole === 'admin' || (userPermissions ? !!userPermissions?.projects?.delete : true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // New activity input
  const [newActivityText, setNewActivityText] = useState('');

  // Real-time Firestore sync
  useEffect(() => {
    if (!initialProject.id) return;

    const unsub = onSnapshot(doc(db, 'it_projects', initialProject.id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as ITProject;
        setProject({
          ...data,
          id: docSnap.id
        });
        setEditCurrentStep(data.currentStep || '');
        setEditNextAction(data.nextAction || '');
        setProjectNotes(data.notes || '');
      }
    });

    return () => unsub();
  }, [initialProject.id]);

  // Dynamic metrics calculation
  const metricsResult = useMemo(() => calculateProjectMetrics(project), [project]);
  const currentHealth = metricsResult.health;
  const currentProgress = metricsResult.progressPercent;
  const taskCounts = metricsResult.counts;

  // Persist project updates
  const handleUpdateProject = async (updatedProject: ITProject) => {
    setProject(updatedProject);
    if (!updatedProject.id) return;

    try {
      const projectRef = doc(db, 'it_projects', updatedProject.id);
      const cleanData = JSON.parse(JSON.stringify({
        ...updatedProject,
        updatedAt: serverTimestamp()
      }));
      await updateDoc(projectRef, cleanData);
    } catch (err) {
      console.error('Error updating project in Firestore:', err);
    }
  };

  // Save current step and next action
  const handleSaveFocus = () => {
    const updated: ITProject = {
      ...project,
      currentStep: editCurrentStep.trim() || project.currentStep,
      nextAction: editNextAction.trim() || project.nextAction,
      updatedAt: new Date().toISOString()
    };
    handleUpdateProject(updated);
    setIsEditingFocus(false);
  };

  // Save notes
  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    const updated: ITProject = {
      ...project,
      notes: projectNotes,
      updatedAt: new Date().toISOString()
    };
    await handleUpdateProject(updated);
    setIsSavingNotes(false);
  };

  // Delete project
  const handleDeleteProject = async () => {
    if (!project.id) return;
    if (!canDelete) {
      alert("Permission Denied: You do not have permission to delete projects.");
      return;
    }
    try {
      setIsDeleting(true);
      await deleteDoc(doc(db, 'it_projects', project.id));
      setIsDeleteDialogOpen(false);
      onBack();
    } catch (err) {
      console.error('Error deleting project in Firestore:', err);
      handleFirestoreError(err, OperationType.DELETE, `it_projects/${project.id}`);
      alert("Failed to delete project: " + (err instanceof Error ? err.message : String(err)));
      setIsDeleting(false);
    }
  };

  // Add activity log
  const handleAddActivity = () => {
    if (!newActivityText.trim()) return;
    const newLog = {
      id: `act_${Date.now()}`,
      date: new Date().toISOString(),
      action: newActivityText.trim(),
      user: project.projectOwner
    };
    const updated: ITProject = {
      ...project,
      activityLog: [newLog, ...(project.activityLog || [])],
      updatedAt: new Date().toISOString()
    };
    handleUpdateProject(updated);
    setNewActivityText('');
  };

  const targetDateFormatted = useMemo(() => {
    const dStr = project.targetDate || project.targetEndDate;
    if (!dStr) return 'Not scheduled';
    try {
      return format(new Date(dStr), 'MMM dd, yyyy');
    } catch {
      return dStr;
    }
  }, [project.targetDate, project.targetEndDate]);

  const startDateFormatted = useMemo(() => {
    if (!project.startDate) return 'Not set';
    try {
      return format(new Date(project.startDate), 'MMM dd, yyyy');
    } catch {
      return project.startDate;
    }
  }, [project.startDate]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0 shadow-xs">
        <div className="flex items-start sm:items-center gap-3">
          <button 
            id="btn-back-to-portfolio"
            onClick={onBack} 
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-0"
            title="Back to Portfolio"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                {project.projectType || 'Standard Project'}
              </span>

              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                currentHealth === 'green' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400' :
                currentHealth === 'amber' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400' : 
                'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400'
              }`}>
                {currentHealth} Health
              </span>

              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                project.priority === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/40' :
                project.priority === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40' :
                'bg-slate-100 text-slate-600 dark:bg-slate-700'
              }`}>
                {project.priority || 'Medium'} Priority
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              {project.name || project.title}
            </h1>

            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 flex flex-wrap items-center gap-3">
              <span>Client / Dept: <strong className="text-slate-700 dark:text-slate-300">{project.client || project.department}</strong></span>
              <span>•</span>
              <span>Owner: <strong className="text-slate-700 dark:text-slate-300">{project.projectOwner}</strong></span>
              <span>•</span>
              <span>Timeline: <strong>{startDateFormatted}</strong> → <strong className={metricsResult.isOverdue ? 'text-red-600 font-bold' : ''}>{targetDateFormatted}</strong></span>
              {metricsResult.isOverdue && (
                <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded bg-red-100 text-red-700">
                  Overdue by {metricsResult.overdueDays}d
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Top Progress Summary & Actions */}
        <div className="flex flex-wrap items-center gap-3 self-start lg:self-center">
          <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-700/60">
            <div className="text-right">
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">
                Automated Progress
              </span>
              <div className="flex items-baseline gap-1 justify-end">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {currentProgress}%
                </span>
                <span className="text-[10px] text-slate-400">
                  ({taskCounts.completed}/{taskCounts.total} tasks)
                </span>
              </div>
            </div>
            <div className="w-24 h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  currentHealth === 'red' ? 'bg-red-500' : currentHealth === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'
                }`} 
                style={{ width: `${currentProgress}%` }} 
              />
            </div>
          </div>

          {canDelete && (
            <button
              type="button"
              id="btn-delete-project"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold text-red-600 dark:text-red-400 hover:text-white dark:hover:text-white bg-red-50 hover:bg-red-600 dark:bg-red-950/40 dark:hover:bg-red-600 border border-red-200 dark:border-red-900/60 rounded-xl transition-all duration-150 shadow-xs cursor-pointer group"
              title="Delete Project"
            >
              <Trash2 className="w-4 h-4 text-red-500 group-hover:text-white transition-colors" />
              <span className="font-semibold">Delete Project</span>
            </button>
          )}
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 flex gap-6 shrink-0 overflow-x-auto">
        <button 
          id="tab-overview"
          onClick={() => setActiveTab('overview')} 
          className={`py-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap flex items-center gap-2 transition-colors ${
            activeTab === 'overview' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" /> Overview & What Remains
        </button>

        <button 
          id="tab-process"
          onClick={() => setActiveTab('process')} 
          className={`py-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap flex items-center gap-2 transition-colors ${
            activeTab === 'process' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Layers className="w-4 h-4" /> Process & Subtasks
        </button>

        <button 
          id="tab-kanban"
          onClick={() => setActiveTab('kanban')} 
          className={`py-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap flex items-center gap-2 transition-colors ${
            activeTab === 'kanban' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Kanban className="w-4 h-4" /> Kanban View
        </button>

        <button 
          id="tab-blocked"
          onClick={() => setActiveTab('blocked')} 
          className={`py-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap flex items-center gap-2 transition-colors ${
            activeTab === 'blocked' ? 'border-amber-600 text-amber-600 dark:text-amber-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Clock className="w-4 h-4 text-amber-500" /> On Hold & Waiting
          {metricsResult.blockedItems.length > 0 && (
            <span className="bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
              {metricsResult.blockedItems.length}
            </span>
          )}
        </button>

        <button 
          id="tab-activity"
          onClick={() => setActiveTab('activity')} 
          className={`py-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap flex items-center gap-2 transition-colors ${
            activeTab === 'activity' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Clock className="w-4 h-4" /> Activity Log
        </button>

        <button 
          id="tab-governance"
          onClick={() => setActiveTab('governance')} 
          className={`py-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap flex items-center gap-2 transition-colors ${
            activeTab === 'governance' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <FileText className="w-4 h-4" /> Governance & Risks
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        {/* Tab 1: Overview & What Remains */}
        {activeTab === 'overview' && (
          <div className="space-y-6 max-w-7xl mx-auto">
            {/* Current Work Focus Card */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Current Focus & Next Action
                  </h2>
                </div>
                {!isEditingFocus ? (
                  <button
                    onClick={() => setIsEditingFocus(true)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit Focus
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsEditingFocus(false)}
                      className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveFocus}
                      className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-lg"
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 block mb-1">
                    Current Step
                  </span>
                  {!isEditingFocus ? (
                    <p className="text-sm font-black text-slate-900 dark:text-white">
                      {project.currentStep || 'Not set'}
                    </p>
                  ) : (
                    <input
                      type="text"
                      value={editCurrentStep}
                      onChange={(e) => setEditCurrentStep(e.target.value)}
                      className="w-full text-xs p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      placeholder="e.g. iOS Development"
                    />
                  )}
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 md:col-span-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1 flex items-center gap-1">
                    <ArrowRight className="w-3 h-3 text-blue-500" />
                    Immediate Next Action
                  </span>
                  {!isEditingFocus ? (
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {project.nextAction || 'No next action defined'}
                    </p>
                  ) : (
                    <input
                      type="text"
                      value={editNextAction}
                      onChange={(e) => setEditNextAction(e.target.value)}
                      className="w-full text-xs p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      placeholder="e.g. Complete iOS payment integration"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Task Progress Breakdown Box */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Task Progress Metrics
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Calculated from completed tasks and subtasks: Completed Tasks ÷ Total Tasks × 100
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Total Tasks: <strong className="text-slate-900 dark:text-white">{taskCounts.total}</strong>
                </span>
              </div>

              {/* Counts Pills Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-center">
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase block">Completed</span>
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{taskCounts.completed}</span>
                </div>
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-center">
                  <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase block">In Progress</span>
                  <span className="text-xl font-black text-blue-600 dark:text-blue-400">{taskCounts.inProgress}</span>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-center">
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase block">Waiting</span>
                  <span className="text-xl font-black text-amber-600 dark:text-amber-400">{taskCounts.waiting}</span>
                </div>
                <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/40 text-center">
                  <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase block">Review / QA</span>
                  <span className="text-xl font-black text-purple-600 dark:text-purple-400">{taskCounts.reviewQa}</span>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-center">
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase block">On Hold</span>
                  <span className="text-xl font-black text-amber-600 dark:text-amber-400">{taskCounts.onHold ?? taskCounts.blocked}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Not Started</span>
                  <span className="text-xl font-black text-slate-700 dark:text-slate-300">{taskCounts.notStarted}</span>
                </div>
              </div>

              {/* Full-width visual Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                  <span>Overall Project Completion</span>
                  <span>{currentProgress}%</span>
                </div>
                <div className="h-3 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-500" 
                    style={{ width: `${currentProgress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* What Remains 4-Quadrant Card */}
            <WhatRemainsCard project={project} />

            {/* Notes Section */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-500" />
                  Project Notes & Documentation
                </h3>
                <button
                  onClick={handleSaveNotes}
                  disabled={isSavingNotes}
                  className="text-xs font-bold px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                >
                  {isSavingNotes ? 'Saving...' : 'Save Notes'}
                </button>
              </div>
              <textarea
                rows={4}
                value={projectNotes}
                onChange={(e) => setProjectNotes(e.target.value)}
                placeholder="Add meeting minutes, credentials references, repository links, or delivery notes..."
                className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Tab 2: Process & Subtasks */}
        {activeTab === 'process' && (
          <div className="max-w-7xl mx-auto">
            <ProcessHierarchyView 
              project={project}
              onUpdateProject={handleUpdateProject}
            />
          </div>
        )}

        {/* Tab 3: Kanban View */}
        {activeTab === 'kanban' && (
          <div className="max-w-7xl mx-auto">
            <KanbanBoardView 
              projects={[project]}
              onUpdateProject={handleUpdateProject}
              selectedProjectId={project.id}
            />
          </div>
        )}

        {/* Tab 4: On Hold & Waiting Items */}
        {activeTab === 'blocked' && (
          <div className="max-w-7xl mx-auto space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
              <h3 className="text-base font-black text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                On Hold & Waiting Items in this Project
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                Directly resolve or update the status of items or dependencies holding up progress.
              </p>

              {metricsResult.blockedItems.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="font-bold text-slate-700 dark:text-slate-300">No On Hold Items</p>
                  <p className="text-xs">All steps are in progress or ready to execute.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {metricsResult.blockedItems.map((bItem, idx) => (
                    <div 
                      key={idx}
                      className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300">
                            {bItem.status === 'blocked' || bItem.status === 'on_hold' ? 'On Hold' : bItem.status}
                          </span>
                          <span className="text-xs text-slate-400">{bItem.phaseName}</span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {bItem.stepTitle}
                        </h4>
                        <div className="mt-1 text-xs text-amber-800 dark:text-amber-300 font-medium">
                          <strong>Reason:</strong> {bItem.reason}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          onClick={() => {
                            // Find and update step to in_progress
                            const updatedPhases = project.phases.map(p => ({
                              ...p,
                              steps: p.steps.map(s => s.id === bItem.stepId ? { ...s, status: 'in_progress' as TaskStatus, blockedReason: undefined } : s)
                            }));
                            handleUpdateProject({ ...project, phases: updatedPhases });
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm"
                        >
                          Resume Step
                        </button>
                        <button
                          onClick={() => {
                            const updatedPhases = project.phases.map(p => ({
                              ...p,
                              steps: p.steps.map(s => s.id === bItem.stepId ? { ...s, status: 'completed' as TaskStatus, blockedReason: undefined } : s)
                            }));
                            handleUpdateProject({ ...project, phases: updatedPhases });
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm"
                        >
                          Mark Completed
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Activity Log */}
        {activeTab === 'activity' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
              <h3 className="text-base font-black text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
                Recent Activity & Progress Updates
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                Chronological log of milestone achievements, status changes, and team comments.
              </p>

              {/* Add Activity Input */}
              <div className="flex items-center gap-2 mb-6">
                <input
                  type="text"
                  value={newActivityText}
                  onChange={(e) => setNewActivityText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddActivity()}
                  placeholder="e.g. 04 Sep — iOS development started / Android testing completed"
                  className="flex-1 text-xs p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={handleAddActivity}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shrink-0"
                >
                  Add Entry
                </button>
              </div>

              {/* Activity Timeline */}
              <div className="space-y-4">
                {(project.activityLog || []).length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-6">No activity logs recorded yet.</p>
                ) : (
                  (project.activityLog || []).map(act => (
                    <div key={act.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/60 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {act.action}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                          <span>{act.date ? format(new Date(act.date), 'MMM dd, yyyy • HH:mm') : 'Recent'}</span>
                          {act.user && <span>• Logged by {act.user}</span>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: Governance & Enterprise Tracking */}
        {activeTab === 'governance' && (
          <div className="max-w-7xl mx-auto space-y-6">
            <MilestoneTrackingView 
              project={project} 
              onUpdateProject={handleUpdateProject} 
            />
            <RisksAndIssuesManager
              project={project}
              onUpdateProject={handleUpdateProject}
            />
            <ChangeRequestManager
              project={project}
              users={[]}
              onUpdateProject={handleUpdateProject}
            />
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteDialogOpen && (
        <div 
          id="modal-delete-project-detail"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => !isDeleting && setIsDeleteDialogOpen(false)}
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
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{project.name || project.title}</p>
              {(project.client || project.department) && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Department / Client: <strong className="text-slate-700 dark:text-slate-300">{project.client || project.department}</strong>
                </p>
              )}
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to delete this project? All associated process phases, steps, subtasks, notes, milestones, and governance logs will be permanently deleted from the database.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                id="btn-cancel-delete-project-detail"
                disabled={isDeleting}
                onClick={() => setIsDeleteDialogOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-delete-project-detail"
                disabled={isDeleting}
                onClick={handleDeleteProject}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
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
