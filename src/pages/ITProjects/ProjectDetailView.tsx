import React, { useState, useMemo, useEffect } from 'react';
import { ITProject } from './types';
import { calculateProjectMetrics } from './utils';
import { 
  ArrowLeft, CheckCircle2, Circle, AlertTriangle, FileText, 
  Lock, LayoutDashboard, ListChecks, Activity, Flag, 
  GitPullRequest, ShieldAlert, Sparkles, TrendingUp, 
  DollarSign, Calendar, Clock, ChevronRight, UserCheck 
} from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { doc, updateDoc, onSnapshot, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';

import SOPPlaybookView from './components/SOPPlaybookView';
import MilestoneTrackingView from './components/MilestoneTrackingView';
import ChangeRequestManager from './components/ChangeRequestManager';
import RisksAndIssuesManager from './components/RisksAndIssuesManager';
import DocumentsManager from './components/DocumentsManager';

interface ProjectDetailViewProps {
  project: ITProject;
  onBack: () => void;
}

export default function ProjectDetailView({ project: initialProject, onBack }: ProjectDetailViewProps) {
  const [project, setProject] = useState<ITProject>(initialProject);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'playbook' | 'milestones' | 'change_requests' | 'risks_issues' | 'documents'>('dashboard');
  const [users, setUsers] = useState<Array<{ id: string; name: string; email?: string; role?: string }>>([]);

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
      }
    });

    // Fetch team users for approver selectors
    const fetchUsers = async () => {
      try {
        const userSnap = await getDocs(collection(db, 'users'));
        const userList = userSnap.docs.map(d => ({
          id: d.id,
          name: d.data().name || d.data().displayName || d.data().email || 'Team Member',
          email: d.data().email,
          role: d.data().role || 'Member'
        }));
        setUsers(userList);
      } catch (err) {
        console.error('Error fetching users for approver selector:', err);
      }
    };
    fetchUsers();

    return () => unsub();
  }, [initialProject.id]);

  // Dynamic metrics calculation (including milestone delays and CR impacts)
  const metricsResult = useMemo(() => calculateProjectMetrics(project), [project]);
  const currentHealth = metricsResult.health;
  const currentProgress = metricsResult.progressPercent;

  // Persist project updates to Firestore
  const handleUpdateProject = async (updatedProject: ITProject) => {
    setProject(updatedProject);
    if (!updatedProject.id) return;

    try {
      const projectRef = doc(db, 'it_projects', updatedProject.id);
      // Strip undefined values before saving to Firestore
      const cleanData = JSON.parse(JSON.stringify({
        ...updatedProject,
        updatedAt: serverTimestamp()
      }));
      await updateDoc(projectRef, cleanData);
    } catch (err) {
      console.error('Error updating project in Firestore:', err);
    }
  };

  // Milestone summaries for dashboard
  const milestones = project.milestones || [];
  const delayedMilestones = milestones.filter(m => {
    if (m.status === 'completed') return false;
    const pDate = new Date(m.plannedDate);
    const fDate = new Date(m.forecastDate);
    return differenceInDays(fDate, pDate) > 0;
  });

  // Change request summaries for dashboard
  const changeRequests = project.changeRequests || [];
  const pendingCRs = changeRequests.filter(cr => cr.status === 'Requested' || cr.status === 'Under Review');
  const approvedCRs = changeRequests.filter(cr => cr.status === 'Approved' || cr.status === 'Implemented');
  const totalApprovedBudgetImpact = approvedCRs.reduce((acc, cr) => acc + (Number(cr.budgetImpact) || 0), 0);
  const totalApprovedDaysDelta = approvedCRs.reduce((acc, cr) => acc + (Number(cr.timelineImpactDays) || 0), 0);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            id="btn-back-to-portfolio"
            onClick={onBack} 
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-500 dark:text-slate-400"
            title="Back to Portfolio"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              {project.title}
              <span className={`text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full border ${
                currentHealth === 'green' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800' :
                currentHealth === 'amber' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800' : 
                'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800'
              }`}>
                {currentHealth} Health
              </span>
            </h1>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 flex items-center gap-2">
              <span>{project.department}</span>
              <span>•</span>
              <span className="capitalize">{project.templateUsed} SOP Playbook</span>
              {project.sponsorName && (
                <>
                  <span>•</span>
                  <span>Sponsor: <strong className="text-slate-700 dark:text-slate-300">{project.sponsorName}</strong></span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm font-bold">
          <div className="text-right">
            <p className="text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">Progress</p>
            <p className="text-slate-900 dark:text-white">{currentProgress}%</p>
          </div>
          <div className="w-28 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                currentHealth === 'red' ? 'bg-red-500' : currentHealth === 'amber' ? 'bg-amber-500' : 'bg-blue-600'
              }`} 
              style={{ width: `${currentProgress}%` }} 
            />
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 flex gap-6 shrink-0 overflow-x-auto">
        <button 
          id="tab-dashboard"
          onClick={() => setActiveTab('dashboard')} 
          className={`py-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap flex items-center gap-2 transition-colors ${activeTab === 'dashboard' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          <LayoutDashboard className="w-4 h-4" /> Dashboard
        </button>

        <button 
          id="tab-playbook"
          onClick={() => setActiveTab('playbook')} 
          className={`py-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap flex items-center gap-2 transition-colors ${activeTab === 'playbook' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          <ListChecks className="w-4 h-4" /> SOP Playbook & Gates
        </button>

        <button 
          id="tab-milestones"
          onClick={() => setActiveTab('milestones')} 
          className={`py-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap flex items-center gap-2 transition-colors ${activeTab === 'milestones' ? 'border-purple-500 text-purple-600 dark:text-purple-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          <Flag className="w-4 h-4 text-purple-500" /> Milestone Tracking
          {delayedMilestones.length > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
              {delayedMilestones.length}
            </span>
          )}
        </button>

        <button 
          id="tab-change-requests"
          onClick={() => setActiveTab('change_requests')} 
          className={`py-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap flex items-center gap-2 transition-colors ${activeTab === 'change_requests' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          <GitPullRequest className="w-4 h-4 text-blue-500" /> Change Requests
          {pendingCRs.length > 0 && (
            <span className="bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
              {pendingCRs.length}
            </span>
          )}
        </button>

        <button 
          id="tab-risks-issues"
          onClick={() => setActiveTab('risks_issues')} 
          className={`py-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap flex items-center gap-2 transition-colors ${activeTab === 'risks_issues' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          <AlertTriangle className="w-4 h-4" /> Risks & Issues
          {(project.risks?.filter(r => r.status === 'Open').length || 0) + (project.issues?.filter(i => i.status === 'Open').length || 0) > 0 && (
            <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold px-1.5 py-0.2 rounded">
              {(project.risks?.filter(r => r.status === 'Open').length || 0) + (project.issues?.filter(i => i.status === 'Open').length || 0)}
            </span>
          )}
        </button>

        <button 
          id="tab-documents"
          onClick={() => setActiveTab('documents')} 
          className={`py-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap flex items-center gap-2 transition-colors ${activeTab === 'documents' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          <FileText className="w-4 h-4" /> Documents ({project.documents?.length || 0})
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider">Schedule</span>
                  <Calendar className="w-4 h-4 text-blue-500" />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Target End:</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">{project.targetEndDate}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Days Left:</span>
                    <span className={`font-bold font-mono ${metricsResult.daysUntilEnd < 0 ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'}`}>
                      {metricsResult.daysUntilEnd >= 0 ? `${metricsResult.daysUntilEnd} days` : `Overdue by ${Math.abs(metricsResult.daysUntilEnd)}d`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider">Budget</span>
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Planned:</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">${(project.budget?.planned || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Actual:</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">${(project.budget?.actual || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider">Milestone Status</span>
                  <Flag className="w-4 h-4 text-purple-500" />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Total Milestones:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{milestones.length}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Forecast Delay:</span>
                    <span className={`font-bold ${delayedMilestones.length > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {delayedMilestones.length > 0 ? `${delayedMilestones.length} delayed` : 'All on track'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider">Change Requests</span>
                  <GitPullRequest className="w-4 h-4 text-blue-500" />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Pending Review:</span>
                    <span className={`font-bold ${pendingCRs.length > 0 ? 'text-amber-600' : 'text-slate-700 dark:text-slate-300'}`}>
                      {pendingCRs.length}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Approved Impact:</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {totalApprovedBudgetImpact !== 0 ? `+$${totalApprovedBudgetImpact.toLocaleString()}` : '$0'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Health Engine Insights & Phase Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-500" />
                    Health Engine Insights
                  </h3>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                    currentHealth === 'green' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300' :
                    currentHealth === 'amber' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300' :
                    'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300'
                  }`}>
                    {currentHealth}
                  </span>
                </div>
                <div className="p-4 flex-1">
                  <ul className="space-y-3">
                    {metricsResult.insights.map((insight, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm">
                        <div className="mt-0.5 shrink-0">
                          {currentHealth === 'red' ? (
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                          ) : currentHealth === 'amber' ? (
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          )}
                        </div>
                        <span className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed">{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Phase Progress Summary
                  </h3>
                  <button 
                    onClick={() => setActiveTab('playbook')}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
                  >
                    View Playbook <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 flex-1 overflow-y-auto">
                  {project.phases.map((phase, idx) => (
                    <div key={phase.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {phase.status === 'completed' ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600 shrink-0" />
                        )}
                        <div>
                          <span className={`font-bold text-xs sm:text-sm ${phase.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-900 dark:text-white'}`}>
                            {phase.name}
                          </span>
                          <p className="text-[11px] text-slate-400">
                            {phase.tasks.filter(t => t.status === 'completed').length} / {phase.tasks.length} tasks
                            {phase.gate && ` • Gate: ${phase.gate.isApproved ? 'Signed off' : 'Pending sign-off'}`}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[10px] uppercase font-extrabold px-2 py-1 rounded border ${
                        phase.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' :
                        phase.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800' :
                        'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                      }`}>
                        {phase.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Milestone Variance & Change Request Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Milestone Tracking Summary */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Flag className="w-4 h-4 text-purple-500" />
                    Milestones & Variance
                  </h3>
                  <button 
                    onClick={() => setActiveTab('milestones')}
                    className="text-xs font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 flex items-center gap-1"
                  >
                    Full View <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="p-4 space-y-3">
                  {milestones.slice(0, 4).map(m => {
                    const pDate = new Date(m.plannedDate);
                    const targetDate = m.actualDate ? new Date(m.actualDate) : new Date(m.forecastDate);
                    const variance = differenceInDays(targetDate, pDate);
                    return (
                      <div key={m.id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          {m.status === 'completed' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                          )}
                          <span className={`font-bold truncate ${m.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-200'}`}>
                            {m.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-slate-500">{format(pDate, 'MMM dd')}</span>
                          {variance > 0 ? (
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 rounded border border-red-100 dark:border-red-900">
                              +{variance}d
                            </span>
                          ) : variance < 0 ? (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-900">
                              {variance}d
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              0d
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {milestones.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-2">No milestones defined yet.</p>
                  )}
                </div>
              </div>

              {/* Change Request Summary */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <GitPullRequest className="w-4 h-4 text-blue-500" />
                    Recent Change Requests
                  </h3>
                  <button 
                    onClick={() => setActiveTab('change_requests')}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
                  >
                    Manage CRs <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="p-4 space-y-3">
                  {changeRequests.slice(0, 3).map(cr => (
                    <div key={cr.id} className="flex items-center justify-between text-xs">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{cr.title}</p>
                        <p className="text-[11px] text-slate-400">
                          {cr.category} • Approver: {cr.assignedApprover || 'Sponsor'}
                        </p>
                      </div>
                      <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded border shrink-0 ${
                        cr.status === 'Approved' || cr.status === 'Implemented' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' :
                        cr.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800' :
                        'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                      }`}>
                        {cr.status}
                      </span>
                    </div>
                  ))}
                  {changeRequests.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-2">No change requests submitted.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SOP PLAYBOOK & GATES TAB */}
        {activeTab === 'playbook' && (
          <SOPPlaybookView 
            project={project}
            users={users}
            onUpdateProject={handleUpdateProject}
            currentUser={auth.currentUser}
          />
        )}

        {/* MILESTONE VARIANCE TRACKING TAB */}
        {activeTab === 'milestones' && (
          <MilestoneTrackingView 
            project={project}
            onUpdateProject={handleUpdateProject}
            currentUser={auth.currentUser}
          />
        )}

        {/* CHANGE REQUESTS TAB */}
        {activeTab === 'change_requests' && (
          <ChangeRequestManager 
            project={project}
            users={users}
            onUpdateProject={handleUpdateProject}
            currentUser={auth.currentUser}
          />
        )}

        {/* RISKS & ISSUES TAB */}
        {activeTab === 'risks_issues' && (
          <RisksAndIssuesManager 
            project={project}
            onUpdateProject={handleUpdateProject}
            currentUser={auth.currentUser}
          />
        )}

        {/* DOCUMENTS TAB */}
        {activeTab === 'documents' && (
          <DocumentsManager 
            project={project}
            onUpdateProject={handleUpdateProject}
            currentUser={auth.currentUser}
          />
        )}

      </div>
    </div>
  );
}
