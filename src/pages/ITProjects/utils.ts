import { ITProject, TaskStatus, ProjectHealth, ProcessStep } from './types';
import { differenceInDays } from 'date-fns';

export interface TaskCounts {
  total: number;
  completed: number;
  inProgress: number;
  waiting: number;
  reviewQa: number;
  onHold: number;
  blocked: number;
  notStarted: number;
  cancelled: number;
}

export const STATUS_CONFIG: Record<TaskStatus, {
  label: string;
  badgeClass: string;
  borderClass: string;
  dotColor: string;
  emoji: string;
}> = {
  not_started: {
    label: 'Not Started',
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    borderClass: 'border-slate-300 dark:border-slate-700',
    dotColor: 'bg-slate-400',
    emoji: '⚪'
  },
  in_progress: {
    label: 'In Progress',
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    borderClass: 'border-blue-300 dark:border-blue-700',
    dotColor: 'bg-blue-500',
    emoji: '🔵'
  },
  waiting: {
    label: 'Waiting',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    borderClass: 'border-amber-300 dark:border-amber-700',
    dotColor: 'bg-amber-500',
    emoji: '🟡'
  },
  review_qa: {
    label: 'Review / QA',
    badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
    borderClass: 'border-purple-300 dark:border-purple-700',
    dotColor: 'bg-purple-500',
    emoji: '🟣'
  },
  completed: {
    label: 'Completed',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    borderClass: 'border-emerald-300 dark:border-emerald-700',
    dotColor: 'bg-emerald-500',
    emoji: '🟢'
  },
  on_hold: {
    label: 'On Hold',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    borderClass: 'border-amber-300 dark:border-amber-700',
    dotColor: 'bg-amber-500',
    emoji: '⏸️'
  },
  blocked: {
    label: 'On Hold',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    borderClass: 'border-amber-300 dark:border-amber-700',
    dotColor: 'bg-amber-500',
    emoji: '⏸️'
  },
  cancelled: {
    label: 'Cancelled',
    badgeClass: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
    borderClass: 'border-slate-400 dark:border-slate-600',
    dotColor: 'bg-slate-600',
    emoji: '⚫'
  }
};

/**
 * Calculates exact task progress % and task counts across all steps & subtasks
 * Formula: Progress = Completed Tasks ÷ Total Tasks × 100
 */
