import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { 
  offlineLeadService, 
  generateTempId, 
  type OfflineLead 
} from "@/lib/offlineDb";

interface UseOfflineLeadDbOptions {
  vendedorNome?: string | null;
  autoSync?: boolean;
  syncInterval?: number;
}

const MAX_RETRIES = 3;
const DEFAULT_SYNC_INTERVAL = 30000; // 30 seconds

export function useOfflineLeadDb(options: UseOfflineLeadDbOptions = {}) {
  const { 
    vendedorNome, 
    autoSync = true, 
    syncInterval = DEFAULT_SYNC_INTERVAL 
  } = options;
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);

  // Normalize vendor name for consistent storage
  const normalizedVendedor = vendedorNome?.toLowerCase().trim().replace(/\s+/g, '_') || 'anonymous';

  // Update pending counts
  const refreshCounts = useCallback(async () => {
    try {
      const pending = await offlineLeadService.count(normalizedVendedor, 'pending');
      const errors = await offlineLeadService.count(normalizedVendedor, 'error');
      const duplicates = await offlineLeadService.count(normalizedVendedor, 'duplicate');
      
      setPendingCount(pending + errors);
      setDuplicateCount(duplicates);
    } catch (error) {
      console.error("Error refreshing counts:", error);
    }
  }, [normalizedVendedor]);

  // Add a lead to offline storage
  const addLead = useCallback(async (leadData: OfflineLead['data']): Promise<string> => {
    const tempId = generateTempId();
    
    const offlineLead: Omit<OfflineLead, 'id'> = {
      tempId,
      vendedorNome: normalizedVendedor,
      data: leadData,
      createdAt: new Date().toISOString(),
      syncStatus: 'pending',
      retryCount: 0
    };

    await offlineLeadService.add(offlineLead);
    await refreshCounts();
    
    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('offline-lead-added', { 
      detail: { tempId, vendedorNome: normalizedVendedor } 
    }));

    // Try immediate sync if online
    if (navigator.onLine && !isProcessingRef.current) {
      setTimeout(() => syncLeads(), 500);
    }

    return tempId;
  }, [normalizedVendedor, refreshCounts]);

  // Sync a single lead to server
  const syncSingleLead = async (lead: OfflineLead): Promise<boolean> => {
    if (!lead.id) return false;
    
    try {
      await offlineLeadService.updateStatus(lead.id, 'syncing');
      
      const { data, error } = await supabase
        .from('leads')
        .insert({
          ...lead.data,
          vendedor: lead.data.vendedor || vendedorNome || 'Admin'
        })
        .select('id, lead_code')
        .single();

      if (error) {
        // Check for duplicate
        if (error.code === '23505' || error.message.includes('duplicate')) {
          await offlineLeadService.updateStatus(lead.id, 'duplicate', undefined, 'Lead duplicado detectado');
          return false;
        }
        
        throw error;
      }

      await offlineLeadService.updateStatus(lead.id, 'synced', data.id);
      return true;
    } catch (error: any) {
      console.error("Error syncing lead:", error);
      
      const currentRetry = lead.retryCount + 1;
      if (currentRetry >= MAX_RETRIES) {
        await offlineLeadService.updateStatus(lead.id, 'error', undefined, error.message);
      } else {
        await offlineLeadService.updateStatus(lead.id, 'pending', undefined, error.message);
      }
      
      return false;
    }
  };

  // Sync all pending leads
  const syncLeads = useCallback(async (showNotifications = true): Promise<{ synced: number; failed: number }> => {
    if (isProcessingRef.current || !navigator.onLine) {
      return { synced: 0, failed: 0 };
    }

    isProcessingRef.current = true;
    setIsSyncing(true);

    try {
      const pendingLeads = await offlineLeadService.getPending(normalizedVendedor);
      
      if (pendingLeads.length === 0) {
        return { synced: 0, failed: 0 };
      }

      let syncedCount = 0;
      let failedCount = 0;

      for (const lead of pendingLeads) {
        if (lead.retryCount >= MAX_RETRIES) {
          failedCount++;
          continue;
        }

        const success = await syncSingleLead(lead);
        if (success) {
          syncedCount++;
        } else if (lead.syncStatus !== 'duplicate') {
          failedCount++;
        }
      }

      setLastSyncTime(new Date());
      await refreshCounts();

      // Dispatch sync completed event
      window.dispatchEvent(new CustomEvent('offline-sync-completed', {
        detail: { synced: syncedCount, failed: failedCount }
      }));

      // Show notification
      if (showNotifications && (syncedCount > 0 || failedCount > 0)) {
        if (syncedCount > 0 && failedCount === 0) {
          toast({
            title: "Sincronização concluída ✓",
            description: `${syncedCount} lead${syncedCount > 1 ? 's' : ''} sincronizado${syncedCount > 1 ? 's' : ''}.`,
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
    } finally {
      isProcessingRef.current = false;
      setIsSyncing(false);
    }
  }, [normalizedVendedor, refreshCounts, vendedorNome]);

  // Get all pending leads (for display)
  const getPendingLeads = useCallback(async (): Promise<OfflineLead[]> => {
    return await offlineLeadService.getPending(normalizedVendedor);
  }, [normalizedVendedor]);

  // Get duplicate leads (for resolution)
  const getDuplicateLeads = useCallback(async (): Promise<OfflineLead[]> => {
    const all = await offlineLeadService.getByVendedor(normalizedVendedor);
    return all.filter(lead => lead.syncStatus === 'duplicate');
  }, [normalizedVendedor]);

  // Resolve duplicate - keep as new (force sync)
  const resolveDuplicateAsNew = useCallback(async (id: number): Promise<void> => {
    await offlineLeadService.updateStatus(id, 'pending');
    await refreshCounts();
  }, [refreshCounts]);

  // Resolve duplicate - discard
  const resolveDuplicateAsExisting = useCallback(async (id: number): Promise<void> => {
    await offlineLeadService.delete(id);
    await refreshCounts();
  }, [refreshCounts]);

  // Clear synced leads
  const clearSynced = useCallback(async (): Promise<void> => {
    await offlineLeadService.clearSynced(normalizedVendedor);
    await refreshCounts();
  }, [normalizedVendedor, refreshCounts]);

  // Delete a specific lead
  const deleteLead = useCallback(async (id: number): Promise<void> => {
    await offlineLeadService.delete(id);
    await refreshCounts();
  }, [refreshCounts]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      
      // Wait for stable connection, then sync
      setTimeout(async () => {
        const pending = await offlineLeadService.count(normalizedVendedor, 'pending');
        if (pending > 0) {
          toast({
            title: "Conexão restaurada 📶",
            description: `${pending} lead${pending > 1 ? 's' : ''} pendente${pending > 1 ? 's' : ''}. Sincronizando...`,
          });
          syncLeads(true);
        }
      }, 2000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: "Você está offline 📴",
        description: "Os leads serão salvos e sincronizados quando a conexão voltar.",
        variant: "destructive",
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [normalizedVendedor, syncLeads]);

  // Auto-sync interval
  useEffect(() => {
    if (!autoSync) return;

    const startSync = () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }

      syncIntervalRef.current = setInterval(() => {
        if (navigator.onLine && !isProcessingRef.current) {
          syncLeads(false); // Silent sync
        }
      }, syncInterval);
    };

    if (navigator.onLine) {
      startSync();
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [autoSync, syncInterval, syncLeads]);

  // Initial count refresh
  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

  return {
    // State
    isOnline,
    pendingCount,
    duplicateCount,
    isSyncing,
    lastSyncTime,
    
    // Actions
    addLead,
    syncLeads,
    getPendingLeads,
    getDuplicateLeads,
    resolveDuplicateAsNew,
    resolveDuplicateAsExisting,
    clearSynced,
    deleteLead,
    refreshCounts
  };
}
