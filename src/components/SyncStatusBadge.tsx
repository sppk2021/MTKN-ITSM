import React, { useEffect, useState, useCallback } from 'react';
import { Database, WifiOff, RefreshCw, Loader2 } from 'lucide-react';
import { getPendingSyncCount, processAllPendingSyncActions } from '../lib/offlineStorage';

interface SyncStatusBadgeProps {
  onSynced?: () => void;
  className?: string;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({ onSynced, className = '' }) => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingSyncCount();
    setPendingCount(count);
  }, []);

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await processAllPendingSyncActions();
      await refreshPendingCount();
      if (res.processed > 0 && onSynced) {
        onSynced();
      }
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, onSynced, refreshPendingCount]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      triggerSync();
    };

    const handleOffline = () => {
      setIsOffline(true);
      refreshPendingCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    refreshPendingCount();
    if (navigator.onLine) {
      triggerSync();
    }

    // Periodic check for queue changes
    const interval = setInterval(refreshPendingCount, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [refreshPendingCount, triggerSync]);

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {isOffline ? (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
          <WifiOff className="w-3 h-3 text-amber-600" />
          <span>Offline Mode (IndexedDB)</span>
        </span>
      ) : pendingCount > 0 ? (
        <button
          onClick={triggerSync}
          disabled={isSyncing}
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-800 border border-blue-200 hover:bg-blue-200 transition-colors cursor-pointer"
          title="Click to sync pending offline changes"
        >
          {isSyncing ? (
            <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
          ) : (
            <RefreshCw className="w-3 h-3 text-blue-600" />
          )}
          <span>{isSyncing ? "Syncing..." : `${pendingCount} pending syncs`}</span>
        </button>
      ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <Database className="w-3 h-3 text-emerald-600" />
          <span>IndexedDB Sync Active</span>
        </span>
      )}
    </div>
  );
};
