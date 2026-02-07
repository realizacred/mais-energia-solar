import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { LeadSimplified } from "@/types/orcamento";

interface LeadData {
  id?: string;
  nome: string;
  telefone: string;
  cep?: string | null;
  estado: string;
  cidade: string;
  rua?: string | null;
  numero?: string | null;
  bairro?: string | null;
  complemento?: string | null;
  area: string;
  tipo_telhado: string;
  rede_atendimento: string;
  media_consumo: number;
  consumo_previsto: number;
  observacoes?: string | null;
  arquivos_urls?: string[];
  vendedor?: string | null;
  synced?: boolean;
}

interface SyncResult {
  total: number;
  synced: number;
  failed: number;
  duplicates: number;
}

interface DuplicateInfo {
  leadId: string;
  leadData: LeadData;
  matchingLeads: LeadSimplified[];
}

// Base keys for localStorage - will be prefixed with vendedor name for isolation
const BASE_STORAGE_KEY = "offline_leads";
const BASE_DUPLICATE_STORAGE_KEY = "offline_leads_duplicates";

// Custom events for cross-component synchronization
const PENDING_COUNT_CHANGED_EVENT = "offline-leads-pending-changed";
const DUPLICATES_CHANGED_EVENT = "offline-leads-duplicates-changed";

// Emit events to notify other hook instances
const emitPendingCountChanged = () => {
  window.dispatchEvent(new CustomEvent(PENDING_COUNT_CHANGED_EVENT));
};

const emitDuplicatesChanged = () => {
  window.dispatchEvent(new CustomEvent(DUPLICATES_CHANGED_EVENT));
};

interface UseOfflineLeadSyncOptions {
  vendedorNome?: string | null;
}

