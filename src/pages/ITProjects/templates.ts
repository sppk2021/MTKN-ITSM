import { ITProject, ProjectPhase, SOPTask } from './types';

const generateId = () => Math.random().toString(36).substr(2, 9);

export const SOFTWARE_DEV_TEMPLATE: ProjectPhase[] = [
  {
    id: generateId(),
    name: 'Phase 1 - Initiation',
    status: 'not_started',
    tasks: [
      { id: generateId(), title: 'Create project charter', description: 'Define the initial project charter.', status: 'not_started' },
      { id: generateId(), title: 'Identify stakeholders', description: 'List all stakeholders.', status: 'not_started' },
      { id: generateId(), title: 'Define business objective', description: 'What is the goal?', status: 'not_started' },
      { id: generateId(), title: 'Obtain project approval', description: 'Get formal sign-off.', status: 'not_started' },
    ],
    gate: {
      id: generateId(),
      name: 'Project Charter Approved',
      conditions: ['Project Charter Document Uploaded', 'Stakeholder Sign-off'],
      isApproved: false,
      assignedApprover: 'Project Sponsor',
      approverRole: 'Executive Sponsor'
    }
  },
  {
    id: generateId(),
    name: 'Phase 2 - Requirements',
    status: 'not_started',
    tasks: [
      { id: generateId(), title: 'Conduct requirement workshop', description: 'Meet with stakeholders.', status: 'not_started' },
      { id: generateId(), title: 'Document requirements (BRD)', description: 'Create Business Requirements Document.', status: 'not_started', requiredDocs: ['BRD'] },
      { id: generateId(), title: 'Review requirements', description: 'Review with tech team.', status: 'not_started' },
      { id: generateId(), title: 'Baseline requirements', description: 'Lock in scope.', status: 'not_started' },
    ],
    gate: {
      id: generateId(),
      name: 'Requirements Complete',
      conditions: ['BRD Uploaded', 'Business Owner Reviewed', 'Open critical issues = 0'],
      isApproved: false,
      assignedApprover: 'Project Manager',
      approverRole: 'PM / Product Lead'
    }
  },
  {
    id: generateId(),
    name: 'Phase 3 - Planning & Design',
    status: 'not_started',
    tasks: [
      { id: generateId(), title: 'Create WBS', description: 'Work Breakdown Structure.', status: 'not_started' },
      { id: generateId(), title: 'Solution Architecture', description: 'Design system architecture.', status: 'not_started', requiredDocs: ['Architecture Diagram'] },
      { id: generateId(), title: 'Create Risk Register', description: 'Identify project risks.', status: 'not_started' },
    ],
    gate: {
      id: generateId(),
      name: 'Design Approved',
      conditions: ['Architecture Diagram Uploaded', 'Security Review Complete'],
      isApproved: false,
      assignedApprover: 'IT Director',
      approverRole: 'Architecture Lead'
    }
  },
  {
    id: generateId(),
    name: 'Phase 4 - Development & Testing',
    status: 'not_started',
    tasks: [
      { id: generateId(), title: 'Development Sprints', description: 'Execute build.', status: 'not_started' },
      { id: generateId(), title: 'System Testing', description: 'QA verification.', status: 'not_started' },
      { id: generateId(), title: 'UAT', description: 'User Acceptance Testing.', status: 'not_started', requiredDocs: ['UAT Sign-off'] },
    ],
    gate: {
      id: generateId(),
      name: 'Go-Live Ready',
      conditions: ['UAT Sign-off Uploaded', 'Zero High/Critical Defects'],
      isApproved: false,
      assignedApprover: 'Project Sponsor',
      approverRole: 'Business Sponsor'
    }
  },
  {
    id: generateId(),
    name: 'Phase 5 - Deployment & Closure',
    status: 'not_started',
    tasks: [
      { id: generateId(), title: 'Production Deployment', description: 'Deploy to live.', status: 'not_started' },
      { id: generateId(), title: 'Post-Implementation Review', description: 'Lessons learned.', status: 'not_started' },
      { id: generateId(), title: 'Handover to Operations', description: 'Transition to support.', status: 'not_started' },
    ],
    gate: {
      id: generateId(),
      name: 'Project Closed',
      conditions: ['Handover Document Uploaded', 'Lessons Learned Uploaded'],
      isApproved: false,
      assignedApprover: 'IT Director',
      approverRole: 'Operations Lead'
    }
  }
];

