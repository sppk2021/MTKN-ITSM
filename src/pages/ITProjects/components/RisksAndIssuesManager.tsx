import React, { useState } from 'react';
import { ITProject, ProjectRisk, ProjectIssue } from '../types';
import { 
  AlertTriangle, Plus, ShieldAlert, CheckCircle2, 
  Trash2, Filter, AlertCircle, Check 
} from 'lucide-react';

interface RisksAndIssuesManagerProps {
  project: ITProject;
  onUpdateProject: (updatedProject: ITProject) => Promise<void>;
  currentUser?: { uid?: string; displayName?: string; email?: string } | null;
}

export default function RisksAndIssuesManager({
  project,
  onUpdateProject,
  currentUser
}: RisksAndIssuesManagerProps) {
  const [subTab, setSubTab] = useState<'risks' | 'issues'>('risks');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [description, setDescription] = useState('');
  const [probability, setProbability] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [impact, setImpact] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [severity, setSeverity] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('High');
  const [owner, setOwner] = useState('');

  const risks = project.risks || [];
  const issues = project.issues || [];

  const handleAddRiskOrIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    if (subTab === 'risks') {
      const newRisk: ProjectRisk = {
        id: Math.random().toString(36).substring(2, 9),
        description: description.trim(),
        probability,
        impact,
        status: 'Open',
        owner: owner.trim() || currentUser?.displayName || 'PM'
      };
      await onUpdateProject({
        ...project,
        risks: [newRisk, ...risks]
      });
    } else {
      const newIssue: ProjectIssue = {
        id: Math.random().toString(36).substring(2, 9),
        description: description.trim(),
        severity,
        status: 'Open',
        owner: owner.trim() || currentUser?.displayName || 'PM'
      };
      await onUpdateProject({
        ...project,
        issues: [newIssue, ...issues]
      });
    }

    setDescription('');
    setOwner('');
    setShowAddModal(false);
  };

  const handleUpdateRiskStatus = async (riskId: string, status: 'Open' | 'Mitigated' | 'Closed') => {
    const updatedRisks = risks.map(r => r.id === riskId ? { ...r, status } : r);
    await onUpdateProject({ ...project, risks: updatedRisks });
  };

  const handleUpdateIssueStatus = async (issueId: string, status: 'Open' | 'Resolved' | 'Closed') => {
    const updatedIssues = issues.map(i => i.id === issueId ? { ...i, status } : i);
    await onUpdateProject({ ...project, issues: updatedIssues });
  };

  const handleDeleteRisk = async (riskId: string) => {
    const updatedRisks = risks.filter(r => r.id !== riskId);
    await onUpdateProject({ ...project, risks: updatedRisks });
  };

  const handleDeleteIssue = async (issueId: string) => {
    const updatedIssues = issues.filter(i => i.id !== issueId);
    await onUpdateProject({ ...project, issues: updatedIssues });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header & Sub-tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setSubTab('risks')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              subTab === 'risks'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Risks Register ({risks.filter(r => r.status === 'Open').length} Open)
          </button>
          <button
            onClick={() => setSubTab('issues')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              subTab === 'issues'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Issues Log ({issues.filter(i => i.status === 'Open').length} Open)
          </button>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          {subTab === 'risks' ? 'Add New Risk' : 'Log New Issue'}
        </button>
      </div>

      {/* Risks SubTab */}
      {subTab === 'risks' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          {risks.length === 0 ? (
            <div className="p-10 text-center text-slate-400">
              <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-50 text-amber-500" />
              <p className="text-xs font-medium">No risks logged yet. Maintain project health by recording potential risks early.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {risks.map(risk => (
                <div key={risk.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        risk.impact === 'High' ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800' :
                        risk.impact === 'Medium' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800' :
                        'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                      }`}>
                        Impact: {risk.impact}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Prob: {risk.probability}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        • Owner: <strong className="text-slate-600 dark:text-slate-300">{risk.owner}</strong>
                      </span>
                    </div>
                    <p className={`text-sm font-bold ${risk.status !== 'Open' ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-200'}`}>
                      {risk.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={risk.status}
                      onChange={(e) => handleUpdateRiskStatus(risk.id, e.target.value as any)}
                      className="text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-300 outline-none"
                    >
                      <option value="Open">Open</option>
                      <option value="Mitigated">Mitigated</option>
                      <option value="Closed">Closed</option>
                    </select>

                    <button
                      onClick={() => handleDeleteRisk(risk.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Issues SubTab */}
      {subTab === 'issues' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          {issues.length === 0 ? (
            <div className="p-10 text-center text-slate-400">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50 text-emerald-500" />
              <p className="text-xs font-medium">No open issues reported. All tasks running smoothly.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {issues.map(issue => (
                <div key={issue.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        issue.severity === 'Critical' ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800' :
                        issue.severity === 'High' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800' :
                        'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800'
                      }`}>
                        Severity: {issue.severity}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Owner: <strong className="text-slate-600 dark:text-slate-300">{issue.owner}</strong>
                      </span>
                    </div>
                    <p className={`text-sm font-bold ${issue.status !== 'Open' ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-200'}`}>
                      {issue.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={issue.status}
                      onChange={(e) => handleUpdateIssueStatus(issue.id, e.target.value as any)}
                      className="text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-300 outline-none"
                    >
                      <option value="Open">Open</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Closed">Closed</option>
                    </select>

                    <button
                      onClick={() => handleDeleteIssue(issue.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                {subTab === 'risks' ? 'Log Project Risk' : 'Log Project Issue'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleAddRiskOrIssue} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Description *
                </label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={subTab === 'risks' ? 'Describe potential risk to schedule, budget, or architecture...' : 'Describe the blocking bug or technical issue...'}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-amber-500 outline-none"
                />
              </div>

              {subTab === 'risks' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Probability
                    </label>
                    <select
                      value={probability}
                      onChange={e => setProbability(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-amber-500 outline-none"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Impact
                    </label>
                    <select
                      value={impact}
                      onChange={e => setImpact(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-amber-500 outline-none"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Severity Level
                  </label>
                  <select
                    value={severity}
                    onChange={e => setSeverity(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-amber-500 outline-none"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical (Blocks Phase)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Assignee / Owner
                </label>
                <input
                  type="text"
                  value={owner}
                  onChange={e => setOwner(e.target.value)}
                  placeholder="e.g. Lead Architect or Jane Doe"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
