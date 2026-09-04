import React, { useState } from 'react';
import { ITProject, TaskStatus, ProcessStep } from '../types';
import { STATUS_CONFIG } from '../utils';
import { 
  Calendar, 
  User, 
  AlertTriangle, 
  CheckSquare, 
  ChevronRight, 
  ChevronLeft, 
  Briefcase,
  Search,
  Filter
} from 'lucide-react';

interface KanbanItem {
  project: ITProject;
  phaseId: string;
  phaseName: string;
  step: ProcessStep;
}

interface KanbanBoardViewProps {
  projects: ITProject[];
  onUpdateProject: (updated: ITProject) => void;
  selectedProjectId?: string;
}

const KANBAN_COLUMNS: Array<{ status: TaskStatus; title: string; color: string; border: string }> = [
  { status: 'not_started', title: 'Not Started', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', border: 'border-slate-300 dark:border-slate-700' },
  { status: 'in_progress', title: 'In Progress', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', border: 'border-blue-400 dark:border-blue-700' },
  { status: 'waiting', title: 'Waiting', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300', border: 'border-amber-400 dark:border-amber-700' },
  { status: 'review_qa', title: 'Review / QA', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300', border: 'border-purple-400 dark:border-purple-700' },
  { status: 'on_hold', title: 'On Hold', color: 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300', border: 'border-amber-400 dark:border-amber-700' },
  { status: 'completed', title: 'Completed', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300', border: 'border-emerald-400 dark:border-emerald-700' }
];

export const KanbanBoardView: React.FC<KanbanBoardViewProps> = ({
  projects,
  onUpdateProject,
  selectedProjectId
}) => {
  const [activeProjectFilter, setActiveProjectFilter] = useState<string>(selectedProjectId || 'all');
  const [searchQuery, setSearchQuery] = useState('');

  // Extract all items from projects
  const allItems: KanbanItem[] = [];
  projects.forEach(project => {
    if (activeProjectFilter !== 'all' && project.id !== activeProjectFilter) {
      return;
    }
    (project.phases || []).forEach(phase => {
      (phase.steps || []).forEach(step => {
        allItems.push({
          project,
          phaseId: phase.id,
          phaseName: phase.name,
          step
        });
      });
    });
  });

  // Filter items by search
  const filteredItems = allItems.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.step.title.toLowerCase().includes(q) ||
      item.project.name.toLowerCase().includes(q) ||
      item.phaseName.toLowerCase().includes(q) ||
      (item.step.personResponsible || '').toLowerCase().includes(q) ||
      (item.step.blockedReason || '').toLowerCase().includes(q)
    );
  });

  // Handle status move
  const handleMoveStatus = (item: KanbanItem, newStatus: TaskStatus) => {
    const targetStatus = newStatus === 'blocked' ? 'on_hold' : newStatus;
    let blockedReason = item.step.blockedReason;
    if (targetStatus === 'on_hold' || targetStatus === 'waiting') {
      const reason = prompt(`Enter ${targetStatus === 'on_hold' ? 'on-hold' : 'waiting'} reason:`, blockedReason || '');
      if (reason === null) return;
      blockedReason = reason;
    }

    const updatedPhases = item.project.phases.map(phase => {
      if (phase.id !== item.phaseId) return phase;
      const updatedSteps = phase.steps.map(step => {
        if (step.id !== item.step.id) return step;
        return {
          ...step,
          status: targetStatus,
          blockedReason: (targetStatus === 'on_hold' || targetStatus === 'waiting') ? blockedReason : undefined,
          completedDate: targetStatus === 'completed' ? new Date().toISOString().split('T')[0] : step.completedDate
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
      {/* Kanban Filters Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Project Filter */}
          {!selectedProjectId && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-blue-500" />
                Project:
              </span>
              <select
                value={activeProjectFilter}
                onChange={(e) => setActiveProjectFilter(e.target.value)}
                className="text-xs font-bold px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All Projects ({projects.length})</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Search Box */}
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks, assignees, blockers..."
              className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Showing <span className="font-bold text-slate-900 dark:text-white">{filteredItems.length}</span> workflow items
        </div>
      </div>

      {/* 6 Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-start">
        {KANBAN_COLUMNS.map((col, colIdx) => {
          const colItems = filteredItems.filter(item => {
            const normStatus = item.step.status === 'blocked' ? 'on_hold' : item.step.status;
            return normStatus === col.status;
          });
          const statusConf = STATUS_CONFIG[col.status];

          return (
            <div 
              key={col.status}
              className="bg-slate-50/80 dark:bg-slate-900/60 rounded-xl p-3 border border-slate-200 dark:border-slate-700/80 min-h-[500px] flex flex-col"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{statusConf.emoji}</span>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    {col.title}
                  </h4>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.color}`}>
                  {colItems.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="space-y-3 flex-1 overflow-y-auto">
                {colItems.length === 0 ? (
                  <div className="h-32 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-slate-400 text-xs italic">
                    No items
                  </div>
                ) : (
                  colItems.map(item => {
                    const completedSubtasks = (item.step.subtasks || []).filter(s => s.completed).length;
                    const totalSubtasks = (item.step.subtasks || []).length;
                    const isPastDue = item.step.dueDate && new Date(item.step.dueDate).getTime() < Date.now() && item.step.status !== 'completed';

                    return (
                      <div
                        key={item.step.id}
                        className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between gap-2.5"
                      >
                        {/* Project & Phase Badges */}
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 max-w-[130px] truncate">
                              {item.project.name}
                            </span>
                            <span className="text-[9px] text-slate-400 truncate max-w-[90px]">
                              {item.phaseName}
                            </span>
                          </div>

                          <h5 className={`text-xs font-bold leading-snug ${
                            item.step.status === 'completed' 
                              ? 'text-slate-400 line-through' 
                              : 'text-slate-900 dark:text-white'
                          }`}>
                            {item.step.title}
                          </h5>

                          {/* On Hold or Waiting Reason Banner */}
                          {(item.step.status === 'blocked' || item.step.status === 'on_hold' || item.step.status === 'waiting') && item.step.blockedReason && (
                            <div className="mt-2 p-1.5 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                              <span className="font-bold block text-[10px] text-amber-600 dark:text-amber-400">
                                {item.step.status === 'waiting' ? 'Waiting on:' : 'On Hold Reason:'}
                              </span>
                              {item.step.blockedReason}
                            </div>
                          )}
                        </div>

                        {/* Card Footer: Subtasks, Assignee, Dates */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex flex-col gap-2">
                          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                            {totalSubtasks > 0 ? (
                              <span className="flex items-center gap-1 font-bold text-slate-600 dark:text-slate-300">
                                <CheckSquare className="w-3 h-3 text-blue-500" />
                                {completedSubtasks}/{totalSubtasks}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">Step</span>
                            )}

                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-400" />
                              <span className="max-w-[70px] truncate">{item.step.personResponsible || item.project.projectOwner}</span>
                            </div>
                          </div>

                          {item.step.dueDate && (
                            <div className={`flex items-center gap-1 text-[10px] font-medium ${
                              isPastDue ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-400'
                            }`}>
                              <Calendar className="w-3 h-3 shrink-0" />
                              <span>{item.step.dueDate}</span>
                              {isPastDue && <span className="text-[8px] uppercase bg-red-100 dark:bg-red-900 px-1 py-0.2 rounded font-black">Overdue</span>}
                            </div>
                          )}

                          {/* Move Status Controls */}
                          <div className="flex items-center justify-between pt-1">
                            <button
                              disabled={colIdx === 0}
                              onClick={() => handleMoveStatus(item, KANBAN_COLUMNS[colIdx - 1].status)}
                              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-20 disabled:hover:text-slate-400"
                              title="Move back"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>

                            {/* Dropdown status selector */}
                            <select
                              value={item.step.status === 'blocked' ? 'on_hold' : item.step.status}
                              onChange={(e) => handleMoveStatus(item, e.target.value as TaskStatus)}
                              className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded border-0 outline-none cursor-pointer"
                            >
                              {KANBAN_COLUMNS.map(c => (
                                <option key={c.status} value={c.status}>{c.title}</option>
                              ))}
                            </select>

                            <button
                              disabled={colIdx === KANBAN_COLUMNS.length - 1}
                              onClick={() => handleMoveStatus(item, KANBAN_COLUMNS[colIdx + 1].status)}
                              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-20 disabled:hover:text-slate-400"
                              title="Move forward"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