export function calculateProjectMetrics(project: ITProject) {
  const counts: TaskCounts = {
    total: 0,
    completed: 0,
    inProgress: 0,
    waiting: 0,
    reviewQa: 0,
    onHold: 0,
    blocked: 0,
    notStarted: 0,
    cancelled: 0
  };

  const allSteps: ProcessStep[] = [];
  const blockedItems: Array<{
    stepId: string;
    stepTitle: string;
    phaseName: string;
    status: 'blocked' | 'waiting' | 'on_hold';
    reason: string;
    personResponsible?: string;
  }> = [];

  if (project.phases && Array.isArray(project.phases)) {
    project.phases.forEach(phase => {
      const steps = phase.steps || (phase.tasks as any) || [];
      steps.forEach((step: ProcessStep) => {
        allSteps.push(step);

        // Check if step is on_hold, blocked or waiting
        if (step.status === 'blocked' || step.status === 'on_hold' || step.status === 'waiting') {
          blockedItems.push({
            stepId: step.id,
            stepTitle: step.title,
            phaseName: phase.name,
            status: (step.status === 'blocked' ? 'on_hold' : step.status) as any,
            reason: step.blockedReason || (step.status === 'waiting' ? 'Waiting for external input' : 'Task on hold'),
            personResponsible: step.personResponsible
          });
        }

        // Subtask breakdown
        if (step.subtasks && step.subtasks.length > 0) {
          step.subtasks.forEach(sub => {
            counts.total++;
            if (sub.completed) {
              counts.completed++;
            } else {
              // Map to step's active status
              if (step.status === 'in_progress') counts.inProgress++;
              else if (step.status === 'waiting') counts.waiting++;
              else if (step.status === 'review_qa') counts.reviewQa++;
              else if (step.status === 'on_hold' || step.status === 'blocked') { counts.onHold++; counts.blocked++; }
              else counts.notStarted++;
            }
          });
        } else {
          // If no subtasks, count the step itself as a task unit
          counts.total++;
          if (step.status === 'completed') counts.completed++;
          else if (step.status === 'in_progress') counts.inProgress++;
          else if (step.status === 'waiting') counts.waiting++;
          else if (step.status === 'review_qa') counts.reviewQa++;
          else if (step.status === 'on_hold' || step.status === 'blocked') { counts.onHold++; counts.blocked++; }
          else if (step.status === 'cancelled') counts.cancelled++;
          else counts.notStarted++;
        }
      });
    });
  }

  // Progress percentage = Completed ÷ Total × 100
  const progressPercent = counts.total > 0 
    ? Math.round((counts.completed / counts.total) * 100) 
    : (project.progressPercent || 0);

  // Target date & overdue analysis
  const targetDateStr = project.targetDate || project.targetEndDate;
  const now = new Date();
  let daysUntilEnd = 999;
  let isOverdue = false;
  let overdueDays = 0;

  if (targetDateStr) {
    try {
      const targetDate = new Date(targetDateStr);
      daysUntilEnd = differenceInDays(targetDate, now);
      if (daysUntilEnd < 0 && progressPercent < 100 && project.status !== 'completed' && project.status !== 'cancelled') {
        isOverdue = true;
        overdueDays = Math.abs(daysUntilEnd);
      }
    } catch {
      // ignore
    }
  }

  // Health assessment
  let health: ProjectHealth = 'green';
  const insights: string[] = [];

  if (counts.onHold > 0 || counts.blocked > 0) {
    health = 'red';
    const holdCount = counts.onHold || counts.blocked;
    insights.push(`${holdCount} task(s) currently on hold`);
  }
  if (isOverdue) {
    health = 'red';
    insights.push(`Project is overdue by ${overdueDays} day(s)`);
  }

  if (health !== 'red') {
    if (counts.waiting > 0) {
      health = 'amber';
      insights.push(`${counts.waiting} task(s) in waiting state`);
    } else if (daysUntilEnd <= 7 && daysUntilEnd >= 0 && progressPercent < 80) {
      health = 'amber';
      insights.push(`Target deadline in ${daysUntilEnd} day(s), progress is ${progressPercent}%`);
    }
  }

  if (health === 'green') {
    insights.push('All active phases and steps are on track');
  }

  return {
    progressPercent,
    counts,
    health,
    isOverdue,
    overdueDays,
    daysUntilEnd,
    insights,
    allSteps,
    blockedItems
  };
}

/**
 * Extracts "What have I done?", "What am I doing now?", "What remains?", and "What is blocked?"
 */
export function extractWhatRemains(project: ITProject) {
  const completed: Array<{ id: string; title: string; phase: string; type: 'step' | 'subtask' }> = [];
  const current: Array<{ id: string; title: string; phase: string; details?: string }> = [];
  const remaining: Array<{ id: string; title: string; phase: string; status: TaskStatus }> = [];
  const blocked: Array<{ id: string; title: string; phase: string; status: 'blocked' | 'on_hold' | 'waiting'; reason: string }> = [];

  if (project.phases && Array.isArray(project.phases)) {
    project.phases.forEach(phase => {
      const steps = phase.steps || (phase.tasks as any) || [];
      steps.forEach((step: ProcessStep) => {
        if (step.status === 'completed') {
          completed.push({
            id: step.id,
            title: step.title,
            phase: phase.name,
            type: 'step'
          });
        } else if (step.status === 'blocked' || step.status === 'on_hold' || step.status === 'waiting') {
          blocked.push({
            id: step.id,
            title: step.title,
            phase: phase.name,
            status: step.status === 'blocked' ? 'on_hold' : step.status,
            reason: step.blockedReason || (step.status === 'waiting' ? 'Waiting for external input' : 'Task on hold')
          });
          remaining.push({
            id: step.id,
            title: step.title,
            phase: phase.name,
            status: step.status
          });
        } else if (step.status === 'in_progress') {
          current.push({
            id: step.id,
            title: step.title,
            phase: phase.name,
            details: step.description
          });
          remaining.push({
            id: step.id,
            title: step.title,
            phase: phase.name,
            status: step.status
          });
        } else {
          remaining.push({
            id: step.id,
            title: step.title,
            phase: phase.name,
            status: step.status
          });
        }

        // Check subtasks for completed list
        if (step.subtasks) {
          step.subtasks.forEach(st => {
            if (st.completed) {
              completed.push({
                id: st.id,
                title: st.title,
                phase: `${phase.name} → ${step.title}`,
                type: 'subtask'
              });
            }
          });
        }
      });
    });
  }

  return {
    completed,
    current,
    remaining,
    blocked
  };
}
