import localforage from 'localforage';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, deleteField } from 'firebase/firestore';
import { db } from './firebase';
import { SupportTicket, User, Repair, ISPAccount, LicenseStatus } from '../types';

// Configure localforage IndexedDB stores
export const ticketsStore = localforage.createInstance({
  name: 'MTKN_ITSM',
  storeName: 'tickets'
});

export const repairsStore = localforage.createInstance({
  name: 'MTKN_ITSM',
  storeName: 'repairs'
});

export const ispStore = localforage.createInstance({
  name: 'MTKN_ITSM',
  storeName: 'isp_accounts'
});

export const licensesStore = localforage.createInstance({
  name: 'MTKN_ITSM',
  storeName: 'software_licenses'
});

export const calendarStore = localforage.createInstance({
  name: 'MTKN_ITSM',
  storeName: 'calendar_events'
});

export const usersStore = localforage.createInstance({
  name: 'MTKN_ITSM',
  storeName: 'users'
});

export const syncQueueStore = localforage.createInstance({
  name: 'MTKN_ITSM',
  storeName: 'sync_queue'
});

export type SyncActionType = 
  | 'CREATE_TICKET' | 'UPDATE_TICKET' | 'DELETE_TICKET'
  | 'CREATE_REPAIR' | 'UPDATE_REPAIR' | 'DELETE_REPAIR'
  | 'CREATE_ISP' | 'UPDATE_ISP' | 'DELETE_ISP'
  | 'CREATE_LICENSE' | 'UPDATE_LICENSE' | 'DELETE_LICENSE'
  | 'CREATE_CALENDAR_EVENT' | 'UPDATE_CALENDAR_EVENT' | 'DELETE_CALENDAR_EVENT'
  | 'UPDATE_USER_PROFILE';

export interface SyncAction {
  id: string;
  type: SyncActionType;
  payload: any;
  timestamp: number;
}

// ---------------- Tickets ----------------
export async function saveTicketsLocal(tickets: SupportTicket[]): Promise<void> {
  try {
    await ticketsStore.setItem('all_tickets', tickets);
    await ticketsStore.setItem('last_updated', Date.now());
  } catch (err) {
    console.error('Failed to save tickets to IndexedDB:', err);
  }
}

export async function getTicketsLocal(): Promise<SupportTicket[]> {
  try {
    const tickets = await ticketsStore.getItem<SupportTicket[]>('all_tickets');
    return tickets || [];
  } catch (err) {
    console.error('Failed to read tickets from IndexedDB:', err);
    return [];
  }
}

// ---------------- Repairs ----------------
export async function saveRepairsLocal(repairs: Repair[]): Promise<void> {
  try {
    await repairsStore.setItem('all_repairs', repairs);
    await repairsStore.setItem('last_updated', Date.now());
  } catch (err) {
    console.error('Failed to save repairs to IndexedDB:', err);
  }
}

export async function getRepairsLocal(): Promise<Repair[]> {
  try {
    const repairs = await repairsStore.getItem<Repair[]>('all_repairs');
    return repairs || [];
  } catch (err) {
    console.error('Failed to read repairs from IndexedDB:', err);
    return [];
  }
}

// ---------------- ISP Accounts ----------------
export async function saveIspLocal(isps: ISPAccount[]): Promise<void> {
  try {
    await ispStore.setItem('all_isps', isps);
    await ispStore.setItem('last_updated', Date.now());
  } catch (err) {
    console.error('Failed to save ISP accounts to IndexedDB:', err);
  }
}

export async function getIspLocal(): Promise<ISPAccount[]> {
  try {
    const isps = await ispStore.getItem<ISPAccount[]>('all_isps');
    return isps || [];
  } catch (err) {
    console.error('Failed to read ISP accounts from IndexedDB:', err);
    return [];
  }
}

// ---------------- Software Licenses ----------------
export async function saveLicensesLocal(licenses: LicenseStatus[]): Promise<void> {
  try {
    await licensesStore.setItem('all_licenses', licenses);
    await licensesStore.setItem('last_updated', Date.now());
  } catch (err) {
    console.error('Failed to save software licenses to IndexedDB:', err);
  }
}

export async function getLicensesLocal(): Promise<LicenseStatus[]> {
  try {
    const licenses = await licensesStore.getItem<LicenseStatus[]>('all_licenses');
    return licenses || [];
  } catch (err) {
    console.error('Failed to read software licenses from IndexedDB:', err);
    return [];
  }
}

// ---------------- Calendar Events ----------------
export async function saveCalendarEventsLocal(events: any[]): Promise<void> {
  try {
    await calendarStore.setItem('all_events', events);
    await calendarStore.setItem('last_updated', Date.now());
  } catch (err) {
    console.error('Failed to save calendar events to IndexedDB:', err);
  }
}

export async function getCalendarEventsLocal(): Promise<any[]> {
  try {
    const events = await calendarStore.getItem<any[]>('all_events');
    return events || [];
  } catch (err) {
    console.error('Failed to read calendar events from IndexedDB:', err);
    return [];
  }
}

// ---------------- Users ----------------
export async function saveUsersLocal(users: User[]): Promise<void> {
  try {
    await usersStore.setItem('all_users', users);
  } catch (err) {
    console.error('Failed to save users to IndexedDB:', err);
  }
}

export async function getUsersLocal(): Promise<User[]> {
  try {
    const users = await usersStore.getItem<User[]>('all_users');
    return users || [];
  } catch (err) {
    console.error('Failed to read users from IndexedDB:', err);
    return [];
  }
}

