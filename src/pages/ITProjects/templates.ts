import { ITProject, ProjectPhase, ProcessStep, ProjectTemplate, Subtask } from './types';

export const generateId = () => Math.random().toString(36).substring(2, 9);

// 1. Template 1 — Matrix
export const TEMPLATE_LIBRARY_MATRIX: ProjectTemplate = {
  id: 'template_library_matrix',
  name: 'Matrix',
  description: 'Standard enterprise library management system deployment flow for Matrix ILS.',
  category: 'library',
  isDefault: true,
  defaultPhases: [
    {
      id: 'phase_matrix_flow',
      name: 'Implementation Flow',
      order: 1,
      defaultSteps: [
        {
          id: 'step_m1',
          title: 'Tender Process',
          description: 'Official tender submission, review specifications, and bidding.',
          defaultSubtasks: ['Review Tender RFP', 'Prepare Quotation & Specs', 'Submit Official Bid', 'Tender Defense Presentation'],
          estimatedDays: 14
        },
        {
          id: 'step_m2',
          title: 'Data Collection',
          description: 'Gather bibliographic MARC21 records, patron files, and circulation policies.',
          defaultSubtasks: ['Collect MARC21 Catalog Records', 'Collect Patron / Student Database', 'Gather Circulation Rules & Loan Periods', 'Barcode Format Specifications'],
          estimatedDays: 10
        },
        {
          id: 'step_m3',
          title: 'Data Gap Check',
          description: 'Validate data integrity, clean missing ISBNs/barcodes, and verify classification numbers.',
          defaultSubtasks: ['Check Missing ISBNs / Call Numbers', 'Identify Duplicate Barcodes', 'Validate Patron Data Fields', 'Client Sign-off on Data Schema'],
          estimatedDays: 7
        },
        {
          id: 'step_m4',
          title: 'Contracted',
          description: 'Formalize agreement, signing terms of service, and SLA contracts.',
          defaultSubtasks: ['Finalize Contract Terms', 'Legal Review & Sign-off', 'SLA Agreement Signed', 'Receive Initial Milestone Deposit'],
          estimatedDays: 7
        },
        {
          id: 'step_m5',
          title: 'Contact Matrix Team (Thailand)',
          description: 'Liaise with Matrix Thailand engineering team for database setup and license provisioning.',
          defaultSubtasks: ['Introduce Project Leads & Tech Channel', 'Send System Architecture Requirements', 'Obtain Matrix API Access Keys', 'Confirm Matrix Cloud Server Spec'],
          estimatedDays: 5
        },
        {
          id: 'step_m6',
          title: 'Configuration',
          description: 'Configure OPAC, SIP2 protocols, circulation modules, and RFID / barcode readers.',
          defaultSubtasks: ['Configure Server Database & Indexing', 'OPAC Custom Theme & Branding', 'SIP2 Protocol Integration for RFID', 'Map Circulation Rules & Privileges'],
          estimatedDays: 14
        },
        {
          id: 'step_m7',
          title: 'Training',
          description: 'Hands-on staff training for librarians, catalogers, and administrators.',
          defaultSubtasks: ['Admin System Management Training', 'Cataloging & Indexing Workshop', 'Circulation Desk Staff Hands-on', 'Self-Check Station User Guide'],
          estimatedDays: 5
        },
        {
          id: 'step_m8',
          title: 'Follow-up',
          description: 'Post-go-live checkup, support monitoring, and resolving user transition questions.',
          defaultSubtasks: ['Monitor Day 1 Circulation Transactions', 'Resolve Early Patron Inquiries', 'Verify Automated Nightly Backups', 'Client Satisfaction Survey'],
          estimatedDays: 14
        },
        {
          id: 'step_m9',
          title: 'Completed / Maintenance',
          description: 'Final project handover and continuous annual maintenance SLA.',
          defaultSubtasks: ['Final Acceptance Certificate Sign-off', 'Establish Monthly Maintenance Routine', 'Deliver As-Built Documentation'],
          estimatedDays: 365
        }
      ]
    }
  ]
};

