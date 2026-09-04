import React, { useState } from 'react';
import { ITProject, ProjectPhase, ProcessStep, TaskStatus, Subtask } from '../types';
import { STATUS_CONFIG } from '../utils';
import { 
  ChevronDown, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Calendar, 
  User, 
  AlertTriangle, 
  CheckSquare, 
  Square,
  Paperclip,
  Clock,
  Layers
} from 'lucide-react';

interface ProcessHierarchyViewProps {
  project: ITProject;
  onUpdateProject: (updated: ITProject) => void;
  canEdit?: boolean;
}

export const ProcessHierarchyView: React.FC<ProcessHierarchyViewProps> = ({
  project,
  onUpdateProject,
  canEdit = true
}) => {
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    (project.phases || []).forEach(p => {
      initial[p.id] = true;
    });
    return initial;
  });

  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    (project.phases || []).forEach(p => {
      (p.steps || []).forEach(s => {
        initial[s.id] = true;
      });
    });
    return initial;
  });

  // State for adding subtask inline
  const [newSubtaskTitle, setNewSubtaskTitle] = useState<Record<string, string>>({});
  // State for on hold / waiting reason modal or inline
  const [activeReasonModal, setActiveReasonModal] = useState<{
    stepId: string;
    status: 'blocked' | 'on_hold' | 'waiting';
    reason: string;
  } | null>(null);

  // Toggle Phase collapse
  const togglePhase = (phaseId: string) => {
    setExpandedPhases(prev => ({ ...prev, [phaseId]: !prev[phaseId] }));
  };

  // Toggle Step collapse
  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  // Update a step's status
  const handleStatusChange = (phaseId: string, stepId: string, newStatus: TaskStatus) => {
    if (newStatus === 'blocked' || newStatus === 'on_hold' || newStatus === 'waiting') {
      // Find current step's reason if any
      const phase = project.phases.find(p => p.id === phaseId);
      const step = phase?.steps.find(s => s.id === stepId);
      setActiveReasonModal({
        stepId,
        status: newStatus === 'blocked' ? 'on_hold' : newStatus,
        reason: step?.blockedReason || ''
      });
      return;
    }

    applyStepUpdate(phaseId, stepId, {
      status: newStatus,
      completedDate: newStatus === 'completed' ? new Date().toISOString().split('T')[0] : undefined,
      blockedReason: undefined
    });
  };

  // Apply changes to a specific step
  const applyStepUpdate = (phaseId: string, stepId: string, updates: Partial<ProcessStep>) => {
    const updatedPhases = project.phases.map(phase => {
      if (phase.id !== phaseId) return phase;
      const updatedSteps = phase.steps.map(step => {
        if (step.id !== stepId) return step;
        return { ...step, ...updates };
      });
      return { ...phase, steps: updatedSteps };
    });

    const updatedProject: ITProject = {
      ...project,
      phases: updatedPhases,
      updatedAt: new Date().toISOString()
    };
    onUpdateProject(updatedProject);
  };

  // Save blocked reason
  const handleSaveBlockedReason = () => {
    if (!activeReasonModal) return;
    const { stepId, status, reason } = activeReasonModal;

    const updatedPhases = project.phases.map(phase => {
      const stepIdx = phase.steps.findIndex(s => s.id === stepId);
      if (stepIdx === -1) return phase;

      const updatedSteps = [...phase.steps];
      updatedSteps[stepIdx] = {
        ...updatedSteps[stepIdx],
        status,
        blockedReason: reason.trim() || `Flagged as ${status}`
      };
      return { ...phase, steps: updatedSteps };
    });

    onUpdateProject({
      ...project,
      phases: updatedPhases,
      updatedAt: new Date().toISOString()
    });
    setActiveReasonModal(null);
  };

  // Toggle Subtask Completion
  const handleToggleSubtask = (phaseId: string, stepId: string, subtaskId: string) => {
    const phase = project.phases.find(p => p.id === phaseId);
    const step = phase?.steps.find(s => s.id === stepId);
    if (!step) return;

    const updatedSubtasks = step.subtasks.map(sub => {
      if (sub.id !== subtaskId) return sub;
      return { ...sub, completed: !sub.completed };
    });

    // Check if all subtasks are completed, if so auto-complete step or advance
    const allCompleted = updatedSubtasks.length > 0 && updatedSubtasks.every(s => s.completed);
    const newStepStatus = allCompleted ? 'completed' : step.status === 'not_started' ? 'in_progress' : step.status;

    applyStepUpdate(phaseId, stepId, {
      subtasks: updatedSubtasks,
      status: newStepStatus,
      completedDate: allCompleted ? new Date().toISOString().split('T')[0] : step.completedDate
    });
  };

  // Add new Subtask
  const handleAddSubtask = (phaseId: string, stepId: string) => {
    const title = (newSubtaskTitle[stepId] || '').trim();
    if (!title) return;

    const phase = project.phases.find(p => p.id === phaseId);
    const step = phase?.steps.find(s => s.id === stepId);
    if (!step) return;

    const newSub: Subtask = {
      id: `sub_${Math.random().toString(36).substring(2, 9)}`,
      title,
      completed: false,
      assignedTo: step.personResponsible
    };

    applyStepUpdate(phaseId, stepId, {
      subtasks: [...(step.subtasks || []), newSub]
    });

    setNewSubtaskTitle(prev => ({ ...prev, [stepId]: '' }));
  };

  // Delete Subtask
  const handleDeleteSubtask = (phaseId: string, stepId: string, subtaskId: string) => {
    const phase = project.phases.find(p => p.id === phaseId);
    const step = phase?.steps.find(s => s.id === stepId);
    if (!step) return;

    const updatedSubtasks = step.subtasks.filter(s => s.id !== subtaskId);
    applyStepUpdate(phaseId, stepId, { subtasks: updatedSubtasks });
  };

  // Add new Step to Phase
  const handleAddStepToPhase = (phaseId: string) => {
    const title = prompt('Enter new step title:');
    if (!title?.trim()) return;

    const phase = project.phases.find(p => p.id === phaseId);
    if (!phase) return;

    const newStep: ProcessStep = {
      id: `step_${Math.random().toString(36).substring(2, 9)}`,
      title: title.trim(),
      phaseId,
      phaseName: phase.name,
      status: 'not_started',
      personResponsible: project.projectOwner,
      startDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      subtasks: [],
      order: (phase.steps.length || 0) + 1
    };

    const updatedPhases = project.phases.map(p => {
      if (p.id !== phaseId) return p;
      return { ...p, steps: [...p.steps, newStep] };
    });

    onUpdateProject({
      ...project,
      phases: updatedPhases,
      updatedAt: new Date().toISOString()
    });
  };

  // Add new Phase to Project
  const handleAddPhase = () => {
    const name = prompt('Enter phase name (e.g., "Phase 3 — Enterprise Integration"):');
    if (!name?.trim()) return;

    const newPhase: ProjectPhase = {
      id: `phase_${Math.random().toString(36).substring(2, 9)}`,
      name: name.trim(),
      order: project.phases.length + 1,
      steps: []
    };

    onUpdateProject({
      ...project,
      phases: [...project.phases, newPhase],
      updatedAt: new Date().toISOString()
    });
  };

  return (
    <div className="space-y-6">
      {/* Phases and Steps Container */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Project Process & Task Hierarchy
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Structured workflow pipeline: Project → Phase → Process Step → Subtasks
          </p>
        </div>
        {canEdit && (
          <button
            onClick={handleAddPhase}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 text-xs font-bold border border-blue-200 dark:border-blue-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Phase
          </button>
        )}
      </div>

      <div className="space-y-4">
        {project.phases && project.phases.map((phase, pIndex) => {
          const isPhaseExpanded = expandedPhases[phase.id] !== false;
          const phaseSteps = phase.steps || [];
          const phaseCompletedSteps = phaseSteps.filter(s => s.status === 'completed').length;
          const phaseProgress = phaseSteps.length > 0 ? Math.round((phaseCompletedSteps / phaseSteps.length) * 100) : 0;

          return (
            <div 
              key={phase.id} 
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden"
            >
              {/* Phase Header */}
              <div 
                onClick={() => togglePhase(phase.id)}
                className="p-4 bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <button className="text-slate-500 hover:text-slate-700 dark:text-slate-400">
                    {isPhaseExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-black flex items-center justify-center">
                    {pIndex + 1}
                  </span>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      {phase.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {phaseSteps.length} step(s) • {phaseCompletedSteps} completed
                    </p>
                  </div>
                </div>

                {/* Phase Progress bar */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 min-w-[120px]">
                    <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${phaseProgress}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 w-9 text-right">
                      {phaseProgress}%
                    </span>
                  </div>

                  {canEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddStepToPhase(phase.id);
                      }}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 bg-white dark:bg-slate-800 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 shadow-sm"
                    >
                      <Plus className="w-3 h-3" />
                      Add Step
                    </button>
                  )}
                </div>
              </div>

              {/* Phase Steps List */}
              {isPhaseExpanded && (
                <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {phaseSteps.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs italic">
                      No steps in this phase yet. Click "+ Add Step" to add one.
                    </div>
                  ) : (
                    phaseSteps.map((step, sIndex) => {
                      const isStepExpanded = expandedSteps[step.id] !== false;
                      const statusConf = STATUS_CONFIG[step.status] || STATUS_CONFIG.not_started;
                      const completedSubtasks = (step.subtasks || []).filter(st => st.completed).length;
                      const totalSubtasks = (step.subtasks || []).length;

                      return (
                        <div key={step.id} className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                            {/* Step Title & Details */}
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <button
                                onClick={() => toggleStep(step.id)}
                                className="mt-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                              >
                                {isStepExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-bold text-slate-400">
                                    {pIndex + 1}.{sIndex + 1}
                                  </span>
                                  <h5 className={`text-sm font-bold ${
                                    step.status === 'completed' 
                                      ? 'text-slate-500 dark:text-slate-400 line-through' 
                                      : 'text-slate-900 dark:text-white'
                                  }`}>
                                    {step.title}
                                  </h5>

                                  {/* Subtasks summary badge */}
                                  {totalSubtasks > 0 && (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      completedSubtasks === totalSubtasks
                                        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                    }`}>
                                      {completedSubtasks}/{totalSubtasks} subtasks
                                    </span>
                                  )}
                                </div>

                                {step.description && (
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    {step.description}
                                  </p>
                                )}

                                {/* On Hold or Waiting Reason Banner */}
                                {(step.status === 'blocked' || step.status === 'on_hold' || step.status === 'waiting') && step.blockedReason && (
                                  <div className="mt-2 inline-flex items-center gap-1.5 p-2 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300">
                                    <Clock className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                                    <span><strong>{step.status === 'waiting' ? 'Waiting on:' : 'On Hold Reason:'}</strong> {step.blockedReason}</span>
                                    {canEdit && (
                                      <button
                                        onClick={() => setActiveReasonModal({
                                          stepId: step.id,
                                          status: (step.status === 'blocked' ? 'on_hold' : step.status) as 'on_hold' | 'waiting',
                                          reason: step.blockedReason || ''
                                        })}
                                        className="underline ml-1 font-bold hover:text-amber-900 dark:hover:text-amber-200"
                                      >
                                        Edit
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Controls: Status, Person, Dates */}
                            <div className="flex flex-wrap items-center gap-3 self-start lg:self-center pl-7 lg:pl-0">
                              {/* Person Responsible */}
                              <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/60 px-2 py-1 rounded">
                                <User className="w-3 h-3 text-slate-400" />
                                <span className="max-w-[120px] truncate">{step.personResponsible || project.projectOwner}</span>
                              </div>

                              {/* Due Date */}
                              <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/60 px-2 py-1 rounded">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                <span>{step.dueDate ? step.dueDate : 'No date'}</span>
                              </div>

                              {/* Status Dropdown */}
                              {canEdit ? (
                                <select
                                  value={step.status === 'blocked' ? 'on_hold' : step.status}
                                  onChange={(e) => handleStatusChange(phase.id, step.id, e.target.value as TaskStatus)}
                                  className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer ${statusConf.badgeClass} ${statusConf.borderClass}`}
                                >
                                  <option value="not_started">⚪ Not Started</option>
                                  <option value="in_progress">🔵 In Progress</option>
                                  <option value="waiting">🟡 Waiting</option>
                                  <option value="review_qa">🟣 Review / QA</option>
                                  <option value="completed">🟢 Completed</option>
                                  <option value="on_hold">⏸️ On Hold</option>
                                  <option value="cancelled">⚫ Cancelled</option>
                                </select>
                              ) : (
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${statusConf.badgeClass}`}>
                                  {statusConf.emoji} {statusConf.label}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Subtasks Checklist Section */}
                          {isStepExpanded && (
                            <div className="mt-3 pl-7 space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                                Subtasks & Action Items:
                              </span>

                              <div className="space-y-1.5">
                                {(step.subtasks || []).map(sub => (
                                  <div 
                                    key={sub.id} 
                                    className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors text-xs"
                                  >
                                    <button
                                      onClick={() => handleToggleSubtask(phase.id, step.id, sub.id)}
                                      className="flex items-center gap-2 flex-1 text-left min-w-0"
                                    >
                                      {sub.completed ? (
                                        <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                      ) : (
                                        <Square className="w-4 h-4 text-slate-400 hover:text-blue-500 shrink-0" />
                                      )}
                                      <span className={`truncate ${
                                        sub.completed 
                                          ? 'text-slate-400 line-through' 
                                          : 'text-slate-700 dark:text-slate-200 font-medium'
                                      }`}>
                                        {sub.title}
                                      </span>
                                    </button>

                                    {canEdit && (
                                      <button
                                        onClick={() => handleDeleteSubtask(phase.id, step.id, sub.id)}
                                        className="text-slate-400 hover:text-red-500 p-1 rounded"
                                        title="Delete Subtask"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {/* Add Subtask Input */}
                              {canEdit && (
                                <div className="flex items-center gap-2 mt-2 pt-1">
                                  <input
                                    type="text"
                                    placeholder="Add new subtask and press Enter..."
                                    value={newSubtaskTitle[step.id] || ''}
                                    onChange={(e) => setNewSubtaskTitle({ ...newSubtaskTitle, [step.id]: e.target.value })}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleAddSubtask(phase.id, step.id);
                                      }
                                    }}
                                    className="flex-1 text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                  <button
                                    onClick={() => handleAddSubtask(phase.id, step.id)}
                                    className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-md text-xs font-bold transition-colors shrink-0"
                                  >
                                    Add
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* On Hold / Waiting Reason Modal */}
      {activeReasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-amber-500" />
              Set {activeReasonModal.status === 'waiting' ? 'Waiting' : 'On Hold'} Reason
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Please specify the reason or dependency holding up this task so the team has transparent visibility.
            </p>

            <textarea
              value={activeReasonModal.reason}
              onChange={(e) => setActiveReasonModal({ ...activeReasonModal, reason: e.target.value })}
              placeholder={
                activeReasonModal.status === 'waiting'
                  ? 'e.g. Waiting for client written information and product photos'
                  : 'e.g. Pending remote database server credentials from external vendor'
              }
              rows={3}
              className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none mb-4"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveReasonModal(null)}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBlockedReason}
                className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm"
              >
                Confirm & Set
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
