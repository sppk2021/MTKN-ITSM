import React, { useState } from 'react';
import { ITProject, TaskStatus } from '../types';
import { 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Edit3, 
  Search, 
  Briefcase, 
  User, 
  Calendar,
  ArrowRight
} from 'lucide-react';

interface BlockedIssuesManagerProps {
  projects: ITProject[];
  onUpdateProject: (updated: ITProject) => void;
  onSelectProject?: (project: ITProject) => void;
}

interface BlockedItemRow {
  project: ITProject;
  phaseId: string;
  phaseName: string;
  stepId: string;
  stepTitle: string;
  status: 'blocked' | 'waiting' | 'on_hold';
  reason: string;
  personResponsible?: string;
  dueDate?: string;
}

export const BlockedIssuesManager: React.FC<BlockedIssuesManagerProps> = ({
  projects,
  onUpdateProject,
  onSelectProject
}) => {
  const [filterType, setFilterType] = useState<'all' | 'blocked' | 'waiting'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingItem, setEditingItem] = useState<BlockedItemRow | null>(null);
  const [editReasonText, setEditReasonText] = useState('');

  // Collect all on-hold/waiting items
  const items: BlockedItemRow[] = [];
  projects.forEach(project => {
    (project.phases || []).forEach(phase => {
      (phase.steps || []).forEach(step => {
        if (step.status === 'blocked' || step.status === 'on_hold' || step.status === 'waiting') {
          items.push({
            project,
            phaseId: phase.id,
            phaseName: phase.name,
            stepId: step.id,
            stepTitle: step.title,
            status: (step.status === 'blocked' ? 'on_hold' : step.status) as any,
            reason: step.blockedReason || (step.status === 'waiting' ? 'Waiting for external input' : 'Task on hold'),
            personResponsible: step.personResponsible || project.projectOwner,
            dueDate: step.dueDate
          });
        }
      });
    });
  });

  const totalBlocked = items.filter(i => i.status === 'blocked' || i.status === 'on_hold').length;
  const totalWaiting = items.filter(i => i.status === 'waiting').length;
  const uniqueProjectsAffected = new Set(items.map(i => i.project.id)).size;

  const filteredItems = items.filter(item => {
    if (filterType !== 'all') {
      if (filterType === 'blocked') {
        if (item.status !== 'blocked' && item.status !== 'on_hold') return false;
      } else if (item.status !== filterType) {
        return false;
      }
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.project.name.toLowerCase().includes(q) ||
      item.stepTitle.toLowerCase().includes(q) ||
      item.reason.toLowerCase().includes(q) ||
      (item.personResponsible || '').toLowerCase().includes(q)
    );
  });

  // Save reason edit
  const handleSaveReason = () => {
    if (!editingItem) return;
    const updatedPhases = editingItem.project.phases.map(phase => {
      if (phase.id !== editingItem.phaseId) return phase;
      const updatedSteps = phase.steps.map(step => {
        if (step.id !== editingItem.stepId) return step;
        return {
          ...step,
          blockedReason: editReasonText.trim()
        };
      });
      return { ...phase, steps: updatedSteps };
    });

    onUpdateProject({
      ...editingItem.project,
      phases: updatedPhases,
      updatedAt: new Date().toISOString()
    });
    setEditingItem(null);
  };

  // Change status to In Progress or Completed (Resolving the blocker)
  const handleResolveStatus = (item: BlockedItemRow, newStatus: TaskStatus) => {
    const updatedPhases = item.project.phases.map(phase => {
      if (phase.id !== item.phaseId) return phase;
      const updatedSteps = phase.steps.map(step => {
        if (step.id !== item.stepId) return step;
        return {
          ...step,
          status: newStatus,
          blockedReason: undefined,
          completedDate: newStatus === 'completed' ? new Date().toISOString().split('T')[0] : step.completedDate
        };
      });
      return { ...phase, steps: updatedSteps };
    });

    onUpdateProject({
      ...item.project,
      phases: updatedPhases,
      updatedAt: new Date().toISOString()
    });
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
              On Hold Items
            </span>
            <span className="text-3xl font-black text-amber-600 dark:text-amber-400">
              {totalBlocked}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
              Waiting on Dependencies
            </span>
            <span className="text-3xl font-black text-amber-600 dark:text-amber-400">
              {totalWaiting}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
              Impacted Projects
            </span>
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {uniqueProjectsAffected}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Briefcase className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              filterType === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            All Items ({items.length})
          </button>
          <button
            onClick={() => setFilterType('blocked')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              filterType === 'blocked'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            On Hold ({totalBlocked})
          </button>
          <button
            onClick={() => setFilterType('waiting')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              filterType === 'waiting'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Waiting ({totalWaiting})
          </button>
        </div>

        <div className="relative max-w-sm w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search project, step, or reason..."
            className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* On Hold Items Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                <th className="p-4 font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Project & Phase</th>
                <th className="p-4 font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Step Title</th>
                <th className="p-4 font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Status</th>
                <th className="p-4 font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">On Hold / Dependency Reason</th>
                <th className="p-4 font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Responsible</th>
                <th className="p-4 font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                    <p className="font-bold text-slate-700 dark:text-slate-300">No on-hold or waiting items!</p>
                    <p className="text-xs text-slate-400 mt-0.5">All projects and steps are progressing smoothly.</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => (
                  <tr key={`${item.project.id}_${item.stepId}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                    <td className="p-4">
                      <div 
                        onClick={() => onSelectProject && onSelectProject(item.project)}
                        className="cursor-pointer group"
                      >
                        <span className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 flex items-center gap-1.5">
                          {item.project.name}
                          <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          {item.phaseName}
                        </span>
                      </div>
                    </td>

                    <td className="p-4">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {item.stepTitle}
                      </span>
                      {item.dueDate && (
                        <span className="block text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          Due: {item.dueDate}
                        </span>
                      )}
                    </td>

                    <td className="p-4">
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 ${
                        item.status === 'blocked' || item.status === 'on_hold'
                          ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          : 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        {item.status === 'blocked' || item.status === 'on_hold' ? 'On Hold' : item.status}
                      </span>
                    </td>

                    <td className="p-4 max-w-sm">
                      <div className="p-2 rounded bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                        {item.reason}
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.personResponsible}</span>
                      </div>
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setEditReasonText(item.reason);
                          }}
                          className="px-2 py-1 text-slate-600 hover:text-blue-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                          title="Edit Reason"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleResolveStatus(item, 'in_progress')}
                          className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded font-bold transition-colors"
                        >
                          Resume Task
                        </button>
                        <button
                          onClick={() => handleResolveStatus(item, 'completed')}
                          className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded font-bold transition-colors"
                        >
                          Mark Done
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Reason Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
              <Edit3 className="w-5 h-5 text-blue-500" />
              Update On Hold / Waiting Reason
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Project: <strong>{editingItem.project.name}</strong> • Step: <strong>{editingItem.stepTitle}</strong>
            </p>

            <textarea
              rows={3}
              value={editReasonText}
              onChange={(e) => setEditReasonText(e.target.value)}
              className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none mb-4"
              placeholder="Detail the reason or dependency holding up work..."
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveReason}
                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
              >
                Save Updates
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