// 2. Template 2 — UbookStore
export const TEMPLATE_UBOOK_STORE: ProjectTemplate = {
  id: 'template_ubook_store',
  name: 'UbookStore',
  description: 'Two-phase retail platform: Phase 1 Website followed by Phase 2 Native Mobile App.',
  category: 'ecommerce',
  isDefault: true,
  defaultPhases: [
    {
      id: 'phase_ubook_web',
      name: 'Phase 1 — Website',
      order: 1,
      defaultSteps: [
        {
          id: 'step_ub_w1',
          title: 'Development',
          description: 'Core web architecture, frontend UI, backend API, and payment gateway.',
          defaultSubtasks: ['UI / Frontend (Homepage, Catalog, Cart)', 'Backend (Inventory API, User Auth)', 'Payment System Integration (KBZPay, WavePay, Card)'],
          estimatedDays: 30
        },
        {
          id: 'step_ub_w2',
          title: 'Testing & QA',
          description: 'Comprehensive functional, security, and payment testing.',
          defaultSubtasks: ['Cross-browser Compatibility Tests', 'Payment Gateway Sandbox Tests', 'Load Testing Under Peak Traffic', 'Security & Vulnerability Scan'],
          estimatedDays: 10
        },
        {
          id: 'step_ub_w3',
          title: 'Bug Fixing',
          description: 'Triage and patch QA defects and checkout bottlenecks.',
          defaultSubtasks: ['Fix Checkout Edge Case Failures', 'Optimize Image Loading Speeds', 'Resolve Mobile View Responsive Glitches'],
          estimatedDays: 7
        },
        {
          id: 'step_ub_w4',
          title: 'Deployment',
          description: 'Production infrastructure provisioning, domain mapping, and live launch.',
          defaultSubtasks: ['Configure Production Cloud Server', 'Domain DNS & SSL Configuration', 'Staging to Production Cutover', 'Verify Live Transaction Flow'],
          estimatedDays: 3
        },
        {
          id: 'step_ub_w5',
          title: 'Maintenance',
          description: 'Continuous server health monitoring, security patches, and backups.',
          defaultSubtasks: ['Monitor Server Uptime & Latency', 'Automated Daily Database Backups', 'Bi-weekly Security Patching'],
          estimatedDays: 90
        }
      ]
    },
    {
      id: 'phase_ubook_mobile',
      name: 'Phase 2 — Mobile App',
      order: 2,
      defaultSteps: [
        {
          id: 'step_ub_m1',
          title: 'Mobile Development',
          description: 'Native mobile clients for Android and iOS.',
          defaultSubtasks: ['Android (Kotlin / Jetpack Compose)', 'iOS (Swift / SwiftUI)', 'Deep Linking & Push Notifications Setup'],
          estimatedDays: 45
        },
        {
          id: 'step_ub_m2',
          title: 'Testing',
          description: 'Device farm testing, beta builds via TestFlight and internal testing tracks.',
          defaultSubtasks: ['Android Device Compatibility Testing', 'TestFlight iOS Beta Testing', 'Push Notification Delivery Verification'],
          estimatedDays: 14
        },
        {
          id: 'step_ub_m3',
          title: 'Bug Fixing',
          description: 'Resolve mobile-specific crashes and caching anomalies.',
          defaultSubtasks: ['Fix Offline Reading Cache Glitches', 'Address Battery & Memory Consumption', 'Patch Crashlytics Priority Reports'],
          estimatedDays: 7
        },
        {
          id: 'step_ub_m4',
          title: 'Deployment',
          description: 'Store submissions, review guidelines compliance, and public release.',
          defaultSubtasks: ['Google Play Store App Submission', 'Apple App Store Review Submission', 'Prepare Store Screenshots & Metadata'],
          estimatedDays: 10
        },
        {
          id: 'step_ub_m5',
          title: 'New Features',
          description: 'Iterative mobile enhancements (loyalty program, audio previews).',
          defaultSubtasks: ['In-app Loyalty Points & Rewards', 'Audio Book Sample Previews', 'Personalized Book Recommendations'],
          estimatedDays: 30
        },
        {
          id: 'step_ub_m6',
          title: 'Maintenance',
          description: 'OS version upgrades and bug patch releases.',
          defaultSubtasks: ['Monitor App Store Crashes', 'Annual iOS / Android SDK Updates'],
          estimatedDays: 180
        }
      ]
    }
  ]
};

