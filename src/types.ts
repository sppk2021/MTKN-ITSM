
export type UserRole = 'admin' | 'management' | 'it_assistant' | 'staff';

export type TabKey = 'dashboard' | 'users' | 'reports' | 'calendar' | 'repairs' | 'tickets' | 'software' | 'isp' | 'projects';

export interface TabPermissions {
  view: boolean;
  edit: boolean;
  delete: boolean;
}

export type UserPermissions = Record<TabKey, TabPermissions>;

export const TAB_LABELS: Record<TabKey, string> = {
  dashboard: 'Executive Dashboard',
  users: 'User Management',
  reports: 'Reports & Analytics',
  calendar: 'Support Calendar',
  repairs: 'Repairs Tracking',
  tickets: 'Support Tickets',
  software: 'Licenses & Domains',
  isp: 'ISP Connections',
  projects: 'Projects & Solutions',
};

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, UserPermissions> = {
  admin: {
    dashboard: { view: true, edit: true, delete: true },
    users: { view: true, edit: true, delete: true },
    reports: { view: true, edit: true, delete: true },
    calendar: { view: true, edit: true, delete: true },
    repairs: { view: true, edit: true, delete: true },
    tickets: { view: true, edit: true, delete: true },
    software: { view: true, edit: true, delete: true },
    isp: { view: true, edit: true, delete: true },
    projects: { view: true, edit: true, delete: true },
  },
  management: {
    dashboard: { view: true, edit: false, delete: false },
    users: { view: false, edit: false, delete: false },
    reports: { view: true, edit: false, delete: false },
    calendar: { view: true, edit: false, delete: false },
    repairs: { view: true, edit: false, delete: false },
    tickets: { view: true, edit: false, delete: false },
    software: { view: true, edit: false, delete: false },
    isp: { view: true, edit: false, delete: false },
    projects: { view: true, edit: false, delete: false },
  },
  it_assistant: {
    dashboard: { view: true, edit: true, delete: false },
    users: { view: false, edit: false, delete: false },
    reports: { view: true, edit: false, delete: false },
    calendar: { view: true, edit: true, delete: false },
    repairs: { view: true, edit: true, delete: false },
    tickets: { view: true, edit: true, delete: false },
    software: { view: true, edit: true, delete: false },
    isp: { view: true, edit: true, delete: false },
    projects: { view: true, edit: true, delete: false },
  },
  staff: {
    dashboard: { view: true, edit: false, delete: false },
    users: { view: false, edit: false, delete: false },
    reports: { view: false, edit: false, delete: false },
    calendar: { view: true, edit: false, delete: false },
    repairs: { view: true, edit: false, delete: false },
    tickets: { view: true, edit: true, delete: false },
    software: { view: false, edit: false, delete: false },
    isp: { view: false, edit: false, delete: false },
    projects: { view: true, edit: false, delete: false },
  },
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface User {
  id: string;
  username: string;
  displayName?: string;
  fullName?: string;
  photoURL?: string;
  avatarUrl?: string;
  phone?: string;
  department?: string;
  email: string;
  role: UserRole;
  status: 'active' | 'disabled';
  password?: string;
  initialPassword?: string;
  permissions?: UserPermissions;
  createdAt?: any;
  updatedAt?: any;
  lastPasswordChange?: any;
}

export interface DowntimeRecord {
  date: string;
  duration?: string;
  reason: string;
  resolvedAt?: string;
  addedAt: string;
  status: 'offline' | 'degraded' | 'maintenance' | 'online';
}

export interface ISPAccount {
  id: string;
  ispName: string;
  branchOffice: string;
  speed: string;
  userIdDeviceId: string;
  contactName: string;
  currentStatus: 'online' | 'offline' | 'degraded' | 'maintenance';
  downtimeRecords?: DowntimeRecord[];
  createdAt?: any;
  updatedAt?: any;
}

export interface TicketHistory {
  note: string;
  date: string;
}

export interface SupportTicket {
  id: string;
  ticketCode: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  supportType: 'hardware' | 'software' | 'network' | 'account' | 'other';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  assigneeId: string;
  authorId: string;
  requestUsername: string;
  requestDept: string;
  history: TicketHistory[];
  resolvedAt?: string;
  createdAt: any;
  updatedAt: any;
}

export interface Repair {
  id: string;
  repairCode: string;
  title: string;
  device: string;
  status: 'pending' | 'ongoing' | 'completed';
  mechanicId: string;
  shopCenterName?: string;
  history: TicketHistory[];
  createdAt: any;
  updatedAt: any;
}

export interface LicenseStatus {
  id: string;
  name: string;
  type: 'domain' | 'server' | 'microsoft';
  expiryDate: string;
  notes: string;
  status: 'active' | 'expired' | 'expiring_soon' | 'disabled';
  details: string;
  licenseKey?: string;
  authorId: string;
  createdAt: any;
  updatedAt: any;
}

export interface BugTask {
  id: string;
  bugDescription: string;
  status: 'open' | 'fixed';
  reportedBy: string;
  date: string;
}

export interface ProjectNote {
  id: string;
  note: string;
  author: string;
  date: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  steps: { id: string; title: string; completed: boolean }[];
  createdAt: any;
}

export interface ActivityLogEvent {
  id: string;
  action: string;
  timestamp: string;
}

export interface SchoolProject {
  id: string;
  title: string;
  category: string; // allow manual category
  clientSchool: string; // displayed as Clients / School / University
  status: 'planning' | 'development' | 'testing' | 'deployed' | 'maintenance';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedDeveloper: string;
  budgetOrCost?: string;
  startDate: string;
  targetCompletionDate: string;
  description: string;
  attachments?: { name: string; url: string; uploadedAt: string }[];
  bugFixLog?: BugTask[];
  steps?: { id: string; title: string; completed: boolean }[];
  projectNotes?: ProjectNote[];
  activityHistory?: ActivityLogEvent[];
  notificationsEnabled?: boolean;
  createdAt: any;
  updatedAt: any;
}
