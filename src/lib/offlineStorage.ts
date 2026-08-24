import localforage from 'localforage';
import { SupportTicket, User } from '../types';

// Configure localforage IndexedDB stores
const ticketsStore = localforage.createInstance({
  name: 'MTKN_ITSM',
  storeName: 'tickets'
});

const usersStore = localforage.createInstance({
  name: 'MTKN_ITSM',
  storeName: 'users'
});

const syncQueueStore = localforage.createInstance({
  name: 'MTKN_ITSM',
  storeName: 'sync_queue'
});

export interface SyncAction {
  id: string;
  type: 'CREATE_TICKET' | 'UPDATE_TICKET' | 'DELETE_TICKET';
  payload: any;
  timestamp: number;
}

/**
 * Save tickets to IndexedDB for offline access
 */
export async function saveTicketsLocal(tickets: SupportTicket[]): Promise<void> {
  try {
    await ticketsStore.setItem('all_tickets', tickets);
    await ticketsStore.setItem('last_updated', Date.now());
  } catch (err) {
    console.error('Failed to save tickets to IndexedDB:', err);
  }
}

/**
 * Get tickets from IndexedDB
 */
export async function getTicketsLocal(): Promise<SupportTicket[]> {
  try {
    const tickets = await ticketsStore.getItem<SupportTicket[]>('all_tickets');
    return tickets || [];
  } catch (err) {
    console.error('Failed to read tickets from IndexedDB:', err);
    return [];
  }
}

/**
 * Save users to IndexedDB for offline access
 */
export async function saveUsersLocal(users: User[]): Promise<void> {
  try {
    await usersStore.setItem('all_users', users);
  } catch (err) {
    console.error('Failed to save users to IndexedDB:', err);
  }
}

/**
 * Get users from IndexedDB
 */
export async function getUsersLocal(): Promise<User[]> {
  try {
    const users = await usersStore.getItem<User[]>('all_users');
    return users || [];
  } catch (err) {
    console.error('Failed to read users from IndexedDB:', err);
    return [];
  }
}

/**
 * Add an offline action to sync queue
 */
export async function addPendingSyncAction(type: SyncAction['type'], payload: any): Promise<void> {
  try {
    const currentQueue = (await syncQueueStore.getItem<SyncAction[]>('queue')) || [];
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

/**
 * Get all pending sync actions
 */
export async function getPendingSyncQueue(): Promise<SyncAction[]> {
  try {
    return (await syncQueueStore.getItem<SyncAction[]>('queue')) || [];
  } catch (err) {
    console.error('Failed to read sync queue:', err);
    return [];
  }
}

/**
 * Clear or update pending sync actions
 */
export async function clearPendingSyncQueue(): Promise<void> {
  try {
    await syncQueueStore.removeItem('queue');
  } catch (err) {
    console.error('Failed to clear sync queue:', err);
  }
}