export const CLOUD_MIGRATION_TEMPLATE: ProjectPhase[] = [
  {
    id: generateId(),
    name: 'Phase 1 - Discovery & Assessment',
    status: 'not_started',
    tasks: [
      { id: generateId(), title: 'Inventory Workloads', description: 'Map existing on-premise servers and applications.', status: 'not_started' },
      { id: generateId(), title: 'Dependency Analysis', description: 'Analyze system dependencies.', status: 'not_started' },
      { id: generateId(), title: 'Cloud Readiness Assessment', description: 'Evaluate readiness for cloud.', status: 'not_started', requiredDocs: ['Readiness Report'] },
    ],
    gate: {
      id: generateId(),
      name: 'Assessment Sign-off',
      conditions: ['Readiness Report Uploaded', 'Management Approval'],
      isApproved: false,
      assignedApprover: 'Project Sponsor'
    }
  },
  {
    id: generateId(),
    name: 'Phase 2 - Planning & Architecture',
    status: 'not_started',
    tasks: [
      { id: generateId(), title: 'Define Migration Strategy', description: 'Rehost, Refactor, or Replatform?', status: 'not_started' },
      { id: generateId(), title: 'Cloud Landing Zone Design', description: 'Network, IAM, and Security design.', status: 'not_started', requiredDocs: ['Architecture Diagram'] },
      { id: generateId(), title: 'Cost Estimation', description: 'Estimate monthly cloud spend.', status: 'not_started' },
    ],
    gate: {
      id: generateId(),
      name: 'Architecture Approved',
      conditions: ['Architecture Diagram Uploaded', 'Budget Approved'],
      isApproved: false,
      assignedApprover: 'Architecture Review Board'
    }
  },
  {
    id: generateId(),
    name: 'Phase 3 - Pilot Migration',
    status: 'not_started',
    tasks: [
      { id: generateId(), title: 'Setup Landing Zone', description: 'Deploy base infrastructure.', status: 'not_started' },
      { id: generateId(), title: 'Migrate Non-Prod Workloads', description: 'Migrate dev/test environments.', status: 'not_started' },
      { id: generateId(), title: 'Pilot Validation', description: 'Validate performance and security.', status: 'not_started', requiredDocs: ['Pilot Validation Report'] },
    ],
    gate: {
      id: generateId(),
      name: 'Pilot Success',
      conditions: ['Pilot Validation Report Uploaded', 'Security Team Sign-off'],
      isApproved: false,
      assignedApprover: 'IT Director'
    }
  },
  {
    id: generateId(),
    name: 'Phase 4 - Mass Migration & Cutover',
    status: 'not_started',
    tasks: [
      { id: generateId(), title: 'Production Data Sync', description: 'Initial and delta data sync.', status: 'not_started' },
      { id: generateId(), title: 'Downtime Window', description: 'Execute final cutover.', status: 'not_started' },
      { id: generateId(), title: 'Post-Migration Testing', description: 'Verify production functionality.', status: 'not_started', requiredDocs: ['UAT Sign-off'] },
    ],
    gate: {
      id: generateId(),
      name: 'Migration Complete',
      conditions: ['UAT Sign-off Uploaded', 'Business Owner Acceptance'],
      isApproved: false,
      assignedApprover: 'Project Sponsor'
    }
  },
  {
    id: generateId(),
    name: 'Phase 5 - Optimization & Closure',
    status: 'not_started',
    tasks: [
      { id: generateId(), title: 'Cost Optimization', description: 'Right-size instances.', status: 'not_started' },
      { id: generateId(), title: 'Decommission On-Prem', description: 'Retire old hardware.', status: 'not_started' },
      { id: generateId(), title: 'Project Handover', description: 'Handover to CloudOps team.', status: 'not_started', requiredDocs: ['Handover Document'] },
    ],
    gate: {
      id: generateId(),
      name: 'Project Closed',
      conditions: ['Handover Document Uploaded', 'No critical open issues'],
      isApproved: false,
      assignedApprover: 'IT Director'
    }
  }
];

