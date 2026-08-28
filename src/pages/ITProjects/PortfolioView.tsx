import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { ITProject } from './types';
import { generateNewProject } from './templates';
import { calculateProjectMetrics } from './utils';
import { Plus, Briefcase, Activity, AlertTriangle, CheckCircle2, Search, X, Calendar, TrendingUp, ArrowUpDown, ArrowDown, ArrowUp } from 'lucide-react';
import { format } from 'date-fns';

type SortOption = 'health' | 'dueDate' | 'progress';
type SortDirection = 'asc' | 'desc';

export default function PortfolioView({ onSelectProject }: { onSelectProject: (p: ITProject) => void }) {
  const location = useLocation();
  const [projects, setProjects] = useState<ITProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('search') || (location.state as any)?.searchQuery;
    if (q) {
      setSearchQuery(q);
    }
  }, [location.search, location.state]);
  const [sortBy, setSortBy] = useState<SortOption>('health');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDept, setNewDept] = useState('');
  const [newSponsor, setNewSponsor] = useState('');
  const [newBudget, setNewBudget] = useState<number>(25000);
  const [newTemplate, setNewTemplate] = useState<'software' | 'cloud' | 'infrastructure'>('software');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'it_projects'));
      const projs = snap.docs.map(doc => {
        const data = doc.data() as ITProject;
        const computed = calculateProjectMetrics(data);
        return { 
          id: doc.id, 
          ...data,
          health: computed.health,
          progressPercent: computed.progressPercent
        };
      });
      setProjects(projs);
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newProj = generateNewProject(newTemplate, newTitle, newDept, auth.currentUser?.uid || 'unknown');
      const docRef = await addDoc(collection(db, 'it_projects'), {
        ...newProj,
        sponsorName: newSponsor.trim() || 'Project Sponsor',
        budget: { planned: Number(newBudget) || 25000, actual: 0 },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setShowNewModal(false);
      setNewTitle('');
      setNewDept('');
      setNewSponsor('');
      setNewBudget(25000);
      fetchProjects();
    } catch (error) {
      console.error("Error creating project:", error);
    }
  };

  const handleSortChange = (option: SortOption) => {
    if (sortBy === option) {
      // Toggle direction if clicking same option
      setSortDir(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(option);
      // Sensible default directions:
      // 'health' -> desc (red=3 first)
      // 'dueDate' -> asc (earliest/nearest due date first)
      // 'progress' -> desc (highest % first)
      if (option === 'health') setSortDir('desc');
      else if (option === 'dueDate') setSortDir('asc');
      else if (option === 'progress') setSortDir('desc');
    }
  };

  const activeProjects = projects.filter(p => p.status !== 'completed' && p.status !== 'cancelled');

  // Filter and Sort Projects
  const filteredAndSortedProjects = projects
    .filter(proj => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        proj.title?.toLowerCase().includes(q) ||
        proj.department?.toLowerCase().includes(q) ||
        proj.status?.toLowerCase().includes(q) ||
        proj.sponsorName?.toLowerCase().includes(q) ||
        proj.templateUsed?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'health') {
        // Red first (weight 3), Amber (weight 2), Green (weight 1)
        const healthPriority: Record<string, number> = { red: 3, amber: 2, green: 1 };
        const scoreA = healthPriority[a.health || 'green'] || 0;
        const scoreB = healthPriority[b.health || 'green'] || 0;
        if (scoreA !== scoreB) {
          return sortDir === 'desc' ? scoreB - scoreA : scoreA - scoreB;
        }
        // Secondary sort: highest progress
        return (b.progressPercent || 0) - (a.progressPercent || 0);
      }

      if (sortBy === 'dueDate') {
        const getDueDateTimestamp = (p: ITProject) => {
          if (p.targetEndDate) {
            const parsed = new Date(p.targetEndDate).getTime();
            if (!isNaN(parsed)) return parsed;
          }
          if (p.milestones && p.milestones.length > 0) {
            const lastM = p.milestones[p.milestones.length - 1];
            const mDate = lastM.forecastDate || lastM.plannedDate;
            if (mDate) {
              const parsed = new Date(mDate).getTime();
              if (!isNaN(parsed)) return parsed;
            }
          }
          return sortDir === 'asc' ? Infinity : -Infinity;
        };

        const timeA = getDueDateTimestamp(a);
        const timeB = getDueDateTimestamp(b);
        if (timeA !== timeB) {
          return sortDir === 'asc' ? timeA - timeB : timeB - timeA;
        }
        return (b.progressPercent || 0) - (a.progressPercent || 0);
      }

      if (sortBy === 'progress') {
        const progA = a.progressPercent || 0;
        const progB = b.progressPercent || 0;
        if (progA !== progB) {
          return sortDir === 'desc' ? progB - progA : progA - progB;
        }
        return a.title.localeCompare(b.title);
      }

      return 0;
    });

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <Briefcase className="w-8 h-8 text-blue-600 dark:text-blue-500" />
            IT Project Portfolio
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium max-w-2xl">
            SOP-driven project lifecycle management. Track phases, approvals, risks, and governance across all IT initiatives.
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Create Project
        </button>
      </header>

      {/* Executive Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Projects</span>
            <Activity className="w-4 h-4 text-blue-500" />
          </div>
          <span className="text-3xl font-black text-slate-900 dark:text-white">{activeProjects.length}</span>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Healthy (Green)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {activeProjects.filter(p => p.health === 'green').length}
          </span>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">At Risk (Amber)</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-3xl font-black text-amber-600 dark:text-amber-400">
            {activeProjects.filter(p => p.health === 'amber').length}
          </span>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Critical (Red)</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <span className="text-3xl font-black text-red-600 dark:text-red-400">
            {activeProjects.filter(p => p.health === 'red').length}
          </span>
        </div>
      </div>

      {/* Filters and Sorting Control Bar */}
      <div className="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search projects, departments, sponsors..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-8 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort By Toggle Control */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5" />
            Sort by:
          </span>

          <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-700">
            {/* Health Sort Button */}
            <button
              type="button"
              onClick={() => handleSortChange('health')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                sortBy === 'health'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Sort by Health: Critical (Red) first, then Amber, then Green"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Health (Red First)</span>
              {sortBy === 'health' && (
                sortDir === 'desc' ? <ArrowDown className="w-3 h-3 ml-0.5" /> : <ArrowUp className="w-3 h-3 ml-0.5" />
              )}
            </button>

            {/* Due Date Sort Button */}
            <button
              type="button"
              onClick={() => handleSortChange('dueDate')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                sortBy === 'dueDate'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Sort by Project Target Due Date"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Due Date</span>
              {sortBy === 'dueDate' && (
                sortDir === 'asc' ? <ArrowUp className="w-3 h-3 ml-0.5" /> : <ArrowDown className="w-3 h-3 ml-0.5" />
              )}
            </button>

            {/* Percentage Progress Sort Button */}
            <button
              type="button"
              onClick={() => handleSortChange('progress')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                sortBy === 'progress'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Sort by Completion Percentage"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Percentage Progress</span>
              {sortBy === 'progress' && (
                sortDir === 'desc' ? <ArrowDown className="w-3 h-3 ml-0.5" /> : <ArrowUp className="w-3 h-3 ml-0.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                <th className="p-4 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Project Name</th>
                <th className="p-4 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Department</th>
                <th className="p-4 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Health</th>
                <th className="p-4 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Due Date</th>
                <th className="p-4 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredAndSortedProjects.map(proj => {
                const targetDate = proj.targetEndDate || (proj.milestones && proj.milestones.length > 0 ? (proj.milestones[proj.milestones.length - 1].forecastDate || proj.milestones[proj.milestones.length - 1].plannedDate) : null);
                let isPastDue = false;
                let formattedDueDate = 'Not set';
                if (targetDate) {
                  try {
                    const d = new Date(targetDate);
                    formattedDueDate = format(d, 'MMM dd, yyyy');
                    isPastDue = d.getTime() < Date.now() && proj.status !== 'completed' && proj.status !== 'cancelled';
                  } catch {
                    formattedDueDate = targetDate;
                  }
                }

                return (
                  <tr 
                    key={proj.id} 
                    onClick={() => onSelectProject(proj)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <td className="p-4">
                      <p className="font-bold text-slate-900 dark:text-white">{proj.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>{proj.templateUsed?.toUpperCase() || 'GENERAL'}</span>
                        {proj.sponsorName && (
                          <>
                            <span>•</span>
                            <span>Sponsor: {proj.sponsorName}</span>
                          </>
                        )}
                      </p>
                    </td>
                    <td className="p-4">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{proj.department}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-[10px] uppercase font-extrabold px-2 py-1 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {proj.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${
                          proj.health === 'green' ? 'bg-emerald-500' :
                          proj.health === 'amber' ? 'bg-amber-500' : 'bg-red-500'
                        }`} />
                        <span className={`text-xs font-bold capitalize ${
                          proj.health === 'red' ? 'text-red-600 dark:text-red-400' :
                          proj.health === 'amber' ? 'text-amber-600 dark:text-amber-400' :
                          'text-emerald-600 dark:text-emerald-400'
                        }`}>{proj.health}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-xs font-medium">
                        <Calendar className={`w-3.5 h-3.5 ${isPastDue ? 'text-red-500' : 'text-slate-400'}`} />
                        <span className={isPastDue ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-700 dark:text-slate-300'}>
                          {formattedDueDate}
                        </span>
                        {isPastDue && (
                          <span className="text-[9px] font-extrabold uppercase px-1 py-0.2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
                            Overdue
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden min-w-[70px]">
                          <div 
                            className={`h-full ${proj.health === 'red' ? 'bg-red-500' : proj.health === 'amber' ? 'bg-amber-500' : 'bg-blue-500'}`} 
                            style={{ width: `${proj.progressPercent}%` }} 
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400 w-8">{proj.progressPercent}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredAndSortedProjects.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 dark:text-slate-400">
                    {searchQuery ? `No projects matching "${searchQuery}".` : 'No projects found. Create one to get started.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Generate Project Playbook</h2>
              <button onClick={() => setShowNewModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Project Name</label>
                <input required type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="e.g., Cloud Migration 2026" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Department</label>
                <input required type="text" value={newDept} onChange={e => setNewDept(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="e.g., IT Infrastructure" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Project Template (SOP)</label>
                <select value={newTemplate} onChange={e => setNewTemplate(e.target.value as any)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none">
                  <option value="software">Software Development Lifecycle</option>
                  <option value="cloud">Cloud Migration Playbook</option>
                  <option value="infrastructure">Infrastructure Upgrade</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Project Sponsor</label>
                  <input type="text" value={newSponsor} onChange={e => setNewSponsor(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none" placeholder="e.g., Jane Doe (VP Ops)" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Planned Budget ($)</label>
                  <input type="number" value={newBudget} onChange={e => setNewBudget(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none font-mono" placeholder="25000" />
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button type="button" onClick={() => setShowNewModal(false)} className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">Generate Project</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