// 3. Template 3 — DIR LMS
export const TEMPLATE_LMS: ProjectTemplate = {
  id: 'template_lms',
  name: 'DIR LMS',
  description: 'Learning Management System lifecycle covering code generation, interactive features, QA, and deployment.',
  category: 'lms',
  isDefault: true,
  defaultPhases: [
    {
      id: 'phase_lms_core',
      name: 'LMS Architecture & Features',
      order: 1,
      defaultSteps: [
        {
          id: 'step_lms_1',
          title: 'Development',
          description: 'Core learning platform UI design and backend microservices.',
          defaultSubtasks: ['UI Design (Student & Instructor Portals)', 'Backend (Course Management & Auth API)', 'Database Schema & Video Storage CDN'],
          estimatedDays: 30
        },
        {
          id: 'step_lms_2',
          title: 'Feature Development',
          description: 'Smart code generation, automated grading, and interactive quizzes.',
          defaultSubtasks: ['Code Generation Engine Integration', 'Interactive Coding Playground & Quizzes', 'Student Progress Tracker & Gradebook', 'Certificate Generation Module'],
          estimatedDays: 25
        },
        {
          id: 'step_lms_3',
          title: 'Testing',
          description: 'Functional student journeys, instructor workflows, and load checks.',
          defaultSubtasks: ['Student Course Completion Flow Test', 'Quiz Submission & Auto-grading Validation', 'Simulate 500 Concurrent Exam Users'],
          estimatedDays: 10
        },
        {
          id: 'step_lms_4',
          title: 'Bug Fixing',
          description: 'Resolve high-severity defects and exam interface glitches.',
          defaultSubtasks: ['Fix Video Playback Buffering on Low Bandwidth', 'Resolve Quiz Timer Auto-submit Edge Case', 'UI Fixes for Tablets and Laptops'],
          estimatedDays: 7
        },
        {
          id: 'step_lms_5',
          title: 'Deployment',
          description: 'Cloud production infrastructure spin-up and domain launch.',
          defaultSubtasks: ['Deploy Production Kubernetes / Cloud Run Cluster', 'Setup CDN Video Streaming Endpoints', 'Domain & Security Headers Configuration'],
          estimatedDays: 5
        },
        {
          id: 'step_lms_6',
          title: 'Maintenance',
          description: 'Ongoing support, bug fixes, and instructor analytics.',
          defaultSubtasks: ['Bug Fixes & System Monitoring', 'New Features (Live Classroom Integration)', 'Teacher Analytics Dashboard Enhancements'],
          estimatedDays: 90
        }
      ]
    }
  ]
};

