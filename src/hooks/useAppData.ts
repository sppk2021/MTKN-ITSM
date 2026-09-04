import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  getTicketsLocal, getRepairsLocal, getIspLocal, getLicensesLocal, getUsersLocal,
  saveTicketsLocal, saveRepairsLocal, saveIspLocal, saveLicensesLocal, saveUsersLocal
} from '../lib/offlineStorage';

// Global memory cache to prevent redundant fetches across component mounts and views
let globalCache: {
  tickets: any[];
  repairs: any[];
  isps: any[];
  licenses: any[];
  users: any[];
  fetchedAt: number;
} | null = null;

const CACHE_TTL = 30 * 1000; // 30 seconds

export function useAppData() {
  const [tickets, setTickets] = useState<any[]>(globalCache?.tickets || []);
  const [repairs, setRepairs] = useState<any[]>(globalCache?.repairs || []);
  const [isps, setIsps] = useState<any[]>(globalCache?.isps || []);
  const [licenses, setLicenses] = useState<any[]>(globalCache?.licenses || []);
  const [users, setUsers] = useState<any[]>(globalCache?.users || []);
  const [loading, setLoading] = useState<boolean>(!globalCache);

  const fetchData = useCallback(async (forceRefresh = false) => {
    try {
      if (!forceRefresh && globalCache && (Date.now() - globalCache.fetchedAt < CACHE_TTL)) {
        setTickets(globalCache.tickets);
        setRepairs(globalCache.repairs);
        setIsps(globalCache.isps);
        setLicenses(globalCache.licenses);
        setUsers(globalCache.users);
        setLoading(false);
        return;
      }

      setLoading(true);

      // Try loading from local IndexedDB first for instant UI response
      const [cachedTickets, cachedRepairs, cachedIsps, cachedLicenses, cachedUsers] = await Promise.all([
        getTicketsLocal(),
        getRepairsLocal(),
        getIspLocal(),
        getLicensesLocal(),
        getUsersLocal()
      ]);

      if (!globalCache && cachedTickets.length > 0) {
        setTickets(cachedTickets);
        setRepairs(cachedRepairs);
        setIsps(cachedIsps);
        setLicenses(cachedLicenses);
        setUsers(cachedUsers);
        setLoading(false);
      }

      // Fetch fresh data from Firestore using identical efficient queries shared between Executive Overview & Reports
      const [ticketsSnap, repairsSnap, usersSnap, ispSnap, licensesSnap] = await Promise.all([
        getDocs(collection(db, "tickets")),
        getDocs(collection(db, "repairs")),
        getDocs(collection(db, "users")),
        getDocs(collection(db, "isp_accounts")),
        getDocs(collection(db, "software_licenses"))
      ]);

      const fetchedTickets = ticketsSnap.docs.map(t => ({ id: t.id, ...t.data() } as any));
      const fetchedRepairs = repairsSnap.docs.map(r => ({ id: r.id, ...r.data() } as any));
      const fetchedUsers = usersSnap.docs.map(u => ({ id: u.id, ...u.data() } as any));
      const fetchedIsps = ispSnap.docs.map(i => ({ id: i.id, ...i.data() } as any));
      const fetchedLicenses = licensesSnap.docs.map(l => ({ id: l.id, ...l.data() } as any));

      globalCache = {
        tickets: fetchedTickets,
        repairs: fetchedRepairs,
        isps: fetchedIsps,
        licenses: fetchedLicenses,
        users: fetchedUsers,
        fetchedAt: Date.now()
      };

      setTickets(fetchedTickets);
      setRepairs(fetchedRepairs);
      setIsps(fetchedIsps);
      setLicenses(fetchedLicenses);
      setUsers(fetchedUsers);

      // Background write-through cache update
      Promise.all([
        saveTicketsLocal(fetchedTickets),
        saveRepairsLocal(fetchedRepairs),
        saveUsersLocal(fetchedUsers),
        saveIspLocal(fetchedIsps),
        saveLicensesLocal(fetchedLicenses)
      ]).catch(err => console.error("Error saving to local cache:", err));

    } catch (e) {
      console.error("Error fetching application data:", e);
      try {
        const [cachedTickets, cachedRepairs, cachedIsps, cachedLicenses, cachedUsers] = await Promise.all([
          getTicketsLocal(),
          getRepairsLocal(),
          getIspLocal(),
          getLicensesLocal(),
          getUsersLocal()
        ]);
        if (cachedTickets.length > 0) setTickets(cachedTickets);
        if (cachedRepairs.length > 0) setRepairs(cachedRepairs);
        if (cachedIsps.length > 0) setIsps(cachedIsps);
        if (cachedLicenses.length > 0) setLicenses(cachedLicenses);
        if (cachedUsers.length > 0) setUsers(cachedUsers);
      } catch (cacheErr) {
        console.error("Cache fallback error:", cacheErr);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    tickets,
    repairs,
    isps,
    licenses,
    users,
    loading,
    refreshData: () => fetchData(true)
  };
}
