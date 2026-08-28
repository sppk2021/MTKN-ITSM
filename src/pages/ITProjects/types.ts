export type ProjectHealth = 'green' | 'amber' | 'red';
export type ProjectPhaseStatus = 'not_started' | 'in_progress' | 'pending_approval' | 'approved' | 'completed';
export type TaskStatus = 'not_started' | 'in_progress' | 'pending_review' | 'approved' | 'completed';

export interface SOPTask {
  id: string;
  title: string;
  description: string;
  ownerId?: string;
  ownerName?: string;
  status: TaskStatus;
  requiredDocs?: string[];
  dependencyIds?: string[];
}

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
  status: ProjectPhaseStatus;
  tasks: SOPTask[];
  gate?: PhaseGate;
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
  budgetImpact: number; // e.g. +$5000 or -$2000
  timelineImpactDays: number; // e.g. +14 days
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
  title: string;
  description: string;
  projectManagerId: string;
  projectManagerName?: string;
  sponsorId?: string;
  sponsorName?: string;
  department: string;
  status: 'draft' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  health: ProjectHealth;
  progressPercent: number;
  startDate: string;
  targetEndDate: string;
  
  templateUsed?: string;
  phases: ProjectPhase[];
  milestones?: ProjectMilestone[];
  risks: ProjectRisk[];
  issues: ProjectIssue[];
  changeRequests: ChangeRequest[];
  documents: ProjectDocument[];
  
  budget: {
    planned: number;
    actual: number;
  };
  
  createdAt: string;
  updatedAt: string;
}
