
export type UserRole = 'admin' | 'management' | 'it_assistant' | 'staff';

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
  email: string;
  role: UserRole;
  status: 'active' | 'disabled';
  createdAt?: any;
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
