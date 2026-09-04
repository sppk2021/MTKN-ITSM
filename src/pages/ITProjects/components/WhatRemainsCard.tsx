import React from 'react';
import { ITProject } from '../types';
import { extractWhatRemains } from '../utils';
import { CheckCircle2, Clock, ListTodo, AlertCircle, ArrowRight } from 'lucide-react';

interface WhatRemainsCardProps {
  project: ITProject;
  onUpdateNextAction?: (nextAction: string) => void;
  onUpdateCurrentStep?: (currentStep: string) => void;
}

export const WhatRemainsCard: React.FC<WhatRemainsCardProps> = ({
  project
}) => {
  const { completed, current, remaining, blocked } = extractWhatRemains(project);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mb-6">
      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Project Execution Status ("What Remains")
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time clarity: what's completed, currently active, upcoming, and on hold.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-700">
        {/* 1. What have I done? */}
        <div className="p-4 sm:p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              What Have I Done?
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
              {completed.length} done
            </span>
          </div>

          <div className="space-y-2 flex-1 max-h-60 overflow-y-auto pr-1">
            {completed.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">No completed items yet.</p>
            ) : (
              completed.map(item => (
                <div 
                  key={item.id} 
                  className="text-xs p-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 flex items-start gap-2"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 line-through opacity-85">
                      {item.title}
                    </span>
                    <span className="block text-[10px] text-emerald-600/90 dark:text-emerald-400/80 mt-0.5">
                      {item.phase}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 2. What am I doing now? */}
        <div className="p-4 sm:p-5 flex flex-col bg-blue-50/20 dark:bg-blue-950/10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              What Am I Doing Now?
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
              Active
            </span>
          </div>

          <div className="space-y-3 flex-1">
            {/* Current Step Focus */}
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block mb-1">
                Current Step Focus
              </span>
              <p className="text-xs font-bold text-blue-900 dark:text-blue-200">
                {project.currentStep || 'Not specified'}
              </p>
            </div>

            {/* Next Action */}
            <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <ArrowRight className="w-3 h-3 text-blue-500" />
                Immediate Next Action
              </span>
              <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                {project.nextAction || 'No next action defined yet'}
              </p>
            </div>

            {/* In Progress Items */}
            {current.length > 0 && (
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Active Tasks ({current.length})
                </span>
                {current.map(c => (
                  <div key={c.id} className="text-xs p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    <span className="text-slate-700 dark:text-slate-300 truncate font-medium">{c.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 3. What remains? */}
        <div className="p-4 sm:p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ListTodo className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              What Remains?
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {remaining.length} pending
            </span>
          </div>

          <div className="space-y-2 flex-1 max-h-60 overflow-y-auto pr-1">
            {remaining.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">All tasks completed!</p>
            ) : (
              remaining.map(item => (
                <div 
                  key={item.id} 
                  className="text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-700/70 flex items-start gap-2"
                >
                  <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0 mt-1" />
                  <div className="min-w-0">
                    <span className="font-medium text-slate-800 dark:text-slate-200 block truncate">
                      {item.title}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {item.phase}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 4. What is on hold / waiting? */}
        <div className="p-4 sm:p-5 flex flex-col bg-amber-50/20 dark:bg-amber-950/10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              What Is On Hold / Waiting?
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              blocked.length > 0 
                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}>
              {blocked.length} items
            </span>
          </div>

          <div className="space-y-2 flex-1 max-h-60 overflow-y-auto pr-1">
            {blocked.length === 0 ? (
              <div className="text-center py-6 text-slate-400">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1 opacity-70" />
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">No on-hold items!</p>
                <p className="text-[10px] text-slate-400">All workflow channels clear</p>
              </div>
            ) : (
              blocked.map(b => (
                <div 
                  key={b.id} 
                  className="text-xs p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex flex-col gap-1 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1 truncate">
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                      {b.title}
                    </span>
                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300 shrink-0">
                      {b.status === 'blocked' || b.status === 'on_hold' ? 'On Hold' : b.status}
                    </span>
                  </div>
                  <div className="mt-1 p-1.5 rounded bg-white dark:bg-slate-900 border border-amber-100 dark:border-amber-900/30 text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                    <span className="font-bold mr-1">Reason:</span>
                    {b.reason}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
