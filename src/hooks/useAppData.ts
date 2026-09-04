import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  getTicketsLocal, getRepairsLocal, getIspLocal, getLicensesLocal, getUsersLocal,
  saveTicketsLocal, saveRepairsLocal, saveIspLocal, saveLicensesLocal, saveUsersLocal
} from '../lib/offlineStorage';

// Global memory cache to prevent redundant fetches across component mounts and views
let globalCache: {
  tickets: any[];
  activeTickets: any[];
  repairs: any[];
  isps: any[];
  licenses: any[];
  users: any[];
  fetchedAt: number;
} | null = null;

const CACHE_TTL = 30 * 1000; // 30 seconds

export function useAppData() {
  const [tickets, setTickets] = useState<any[]>(globalCache?.tickets || []);
  const [activeTickets, setActiveTickets] = useState<any[]>(globalCache?.activeTickets || []);
  const [repairs, setRepairs] = useState<any[]>(globalCache?.repairs || []);
  const [isps, setIsps] = useState<any[]>(globalCache?.isps || []);
  const [licenses, setLicenses] = useState<any[]>(globalCache?.licenses || []);
  const [users, setUsers] = useState<any[]>(globalCache?.users || []);
  const [loading, setLoading] = useState<boolean>(!globalCache);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchData = useCallback(async (forceRefresh = false) => {
    try {
      if (!forceRefresh && globalCache && (Date.now() - globalCache.fetchedAt < CACHE_TTL)) {
        setTickets(globalCache.tickets);
        setActiveTickets(globalCache.activeTickets);
        setRepairs(globalCache.repairs);
        setIsps(globalCache.isps);
        setLicenses(globalCache.licenses);
        setUsers(globalCache.users);
        setLoading(false);
        return;
      }

      if (forceRefresh) {
        setIsRefreshing(true);
      } else if (!globalCache) {
        setLoading(true);
      }

      // Try loading from local IndexedDB first for instant UI response
      if (!forceRefresh && !globalCache) {
        const [cachedTickets, cachedRepairs, cachedIsps, cachedLicenses, cachedUsers] = await Promise.all([
          getTicketsLocal(),
          getRepairsLocal(),
          getIspLocal(),
          getLicensesLocal(),
          getUsersLocal()
        ]);

        if (cachedTickets.length > 0) {
          setTickets(cachedTickets);
          const cachedActive = cachedTickets.filter((t: any) => {
            const s = (t.status || 'open').toLowerCase().trim().replace(/[\s-]/g, '_');
            return s === 'open' || s === 'new' || s === 'pending' || s === 'in_progress';
          });
          setActiveTickets(cachedActive);
          setRepairs(cachedRepairs);
          setIsps(cachedIsps);
          setLicenses(cachedLicenses);
          setUsers(cachedUsers);
          setLoading(false);
        }
      }

      // Centralized Firestore queries utilizing database-level 'where' clause for active operational workload
      const activeTicketsQuery = query(
        collection(db, "tickets"),
        where("status", "in", ["open", "pending", "in_progress", "in-process", "new"])
      );

      const [activeTicketsSnap, allTicketsSnap, repairsSnap, usersSnap, ispSnap, licensesSnap] = await Promise.all([
        getDocs(activeTicketsQuery),
        getDocs(collection(db, "tickets")),
        getDocs(collection(db, "repairs")),
        getDocs(collection(db, "users")),
        getDocs(collection(db, "isp_accounts")),
        getDocs(collection(db, "software_licenses"))
      ]);

      const fetchedActiveTickets = activeTicketsSnap.docs.map(t => ({ id: t.id, ...t.data() } as any));
      const fetchedTickets = allTicketsSnap.docs.map(t => ({ id: t.id, ...t.data() } as any));
      const fetchedRepairs = repairsSnap.docs.map(r => ({ id: r.id, ...r.data() } as any));
      const fetchedUsers = usersSnap.docs.map(u => ({ id: u.id, ...u.data() } as any));
      const fetchedIsps = ispSnap.docs.map(i => ({ id: i.id, ...i.data() } as any));
      const fetchedLicenses = licensesSnap.docs.map(l => ({ id: l.id, ...l.data() } as any));

      globalCache = {
        tickets: fetchedTickets,
        activeTickets: fetchedActiveTickets,
        repairs: fetchedRepairs,
        isps: fetchedIsps,
        licenses: fetchedLicenses,
        users: fetchedUsers,
        fetchedAt: Date.now()
      };

      setTickets(fetchedTickets);
      setActiveTickets(fetchedActiveTickets);
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
        if (cachedTickets.length > 0) {
          setTickets(cachedTickets);
          setActiveTickets(cachedTickets.filter((t: any) => {
            const s = (t.status || 'open').toLowerCase().trim().replace(/[\s-]/g, '_');
            return s === 'open' || s === 'new' || s === 'pending' || s === 'in_progress';
          }));
        }
        if (cachedRepairs.length > 0) setRepairs(cachedRepairs);
        if (cachedIsps.length > 0) setIsps(cachedIsps);
        if (cachedLicenses.length > 0) setLicenses(cachedLicenses);
        if (cachedUsers.length > 0) setUsers(cachedUsers);
      } catch (cacheErr) {
        console.error("Cache fallback error:", cacheErr);
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const refreshData = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    tickets,
    activeTickets,
    repairs,
    isps,
    licenses,
    users,
    loading,
    isRefreshing,
    refreshData
  };
}
