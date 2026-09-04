import React, { useState } from 'react';
import { ProjectTemplate, TemplatePhaseDef, TemplateStepDef } from '../types';
import { 
  FileCode, 
  Plus, 
  Copy, 
  Trash2, 
  Edit3, 
  Layers, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  ChevronDown,
  X,
  Play
} from 'lucide-react';

interface ProjectTemplateBuilderProps {
  templates: ProjectTemplate[];
  onSaveTemplate: (template: ProjectTemplate) => void;
  onDeleteTemplate?: (templateId: string) => void;
  onSelectTemplateToCreate: (template: ProjectTemplate) => void;
}

export const ProjectTemplateBuilder: React.FC<ProjectTemplateBuilderProps> = ({
  templates,
  onSaveTemplate,
  onDeleteTemplate,
  onSelectTemplateToCreate
}) => {
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<ProjectTemplate | null>(null);
  const [isNewTemplateModalOpen, setIsNewTemplateModalOpen] = useState(false);

  // Helper for starting a new template
  const handleStartNewTemplate = () => {
    const freshTemplate: ProjectTemplate = {
      id: `template_custom_${Date.now()}`,
      name: '',
      description: '',
      category: 'custom',
      isDefault: false,
      defaultPhases: [
        {
          id: `phase_${Math.random().toString(36).substring(2, 7)}`,
          name: 'Phase 1 — Discovery & Design',
          order: 1,
          defaultSteps: [
            {
              id: `step_${Math.random().toString(36).substring(2, 7)}`,
              title: 'Requirements Gathering',
              description: 'Initial scope alignment and stakeholder requirements.',
              estimatedDays: 7,
              defaultSubtasks: ['Review client brief', 'Stakeholder kickoff meeting', 'Document functional specs']
            }
          ]
        }
      ]
    };
    setEditingTemplate(freshTemplate);
    setIsNewTemplateModalOpen(true);
  };

  // Duplicate a template
  const handleDuplicate = (t: ProjectTemplate) => {
    const duplicated: ProjectTemplate = {
      ...t,
      id: `template_${Date.now()}`,
      name: `${t.name} (Copy)`,
      isDefault: false,
      createdAt: new Date().toISOString()
    };
    onSaveTemplate(duplicated);
  };

  // Add Phase to template editor
  const handleAddPhaseToEditor = () => {
    if (!editingTemplate) return;
    const newPhase: TemplatePhaseDef = {
      id: `phase_${Math.random().toString(36).substring(2, 7)}`,
      name: `Phase ${editingTemplate.defaultPhases.length + 1}`,
      order: editingTemplate.defaultPhases.length + 1,
      defaultSteps: []
    };
    setEditingTemplate({
      ...editingTemplate,
      defaultPhases: [...editingTemplate.defaultPhases, newPhase]
    });
  };

  // Add Step to a Phase in editor
  const handleAddStepToPhaseInEditor = (phaseId: string) => {
    if (!editingTemplate) return;
    const newStep: TemplateStepDef = {
      id: `step_${Math.random().toString(36).substring(2, 7)}`,
      title: 'New Process Step',
      estimatedDays: 7,
      defaultSubtasks: []
    };

    const updatedPhases = editingTemplate.defaultPhases.map(p => {
      if (p.id !== phaseId) return p;
      return { ...p, defaultSteps: [...p.defaultSteps, newStep] };
    });

    setEditingTemplate({
      ...editingTemplate,
      defaultPhases: updatedPhases
    });
  };

  // Save template from modal
  const handleSaveEditor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate || !editingTemplate.name.trim()) return;

    onSaveTemplate(editingTemplate);
    setIsNewTemplateModalOpen(false);
    setEditingTemplate(null);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <FileCode className="w-6 h-6 text-blue-600 dark:text-blue-500" />
            Project Template Builder
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Configure reusable process workflows. Each project type (Matrix, UbookStore, DIR LMS, Website) shares the same tracking core with customized phases and steps.
          </p>
        </div>
        <button
          onClick={handleStartNewTemplate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Create New Template
        </button>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {templates.map(tpl => {
          const totalPhases = tpl.defaultPhases?.length || 0;
          let totalSteps = 0;
          let totalDays = 0;
          tpl.defaultPhases?.forEach(p => {
            totalSteps += p.defaultSteps?.length || 0;
            p.defaultSteps?.forEach(s => {
              totalDays += s.estimatedDays || 7;
            });
          });

          const isPreviewOpen = previewTemplateId === tpl.id;

          return (
            <div 
              key={tpl.id}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col justify-between"
            >
              <div className="p-6">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                        {tpl.category.toUpperCase()}
                      </span>
                      {tpl.isDefault && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          Standard Template
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      {tpl.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDuplicate(tpl)}
                      title="Duplicate Template"
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingTemplate(JSON.parse(JSON.stringify(tpl)));
                        setIsNewTemplateModalOpen(true);
                      }}
                      title="Edit Template"
                      className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    {!tpl.isDefault && onDeleteTemplate && (
                      <button
                        onClick={() => onDeleteTemplate(tpl.id)}
                        title="Delete Template"
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">
                  {tpl.description}
                </p>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-center">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Phases</span>
                    <span className="text-sm font-black text-slate-800 dark:text-slate-200">{totalPhases}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Steps</span>
                    <span className="text-sm font-black text-slate-800 dark:text-slate-200">{totalSteps}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Est. Timeline</span>
                    <span className="text-sm font-black text-slate-800 dark:text-slate-200">~{totalDays}d</span>
                  </div>
                </div>

                {/* Preview Dropdown */}
                <div className="mt-4">
                  <button
                    onClick={() => setPreviewTemplateId(isPreviewOpen ? null : tpl.id)}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    {isPreviewOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    {isPreviewOpen ? 'Hide Workflow Pipeline' : 'View Workflow Steps Pipeline'}
                  </button>

                  {isPreviewOpen && (
                    <div className="mt-3 space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800 max-h-60 overflow-y-auto pr-1">
                      {tpl.defaultPhases.map((phase, pi) => (
                        <div key={phase.id} className="space-y-1.5">
                          <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            {phase.name}
                          </span>
                          <div className="pl-3 space-y-1">
                            {phase.defaultSteps.map((st, si) => (
                              <div key={st.id} className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                <span className="text-slate-400 font-mono text-[10px]">{pi + 1}.{si + 1}</span>
                                <span>{st.title}</span>
                                {st.defaultSubtasks && st.defaultSubtasks.length > 0 && (
                                  <span className="text-[9px] text-slate-400 font-medium">({st.defaultSubtasks.length} subtasks)</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => onSelectTemplateToCreate(tpl)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl shadow-sm transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Use This Template
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Template Edit / Create Modal */}
      {isNewTemplateModalOpen && editingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                {editingTemplate.isDefault ? 'Edit Template Specification' : 'Configure Custom Template'}
              </h3>
              <button 
                onClick={() => setIsNewTemplateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditor} className="p-6 space-y-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Template Name
                  </label>
                  <input
                    required
                    type="text"
                    value={editingTemplate.name}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                    placeholder="e.g., Corporate Portal Deployment"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Category
                  </label>
                  <select
                    value={editingTemplate.category}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, category: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none"
                  >
                    <option value="library">Matrix</option>
                    <option value="ecommerce">UbookStore</option>
                    <option value="lms">DIR LMS</option>
                    <option value="website">Website</option>
                    <option value="custom">Custom Project</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editingTemplate.description}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                  placeholder="Describe the workflow purpose, prerequisites, and deliverables..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Phases and Steps Builder */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-blue-500" />
                    Process Phases & Steps
                  </span>
                  <button
                    type="button"
                    onClick={handleAddPhaseToEditor}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Phase
                  </button>
                </div>

                <div className="space-y-4">
                  {editingTemplate.defaultPhases.map((phase, pIdx) => (
                    <div 
                      key={phase.id} 
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <input
                          type="text"
                          value={phase.name}
                          onChange={(e) => {
                            const updatedPhases = [...editingTemplate.defaultPhases];
                            updatedPhases[pIdx].name = e.target.value;
                            setEditingTemplate({ ...editingTemplate, defaultPhases: updatedPhases });
                          }}
                          className="font-bold text-xs bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white flex-1"
                          placeholder="Phase Name (e.g. Phase 1 — Website)"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddStepToPhaseInEditor(phase.id)}
                          className="text-[11px] font-bold text-blue-600 bg-white dark:bg-slate-800 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Add Step
                        </button>
                      </div>

                      {/* Steps inside this phase */}
                      <div className="space-y-2 pl-2">
                        {phase.defaultSteps.map((step, sIdx) => (
                          <div 
                            key={step.id} 
                            className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <input
                                type="text"
                                value={step.title}
                                onChange={(e) => {
                                  const updatedPhases = [...editingTemplate.defaultPhases];
                                  updatedPhases[pIdx].defaultSteps[sIdx].title = e.target.value;
                                  setEditingTemplate({ ...editingTemplate, defaultPhases: updatedPhases });
                                }}
                                placeholder="Step Title (e.g., Data Gap Check)"
                                className="font-semibold text-xs flex-1 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                              />
                              <div className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
                                <span>Est.</span>
                                <input
                                  type="number"
                                  value={step.estimatedDays || 7}
                                  onChange={(e) => {
                                    const updatedPhases = [...editingTemplate.defaultPhases];
                                    updatedPhases[pIdx].defaultSteps[sIdx].estimatedDays = Number(e.target.value);
                                    setEditingTemplate({ ...editingTemplate, defaultPhases: updatedPhases });
                                  }}
                                  className="w-12 px-1 py-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-center text-xs"
                                />
                                <span>days</span>
                              </div>
                            </div>

                            {/* Subtasks comma-separated */}
                            <div>
                              <span className="text-[10px] text-slate-400 font-medium block mb-1">
                                Default Subtasks (comma-separated):
                              </span>
                              <input
                                type="text"
                                value={(step.defaultSubtasks || []).join(', ')}
                                onChange={(e) => {
                                  const list = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                  const updatedPhases = [...editingTemplate.defaultPhases];
                                  updatedPhases[pIdx].defaultSteps[sIdx].defaultSubtasks = list;
                                  setEditingTemplate({ ...editingTemplate, defaultPhases: updatedPhases });
                                }}
                                placeholder="e.g. Collect catalog, Check missing ISBNs, Verify patron records"
                                className="w-full text-xs px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewTemplateModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                >
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