export function useOfflineLeadSync({ vendedorNome }: UseOfflineLeadSyncOptions = {}) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [duplicatesToResolve, setDuplicatesToResolve] = useState<DuplicateInfo[]>([]);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const syncInProgressRef = useRef(false);
  // Keep a reliable, up-to-date online flag (navigator.onLine can be inconsistent in some contexts)
  const isOnlineRef = useRef(navigator.onLine);
  const syncedIdsRef = useRef<Set<string>>(new Set());

  // Generate vendedor-specific storage keys to isolate data between vendors
  const getStorageKey = useCallback(() => {
    if (vendedorNome) {
      // Normalize vendedor name for use as key suffix (remove spaces, lowercase)
      const normalizedName = vendedorNome.toLowerCase().replace(/\s+/g, '_');
      return `${BASE_STORAGE_KEY}_${normalizedName}`;
    }
    return BASE_STORAGE_KEY;
  }, [vendedorNome]);

  const getDuplicateStorageKey = useCallback(() => {
    if (vendedorNome) {
      const normalizedName = vendedorNome.toLowerCase().replace(/\s+/g, '_');
      return `${BASE_DUPLICATE_STORAGE_KEY}_${normalizedName}`;
    }
    return BASE_DUPLICATE_STORAGE_KEY;
  }, [vendedorNome]);

  const countPending = useCallback(() => {
    try {
      const storageKey = getStorageKey();
      const stored = localStorage.getItem(storageKey);
      const leads: LeadData[] = stored ? JSON.parse(stored) : [];
      const count = leads.filter((l) => !l.synced).length;
      setPendingCount(count);
      return count;
    } catch {
      setPendingCount(0);
      return 0;
    }
  }, [getStorageKey]);

  const loadDuplicates = useCallback(() => {
    try {
      const duplicateKey = getDuplicateStorageKey();
      const stored = localStorage.getItem(duplicateKey);
      if (stored) {
        const duplicates = JSON.parse(stored);
        setDuplicatesToResolve(duplicates);
      } else {
        setDuplicatesToResolve([]);
      }
    } catch {
      setDuplicatesToResolve([]);
    }
  }, [getDuplicateStorageKey]);

  /**
   * Normaliza o telefone removendo caracteres não numéricos
   */
  const normalizePhone = (phone: string): string => {
    return phone.replace(/\D/g, "");
  };

  /**
   * Verifica se já existem leads com o mesmo telefone
   */
  const checkExistingLeads = async (telefone: string): Promise<LeadSimplified[] | null> => {
    const normalized = normalizePhone(telefone);
    if (normalized.length < 10) return null;

    try {
      const { data: leads, error } = await supabase
        .from("leads")
        .select("id, lead_code, nome, telefone, telefone_normalized, created_at, updated_at")
        .eq("telefone_normalized", normalized)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[checkExistingLeads] Error:", error.message);
        return null;
      }

      if (leads && leads.length > 0) {
        // Deduplicate by normalized name
        const normalizedNameMap = new Map<string, typeof leads[0]>();
        for (const lead of leads) {
          const normalizedName = lead.nome.toLowerCase().trim().replace(/\s+/g, ' ');
          if (!normalizedNameMap.has(normalizedName)) {
            normalizedNameMap.set(normalizedName, lead);
          }
        }
        return Array.from(normalizedNameMap.values()) as LeadSimplified[];
      }

      return null;
    } catch (error) {
      console.error("[checkExistingLeads] Exception:", error);
      return null;
    }
  };

  const syncLead = async (lead: LeadData): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log("[syncLead] Attempting to sync lead:", lead.nome);
      
      const { data, error } = await supabase.from("leads").insert({
        nome: lead.nome,
        telefone: lead.telefone,
        cep: lead.cep || null,
        estado: lead.estado,
        cidade: lead.cidade,
        rua: lead.rua || null,
        numero: lead.numero || null,
        bairro: lead.bairro || null,
        complemento: lead.complemento || null,
        area: lead.area,
        tipo_telhado: lead.tipo_telhado,
        rede_atendimento: lead.rede_atendimento,
        media_consumo: lead.media_consumo,
        consumo_previsto: lead.consumo_previsto,
        observacoes: lead.observacoes || null,
        arquivos_urls: lead.arquivos_urls || [],
        vendedor: lead.vendedor || null,
      }).select();

      if (error) {
        console.error("[syncLead] Supabase error:", error.message, error.details);
        return { success: false, error: error.message };
      }
      
      console.log("[syncLead] Successfully synced lead:", data);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[syncLead] Exception:", errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const syncPendingLeads = useCallback(async (showToast = true): Promise<SyncResult> => {
    const result: SyncResult = { total: 0, synced: 0, failed: 0, duplicates: 0 };
    
    // Prevent multiple simultaneous sync operations
    if (syncInProgressRef.current) {
      console.log("[syncPendingLeads] Sync already in progress, skipping");
      return result;
    }

    // Check online status at call time (from ref updated by online/offline events)
    const currentlyOnline = isOnlineRef.current;
    console.log("[syncPendingLeads] Online status check:", {
      isOnlineRef: currentlyOnline,
      navigatorOnLine: navigator.onLine,
    });
    
    if (!currentlyOnline) {
      if (showToast) {
        toast({
          title: "Sem conexão",
          description: "Aguarde a conexão ser restabelecida para sincronizar.",
          variant: "destructive",
        });
      }
      return result;
    }

    try {
      setIsSyncing(true);
      syncInProgressRef.current = true;
      
      if (showToast) {
        toast({
          title: "Sincronizando...",
          description: "Verificando e enviando leads pendentes.",
        });
      }

      const storageKey = getStorageKey();
      const stored = localStorage.getItem(storageKey);
      if (!stored) {
        setIsSyncing(false);
        syncInProgressRef.current = false;
        return result;
      }

      const leads: LeadData[] = JSON.parse(stored);
      // Filter out already synced and recently synced leads to prevent duplicates
      const pending = leads.filter((l) => !l.synced && l.id && !syncedIdsRef.current.has(l.id));
      result.total = pending.length;

      if (pending.length === 0) {
        if (showToast) {
          toast({
            title: "Tudo sincronizado! ✓",
            description: "Não há leads pendentes.",
          });
        }
        setIsSyncing(false);
        syncInProgressRef.current = false;
        return result;
      }

      const duplicatesFound: DuplicateInfo[] = [];

      for (const lead of pending) {
        // Double-check this lead hasn't been synced
        if (lead.id && syncedIdsRef.current.has(lead.id)) {
          continue;
        }
        
        // Check for existing leads with same phone BEFORE syncing
        const existingLeads = await checkExistingLeads(lead.telefone);
        
        if (existingLeads && existingLeads.length > 0) {
          console.log("[syncPendingLeads] Duplicate found for:", lead.nome, "matches:", existingLeads.length);
          duplicatesFound.push({
            leadId: lead.id!,
            leadData: lead,
            matchingLeads: existingLeads,
          });
          result.duplicates++;
          continue; // Skip syncing this lead, add to duplicates list
        }
        
        const syncResult = await syncLead(lead);
        if (syncResult.success) {
          const index = leads.findIndex((l) => l.id === lead.id);
          if (index >= 0) {
            leads[index].synced = true;
            // Mark as synced to prevent duplicates
            if (lead.id) {
              syncedIdsRef.current.add(lead.id);
            }
            result.synced++;
          }
        } else {
          console.warn("[syncPendingLeads] Failed to sync lead:", lead.nome, syncResult.error);
          result.failed++;
        }
      }

      localStorage.setItem(storageKey, JSON.stringify(leads));
      
      // Store duplicates for later resolution
      if (duplicatesFound.length > 0) {
        const duplicateKey = getDuplicateStorageKey();
        localStorage.setItem(duplicateKey, JSON.stringify(duplicatesFound));
        setDuplicatesToResolve(duplicatesFound);
        // Notify other hook instances about duplicates
        emitDuplicatesChanged();
      }
      
      countPending();
      // Notify other hook instances about pending count change
      emitPendingCountChanged();
      
      setLastSyncResult(result);

      if (showToast) {
        if (result.duplicates > 0) {
          toast({
            title: "Clientes existentes encontrados",
            description: `${result.duplicates} lead${result.duplicates > 1 ? 's' : ''} com telefone já cadastrado. Revise antes de sincronizar.`,
            variant: "destructive",
          });
        } else if (result.failed === 0 && result.synced > 0) {
          toast({
            title: "Sincronização concluída! ✓",
            description: `${result.synced} lead${result.synced > 1 ? 's' : ''} enviado${result.synced > 1 ? 's' : ''} com sucesso.`,
          });
        } else if (result.synced > 0 && result.failed > 0) {
          toast({
            title: "Sincronização parcial",
            description: `${result.synced} enviado${result.synced > 1 ? 's' : ''}, ${result.failed} falhou${result.failed > 1 ? 'ram' : ''}. Tente novamente.`,
            variant: "destructive",
          });
        } else if (result.failed > 0) {
          toast({
            title: "Falha na sincronização",
            description: `${result.failed} lead${result.failed > 1 ? 's' : ''} não pôde${result.failed > 1 ? 'ram' : ''} ser enviado${result.failed > 1 ? 's' : ''}. Tente novamente.`,
            variant: "destructive",
          });
        }
      }

      return result;
    } catch (error) {
      console.error("Error syncing:", error);
      if (showToast) {
        toast({
          title: "Erro na sincronização",
          description: "Ocorreu um erro. Tente novamente mais tarde.",
          variant: "destructive",
        });
      }
      return result;
    } finally {
      setIsSyncing(false);
      syncInProgressRef.current = false;
    }
  }, [countPending, getStorageKey, getDuplicateStorageKey]);

  const saveLocally = useCallback((lead: LeadData): string => {
    try {
      const storageKey = getStorageKey();
      const stored = localStorage.getItem(storageKey);
      const leads: LeadData[] = stored ? JSON.parse(stored) : [];
      
      const localId = `local_${Date.now()}`;
      const newLead = { ...lead, id: localId, synced: false };
      leads.push(newLead);
      
      localStorage.setItem(storageKey, JSON.stringify(leads));
      countPending();
      
      // Notify other hook instances
      emitPendingCountChanged();
      
      return localId;
    } catch (error) {
      console.error("Error saving locally:", error);
      throw new Error("Falha ao salvar localmente");
    }
  }, [getStorageKey, countPending]);

  const saveLead = async (lead: Omit<LeadData, "id" | "synced">): Promise<{ success: boolean; offline: boolean; error?: string }> => {
    // Use fresh navigator.onLine check for most accurate status
    const currentlyOnline = navigator.onLine && isOnlineRef.current;
    
    console.log("[saveLead] Starting save, online:", {
      navigatorOnLine: navigator.onLine,
      isOnlineRef: isOnlineRef.current,
      currentlyOnline,
    });
    
    // If truly offline, save locally
    if (!currentlyOnline) {
      try {
        console.log("[saveLead] Device is offline, saving locally...");
        saveLocally({ ...lead, synced: false });
        return { success: true, offline: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("[saveLead] Offline save failed:", errorMessage);
        return { success: false, offline: true, error: errorMessage };
      }
    }

    // Online: try to sync directly
    const syncResult = await syncLead({ ...lead, synced: true });
    if (syncResult.success) {
      console.log("[saveLead] Online save successful");
      return { success: true, offline: false };
    }
    
    // Online save failed - this is a real error, don't silently fall back to offline
    // The caller should handle this error appropriately
    console.error("[saveLead] Online save failed:", syncResult.error);
    return { success: false, offline: false, error: syncResult.error };
  };

  // Auto sync when connection is restored
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      isOnlineRef.current = true;
      
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      
      syncTimeoutRef.current = setTimeout(() => {
        const pending = countPending();
        if (pending > 0) {
          toast({
            title: "Conexão restabelecida! 📶",
            description: `${pending} lead${pending > 1 ? 's' : ''} pendente${pending > 1 ? 's' : ''}. Sincronizando automaticamente...`,
          });
          
          syncPendingLeads(true);
        }
      }, 1500);
    };

    const handleOffline = () => {
      setIsOnline(false);
      isOnlineRef.current = false;
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      toast({
        title: "Você está offline 📴",
        description: "Os leads serão salvos localmente e sincronizados quando a conexão voltar.",
        variant: "destructive",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Count pending on mount
    countPending();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [countPending, syncPendingLeads]);

  const retrySync = useCallback(() => {
    return syncPendingLeads(true);
  }, [syncPendingLeads]);

  const clearSyncedLeads = useCallback(() => {
    try {
      const storageKey = getStorageKey();
      const stored = localStorage.getItem(storageKey);
      if (!stored) return;
      
      const leads: LeadData[] = JSON.parse(stored);
      const pendingOnly = leads.filter((l) => !l.synced);
      localStorage.setItem(storageKey, JSON.stringify(pendingOnly));
    } catch (error) {
      console.error("Error clearing synced leads:", error);
    }
  }, [getStorageKey]);

  /**
   * Resolve a duplicate by forcing creation of new lead
   */
  const resolveDuplicateAsNew = useCallback(async (localLeadId: string): Promise<boolean> => {
    try {
      const storageKey = getStorageKey();
      const duplicateKey = getDuplicateStorageKey();
      const stored = localStorage.getItem(storageKey);
      if (!stored) return false;
      
      const leads: LeadData[] = JSON.parse(stored);
      const lead = leads.find((l) => l.id === localLeadId);
      
      if (!lead) return false;
      
      const syncResult = await syncLead(lead);
      if (syncResult.success) {
        lead.synced = true;
        localStorage.setItem(storageKey, JSON.stringify(leads));
        
        // Remove from duplicates list
        const duplicates = duplicatesToResolve.filter((d) => d.leadId !== localLeadId);
        setDuplicatesToResolve(duplicates);
        localStorage.setItem(duplicateKey, JSON.stringify(duplicates));
        
        countPending();
        
        // Notify other hook instances
        emitPendingCountChanged();
        emitDuplicatesChanged();
        
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error resolving duplicate as new:", error);
      return false;
    }
  }, [duplicatesToResolve, countPending, getStorageKey, getDuplicateStorageKey]);

  /**
   * Resolve a duplicate by discarding the local lead (it's already in DB)
   */
  const resolveDuplicateAsExisting = useCallback((localLeadId: string): boolean => {
    try {
      const storageKey = getStorageKey();
      const duplicateKey = getDuplicateStorageKey();
      const stored = localStorage.getItem(storageKey);
      if (!stored) return false;
      
      const leads: LeadData[] = JSON.parse(stored);
      const index = leads.findIndex((l) => l.id === localLeadId);
      
      if (index >= 0) {
        // Mark as synced (since we're treating it as duplicate of existing)
        leads[index].synced = true;
        localStorage.setItem(storageKey, JSON.stringify(leads));
        
        // Remove from duplicates list
        const duplicates = duplicatesToResolve.filter((d) => d.leadId !== localLeadId);
        setDuplicatesToResolve(duplicates);
        localStorage.setItem(duplicateKey, JSON.stringify(duplicates));
        
        countPending();
        
        // Notify other hook instances
        emitPendingCountChanged();
        emitDuplicatesChanged();
        
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error resolving duplicate as existing:", error);
      return false;
    }
  }, [duplicatesToResolve, countPending, getStorageKey, getDuplicateStorageKey]);

  /**
   * Clear all resolved duplicates
   */
  const clearDuplicates = useCallback(() => {
    const duplicateKey = getDuplicateStorageKey();
    setDuplicatesToResolve([]);
    localStorage.removeItem(duplicateKey);
    emitDuplicatesChanged();
  }, [getDuplicateStorageKey]);

  // Load duplicates from storage on mount and listen for changes from other hook instances
  useEffect(() => {
    // Initial load
    loadDuplicates();
    countPending();

    // Listen for changes from other hook instances
    const handlePendingCountChanged = () => {
      countPending();
    };

    const handleDuplicatesChanged = () => {
      loadDuplicates();
    };

    window.addEventListener(PENDING_COUNT_CHANGED_EVENT, handlePendingCountChanged);
    window.addEventListener(DUPLICATES_CHANGED_EVENT, handleDuplicatesChanged);

    return () => {
      window.removeEventListener(PENDING_COUNT_CHANGED_EVENT, handlePendingCountChanged);
      window.removeEventListener(DUPLICATES_CHANGED_EVENT, handleDuplicatesChanged);
    };
  }, [loadDuplicates, countPending]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncResult,
    duplicatesToResolve,
    saveLead,
    syncPendingLeads,
    retrySync,
    clearSyncedLeads,
    refreshPendingCount: countPending,
    resolveDuplicateAsNew,
    resolveDuplicateAsExisting,
    clearDuplicates,
  };
}
