import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface SyncableData {
  id: string;
  type: "lead" | "orcamento" | "checklist";
  data: Record<string, unknown>;
  createdAt: string;
  synced: boolean;
  retryCount: number;
}

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: Date | null;
  syncErrors: string[];
}

const STORAGE_KEY = "background_sync_queue";
const MAX_RETRIES = 3;
const SYNC_INTERVAL = 30000; // 30 seconds

export function useBackgroundSync() {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingCount: 0,
    lastSyncTime: null,
    syncErrors: [],
  });
  
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);

  // Get pending items from storage
  const getPendingItems = useCallback((): SyncableData[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      const items: SyncableData[] = JSON.parse(stored);
      return items.filter((item) => !item.synced && item.retryCount < MAX_RETRIES);
    } catch {
      return [];
    }
  }, []);

  // Save items to storage
  const saveItems = useCallback((items: SyncableData[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      const pendingCount = items.filter((i) => !i.synced && i.retryCount < MAX_RETRIES).length;
      setStatus((prev) => ({ ...prev, pendingCount }));
    } catch (error) {
      console.error("Error saving sync queue:", error);
    }
  }, []);

  // Add item to sync queue
  const addToQueue = useCallback((type: SyncableData["type"], data: Record<string, unknown>): string => {
    const items = getPendingItems();
    const id = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newItem: SyncableData = {
      id,
      type,
      data,
      createdAt: new Date().toISOString(),
      synced: false,
      retryCount: 0,
    };
    
    items.push(newItem);
    saveItems(items);
    
    // Dispatch event for other components to update
    window.dispatchEvent(new CustomEvent("sync-queue-updated", { detail: { pendingCount: items.length } }));
    
    return id;
  }, [getPendingItems, saveItems]);

  // Sync a single item
  const syncItem = async (item: SyncableData): Promise<boolean> => {
    try {
      let error = null;
      
      switch (item.type) {
        case "lead": {
          const result = await supabase.from("leads").insert(item.data as never);
          error = result.error;
          break;
        }
        case "orcamento": {
          const result = await supabase.from("orcamentos").insert(item.data as never);
          error = result.error;
          break;
        }
        case "checklist": {
          const result = await supabase.from("checklists_instalacao").insert(item.data as never);
          error = result.error;
          break;
        }
      }
      
      if (error) {
        console.error(`Sync error for ${item.type}:`, error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error("Sync item error:", error);
      return false;
    }
  };

  // Process sync queue
  const processQueue = useCallback(async (showNotifications = true): Promise<{ synced: number; failed: number }> => {
    if (isProcessingRef.current || !navigator.onLine) {
      return { synced: 0, failed: 0 };
    }

    isProcessingRef.current = true;
    setStatus((prev) => ({ ...prev, isSyncing: true, syncErrors: [] }));

    const items = getPendingItems();
    const pending = items.filter((i) => !i.synced);
    
    if (pending.length === 0) {
      isProcessingRef.current = false;
      setStatus((prev) => ({ ...prev, isSyncing: false }));
      return { synced: 0, failed: 0 };
    }

    let syncedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const item of pending) {
      const success = await syncItem(item);
      
      if (success) {
        item.synced = true;
        syncedCount++;
      } else {
        item.retryCount++;
        if (item.retryCount >= MAX_RETRIES) {
          errors.push(`Falha ao sincronizar ${item.type} após ${MAX_RETRIES} tentativas`);
          failedCount++;
        }
      }
    }

    // Clean up synced items and items that exceeded retries
    const remainingItems = items.filter((i) => !i.synced && i.retryCount < MAX_RETRIES);
    saveItems(remainingItems);

    setStatus((prev) => ({
      ...prev,
      isSyncing: false,
      lastSyncTime: new Date(),
      syncErrors: errors,
      pendingCount: remainingItems.length,
    }));

    isProcessingRef.current = false;

    // Dispatch event for updates
    window.dispatchEvent(new CustomEvent("sync-completed", { 
      detail: { synced: syncedCount, failed: failedCount } 
    }));

    // Show notification
    if (showNotifications && (syncedCount > 0 || failedCount > 0)) {
      if (syncedCount > 0 && failedCount === 0) {
        toast({
          title: "Sincronização concluída ✓",
          description: `${syncedCount} item${syncedCount > 1 ? 's' : ''} sincronizado${syncedCount > 1 ? 's' : ''}.`,
        });
      } else if (failedCount > 0) {
        toast({
          title: "Sincronização parcial",
          description: `${syncedCount} sincronizado${syncedCount > 1 ? 's' : ''}, ${failedCount} falha${failedCount > 1 ? 's' : ''}.`,
          variant: "destructive",
        });
      }
    }

    return { synced: syncedCount, failed: failedCount };
  }, [getPendingItems, saveItems]);

  // Start periodic sync
  const startPeriodicSync = useCallback(() => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
    }

    syncIntervalRef.current = setInterval(() => {
      if (navigator.onLine && !isProcessingRef.current) {
        processQueue(false); // Silent sync
      }
    }, SYNC_INTERVAL);
  }, [processQueue]);

  // Stop periodic sync
  const stopPeriodicSync = useCallback(() => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
  }, []);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setStatus((prev) => ({ ...prev, isOnline: true }));
      
      // Wait a bit for stable connection, then sync
      setTimeout(() => {
        const pending = getPendingItems();
        if (pending.length > 0) {
          toast({
            title: "Conexão restaurada 📶",
            description: `${pending.length} item${pending.length > 1 ? 's' : ''} pendente${pending.length > 1 ? 's' : ''}. Sincronizando...`,
          });
          processQueue(true);
        }
      }, 2000);
      
      startPeriodicSync();
    };

    const handleOffline = () => {
      setStatus((prev) => ({ ...prev, isOnline: false }));
      stopPeriodicSync();
      
      toast({
        title: "Você está offline 📴",
        description: "As alterações serão salvas e sincronizadas automaticamente quando a conexão voltar.",
        variant: "destructive",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial count
    const pending = getPendingItems();
    setStatus((prev) => ({ ...prev, pendingCount: pending.length }));

    // Start periodic sync if online
    if (navigator.onLine) {
      startPeriodicSync();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      stopPeriodicSync();
    };
  }, [getPendingItems, processQueue, startPeriodicSync, stopPeriodicSync]);

  // Manual sync trigger
  const manualSync = useCallback(() => {
    return processQueue(true);
  }, [processQueue]);

  // Clear failed items
  const clearFailedItems = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      
      const items: SyncableData[] = JSON.parse(stored);
      const filtered = items.filter((i) => i.retryCount < MAX_RETRIES);
      saveItems(filtered);
      
      toast({
        title: "Itens removidos",
        description: "Itens com falha foram removidos da fila.",
      });
    } catch (error) {
      console.error("Error clearing failed items:", error);
    }
  }, [saveItems]);

  return {
    ...status,
    addToQueue,
    manualSync,
    clearFailedItems,
    startPeriodicSync,
    stopPeriodicSync,
  };
}
