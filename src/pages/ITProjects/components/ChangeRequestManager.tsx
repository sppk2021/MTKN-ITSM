import React, { useState } from 'react';
import { ITProject, ChangeRequest } from '../types';
import { 
  Plus, GitPullRequest, DollarSign, Calendar, Clock, CheckCircle2, 
  XCircle, AlertTriangle, UserCheck, ArrowRight, ShieldCheck, 
  Trash2, Check, Filter, TrendingUp, Layers, HelpCircle
} from 'lucide-react';
import { format, addDays } from 'date-fns';

interface ChangeRequestManagerProps {
  project: ITProject;
  users: Array<{ id: string; name: string; email?: string; role?: string }>;
  onUpdateProject: (updatedProject: ITProject) => Promise<void>;
  currentUser?: { uid?: string; displayName?: string; email?: string } | null;
}

export default function ChangeRequestManager({
  project,
  users,
  onUpdateProject,
  currentUser
}: ChangeRequestManagerProps) {
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'Requested' | 'Under Review' | 'Approved' | 'Rejected' | 'Implemented'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState<'Scope' | 'Timeline' | 'Budget' | 'Technical' | 'Resource'>('Scope');
  const [impact, setImpact] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [budgetImpact, setBudgetImpact] = useState<number>(0);
  const [timelineImpactDays, setTimelineImpactDays] = useState<number>(0);
  const [assignedApprover, setAssignedApprover] = useState<string>(project.sponsorName || project.projectManagerName || 'Project Sponsor');
  const [approverRole, setApproverRole] = useState<string>('Sponsor / Executive');

  // Rejection modal
  const [rejectingCrId, setRejectingCrId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const changeRequests = project.changeRequests || [];

  // Filtered requests
  const filteredRequests = changeRequests.filter(cr => {
    if (statusFilter === 'all') return true;
    return cr.status === statusFilter;
  });

  // Calculate Cumulative Metrics
  const approvedRequests = changeRequests.filter(cr => cr.status === 'Approved' || cr.status === 'Implemented');
  const totalApprovedBudget = approvedRequests.reduce((sum, cr) => sum + (Number(cr.budgetImpact) || 0), 0);
  const totalApprovedDays = approvedRequests.reduce((sum, cr) => sum + (Number(cr.timelineImpactDays) || 0), 0);
  const pendingRequests = changeRequests.filter(cr => cr.status === 'Requested' || cr.status === 'Under Review');
  const pendingBudget = pendingRequests.reduce((sum, cr) => sum + (Number(cr.budgetImpact) || 0), 0);
  const pendingDays = pendingRequests.reduce((sum, cr) => sum + (Number(cr.timelineImpactDays) || 0), 0);

  // Preview dates for new CR
  const currentEndDate = new Date(project.targetEndDate);
  const proposedEndDate = addDays(currentEndDate, Number(timelineImpactDays) || 0);
  const currentPlannedBudget = project.budget?.planned || 0;
  const proposedPlannedBudget = currentPlannedBudget + (Number(budgetImpact) || 0);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setReason('');
    setCategory('Scope');
    setImpact('Medium');
    setBudgetImpact(0);
    setTimelineImpactDays(0);
    setAssignedApprover(project.sponsorName || project.projectManagerName || 'Project Sponsor');
    setApproverRole('Sponsor / Executive');
  };

  const handleCreateCR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setIsSubmitting(true);
    try {
      const newCR: ChangeRequest = {
        id: Math.random().toString(36).substring(2, 9),
        title: title.trim(),
        description: description.trim(),
        reason: reason.trim(),
        category,
        impact,
        budgetImpact: Number(budgetImpact) || 0,
        timelineImpactDays: Number(timelineImpactDays) || 0,
        requestedBy: currentUser?.displayName || currentUser?.email || 'Project Member',
        requestedAt: new Date().toISOString(),
        assignedApprover: assignedApprover.trim(),
        approverRole: approverRole.trim(),
        status: 'Requested'
      };

      const updatedCRs = [newCR, ...(project.changeRequests || [])];
      await onUpdateProject({
        ...project,
        changeRequests: updatedCRs
      });

      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Error creating change request:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manual Approver change
  const handleUpdateApprover = async (crId: string, newApprover: string) => {
    const updatedCRs = (project.changeRequests || []).map(cr => {
      if (cr.id === crId) {
        return { ...cr, assignedApprover: newApprover };
      }
      return cr;
    });

    await onUpdateProject({
      ...project,
      changeRequests: updatedCRs
    });
  };

  // Manual Approval Action
  const handleApprove = async (cr: ChangeRequest, applyToProjectBaseline: boolean = true) => {
    setActionLoadingId(cr.id);
    try {
      const approverName = currentUser?.displayName || currentUser?.email || cr.assignedApprover || 'Approver';
      const updatedCRs = (project.changeRequests || []).map(item => {
        if (item.id === cr.id) {
          return {
            ...item,
            status: 'Approved' as const,
            approvedBy: approverName,
            approvedAt: new Date().toISOString()
          };
        }
        return item;
      });

      // Optionally adjust project budget and timeline
      let updatedBudget = { ...project.budget };
      let updatedTargetEnd = project.targetEndDate;

      if (applyToProjectBaseline) {
        if (cr.budgetImpact) {
          updatedBudget = {
            ...updatedBudget,
            planned: (updatedBudget.planned || 0) + Number(cr.budgetImpact)
          };
        }
        if (cr.timelineImpactDays && cr.timelineImpactDays > 0) {
          const currentTarget = new Date(project.targetEndDate);
          updatedTargetEnd = format(addDays(currentTarget, Number(cr.timelineImpactDays)), 'yyyy-MM-dd');
        }
      }

      await onUpdateProject({
        ...project,
        changeRequests: updatedCRs,
        budget: updatedBudget,
        targetEndDate: updatedTargetEnd
      });
    } catch (error) {
      console.error('Error approving change request:', error);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Manual Rejection Action
  const handleReject = async () => {
    if (!rejectingCrId) return;
    setActionLoadingId(rejectingCrId);
    try {
      const approverName = currentUser?.displayName || currentUser?.email || 'Approver';
      const updatedCRs = (project.changeRequests || []).map(item => {
        if (item.id === rejectingCrId) {
          return {
            ...item,
            status: 'Rejected' as const,
            approvedBy: approverName,
            approvedAt: new Date().toISOString(),
            rejectionReason: rejectionReason.trim()
          };
        }
        return item;
      });

      await onUpdateProject({
        ...project,
        changeRequests: updatedCRs
      });
      setRejectingCrId(null);
      setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting change request:', error);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Mark as Implemented
  const handleSetImplemented = async (crId: string) => {
    setActionLoadingId(crId);
    try {
      const updatedCRs = (project.changeRequests || []).map(item => {
        if (item.id === crId) {
          return { ...item, status: 'Implemented' as const };
        }
        return item;
      });

      await onUpdateProject({
        ...project,
        changeRequests: updatedCRs
      });
    } catch (error) {
      console.error('Error implementing change request:', error);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete CR
  const handleDeleteCR = async (crId: string) => {
    if (!window.confirm('Are you sure you want to delete this Change Request?')) return;
    const updatedCRs = (project.changeRequests || []).filter(cr => cr.id !== crId);
    await onUpdateProject({
      ...project,
      changeRequests: updatedCRs
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Header & Metrics Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <GitPullRequest className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Change Request Management
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Submit scope amendments, calculate dynamic budget & schedule impacts, and select personnel for manual review & approval.
          </p>
        </div>
        <button
          id="btn-new-change-request"
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-2 shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Submit Change Request
        </button>
      </div>

      {/* Impact Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wider">Total Requests</span>
            <Layers className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{changeRequests.length}</p>
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">
            <span className="text-amber-600 font-bold">{pendingRequests.length} pending</span> review
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wider">Approved Budget Impact</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <p className={`text-2xl font-black ${totalApprovedBudget > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
            {totalApprovedBudget >= 0 ? `+$${totalApprovedBudget.toLocaleString()}` : `-$${Math.abs(totalApprovedBudget).toLocaleString()}`}
          </p>
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">
            {pendingBudget !== 0 && (
              <span>Pending: {pendingBudget > 0 ? `+$${pendingBudget.toLocaleString()}` : `-$${Math.abs(pendingBudget).toLocaleString()}`}</span>
            )}
            {pendingBudget === 0 && <span>No pending budget changes</span>}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wider">Approved Schedule Delta</span>
            <Calendar className="w-4 h-4 text-purple-500" />
          </div>
          <p className={`text-2xl font-black ${totalApprovedDays > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
            {totalApprovedDays > 0 ? `+${totalApprovedDays} Days` : totalApprovedDays < 0 ? `${totalApprovedDays} Days` : '0 Days'}
          </p>
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">
            {pendingDays > 0 ? (
              <span className="text-amber-600 font-bold">+{pendingDays} days pending approval</span>
            ) : (
              <span>Baseline adjusted on approval</span>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wider">Approval Rate</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">
            {changeRequests.length > 0 ? `${Math.round((approvedRequests.length / changeRequests.length) * 100)}%` : '100%'}
          </p>
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">
            <span className="font-bold text-emerald-600">{approvedRequests.length}</span> approved / <span className="font-bold text-red-600">{changeRequests.filter(c => c.status === 'Rejected').length}</span> rejected
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          {(['all', 'Requested', 'Under Review', 'Approved', 'Implemented', 'Rejected'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap capitalize ${
                statusFilter === tab
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {tab === 'all' ? 'All Requests' : tab}
              <span className="ml-1.5 text-[10px] opacity-80">
                ({tab === 'all' ? changeRequests.length : changeRequests.filter(c => c.status === tab).length})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Change Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-10 text-center border border-slate-200 dark:border-slate-700">
          <GitPullRequest className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">No Change Requests Found</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            {statusFilter === 'all' 
              ? 'No scope change requests have been submitted for this project yet. Click "Submit Change Request" to create one.'
              : `No change requests currently have the "${statusFilter}" status.`}
          </p>
          {statusFilter === 'all' && (
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 inline-flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Submit First Request
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map(cr => {
            const isPending = cr.status === 'Requested' || cr.status === 'Under Review';
            const isApproved = cr.status === 'Approved' || cr.status === 'Implemented';
            const isRejected = cr.status === 'Rejected';

            return (
              <div
                key={cr.id}
                id={`cr-card-${cr.id}`}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-all"
              >
                <div className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Badge Row */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full border ${
                          isApproved ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' :
                          isRejected ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800' :
                          'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                        }`}>
                          {cr.status}
                        </span>

                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {cr.category || 'Scope'} Change
                        </span>

                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                          cr.impact === 'Critical' ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:border-red-800' :
                          cr.impact === 'High' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800' :
                          cr.impact === 'Medium' ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' :
                          'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
                        }`}>
                          Impact: {cr.impact}
                        </span>

                        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono ml-auto">
                          ID: #{cr.id}
                        </span>
                      </div>

                      {/* Title & Description */}
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {cr.title}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                        {cr.description}
                      </p>

                      {cr.reason && (
                        <div className="mt-2 text-xs bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                          <strong className="text-slate-700 dark:text-slate-300">Justification: </strong>
                          {cr.reason}
                        </div>
                      )}

                      {/* Rejection notice if rejected */}
                      {isRejected && cr.rejectionReason && (
                        <div className="mt-2 text-xs bg-red-50 dark:bg-red-950/30 p-2.5 rounded-lg border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300">
                          <strong>Rejection Reason: </strong>
                          {cr.rejectionReason}
                        </div>
                      )}
                    </div>

                    {/* Impact Metrics Box */}
                    <div className="bg-slate-50 dark:bg-slate-900/80 rounded-xl p-3.5 border border-slate-100 dark:border-slate-800 min-w-[220px] shrink-0 space-y-2">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Calculated Impact
                      </p>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-500" /> Budget:
                        </span>
                        <span className={`font-mono font-bold ${cr.budgetImpact > 0 ? 'text-red-600 dark:text-red-400' : cr.budgetImpact < 0 ? 'text-emerald-600' : 'text-slate-600 dark:text-slate-300'}`}>
                          {cr.budgetImpact >= 0 ? `+$${(Number(cr.budgetImpact) || 0).toLocaleString()}` : `-$${Math.abs(Number(cr.budgetImpact) || 0).toLocaleString()}`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-purple-500" /> Timeline:
                        </span>
                        <span className={`font-mono font-bold ${cr.timelineImpactDays > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'}`}>
                          {cr.timelineImpactDays > 0 ? `+${cr.timelineImpactDays} Days` : cr.timelineImpactDays < 0 ? `${cr.timelineImpactDays} Days` : '0 Days'}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 flex justify-between">
                        <span>Requested:</span>
                        <span className="font-medium font-mono">{cr.requestedAt ? format(new Date(cr.requestedAt), 'MMM dd, yyyy') : 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Approver Selection and Manual Actions Footer */}
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/40 -mx-5 -mb-5 p-4">
                    {/* Approver assignment button/select */}
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-slate-400" />
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Approver:</span>
                      
                      {isPending ? (
                        <div className="flex items-center gap-2">
                          <select
                            id={`select-approver-${cr.id}`}
                            value={cr.assignedApprover || ''}
                            onChange={(e) => handleUpdateApprover(cr.id, e.target.value)}
                            className="text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value={project.sponsorName || 'Project Sponsor'}>
                              {project.sponsorName ? `${project.sponsorName} (Sponsor)` : 'Project Sponsor'}
                            </option>
                            <option value={project.projectManagerName || 'Project Manager'}>
                              {project.projectManagerName ? `${project.projectManagerName} (PM)` : 'Project Manager'}
                            </option>
                            <option value="IT Director">IT Director</option>
                            <option value="Steering Committee">Steering Committee</option>
                            {users.map(u => (
                              <option key={u.id} value={u.name || u.email}>
                                {u.name || u.email} ({u.role || 'Staff'})
                              </option>
                            ))}
                          </select>
                          <span className="text-[10px] text-slate-400 italic">Manual personnel</span>
                        </div>
                      ) : (
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {cr.approvedBy ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Reviewed by {cr.approvedBy} {cr.approvedAt && `(${format(new Date(cr.approvedAt), 'MMM dd')})`}
                            </span>
                          ) : (
                            <span>{cr.assignedApprover || 'Assigned Approver'}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Manual Approval Action Buttons */}
                    <div className="flex items-center gap-2 self-end md:self-auto">
                      {isPending && (
                        <>
                          <button
                            id={`btn-approve-cr-${cr.id}`}
                            disabled={actionLoadingId === cr.id}
                            onClick={() => handleApprove(cr, true)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Approve Change
                          </button>

                          <button
                            id={`btn-reject-cr-${cr.id}`}
                            disabled={actionLoadingId === cr.id}
                            onClick={() => {
                              setRejectingCrId(cr.id);
                              setRejectionReason('');
                            }}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/50 dark:hover:bg-red-900/50 dark:text-red-300 border border-red-200 dark:border-red-800 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </>
                      )}

                      {cr.status === 'Approved' && (
                        <button
                          onClick={() => handleSetImplemented(cr.id)}
                          disabled={actionLoadingId === cr.id}
                          className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-800 text-xs font-bold rounded-lg transition-all"
                        >
                          Mark as Implemented
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteCR(cr.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors ml-1"
                        title="Delete Change Request"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submission Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-xl border border-slate-200 dark:border-slate-700 overflow-hidden my-8">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <GitPullRequest className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Submit Scope Change Request
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCR} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Change Request Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g., Add Multi-Factor Authentication (MFA) to User Portal"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none font-medium"
                  >
                    <option value="Scope">Scope Expansion / Reduction</option>
                    <option value="Timeline">Timeline Adjustment</option>
                    <option value="Budget">Budget / Cost Amendment</option>
                    <option value="Technical">Technical / Architecture Change</option>
                    <option value="Resource">Resource / Staffing Shift</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Impact Severity
                  </label>
                  <select
                    value={impact}
                    onChange={e => setImpact(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none font-medium"
                  >
                    <option value="Low">Low - Minor cosmetic / internal delta</option>
                    <option value="Medium">Medium - Notable timeline/cost change</option>
                    <option value="High">High - Substantial budget/architecture shift</option>
                    <option value="Critical">Critical - Major pivot / baseline rewrite</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Scope Change Description *
                </label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Detail what is being added, removed, or modified in the project scope..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Business Justification & Reason
                </label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Why is this change necessary? (e.g. Compliance mandate, security audit finding, user feedback)..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none font-medium"
                />
              </div>

              {/* Impact Calculation Inputs */}
              <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-blue-900 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    Impact Calculation Engine
                  </span>
                  <span className="text-[10px] text-blue-700 dark:text-blue-400 font-semibold">Live Preview</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Budget Impact ($ USD)
                    </label>
                    <input
                      type="number"
                      value={budgetImpact}
                      onChange={e => setBudgetImpact(Number(e.target.value))}
                      placeholder="e.g., 5000 (use - for savings)"
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Schedule Impact (Days)
                    </label>
                    <input
                      type="number"
                      value={timelineImpactDays}
                      onChange={e => setTimelineImpactDays(Number(e.target.value))}
                      placeholder="e.g., 14 (use - for acceleration)"
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                {/* Live Output preview */}
                <div className="pt-2 border-t border-blue-200 dark:border-blue-900/60 text-xs space-y-1">
                  <div className="flex justify-between text-slate-700 dark:text-slate-300">
                    <span>Project Planned Budget:</span>
                    <span className="font-mono font-bold">
                      ${currentPlannedBudget.toLocaleString()} →{' '}
                      <span className={budgetImpact > 0 ? 'text-red-600' : 'text-emerald-600'}>
                        ${proposedPlannedBudget.toLocaleString()}
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-700 dark:text-slate-300">
                    <span>Project Target Completion:</span>
                    <span className="font-mono font-bold">
                      {project.targetEndDate} →{' '}
                      <span className={timelineImpactDays > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                        {format(proposedEndDate, 'yyyy-MM-dd')}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Select Approver Personnel */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Select Approver Personnel
                </label>
                <select
                  value={assignedApprover}
                  onChange={e => setAssignedApprover(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none font-medium"
                >
                  <option value={project.sponsorName || 'Project Sponsor'}>
                    {project.sponsorName ? `${project.sponsorName} (Project Sponsor)` : 'Project Sponsor'}
                  </option>
                  <option value={project.projectManagerName || 'Project Manager'}>
                    {project.projectManagerName ? `${project.projectManagerName} (Project Manager)` : 'Project Manager'}
                  </option>
                  <option value="IT Director">IT Director</option>
                  <option value="Executive Steering Committee">Executive Steering Committee</option>
                  <option value="Enterprise Architecture Board">Enterprise Architecture Board</option>
                  {users.map(u => (
                    <option key={u.id} value={u.name || u.email}>
                      {u.name || u.email} ({u.role || 'Staff'})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                  The designated personnel will review and manually authorize this change request.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  {isSubmitting ? 'Submitting...' : 'Submit for Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingCrId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-red-50 dark:bg-red-950/40 flex justify-between items-center">
              <h3 className="text-sm font-bold text-red-900 dark:text-red-300 uppercase tracking-wider flex items-center gap-2">
                <XCircle className="w-4 h-4" /> Reject Change Request
              </h3>
              <button onClick={() => setRejectingCrId(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Reason for Rejection *
                </label>
                <textarea
                  rows={3}
                  required
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="Provide feedback on why this change is rejected (e.g. budget cap, out of scope, scheduled for next phase)..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-red-500 outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingCrId(null)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={!rejectionReason.trim()}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