export const INFRASTRUCTURE_TEMPLATE: ProjectPhase[] = [
  {
    id: generateId(),
    name: 'Phase 1 - Discovery & Requirements',
    status: 'not_started',
    tasks: [
      { id: generateId(), title: 'Site Survey', description: 'Physical inspection of facilities.', status: 'not_started' },
      { id: generateId(), title: 'Hardware Audit', description: 'Audit existing equipment.', status: 'not_started' },
      { id: generateId(), title: 'Define Requirements', description: 'Bandwidth, power, cooling needs.', status: 'not_started', requiredDocs: ['Requirements Spec'] },
    ],
    gate: {
      id: generateId(),
      name: 'Audit Complete',
      conditions: ['Requirements Spec Uploaded', 'Stakeholder Sign-off'],
      isApproved: false,
      assignedApprover: 'Project Sponsor'
    }
  },
  {
    id: generateId(),
    name: 'Phase 2 - Procurement',
    status: 'not_started',
    tasks: [
      { id: generateId(), title: 'Vendor Selection', description: 'Evaluate and select hardware vendors.', status: 'not_started' },
      { id: generateId(), title: 'Create Purchase Orders', description: 'Issue POs for equipment.', status: 'not_started' },
      { id: generateId(), title: 'Delivery & Inventory', description: 'Receive and log equipment.', status: 'not_started', requiredDocs: ['Inventory Log'] },
    ],
    gate: {
      id: generateId(),
      name: 'Hardware Delivered',
      conditions: ['Inventory Log Uploaded', 'All critical items received'],
      isApproved: false,
      assignedApprover: 'Project Manager'
    }
  },
  {
    id: generateId(),
    name: 'Phase 3 - Installation & Config',
    status: 'not_started',
    tasks: [
      { id: generateId(), title: 'Rack and Stack', description: 'Physical installation.', status: 'not_started' },
      { id: generateId(), title: 'Cabling & Power', description: 'Run cables and connect power.', status: 'not_started' },
      { id: generateId(), title: 'Base Configuration', description: 'Install OS, configure IPs, routing.', status: 'not_started' },
    ],
    gate: {
      id: generateId(),
      name: 'Installation Complete',
      conditions: ['Physical Install Verified', 'Network Connectivity Confirmed'],
      isApproved: false,
      assignedApprover: 'Infrastructure Lead'
    }
  },
  {
    id: generateId(),
    name: 'Phase 4 - Testing & Validation',
    status: 'not_started',
    tasks: [
      { id: generateId(), title: 'Load Testing', description: 'Test capacity and throughput.', status: 'not_started' },
      { id: generateId(), title: 'Security Scan', description: 'Run vulnerability assessments.', status: 'not_started', requiredDocs: ['Security Report'] },
      { id: generateId(), title: 'Failover Testing', description: 'Test redundancy systems.', status: 'not_started' },
    ],
    gate: {
      id: generateId(),
      name: 'Ready for Service',
      conditions: ['Security Report Uploaded', 'Failover Test Passed'],
      isApproved: false,
      assignedApprover: 'IT Director'
    }
  },
  {
    id: generateId(),
    name: 'Phase 5 - Handover',
    status: 'not_started',
    tasks: [
      { id: generateId(), title: 'Update Documentation', description: 'Update network diagrams.', status: 'not_started', requiredDocs: ['As-Built Diagrams'] },
      { id: generateId(), title: 'Old Hardware Disposal', description: 'Securely wipe and dispose.', status: 'not_started' },
      { id: generateId(), title: 'NOC Handover', description: 'Handover to Network Operations.', status: 'not_started' },
    ],
    gate: {
      id: generateId(),
      name: 'Project Closed',
      conditions: ['As-Built Diagrams Uploaded', 'NOC Sign-off'],
      isApproved: false,
      assignedApprover: 'IT Director'
    }
  }
];

export const generateNewProject = (templateType: 'software' | 'cloud' | 'infrastructure', title: string, department: string, pmId: string): Omit<ITProject, 'id' | 'createdAt' | 'updatedAt'> => {
  let phases = SOFTWARE_DEV_TEMPLATE;
  
  if (templateType === 'cloud') phases = CLOUD_MIGRATION_TEMPLATE;
  else if (templateType === 'infrastructure') phases = INFRASTRUCTURE_TEMPLATE;

  const now = new Date();
  
  // Default milestones based on type
  let defaultMilestones = [];
  
  if (templateType === 'cloud') {
    defaultMilestones = [
      { id: generateId(), name: 'Assessment Sign-off', plannedDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], forecastDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], status: 'pending' as const },
      { id: generateId(), name: 'Architecture Approved', plannedDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], forecastDate: new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], status: 'pending' as const },
      { id: generateId(), name: 'Pilot Success', plannedDate: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], forecastDate: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], status: 'pending' as const },
      { id: generateId(), name: 'Production Cutover', plannedDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], forecastDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], status: 'pending' as const }
    ];
  } else if (templateType === 'infrastructure') {
    defaultMilestones = [
      { id: generateId(), name: 'Requirements Frozen', plannedDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], forecastDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], status: 'pending' as const },
      { id: generateId(), name: 'Hardware Delivered', plannedDate: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], forecastDate: new Date(now.getTime() + 50 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], status: 'pending' as const },
      { id: generateId(), name: 'Installation Complete', plannedDate: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], forecastDate: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], status: 'pending' as const },
      { id: generateId(), name: 'Ready for Service', plannedDate: new Date(now.getTime() + 75 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], forecastDate: new Date(now.getTime() + 75 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], status: 'pending' as const }
    ];
  } else {
    // Software
    defaultMilestones = [
      { id: generateId(), name: 'Requirements Approved', plannedDate: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], forecastDate: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], status: 'pending' as const },
      { id: generateId(), name: 'Design Complete', plannedDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], forecastDate: new Date(now.getTime() + 32 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], status: 'pending' as const },
      { id: generateId(), name: 'UAT Sign-off', plannedDate: new Date(now.getTime() + 75 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], forecastDate: new Date(now.getTime() + 75 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], status: 'pending' as const },
      { id: generateId(), name: 'Go-Live', plannedDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], forecastDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], status: 'pending' as const }
    ];
  }

  return {
    title,
    description: 'Auto-generated project playbook',
    projectManagerId: pmId,
    department,
    status: 'draft',
    health: 'green',
    progressPercent: 0,
    startDate: now.toISOString().split('T')[0],
    targetEndDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    templateUsed: templateType,
    phases,
    milestones: defaultMilestones,
    risks: [],
    issues: [],
    changeRequests: [],
    documents: [],
    budget: { planned: 10000, actual: 0 }
  };
};