// ---------------- Sync Queue ----------------
export async function addPendingSyncAction(type: SyncActionType, payload: any): Promise<void> {
  try {
    const currentQueue = (await syncQueueStore.getItem<SyncAction[]>('queue')) || [];
    
    // Check if duplicate action already exists in queue (e.g., same ticketCode or repairCode or payload)
    const payloadKey = payload?.ticketCode || payload?.repairCode || payload?.id || JSON.stringify(payload);
    const isDuplicate = currentQueue.some(action => {
      if (action.type !== type) return false;
      const existingKey = action.payload?.ticketCode || action.payload?.repairCode || action.payload?.id || JSON.stringify(action.payload);
      return existingKey === payloadKey;
    });

    if (isDuplicate) {
      return;
    }

    const newAction: SyncAction = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      payload,
      timestamp: Date.now()
    };
    currentQueue.push(newAction);
    await syncQueueStore.setItem('queue', currentQueue);
  } catch (err) {
    console.error('Failed to save sync action:', err);
  }
}

export async function getPendingSyncQueue(): Promise<SyncAction[]> {
  try {
    return (await syncQueueStore.getItem<SyncAction[]>('queue')) || [];
  } catch (err) {
    console.error('Failed to read sync queue:', err);
    return [];
  }
}

export async function clearPendingSyncQueue(): Promise<void> {
  try {
    await syncQueueStore.removeItem('queue');
  } catch (err) {
    console.error('Failed to clear sync queue:', err);
  }
}

export async function getPendingSyncCount(): Promise<number> {
  try {
    const queue = await getPendingSyncQueue();
    return queue.length;
  } catch {
    return 0;
  }
}

/**
 * Universal executor to flush all pending offline sync actions to Firestore
 */
export async function processAllPendingSyncActions(): Promise<{ success: boolean; processed: number; errors: number }> {
  if (!navigator.onLine) {
    return { success: false, processed: 0, errors: 0 };
  }

  const queue = await getPendingSyncQueue();
  if (queue.length === 0) {
    return { success: true, processed: 0, errors: 0 };
  }

  let processedCount = 0;
  let errorCount = 0;
  const remainingQueue: SyncAction[] = [];

  for (const action of queue) {
    try {
      switch (action.type) {
        // Tickets
        case 'CREATE_TICKET':
          await addDoc(collection(db, "tickets"), {
            ...action.payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          break;
        case 'UPDATE_TICKET':
          const ticketUpdates = { ...action.payload.updates };
          if (ticketUpdates.resolvedAt === null) {
            ticketUpdates.resolvedAt = deleteField();
          }
          await updateDoc(doc(db, "tickets", action.payload.id), {
            ...ticketUpdates,
            updatedAt: serverTimestamp()
          });
          break;
        case 'DELETE_TICKET':
          await deleteDoc(doc(db, "tickets", action.payload.id));
          break;

        // Repairs
        case 'CREATE_REPAIR':
          await addDoc(collection(db, "repairs"), {
            ...action.payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          break;
        case 'UPDATE_REPAIR':
          const repairUpdates = { ...action.payload.updates };
          if (repairUpdates.completionDate === null) {
            repairUpdates.completionDate = deleteField();
          }
          await updateDoc(doc(db, "repairs", action.payload.id), {
            ...repairUpdates,
            updatedAt: serverTimestamp()
          });
          break;
        case 'DELETE_REPAIR':
          await deleteDoc(doc(db, "repairs", action.payload.id));
          break;

        // ISP Accounts
        case 'CREATE_ISP':
          await addDoc(collection(db, "isp_accounts"), {
            ...action.payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          break;
        case 'UPDATE_ISP':
          await updateDoc(doc(db, "isp_accounts", action.payload.id), {
            ...action.payload.updates,
            updatedAt: serverTimestamp()
          });
          break;
        case 'DELETE_ISP':
          await deleteDoc(doc(db, "isp_accounts", action.payload.id));
          break;

        // Licenses
        case 'CREATE_LICENSE':
          await addDoc(collection(db, "software_licenses"), {
            ...action.payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          break;
        case 'UPDATE_LICENSE':
          await updateDoc(doc(db, "software_licenses", action.payload.id), {
            ...action.payload.updates,
            updatedAt: serverTimestamp()
          });
          break;
        case 'DELETE_LICENSE':
          await deleteDoc(doc(db, "software_licenses", action.payload.id));
          break;

        // Calendar Events
        case 'CREATE_CALENDAR_EVENT':
          await addDoc(collection(db, "calendarEvents"), {
            ...action.payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          break;
        case 'UPDATE_CALENDAR_EVENT':
          await updateDoc(doc(db, "calendarEvents", action.payload.id), {
            ...action.payload.updates,
            updatedAt: serverTimestamp()
          });
          break;
        case 'DELETE_CALENDAR_EVENT':
          await deleteDoc(doc(db, "calendarEvents", action.payload.id));
          break;

        // User Profile
        case 'UPDATE_USER_PROFILE':
          await updateDoc(doc(db, "users", action.payload.id), {
            ...action.payload.updates,
            updatedAt: serverTimestamp()
          });
          break;

        default:
          console.warn('Unknown sync action type:', (action as any).type);
      }
      processedCount++;
    } catch (err) {
      console.error(`Failed to process sync action ${action.id}:`, err);
      errorCount++;
      remainingQueue.push(action);
    }
  }

  if (remainingQueue.length === 0) {
    await clearPendingSyncQueue();
  } else {
    await syncQueueStore.setItem('queue', remainingQueue);
  }

  return { success: errorCount === 0, processed: processedCount, errors: errorCount };
}
