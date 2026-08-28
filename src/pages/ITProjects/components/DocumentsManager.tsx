import React, { useState } from 'react';
import { ITProject, ProjectDocument } from '../types';
import { FileText, Plus, ExternalLink, CheckCircle2, AlertCircle, Trash2, UploadCloud } from 'lucide-react';

interface DocumentsManagerProps {
  project: ITProject;
  onUpdateProject: (updatedProject: ITProject) => Promise<void>;
  currentUser?: { uid?: string; displayName?: string; email?: string } | null;
}

export default function DocumentsManager({
  project,
  onUpdateProject,
  currentUser
}: DocumentsManagerProps) {
  const [showModal, setShowModal] = useState(false);
  const [docName, setDocName] = useState('');
  const [phaseId, setPhaseId] = useState(project.phases[0]?.id || '');
  const [docUrl, setDocUrl] = useState('');
  const [status, setStatus] = useState<'draft' | 'final'>('final');

  const documents = project.documents || [];

  const handleAddDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName.trim()) return;

    const newDoc: ProjectDocument = {
      id: Math.random().toString(36).substring(2, 9),
      name: docName.trim(),
      phaseId,
      url: docUrl.trim() || undefined,
      status,
      uploadedAt: new Date().toISOString(),
      uploadedBy: currentUser?.displayName || currentUser?.email || 'User'
    };

    await onUpdateProject({
      ...project,
      documents: [newDoc, ...documents]
    });

    setDocName('');
    setDocUrl('');
    setShowModal(false);
  };

  const handleDeleteDoc = async (docId: string) => {
    const updatedDocs = documents.filter(d => d.id !== docId);
    await onUpdateProject({
      ...project,
      documents: updatedDocs
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Project Documents & Gate Artifacts
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Central repository for mandatory SOP deliverables, architecture designs, and compliance sign-offs.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Document
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {documents.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <UploadCloud className="w-8 h-8 mx-auto mb-2 opacity-50 text-blue-500" />
            <p className="text-xs font-medium">No documents attached yet. Attach requirements specs or architecture docs to satisfy gate conditions.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {documents.map(doc => {
              const phaseName = project.phases.find(p => p.id === doc.phaseId)?.name || 'General';
              return (
                <div key={doc.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {doc.name}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>Phase: {phaseName}</span>
                        <span>•</span>
                        <span className="capitalize font-semibold text-slate-700 dark:text-slate-300">{doc.status}</span>
                        {doc.uploadedBy && <span>• Uploaded by {doc.uploadedBy}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {doc.url && (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                        title="Open document link"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => handleDeleteDoc(doc.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                      title="Delete document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Attach Project Document
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleAddDoc} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Document Title *
                </label>
                <input
                  type="text"
                  required
                  value={docName}
                  onChange={e => setDocName(e.target.value)}
                  placeholder="e.g. Architecture Diagram, Security Report, UAT Signoff"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Associated Phase
                </label>
                <select
                  value={phaseId}
                  onChange={e => setPhaseId(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none font-medium"
                >
                  {project.phases.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Document URL / Cloud Link (Optional)
                </label>
                <input
                  type="url"
                  value={docUrl}
                  onChange={e => setDocUrl(e.target.value)}
                  placeholder="https://drive.google.com/... or cloud share link"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none font-medium"
                >
                  <option value="draft">Draft</option>
                  <option value="final">Final / Approved</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                >
                  Attach
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
