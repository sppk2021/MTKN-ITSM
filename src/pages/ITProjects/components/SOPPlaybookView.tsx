import React, { useState } from 'react';
import { ITProject, ProjectPhase, SOPTask, PhaseGate } from '../types';
import { 
  CheckCircle2, Circle, Lock, Unlock, UserCheck, 
  FileText, ShieldCheck, Plus, Check, Edit2, AlertCircle 
} from 'lucide-react';
import { format } from 'date-fns';

interface SOPPlaybookViewProps {
  project: ITProject;
  users: Array<{ id: string; name: string; email?: string; role?: string }>;
  onUpdateProject: (updatedProject: ITProject) => Promise<void>;
  currentUser?: { uid?: string; displayName?: string; email?: string } | null;
}

export default function SOPPlaybookView({
  project,
  users,
  onUpdateProject,
  currentUser
}: SOPPlaybookViewProps) {
  const [activePhaseId, setActivePhaseId] = useState<string>(project.phases[0]?.id || '');
  const [actionLoading, setActionLoading] = useState(false);

  // Update Task Status
  const handleTaskStatusChange = async (phaseId: string, taskId: string, newStatus: any) => {
    const updatedPhases = project.phases.map(phase => {
      if (phase.id === phaseId) {
        const updatedTasks = phase.tasks.map(task => {
          if (task.id === taskId) {
            return { ...task, status: newStatus };
          }
          return task;
        });

        // Compute phase status based on tasks
        const allCompleted = updatedTasks.every(t => t.status === 'completed');
        const anyStarted = updatedTasks.some(t => t.status !== 'not_started');
        const phaseStatus = allCompleted ? 'completed' : anyStarted ? 'in_progress' : 'not_started';

        return {
          ...phase,
          tasks: updatedTasks,
          status: phaseStatus as any
        };
      }
      return phase;
    });

    await onUpdateProject({
      ...project,
      phases: updatedPhases
    });
  };

  // Update Task Owner
  const handleTaskOwnerChange = async (phaseId: string, taskId: string, ownerName: string) => {
    const updatedPhases = project.phases.map(phase => {
      if (phase.id === phaseId) {
        const updatedTasks = phase.tasks.map(task => {
          if (task.id === taskId) {
            return { ...task, ownerName };
          }
          return task;
        });
        return { ...phase, tasks: updatedTasks };
      }
      return phase;
    });

    await onUpdateProject({
      ...project,
      phases: updatedPhases
    });
  };

  // Change Gate Assigned Approver (Manual Select button)
  const handleGateApproverChange = async (phaseId: string, assignedApprover: string) => {
    const updatedPhases = project.phases.map(phase => {
      if (phase.id === phaseId && phase.gate) {
        return {
          ...phase,
          gate: {
            ...phase.gate,
            assignedApprover
          }
        };
      }
      return phase;
    });

    await onUpdateProject({
      ...project,
      phases: updatedPhases
    });
  };

  // Manual Gate Sign-off / Approval Action
  const handleToggleGateApproval = async (phaseId: string, isApproved: boolean) => {
    setActionLoading(true);
    try {
      const approverName = currentUser?.displayName || currentUser?.email || 'Approver';
      const updatedPhases = project.phases.map(phase => {
        if (phase.id === phaseId && phase.gate) {
          return {
            ...phase,
            gate: {
              ...phase.gate,
              isApproved,
              approvedBy: isApproved ? (phase.gate.assignedApprover || approverName) : undefined,
              approvedAt: isApproved ? new Date().toISOString() : undefined
            }
          };
        }
        return phase;
      });

      await onUpdateProject({
        ...project,
        phases: updatedPhases
      });
    } catch (error) {
      console.error('Error updating gate approval:', error);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Standard Operating Procedures (SOP) Playbook & Phase Gates
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Execute step-by-step SOP tasks. Each phase includes a manual approver selection button for personnel sign-off.
          </p>
        </div>
      </div>

      {/* Phase Cards */}
      <div className="space-y-6">
        {project.phases.map((phase, phaseIdx) => {
          const isPhaseCompleted = phase.status === 'completed';
          const isGateApproved = phase.gate?.isApproved;

          return (
            <div
              key={phase.id}
              id={`phase-card-${phase.id}`}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden"
            >
              {/* Phase Header */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 text-xs font-black flex items-center justify-center">
                    {phaseIdx + 1}
                  </span>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      {phase.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {phase.tasks.filter(t => t.status === 'completed').length} of {phase.tasks.length} tasks completed
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[10px] uppercase font-extrabold px-2.5 py-1 rounded-full border ${
                    isPhaseCompleted 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' 
                      : phase.status === 'in_progress'
                      ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                      : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                  }`}>
                    {phase.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Tasks List */}
              <div className="p-4 sm:p-5 space-y-3">
                {phase.tasks.map((task, taskIdx) => (
                  <div
                    key={task.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      task.status === 'completed'
                        ? 'bg-slate-50/60 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800 opacity-90'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 shadow-xs'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <button
                          onClick={() => handleTaskStatusChange(phase.id, task.id, task.status === 'completed' ? 'in_progress' : 'completed')}
                          className="mt-0.5 text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors shrink-0"
                          title="Toggle Completion"
                        >
                          {task.status === 'completed' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold ${task.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-900 dark:text-white'}`}>
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                              {task.description}
                            </p>
                          )}

                          {/* Mandatory Documents required */}
                          {task.requiredDocs && task.requiredDocs.length > 0 && (
                            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] text-slate-400 font-semibold uppercase">Required:</span>
                              {task.requiredDocs.map(doc => (
                                <span
                                  key={doc}
                                  className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-900"
                                >
                                  <FileText className="w-3 h-3" /> {doc}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Task Controls: Status & Owner */}
                      <div className="flex items-center gap-2 shrink-0 sm:self-start">
                        {/* Task Owner select */}
                        <select
                          value={task.ownerName || ''}
                          onChange={(e) => handleTaskOwnerChange(phase.id, task.id, e.target.value)}
                          className="text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 outline-none"
                        >
                          <option value="">Assign Owner...</option>
                          <option value={project.projectManagerName || 'Project Manager'}>
                            {project.projectManagerName || 'Project Manager'}
                          </option>
                          {users.map(u => (
                            <option key={u.id} value={u.name || u.email}>
                              {u.name || u.email}
                            </option>
                          ))}
                        </select>

                        {/* Task Status */}
                        <select
                          value={task.status}
                          onChange={(e) => handleTaskStatusChange(phase.id, task.id, e.target.value as any)}
                          className={`text-xs font-bold rounded-lg px-2.5 py-1 border outline-none ${
                            task.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                              : task.status === 'in_progress'
                              ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <option value="not_started">Not Started</option>
                          <option value="in_progress">In Progress</option>
                          <option value="pending_review">Pending Review</option>
                          <option value="completed">Completed</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Phase Gate Section with Manual Approver Selection */}
                {phase.gate && (
                  <div className={`mt-6 p-4 sm:p-5 rounded-2xl border-2 transition-all ${
                    isGateApproved
                      ? 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/50'
                      : 'border-amber-200 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-900/50'
                  }`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-lg ${isGateApproved ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'}`}>
                          {isGateApproved ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        </div>
                        <div>
                          <h4 className={`text-sm font-extrabold ${isGateApproved ? 'text-emerald-900 dark:text-emerald-300' : 'text-amber-900 dark:text-amber-300'}`}>
                            Phase Gate: {phase.gate.name}
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Mandatory milestone check before proceeding to next project phase
                          </p>
                        </div>
                      </div>

                      {/* Manual Approver Selection Dropdown Button */}
                      <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs">
                        <UserCheck className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          Approver:
                        </span>
                        <select
                          id={`select-gate-approver-${phase.id}`}
                          value={phase.gate.assignedApprover || ''}
                          disabled={isGateApproved}
                          onChange={(e) => handleGateApproverChange(phase.id, e.target.value)}
                          className="text-xs font-bold bg-transparent text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                        >
                          <option value={project.sponsorName || 'Project Sponsor'}>
                            {project.sponsorName ? `${project.sponsorName} (Sponsor)` : 'Project Sponsor'}
                          </option>
                          <option value={project.projectManagerName || 'Project Manager'}>
                            {project.projectManagerName ? `${project.projectManagerName} (PM)` : 'Project Manager'}
                          </option>
                          <option value="IT Director">IT Director</option>
                          <option value="Architecture Review Board">Architecture Review Board</option>
                          {users.map(u => (
                            <option key={u.id} value={u.name || u.email}>
                              {u.name || u.email} ({u.role || 'Staff'})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Conditions checklist */}
                    <div className="space-y-1.5 my-3 pl-1">
                      {phase.gate.conditions.map((cond, condIdx) => (
                        <div key={condIdx} className="flex items-center gap-2 text-xs">
                          {isGateApproved ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <Circle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          )}
                          <span className={isGateApproved ? 'text-emerald-800 dark:text-emerald-300 font-medium' : 'text-amber-900 dark:text-amber-200 font-medium'}>
                            {cond}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Sign-off / Manual Action Footer */}
                    <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {isGateApproved ? (
                          <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                            <Check className="w-4 h-4" /> Signed off by {phase.gate.approvedBy || phase.gate.assignedApprover || 'Approver'}{' '}
                            {phase.gate.approvedAt && `on ${format(new Date(phase.gate.approvedAt), 'MMM dd, yyyy')}`}
                          </span>
                        ) : (
                          <span className="italic text-slate-500">
                            Awaiting manual sign-off by {phase.gate.assignedApprover || 'designated approver'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {isGateApproved ? (
                          <button
                            onClick={() => handleToggleGateApproval(phase.id, false)}
                            disabled={actionLoading}
                            className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-red-600 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
                          >
                            Revoke Sign-off
                          </button>
                        ) : (
                          <button
                            id={`btn-approve-gate-${phase.id}`}
                            onClick={() => handleToggleGateApproval(phase.id, true)}
                            disabled={actionLoading}
                            className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all flex items-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Approve Phase Gate
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
