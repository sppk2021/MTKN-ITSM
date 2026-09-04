export type ProjectHealth = 'green' | 'amber' | 'red';

export type TaskStatus = 
  | 'not_started' 
  | 'in_progress' 
  | 'waiting' 
  | 'review_qa' 
  | 'completed' 
  | 'on_hold'
  | 'blocked' 
  | 'cancelled';

export type ProjectPriority = 'low' | 'medium' | 'high' | 'critical';

export type ProjectOverallStatus = 
  | 'not_started' 
  | 'active' 
  | 'waiting' 
  | 'completed' 
  | 'on_hold' 
  | 'cancelled';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  assignedTo?: string;
  dueDate?: string;
}

export interface ProcessStep {
  id: string;
  title: string;
  description?: string;
  phaseId?: string;
  phaseName?: string;
  startDate?: string;
  dueDate?: string;
  completedDate?: string;
  personResponsible?: string;
  status: TaskStatus;
  blockedReason?: string; // Explicit reason if status is 'blocked' or 'waiting'
  notes?: string;
  attachments?: Array<{ id?: string; name: string; url?: string; size?: string }>;
  subtasks: Subtask[];
  order: number;
}

export type SOPTask = ProcessStep;

export interface PhaseGate {
  id: string;
  name: string;
  conditions: string[];
  isApproved: boolean;
  assignedApprover?: string;
  approverRole?: string;
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
}

export interface ProjectPhase {
  id: string;
  name: string;
  description?: string;
  order: number;
  steps: ProcessStep[];
  // Backwards compatibility with previous schema
  status?: string;
  tasks?: any[];
  gate?: PhaseGate;
}

export interface TemplateStepDef {
  id: string;
  title: string;
  description?: string;
  defaultSubtasks?: string[];
  estimatedDays?: number;
}

export interface TemplatePhaseDef {
  id: string;
  name: string;
  order: number;
  defaultSteps: TemplateStepDef[];
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: 'library' | 'ecommerce' | 'lms' | 'website' | 'custom';
  defaultPhases: TemplatePhaseDef[];
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BlockedItem {
  id: string;
  projectId: string;
  projectTitle: string;
  stepId: string;
  stepTitle: string;
  phaseName?: string;
  status: 'blocked' | 'waiting';
  reason: string;
  personResponsible?: string;
  updatedAt?: string;
}

export interface ProjectActivity {
  id: string;
  date: string;
  action: string;
  user?: string;
}

export interface ProjectRisk {
  id: string;
  description: string;
  probability: 'Low' | 'Medium' | 'High';
  impact: 'Low' | 'Medium' | 'High';
  status: 'Open' | 'Mitigated' | 'Closed';
  owner: string;
}

export interface ProjectIssue {
  id: string;
  description: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Open' | 'Resolved' | 'Closed';
  owner: string;
}

export interface ChangeRequest {
  id: string;
  title: string;
  description: string;
  reason?: string;
  category: 'Scope' | 'Timeline' | 'Budget' | 'Technical' | 'Resource';
  impact: 'Low' | 'Medium' | 'High' | 'Critical';
  budgetImpact: number;
  timelineImpactDays: number;
  requestedBy: string;
  requestedAt: string;
  assignedApprover?: string;
  approverRole?: string;
  status: 'Requested' | 'Under Review' | 'Approved' | 'Rejected' | 'Implemented';
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  comments?: string;
}

export interface ProjectDocument {
  id: string;
  name: string;
  phaseId: string;
  url?: string;
  status: 'missing' | 'draft' | 'final';
  uploadedAt?: string;
  uploadedBy?: string;
}

export interface ProjectMilestone {
  id: string;
  name: string;
  description?: string;
  plannedDate: string;
  forecastDate: string;
  actualDate?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  owner?: string;
  deliverables?: string[];
}

export interface ITProject {
  id: string;
  name: string; // Project Name (e.g., "Library Management – Matrix", "UBook Store Website")
  title?: string; // alias
  client: string; // Client / Department (e.g., "Central University", "UBook Retail")
  department?: string; // alias
  projectType: string; // "Matrix", "UbookStore", "DIR LMS", "Website", "Custom"
  projectOwner: string; // e.g. "Saw Pyae Phyo Kyaw"
  ownerId?: string;
  startDate: string;
  targetDate: string;
  targetEndDate?: string; // alias
  priority: ProjectPriority;
  status: ProjectOverallStatus;
  health: ProjectHealth;
  progressPercent: number; // Computed: (Completed Tasks ÷ Total Tasks × 100)
  currentStep: string; // e.g., "iOS Development"
  nextAction: string; // e.g., "Complete iOS payment integration"
  notes?: string;
  files?: Array<{ id: string; name: string; url?: string; size?: string; uploadedAt?: string }>;
  phases: ProjectPhase[];
  activityLog?: ProjectActivity[];
  
  // Template metadata
  templateId?: string;
  templateUsed?: string;
  
  // Enterprise governance fields (backwards compatibility)
  sponsorId?: string;
  sponsorName?: string;
  projectManagerId?: string;
  projectManagerName?: string;
  milestones?: ProjectMilestone[];
  risks?: ProjectRisk[];
  issues?: ProjectIssue[];
  changeRequests?: ChangeRequest[];
  documents?: ProjectDocument[];
  budget?: {
    planned: number;
    actual: number;
  };
  
  createdAt?: string;
  updatedAt?: string;
}
