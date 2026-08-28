import React, { useState, useMemo } from 'react';
import { ITProject, ProjectMilestone } from '../types';
import { 
  Flag, Calendar, Clock, CheckCircle2, AlertTriangle, 
  Plus, Edit3, Trash2, Check, ArrowRight, TrendingDown,
  TrendingUp, ShieldAlert, Sparkles, Filter, ChevronRight
} from 'lucide-react';
import { differenceInDays, format, isAfter, isBefore } from 'date-fns';

interface MilestoneTrackingViewProps {
  project: ITProject;
  onUpdateProject: (updatedProject: ITProject) => Promise<void>;
  currentUser?: { uid?: string; displayName?: string; email?: string } | null;
}

export default function MilestoneTrackingView({
  project,
  onUpdateProject,
  currentUser
}: MilestoneTrackingViewProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<ProjectMilestone | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed' | 'delayed'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add/Edit Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [plannedDate, setPlannedDate] = useState('');
  const [forecastDate, setForecastDate] = useState('');
  const [actualDate, setActualDate] = useState('');
  const [status, setStatus] = useState<'pending' | 'in_progress' | 'completed' | 'delayed'>('pending');
  const [owner, setOwner] = useState('');
  const [deliverablesInput, setDeliverablesInput] = useState('');

  const milestones = project.milestones || [];

  // Derived Variance Metrics
  const milestoneMetrics = useMemo(() => {
    let total = milestones.length;
    let completed = 0;
    let delayed = 0;
    let onTrack = 0;
    let totalVarianceDays = 0;
    let maxDelay = 0;

    const listWithVariance = milestones.map(m => {
      const pDate = new Date(m.plannedDate);
      const targetDate = m.actualDate ? new Date(m.actualDate) : new Date(m.forecastDate);
      const variance = differenceInDays(targetDate, pDate);

      if (m.status === 'completed') {
        completed++;
      } else if (variance > 0) {
        delayed++;
        if (variance > maxDelay) maxDelay = variance;
      } else {
        onTrack++;
      }

      totalVarianceDays += variance;

      return {
        ...m,
        varianceDays: variance,
        isDelayed: variance > 0 && m.status !== 'completed',
        isAhead: variance < 0,
        isOnTime: variance === 0
      };
    });

    return {
      total,
      completed,
      delayed,
      onTrack,
      totalVarianceDays,
      maxDelay,
      listWithVariance
    };
  }, [milestones]);

  const filteredMilestones = milestoneMetrics.listWithVariance.filter(m => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'delayed') return m.isDelayed || m.status === 'delayed';
    return m.status === statusFilter;
  });

  const resetForm = () => {
    setName('');
    setDescription('');
    setPlannedDate('');
    setForecastDate('');
    setActualDate('');
    setStatus('pending');
    setOwner('');
    setDeliverablesInput('');
    setEditingMilestone(null);
  };

  const openAddModal = () => {
    resetForm();
    const today = new Date().toISOString().split('T')[0];
    setPlannedDate(today);
    setForecastDate(today);
    setShowAddModal(true);
  };

  const openEditModal = (m: ProjectMilestone) => {
    setEditingMilestone(m);
    setName(m.name);
    setDescription(m.description || '');
    setPlannedDate(m.plannedDate);
    setForecastDate(m.forecastDate);
    setActualDate(m.actualDate || '');
    setStatus(m.status);
    setOwner(m.owner || '');
    setDeliverablesInput((m.deliverables || []).join(', '));
    setShowAddModal(true);
  };

  const handleSaveMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !plannedDate || !forecastDate) return;

    setIsSubmitting(true);
    try {
      const deliverables = deliverablesInput
        .split(',')
        .map(d => d.trim())
        .filter(Boolean);

      let updatedList: ProjectMilestone[] = [];

      if (editingMilestone) {
        updatedList = milestones.map(m => {
          if (m.id === editingMilestone.id) {
            return {
              ...m,
              name: name.trim(),
              description: description.trim(),
              plannedDate,
              forecastDate,
              actualDate: actualDate || undefined,
              status,
              owner: owner.trim() || undefined,
              deliverables
            };
          }
          return m;
        });
      } else {
        const newM: ProjectMilestone = {
          id: Math.random().toString(36).substring(2, 9),
          name: name.trim(),
          description: description.trim(),
          plannedDate,
          forecastDate,
          actualDate: actualDate || undefined,
          status,
          owner: owner.trim() || undefined,
          deliverables
        };
        updatedList = [...milestones, newM];
      }

      // Sort chronologically by plannedDate
      updatedList.sort((a, b) => new Date(a.plannedDate).getTime() - new Date(b.plannedDate).getTime());

      await onUpdateProject({
        ...project,
        milestones: updatedList
      });

      setShowAddModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving milestone:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleComplete = async (milestoneId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const updatedList = milestones.map(m => {
      if (m.id === milestoneId) {
        const willBeCompleted = m.status !== 'completed';
        return {
          ...m,
          status: (willBeCompleted ? 'completed' : 'pending') as 'completed' | 'pending',
          actualDate: willBeCompleted ? today : undefined
        };
      }
      return m;
    });

    await onUpdateProject({
      ...project,
      milestones: updatedList
    });
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    if (!window.confirm('Are you sure you want to delete this milestone?')) return;
    const updatedList = milestones.filter(m => m.id !== milestoneId);
    await onUpdateProject({
      ...project,
      milestones: updatedList
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Flag className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            Milestone Variance & Schedule Tracking
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track planned vs. forecast delivery dates, calculate variance in days, and proactively identify schedule slippage before project gates are breached.
          </p>
        </div>

        <button
          id="btn-add-milestone"
          onClick={openAddModal}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-2 shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Milestone
        </button>
      </div>

      {/* Variance Alert Banner if Delays Detected */}
      {milestoneMetrics.delayed > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl p-4 flex items-start gap-3 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <h4 className="font-extrabold text-sm mb-0.5">
              Early Delay Warning: {milestoneMetrics.delayed} Milestone(s) Forecasted with Schedule Slippage
            </h4>
            <p className="opacity-90">
              The project health engine detected up to <strong className="font-bold">+{milestoneMetrics.maxDelay} days of forecasted variance</strong>. Review the timeline below or submit a Change Request if scope or baseline adjustment is needed.
            </p>
          </div>
        </div>
      )}

      {/* Key Metric Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wider">Total Milestones</span>
            <Flag className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{milestoneMetrics.total}</p>
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">
            <span className="font-bold text-emerald-600">{milestoneMetrics.completed} completed</span> ({milestoneMetrics.total > 0 ? Math.round((milestoneMetrics.completed / milestoneMetrics.total) * 100) : 0}%)
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wider">On Schedule / Ahead</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {milestoneMetrics.onTrack}
          </p>
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">
            Target dates matching or beating baseline
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wider">Forecast Delays</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className={`text-2xl font-black ${milestoneMetrics.delayed > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
            {milestoneMetrics.delayed}
          </p>
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">
            {milestoneMetrics.maxDelay > 0 ? (
              <span className="text-red-600 font-bold">Max slippage: +{milestoneMetrics.maxDelay} days</span>
            ) : (
              <span>No critical schedule delays</span>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wider">Target Project End</span>
            <Calendar className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-900 dark:text-white">
            {project.targetEndDate ? format(new Date(project.targetEndDate), 'MMM dd, yyyy') : 'N/A'}
          </p>
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">
            Baseline: {project.startDate ? format(new Date(project.startDate), 'MMM dd, yyyy') : 'N/A'}
          </div>
        </div>
      </div>

      {/* Visual Milestone Roadmap Sequence */}
      {milestones.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Visual Milestone Roadmap
            </h3>
            <span className="text-[11px] text-slate-400">Sequential Execution Order</span>
          </div>

          <div className="relative">
            <div className="flex items-center gap-2 overflow-x-auto pb-4 pt-2">
              {milestoneMetrics.listWithVariance.map((m, idx) => (
                <div key={m.id} className="flex items-center shrink-0">
                  <div 
                    onClick={() => openEditModal(m)}
                    className={`cursor-pointer group p-3.5 rounded-xl border transition-all w-52 ${
                      m.status === 'completed'
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400'
                        : m.isDelayed
                        ? 'bg-red-50/60 dark:bg-red-950/30 border-red-200 dark:border-red-800 hover:border-red-400'
                        : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">
                        M{idx + 1}
                      </span>
                      {m.status === 'completed' ? (
                        <span className="text-[9px] uppercase font-extrabold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded">
                          Done
                        </span>
                      ) : m.isDelayed ? (
                        <span className="text-[9px] uppercase font-extrabold text-red-600 bg-red-100 dark:bg-red-900/50 px-1.5 py-0.5 rounded">
                          +{m.varianceDays}d Delay
                        </span>
                      ) : (
                        <span className="text-[9px] uppercase font-extrabold text-slate-600 bg-slate-200 dark:bg-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded">
                          On Time
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 transition-colors">
                      {m.name}
                    </h4>

                    <div className="mt-2 text-[10px] space-y-0.5 text-slate-500 dark:text-slate-400 font-mono">
                      <div className="flex justify-between">
                        <span>Plan:</span>
                        <span className="font-semibold">{format(new Date(m.plannedDate), 'MMM dd')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{m.actualDate ? 'Actual:' : 'Forecast:'}</span>
                        <span className={`font-semibold ${m.isDelayed ? 'text-red-600 font-bold' : ''}`}>
                          {format(new Date(m.actualDate || m.forecastDate), 'MMM dd')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {idx < milestones.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0 mx-1" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          {(['all', 'pending', 'in_progress', 'delayed', 'completed'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap capitalize ${
                statusFilter === tab
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {tab === 'all' ? 'All Milestones' : tab === 'delayed' ? 'Delayed Only' : tab.replace('_', ' ')}
              <span className="ml-1.5 text-[10px] opacity-80">
                ({tab === 'all' ? milestones.length : 
                  tab === 'delayed' ? milestoneMetrics.delayed : 
                  milestones.filter(m => m.status === tab).length})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Milestone Variance Matrix Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
          <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Milestone Variance Schedule
          </h3>
          <span className="text-[11px] text-slate-500 font-medium">
            Variance = Forecast/Actual Date − Planned Baseline
          </span>
        </div>

        {filteredMilestones.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <Flag className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs font-medium">No milestones match the selected filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="p-3.5 pl-5">Milestone</th>
                  <th className="p-3.5">Planned Date</th>
                  <th className="p-3.5">Forecast Date</th>
                  <th className="p-3.5">Actual Date</th>
                  <th className="p-3.5">Calculated Variance</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredMilestones.map(m => {
                  const pDate = new Date(m.plannedDate);
                  const fDate = new Date(m.forecastDate);
                  const aDate = m.actualDate ? new Date(m.actualDate) : null;

                  return (
                    <tr 
                      key={m.id}
                      id={`milestone-row-${m.id}`}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      {/* Name & Deliverables */}
                      <td className="p-3.5 pl-5">
                        <div className="flex items-start gap-2.5">
                          <button
                            onClick={() => handleToggleComplete(m.id)}
                            className="mt-0.5 text-slate-300 hover:text-emerald-500 dark:text-slate-600 transition-colors"
                            title={m.status === 'completed' ? 'Mark Pending' : 'Mark Completed'}
                          >
                            {m.status === 'completed' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600 hover:border-emerald-500" />
                            )}
                          </button>
                          <div>
                            <span className={`font-bold ${m.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>
                              {m.name}
                            </span>
                            {m.description && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {m.description}
                              </p>
                            )}
                            {m.deliverables && m.deliverables.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {m.deliverables.map((del, i) => (
                                  <span key={i} className="text-[9px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-medium">
                                    {del}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Planned Date */}
                      <td className="p-3.5 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {format(pDate, 'MMM dd, yyyy')}
                      </td>

                      {/* Forecast Date */}
                      <td className="p-3.5 font-mono whitespace-nowrap">
                        <span className={m.isDelayed ? 'text-red-600 font-bold dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}>
                          {format(fDate, 'MMM dd, yyyy')}
                        </span>
                      </td>

                      {/* Actual Date */}
                      <td className="p-3.5 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {aDate ? (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {format(aDate, 'MMM dd, yyyy')}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>

                      {/* Calculated Variance */}
                      <td className="p-3.5 whitespace-nowrap">
                        {m.varianceDays > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-900 px-2 py-0.5 rounded-md">
                            <TrendingUp className="w-3 h-3 text-red-500" />
                            +{m.varianceDays} Days Delay
                          </span>
                        ) : m.varianceDays < 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 px-2 py-0.5 rounded-md">
                            <TrendingDown className="w-3 h-3 text-emerald-500" />
                            {m.varianceDays} Days Ahead
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md">
                            <Check className="w-3 h-3 text-emerald-500" />
                            On Time (0d)
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                          m.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800' :
                          m.status === 'in_progress' ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800' :
                          m.isDelayed ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800' :
                          'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                        }`}>
                          {m.status === 'completed' ? 'Completed' : m.isDelayed ? 'Delayed' : m.status.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 pr-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(m)}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            title="Edit Milestone"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMilestone(m.id)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            title="Delete Milestone"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Milestone Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 dark:border-slate-700 overflow-hidden my-8">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <Flag className="w-5 h-5 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  {editingMilestone ? 'Edit Milestone' : 'Add Project Milestone'}
                </h3>
              </div>
              <button onClick={() => { setShowAddModal(false); resetForm(); }} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleSaveMilestone} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Milestone Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g., UAT Sign-off or Production Cutover"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-purple-500 outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Description / Criteria
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe the exit criteria or milestone deliverable..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-purple-500 outline-none font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Planned Baseline Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={plannedDate}
                    onChange={e => setPlannedDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-purple-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Forecast Delivery Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={forecastDate}
                    onChange={e => setForecastDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-purple-500 outline-none font-mono"
                  />
                </div>
              </div>

              {/* Dynamic Variance Preview */}
              {plannedDate && forecastDate && (
                <div className="bg-purple-50 dark:bg-purple-950/30 p-3 rounded-lg border border-purple-100 dark:border-purple-900 flex items-center justify-between text-xs">
                  <span className="text-purple-900 dark:text-purple-300 font-bold">
                    Calculated Variance:
                  </span>
                  <span className="font-mono font-bold">
                    {differenceInDays(new Date(forecastDate), new Date(plannedDate)) > 0 ? (
                      <span className="text-red-600">
                        +{differenceInDays(new Date(forecastDate), new Date(plannedDate))} Days Delay
                      </span>
                    ) : differenceInDays(new Date(forecastDate), new Date(plannedDate)) < 0 ? (
                      <span className="text-emerald-600">
                        {differenceInDays(new Date(forecastDate), new Date(plannedDate))} Days Ahead
                      </span>
                    ) : (
                      <span className="text-slate-600 dark:text-slate-300">0 Days (On Time)</span>
                    )}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Actual Completed Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={actualDate}
                    onChange={e => setActualDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-purple-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-purple-500 outline-none font-medium"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="delayed">Delayed</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Deliverables (comma separated)
                </label>
                <input
                  type="text"
                  value={deliverablesInput}
                  onChange={e => setDeliverablesInput(e.target.value)}
                  placeholder="e.g., Security Audit, Cloud Architecture Doc, UAT Signoff"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-purple-500 outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  {isSubmitting ? 'Saving...' : editingMilestone ? 'Update Milestone' : 'Add Milestone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
