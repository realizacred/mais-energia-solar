import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { 
  offlineChecklistService, 
  offlineMediaService,
  generateTempId, 
  type OfflineChecklist,
  type OfflineMedia
} from "@/lib/offlineDb";

interface UseOfflineChecklistDbOptions {
  instaladorId?: string | null;
  autoSync?: boolean;
  syncInterval?: number;
}

const MAX_RETRIES = 3;
const DEFAULT_SYNC_INTERVAL = 30000; // 30 seconds

export function useOfflineChecklistDb(options: UseOfflineChecklistDbOptions = {}) {
  const { 
    instaladorId, 
    autoSync = true, 
    syncInterval = DEFAULT_SYNC_INTERVAL 
  } = options;
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);

  // Update pending counts
  const refreshCounts = useCallback(async () => {
    if (!instaladorId) return;
    
    try {
      const pending = await offlineChecklistService.count(instaladorId, 'pending');
      const errors = await offlineChecklistService.count(instaladorId, 'error');
      setPendingCount(pending + errors);
    } catch (error) {
      console.error("Error refreshing counts:", error);
    }
  }, [instaladorId]);

  // Upload media to storage
  const uploadMedia = async (media: OfflineMedia): Promise<string | null> => {
    try {
      const fileName = `${media.parentTempId}/${media.fileName}`;
      const bucket = media.parentType === 'checklist' ? 'checklist-files' : 'lead-files';
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, media.blob, {
          contentType: media.mimeType,
          upsert: true
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (error) {
      console.error("Error uploading media:", error);
      return null;
    }
  };

  // Add a checklist to offline storage
  const addChecklist = useCallback(async (
    checklistData: OfflineChecklist['data'],
    photos?: { fileName: string; blob: Blob; mimeType: string }[]
  ): Promise<string> => {
    if (!instaladorId) throw new Error("Instalador ID is required");
    
    const tempId = generateTempId();
    
    const offlineChecklist: Omit<OfflineChecklist, 'id'> = {
      tempId,
      instaladorId,
      data: checklistData,
      createdAt: new Date().toISOString(),
      syncStatus: 'pending',
      retryCount: 0
    };

    await offlineChecklistService.add(offlineChecklist);

    // Save photos to IndexedDB
    if (photos && photos.length > 0) {
      for (const photo of photos) {
        const mediaEntry: Omit<OfflineMedia, 'id'> = {
          tempId: generateTempId(),
          parentType: 'checklist',
          parentTempId: tempId,
          fileName: photo.fileName,
          mimeType: photo.mimeType,
          blob: photo.blob,
          createdAt: new Date().toISOString(),
          syncStatus: 'pending'
        };
        await offlineMediaService.add(mediaEntry);
      }
    }

    await refreshCounts();
    
    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('offline-checklist-added', { 
      detail: { tempId, instaladorId } 
    }));

    // Try immediate sync if online
    if (navigator.onLine && !isProcessingRef.current) {
      setTimeout(() => syncChecklists(), 500);
    }

    return tempId;
  }, [instaladorId, refreshCounts]);

  // Sync a single checklist to server
  const syncSingleChecklist = async (checklist: OfflineChecklist): Promise<boolean> => {
    if (!checklist.id || !instaladorId) return false;
    
    try {
      await offlineChecklistService.updateStatus(checklist.id, 'syncing');
      
      // First, upload any associated media
      const mediaItems = await offlineMediaService.getByParent('checklist', checklist.tempId);
      const uploadedUrls: string[] = [];
      
      for (const media of mediaItems) {
        if (media.syncStatus !== 'synced' && media.id) {
          await offlineMediaService.updateStatus(media.id, 'syncing');
          const url = await uploadMedia(media);
          
          if (url) {
            await offlineMediaService.updateStatus(media.id, 'synced', url);
            uploadedUrls.push(url);
          } else if (media.id) {
            await offlineMediaService.updateStatus(media.id, 'error');
          }
        } else if (media.serverUrl) {
          uploadedUrls.push(media.serverUrl);
        }
      }

      // Insert checklist with photo URLs
      const { data, error } = await supabase
        .from('checklists_instalacao')
        .insert({
          ...checklist.data,
          instalador_id: instaladorId,
          fotos_urls: uploadedUrls.length > 0 ? uploadedUrls : checklist.data.fotos_urls
        })
        .select('id')
        .single();

      if (error) throw error;

      await offlineChecklistService.updateStatus(checklist.id, 'synced', data.id);
      return true;
    } catch (error: any) {
      console.error("Error syncing checklist:", error);
      
      if (checklist.id) {
        const currentRetry = checklist.retryCount + 1;
        if (currentRetry >= MAX_RETRIES) {
          await offlineChecklistService.updateStatus(checklist.id, 'error', undefined, error.message);
        } else {
          await offlineChecklistService.updateStatus(checklist.id, 'pending', undefined, error.message);
        }
      }
      
      return false;
    }
  };

  // Sync all pending checklists
  const syncChecklists = useCallback(async (showNotifications = true): Promise<{ synced: number; failed: number }> => {
    if (isProcessingRef.current || !navigator.onLine || !instaladorId) {
      return { synced: 0, failed: 0 };
    }

    isProcessingRef.current = true;
    setIsSyncing(true);

    try {
      const pendingChecklists = await offlineChecklistService.getPending(instaladorId);
      
      if (pendingChecklists.length === 0) {
        return { synced: 0, failed: 0 };
      }

      let syncedCount = 0;
      let failedCount = 0;

      for (const checklist of pendingChecklists) {
        if (checklist.retryCount >= MAX_RETRIES) {
          failedCount++;
          continue;
        }

        const success = await syncSingleChecklist(checklist);
        if (success) {
          syncedCount++;
        } else {
          failedCount++;
        }
      }

      setLastSyncTime(new Date());
      await refreshCounts();

      // Dispatch sync completed event
      window.dispatchEvent(new CustomEvent('offline-checklist-sync-completed', {
        detail: { synced: syncedCount, failed: failedCount }
      }));

      // Show notification
      if (showNotifications && (syncedCount > 0 || failedCount > 0)) {
        if (syncedCount > 0 && failedCount === 0) {
          toast({
            title: "Sincronização concluída ✓",
            description: `${syncedCount} registro${syncedCount > 1 ? 's' : ''} sincronizado${syncedCount > 1 ? 's' : ''}.`,
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
  }, [instaladorId, refreshCounts]);

  // Get all pending checklists (for display)
  const getPendingChecklists = useCallback(async (): Promise<OfflineChecklist[]> => {
    if (!instaladorId) return [];
    return await offlineChecklistService.getPending(instaladorId);
  }, [instaladorId]);

  // Clear synced checklists and their media
  const clearSynced = useCallback(async (): Promise<void> => {
    if (!instaladorId) return;
    
    // Get synced checklists to find their media
    const synced = (await offlineChecklistService.getByInstalador(instaladorId))
      .filter(c => c.syncStatus === 'synced');
    
    // Delete associated media
    for (const checklist of synced) {
      const media = await offlineMediaService.getByParent('checklist', checklist.tempId);
      for (const m of media) {
        if (m.id) await offlineMediaService.delete(m.id);
      }
    }
    
    await offlineChecklistService.clearSynced(instaladorId);
    await refreshCounts();
  }, [instaladorId, refreshCounts]);

  // Delete a specific checklist
  const deleteChecklist = useCallback(async (id: number, tempId: string): Promise<void> => {
    // Delete associated media
    const media = await offlineMediaService.getByParent('checklist', tempId);
    for (const m of media) {
      if (m.id) await offlineMediaService.delete(m.id);
    }
    
    await offlineChecklistService.delete(id);
    await refreshCounts();
  }, [refreshCounts]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      
      // Wait for stable connection, then sync
      setTimeout(async () => {
        if (!instaladorId) return;
        
        const pending = await offlineChecklistService.count(instaladorId, 'pending');
        if (pending > 0) {
          toast({
            title: "Conexão restaurada 📶",
            description: `${pending} registro${pending > 1 ? 's' : ''} pendente${pending > 1 ? 's' : ''}. Sincronizando...`,
          });
          syncChecklists(true);
        }
      }, 2000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: "Você está offline 📴",
        description: "Os registros serão salvos e sincronizados quando a conexão voltar.",
        variant: "destructive",
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [instaladorId, syncChecklists]);

  // Auto-sync interval
  useEffect(() => {
    if (!autoSync || !instaladorId) return;

    const startSync = () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }

      syncIntervalRef.current = setInterval(() => {
        if (navigator.onLine && !isProcessingRef.current) {
          syncChecklists(false); // Silent sync
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
  }, [autoSync, syncInterval, syncChecklists, instaladorId]);

  // Initial count refresh
  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

  return {
    // State
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncTime,
    
    // Actions
    addChecklist,
    syncChecklists,
    getPendingChecklists,
    clearSynced,
    deleteChecklist,
    refreshCounts
  };
}
