import React, { useState } from 'react';
import { ITProject } from '../types';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isToday 
} from 'date-fns';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Flag, 
  CheckCircle2, 
  Clock, 
  Briefcase,
  AlertCircle
} from 'lucide-react';

interface CalendarScheduleViewProps {
  projects: ITProject[];
  onSelectProject?: (project: ITProject) => void;
}

interface CalendarEvent {
  id: string;
  type: 'project_target' | 'step_due' | 'milestone';
  title: string;
  projectName: string;
  project: ITProject;
  date: string; // YYYY-MM-DD
  status: string;
  isOverdue?: boolean;
}

export const CalendarScheduleView: React.FC<CalendarScheduleViewProps> = ({
  projects,
  onSelectProject
}) => {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [filterProject, setFilterProject] = useState<string>('all');

  // Collect events
  const events: CalendarEvent[] = [];
  const now = new Date();

  projects.forEach(project => {
    if (filterProject !== 'all' && project.id !== filterProject) return;

    // 1. Project target date
    const targetDateStr = project.targetDate || project.targetEndDate;
    if (targetDateStr) {
      const isPast = new Date(targetDateStr).getTime() < now.getTime() && project.status !== 'completed';
      events.push({
        id: `proj_target_${project.id}`,
        type: 'project_target',
        title: `Target Complete: ${project.name}`,
        projectName: project.name,
        project,
        date: targetDateStr,
        status: project.status,
        isOverdue: isPast
      });
    }

    // 2. Step due dates
    (project.phases || []).forEach(phase => {
      (phase.steps || []).forEach(step => {
        if (step.dueDate) {
          const isPast = new Date(step.dueDate).getTime() < now.getTime() && step.status !== 'completed';
          events.push({
            id: `step_due_${step.id}`,
            type: 'step_due',
            title: step.title,
            projectName: project.name,
            project,
            date: step.dueDate,
            status: step.status,
            isOverdue: isPast
          });
        }
      });
    });
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Selected date events
  const selectedDateEvents = events.filter(e => {
    try {
      return isSameDay(new Date(e.date), selectedDate);
    } catch {
      return false;
    }
  });

  return (
    <div className="space-y-6">
      {/* Calendar Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            {format(currentMonth, 'MMMM yyyy')}
          </h3>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/60 p-1 rounded-lg">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                const d = new Date();
                setCurrentMonth(d);
                setSelectedDate(d);
              }}
              className="px-2 py-0.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-600 rounded"
            >
              Today
            </button>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Project Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Filter Project:
          </span>
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="text-xs font-bold px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white outline-none"
          >
            <option value="all">All Projects ({projects.length})</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Month Grid */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden p-4">
          <div className="grid grid-cols-7 gap-px mb-2 text-center text-[11px] font-extrabold uppercase text-slate-400 py-2 border-b border-slate-100 dark:border-slate-700">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {/* Empty slots for month start day offset */}
            {Array.from({ length: monthStart.getDay() }).map((_, i) => (
              <div key={`empty_${i}`} className="min-h-[90px] p-2 bg-slate-50/40 dark:bg-slate-900/20 rounded-lg opacity-40" />
            ))}

            {days.map(day => {
              const dayEvents = events.filter(e => {
                try {
                  return isSameDay(new Date(e.date), day);
                } catch {
                  return false;
                }
              });

              const isDaySelected = isSameDay(day, selectedDate);
              const isCurrentDay = isToday(day);

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={`min-h-[95px] p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isDaySelected 
                      ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-900/20 shadow-sm ring-1 ring-blue-500' 
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-black w-6 h-6 rounded-full flex items-center justify-center ${
                      isCurrentDay 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : isDaySelected 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : 'text-slate-700 dark:text-slate-300'
                    }`}>
                      {format(day, 'd')}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 mt-1 overflow-hidden">
                    {dayEvents.slice(0, 2).map(evt => (
                      <div
                        key={evt.id}
                        className={`text-[9px] font-bold p-1 rounded truncate leading-tight flex items-center gap-1 ${
                          evt.type === 'project_target'
                            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300'
                            : evt.isOverdue
                            ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300'
                            : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                        }`}
                      >
                        {evt.type === 'project_target' ? (
                          <Flag className="w-2.5 h-2.5 shrink-0" />
                        ) : (
                          <Clock className="w-2.5 h-2.5 shrink-0" />
                        )}
                        <span className="truncate">{evt.title}</span>
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <span className="text-[9px] text-slate-400 font-bold block pl-1">
                        +{dayEvents.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Agenda */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 flex flex-col justify-between">
          <div>
            <div className="pb-4 mb-4 border-b border-slate-100 dark:border-slate-700">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Selected Date Schedule
              </span>
              <h4 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                {format(selectedDate, 'EEEE, MMMM d, yyyy')}
              </h4>
            </div>

            <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
              {selectedDateEvents.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-bold text-slate-500">No scheduled deadlines</p>
                  <p className="text-[10px]">Select another date to view events.</p>
                </div>
              ) : (
                selectedDateEvents.map(evt => (
                  <div
                    key={evt.id}
                    onClick={() => onSelectProject && onSelectProject(evt.project)}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-600 bg-slate-50/60 dark:bg-slate-900/40 cursor-pointer transition-all space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 truncate">
                        {evt.projectName}
                      </span>
                      {evt.type === 'project_target' ? (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          Milestone
                        </span>
                      ) : (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                          Step Due
                        </span>
                      )}
                    </div>

                    <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                      {evt.title}
                    </h5>

                    {evt.isOverdue && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400">
                        <AlertCircle className="w-3 h-3" />
                        Deadline passed
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-700 text-[11px] text-slate-400 text-center">
            Click any task to jump to its project dashboard
          </div>
        </div>
      </div>
    </div>
  );
};