// 4. Template 4 — Website (Reusable template for ABC, XYZ, School, Corporate)
export const TEMPLATE_WEBSITE_DEV: ProjectTemplate = {
  id: 'template_website_dev',
  name: 'Website',
  description: 'Universal 5-step reusable web template for company, corporate, school, and e-commerce sites.',
  category: 'website',
  isDefault: true,
  defaultPhases: [
    {
      id: 'phase_web_std',
      name: 'Standard Website Flow',
      order: 1,
      defaultSteps: [
        {
          id: 'step_w_1',
          title: 'UI & Data Collection',
          description: 'Gather branding assets, content copy, images, and confirm layout wireframe.',
          defaultSubtasks: ['Collect Logo & Brand Guidelines', 'Collect Written Content & Copy', 'Collect High-res Images & Media', 'Confirm Figma Design Mockup with Client'],
          estimatedDays: 10
        },
        {
          id: 'step_w_2',
          title: 'Coding',
          description: 'Full-stack development of pages, responsive components, and backend forms.',
          defaultSubtasks: ['Homepage & Hero Section', 'About Us & Mission Statement', 'Product / Services Catalog', 'Contact Page with Working Form', 'Admin Dashboard / CMS', 'Responsive Design (Mobile, Tablet, Desktop)', 'On-page SEO & Meta Tags'],
          estimatedDays: 20
        },
        {
          id: 'step_w_3',
          title: 'Testing & QA',
          description: 'Test cross-device layouts, form submissions, security, and loading speed.',
          defaultSubtasks: ['Contact Form Email Notification Test', 'PageSpeed & Lighthouse Optimization (>90)', 'Mobile Browser Testing (Safari / Chrome)', 'Broken Links & Spell Check'],
          estimatedDays: 5
        },
        {
          id: 'step_w_4',
          title: 'Deployment',
          description: 'Configure custom domain DNS, SSL certificate, and launch live.',
          defaultSubtasks: ['Connect Production Domain & DNS Records', 'Enable Free SSL Certificate (HTTPS)', 'Submit Sitemap to Google Search Console', 'Client Go-Live Announcement'],
          estimatedDays: 3
        },
        {
          id: 'step_w_5',
          title: 'Maintenance',
          description: 'Monthly uptime checks, software updates, and minor content updates.',
          defaultSubtasks: ['Monthly Security & Package Updates', 'Monthly Backup Check', 'Content Update Requests Support'],
          estimatedDays: 90
        }
      ]
    }
  ]
};

export const DEFAULT_TEMPLATES: ProjectTemplate[] = [
  TEMPLATE_LIBRARY_MATRIX,
  TEMPLATE_UBOOK_STORE,
  TEMPLATE_LMS,
  TEMPLATE_WEBSITE_DEV
];

/**
 * Instantiates a fully populated ITProject from a selected ProjectTemplate
 */
export function generateProjectFromTemplate(
  template: ProjectTemplate,
  meta: {
    name: string;
    client: string;
    projectOwner: string;
    startDate?: string;
    targetDate?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    nextAction?: string;
  }
): Omit<ITProject, 'id' | 'createdAt' | 'updatedAt'> {
  const now = new Date();
  const startDateStr = meta.startDate || now.toISOString().split('T')[0];
  
  // Calculate default target date based on template total days
  let totalDays = 0;
  template.defaultPhases.forEach(p => {
    p.defaultSteps.forEach(s => {
      totalDays += s.estimatedDays || 7;
    });
  });
  if (totalDays === 0) totalDays = 60;

  const targetDateObj = meta.targetDate 
    ? new Date(meta.targetDate) 
    : new Date(now.getTime() + totalDays * 24 * 60 * 60 * 1000);
  const targetDateStr = targetDateObj.toISOString().split('T')[0];

  let stepCursorDays = 0;
  let firstStepTitle = '';

  const phases: ProjectPhase[] = template.defaultPhases.map((phaseDef, pIndex) => {
    const phaseId = `phase_${generateId()}`;
    const steps: ProcessStep[] = phaseDef.defaultSteps.map((stepDef, sIndex) => {
      const stepId = `step_${generateId()}`;
      if (!firstStepTitle && pIndex === 0 && sIndex === 0) {
        firstStepTitle = stepDef.title;
      }

      const stepStart = new Date(now.getTime() + stepCursorDays * 24 * 60 * 60 * 1000);
      stepCursorDays += (stepDef.estimatedDays || 7);
      const stepDue = new Date(now.getTime() + stepCursorDays * 24 * 60 * 60 * 1000);

      const subtasks: Subtask[] = (stepDef.defaultSubtasks || []).map(stTitle => ({
        id: `sub_${generateId()}`,
        title: stTitle,
        completed: false,
        assignedTo: meta.projectOwner
      }));

      return {
        id: stepId,
        title: stepDef.title,
        description: stepDef.description || '',
        phaseId,
        phaseName: phaseDef.name,
        startDate: stepStart.toISOString().split('T')[0],
        dueDate: stepDue.toISOString().split('T')[0],
        personResponsible: meta.projectOwner,
        status: (pIndex === 0 && sIndex === 0) ? 'in_progress' : 'not_started',
        subtasks,
        order: sIndex + 1
      };
    });

    return {
      id: phaseId,
      name: phaseDef.name,
      order: phaseDef.order || pIndex + 1,
      steps
    };
  });

  return {
    name: meta.name,
    title: meta.name,
    client: meta.client,
    department: meta.client,
    projectType: template.name,
    projectOwner: meta.projectOwner,
    startDate: startDateStr,
    targetDate: targetDateStr,
    targetEndDate: targetDateStr,
    priority: meta.priority || 'medium',
    status: 'active',
    health: 'green',
    progressPercent: 0,
    currentStep: firstStepTitle || 'Initial Setup',
    nextAction: meta.nextAction || `Begin work on ${firstStepTitle || 'project startup'}`,
    phases,
    templateId: template.id,
    templateUsed: template.category,
    activityLog: [
      {
        id: `act_${generateId()}`,
        date: new Date().toISOString(),
        action: `Project created using template: ${template.name}`,
        user: meta.projectOwner
      }
    ],
    budget: { planned: 15000, actual: 0 }
  };
}

/**
 * Creates seed projects matching the user's explicit specification
 */
export function generateUserSeedProjects(ownerName: string = 'Saw Pyae Phyo Kyaw'): Array<Omit<ITProject, 'id'>> {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // 1. Library Management – Matrix (Progress ~75%, Matrix config on-hold item)
  const matrixBase = generateProjectFromTemplate(TEMPLATE_LIBRARY_MATRIX, {
    name: 'Library Management – Matrix',
    client: 'Central University Library',
    projectOwner: ownerName,
    startDate: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    targetDate: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    priority: 'high',
    nextAction: 'Contact Matrix Team (Thailand) for SIP2 API specs'
  });
  
  // Custom states for Matrix
  if (matrixBase.phases[0]?.steps) {
    const steps = matrixBase.phases[0].steps;
    // Step 1 Tender: completed
    if (steps[0]) {
      steps[0].status = 'completed';
      steps[0].completedDate = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      steps[0].subtasks.forEach(s => s.completed = true);
    }
    // Step 2 Data Collection: completed
    if (steps[1]) {
      steps[1].status = 'completed';
      steps[1].completedDate = new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      steps[1].subtasks.forEach(s => s.completed = true);
    }
    // Step 3 Data Gap Check: completed
    if (steps[2]) {
      steps[2].status = 'completed';
      steps[2].completedDate = new Date(now.getTime() - 18 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      steps[2].subtasks.forEach(s => s.completed = true);
    }
    // Step 4 Contracted: completed
    if (steps[3]) {
      steps[3].status = 'completed';
      steps[3].completedDate = new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      steps[3].subtasks.forEach(s => s.completed = true);
    }
    // Step 5 Contact Matrix Team: completed
    if (steps[4]) {
      steps[4].status = 'completed';
      steps[4].completedDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      steps[4].subtasks.forEach(s => s.completed = true);
    }
    // Step 6 Configuration: Active / In Progress
    if (steps[5]) {
      steps[5].status = 'in_progress';
      if (steps[5].subtasks[0]) steps[5].subtasks[0].completed = true;
      if (steps[5].subtasks[1]) steps[5].subtasks[1].completed = true;
    }
    // Step 7 Training: in_progress
    if (steps[6]) {
      steps[6].status = 'in_progress';
      if (steps[6].subtasks[0]) steps[6].subtasks[0].completed = true;
    }
  }
  matrixBase.currentStep = 'Configuration / Training';
  matrixBase.nextAction = 'Follow up with Thailand Matrix Team on SIP2 configuration';
  matrixBase.health = 'amber';
  matrixBase.progressPercent = 75;

  // 2. UBook Store Website (Phase 1 Web completed, Phase 2 iOS In Progress)
  const ubookBase = generateProjectFromTemplate(TEMPLATE_UBOOK_STORE, {
    name: 'UBook Store Website',
    client: 'UBook Retail Group',
    projectOwner: ownerName,
    startDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    targetDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    priority: 'critical',
    nextAction: 'Complete iOS payment integration'
  });
  // Phase 1 Website all complete
  if (ubookBase.phases[0]?.steps) {
    ubookBase.phases[0].steps.forEach(s => {
      s.status = 'completed';
      s.completedDate = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      s.subtasks.forEach(st => st.completed = true);
    });
  }
  // Phase 2 Mobile: Android completed, iOS in progress, Payment waiting
  if (ubookBase.phases[1]?.steps) {
    const mSteps = ubookBase.phases[1].steps;
    if (mSteps[0]) {
      mSteps[0].status = 'in_progress';
      if (mSteps[0].subtasks[0]) mSteps[0].subtasks[0].completed = true; // Android done
      if (mSteps[0].subtasks[1]) mSteps[0].subtasks[1].completed = false; // iOS in progress
    }
    if (mSteps[1]) {
      mSteps[1].status = 'waiting';
      mSteps[1].blockedReason = 'Waiting for iOS payment API credentials from merchant bank';
    }
  }
  ubookBase.currentStep = 'iOS Development';
  ubookBase.nextAction = 'Complete iOS payment integration';
  ubookBase.progressPercent = 65;

  // 3. UBook LMS (Progress ~48%, Current: Features, Next: Interactive quiz)
  const lmsBase = generateProjectFromTemplate(TEMPLATE_LMS, {
    name: 'UBook LMS',
    client: 'Education & Training Dept',
    projectOwner: ownerName,
    startDate: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    targetDate: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    priority: 'high',
    nextAction: 'Finalize interactive quiz module'
  });
  if (lmsBase.phases[0]?.steps) {
    const s = lmsBase.phases[0].steps;
    if (s[0]) {
      s[0].status = 'completed';
      s[0].subtasks.forEach(st => st.completed = true);
    }
    if (s[1]) {
      s[1].status = 'in_progress';
      if (s[1].subtasks[0]) s[1].subtasks[0].completed = true; // Code Gen done
    }
  }
  lmsBase.currentStep = 'Feature Development (Interactive Features)';
  lmsBase.nextAction = 'Complete interactive quiz module and grading';
  lmsBase.progressPercent = 48;

  // 4. ABC Company Website (Progress ~35%, Current: Coding, Next: About Us + Product, Waiting on content)
  const abcBase = generateProjectFromTemplate(TEMPLATE_WEBSITE_DEV, {
    name: 'ABC Company Website',
    client: 'ABC Corporation Ltd',
    projectOwner: ownerName,
    startDate: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    targetDate: new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    priority: 'medium',
    nextAction: 'Complete About Us + Product pages'
  });
  if (abcBase.phases[0]?.steps) {
    const s = abcBase.phases[0].steps;
    if (s[0]) {
      s[0].status = 'in_progress';
      if (s[0].subtasks[0]) s[0].subtasks[0].completed = true;
    }
    if (s[1]) {
      s[1].status = 'in_progress';
      if (s[1].subtasks[0]) s[1].subtasks[0].completed = true; // Homepage done
    }
  }
  abcBase.currentStep = 'Coding';
  abcBase.nextAction = 'Complete About Us + Product pages';
  abcBase.progressPercent = 35;

  // 5. XYZ Company Website (Progress ~25%, Current: UI & Data Collection, Next: Confirm design)
  const xyzBase = generateProjectFromTemplate(TEMPLATE_WEBSITE_DEV, {
    name: 'XYZ Company Website',
    client: 'XYZ International Trading',
    projectOwner: ownerName,
    startDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    targetDate: new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    priority: 'low',
    nextAction: 'Confirm design mockup with client'
  });
  if (xyzBase.phases[0]?.steps) {
    const s = xyzBase.phases[0].steps;
    if (s[0]) {
      s[0].status = 'in_progress';
      if (s[0].subtasks[0]) s[0].subtasks[0].completed = true;
      if (s[0].subtasks[1]) s[0].subtasks[1].completed = true;
    }
  }
  xyzBase.currentStep = 'UI & Data Collection';
  xyzBase.nextAction = 'Confirm design mockup with client';
  xyzBase.progressPercent = 25;

  return [matrixBase, ubookBase, lmsBase, abcBase, xyzBase];
}
