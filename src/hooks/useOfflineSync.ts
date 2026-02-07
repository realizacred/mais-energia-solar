import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ChecklistData {
  id?: string;
  data_instalacao: string;
  endereco: string;
  bairro?: string;
  lead_code?: string;
  placas_local_aprovado: boolean;
  inversor_local_aprovado: boolean;
  avaliacao_atendimento?: string;
  nome_cliente: string;
  assinatura_cliente_url?: string;
  adesivo_inversor: boolean;
  plaquinha_relogio: boolean;
  configuracao_wifi: boolean;
  foto_servico: boolean;
  observacoes?: string;
  // Photos stored as base64 when offline, converted to URLs on sync
  fotos_urls: string[];
  assinatura_instalador_url?: string;
  instalador_id: string;
  synced: boolean;
}

interface SyncResult {
  total: number;
  synced: number;
  failed: number;
}

const STORAGE_KEY = "offline_checklists";

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const countPending = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const checklists: ChecklistData[] = stored ? JSON.parse(stored) : [];
      const count = checklists.filter((c) => !c.synced).length;
      setPendingCount(count);
      return count;
    } catch {
      setPendingCount(0);
      return 0;
    }
  }, []);

  const uploadAsset = async (dataUrl: string, path: string): Promise<string> => {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    
    const { data, error } = await supabase.storage
      .from("checklist-assets")
      .upload(path, blob, {
        contentType: "image/png",
        upsert: true,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from("checklist-assets")
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  };

  const syncChecklist = async (checklist: ChecklistData): Promise<boolean> => {
    try {
      const timestamp = Date.now();
      
      let clientSignatureUrl = checklist.assinatura_cliente_url;
      if (clientSignatureUrl?.startsWith("data:")) {
        clientSignatureUrl = await uploadAsset(
          clientSignatureUrl,
          `signatures/cliente_${timestamp}.png`
        );
      }

      let installerSignatureUrl = checklist.assinatura_instalador_url;
      if (installerSignatureUrl?.startsWith("data:")) {
        installerSignatureUrl = await uploadAsset(
          installerSignatureUrl,
          `signatures/instalador_${timestamp}.png`
        );
      }

      const uploadedPhotos: string[] = [];
      for (let i = 0; i < checklist.fotos_urls.length; i++) {
        const photo = checklist.fotos_urls[i];
        if (photo.startsWith("data:")) {
          const url = await uploadAsset(photo, `fotos/${timestamp}_${i}.png`);
          uploadedPhotos.push(url);
        } else {
          uploadedPhotos.push(photo);
        }
      }

      const { error } = await supabase.from("checklists_instalacao").insert({
        data_instalacao: checklist.data_instalacao,
        endereco: checklist.endereco,
        bairro: checklist.bairro,
        lead_code: checklist.lead_code,
        placas_local_aprovado: checklist.placas_local_aprovado,
        inversor_local_aprovado: checklist.inversor_local_aprovado,
        avaliacao_atendimento: checklist.avaliacao_atendimento || null,
        nome_cliente: checklist.nome_cliente,
        assinatura_cliente_url: clientSignatureUrl,
        adesivo_inversor: checklist.adesivo_inversor,
        plaquinha_relogio: checklist.plaquinha_relogio,
        configuracao_wifi: checklist.configuracao_wifi,
        foto_servico: checklist.foto_servico,
        observacoes: checklist.observacoes,
        fotos_urls: uploadedPhotos,
        assinatura_instalador_url: installerSignatureUrl,
        instalador_id: checklist.instalador_id,
        synced: true,
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error syncing checklist:", error);
      return false;
    }
  };

  const syncPendingChecklists = useCallback(async (showToast = true): Promise<SyncResult> => {
    const result: SyncResult = { total: 0, synced: 0, failed: 0 };
    
    if (!navigator.onLine || isSyncing) {
      if (showToast && !navigator.onLine) {
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
      
      if (showToast) {
        toast({
          title: "Sincronizando...",
          description: "Enviando checklists pendentes.",
        });
      }

      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setIsSyncing(false);
        return result;
      }

      const checklists: ChecklistData[] = JSON.parse(stored);
      const pending = checklists.filter((c) => !c.synced);
      result.total = pending.length;

      if (pending.length === 0) {
        if (showToast) {
          toast({
            title: "Tudo sincronizado! ✓",
            description: "Não há checklists pendentes.",
          });
        }
        setIsSyncing(false);
        return result;
      }

      for (const checklist of pending) {
        const success = await syncChecklist(checklist);
        if (success) {
          const index = checklists.findIndex((c) => c.id === checklist.id);
          if (index >= 0) {
            checklists[index].synced = true;
            result.synced++;
          }
        } else {
          result.failed++;
        }
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(checklists));
      countPending();
      setLastSyncResult(result);

      // Mostrar resultado da sincronização
      if (showToast) {
        if (result.failed === 0 && result.synced > 0) {
          toast({
            title: "Sincronização concluída! ✓",
            description: `${result.synced} checklist${result.synced > 1 ? 's' : ''} enviado${result.synced > 1 ? 's' : ''} com sucesso.`,
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
            description: `${result.failed} checklist${result.failed > 1 ? 's' : ''} não pôde${result.failed > 1 ? 'ram' : ''} ser enviado${result.failed > 1 ? 's' : ''}. Tente novamente.`,
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
    }
  }, [isSyncing, countPending]);

  const saveLocally = (checklist: ChecklistData): string => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const checklists: ChecklistData[] = stored ? JSON.parse(stored) : [];
      
      const localId = `local_${Date.now()}`;
      const newChecklist = { ...checklist, id: localId, synced: false };
      checklists.push(newChecklist);
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checklists));
      countPending();
      
      return localId;
    } catch (error) {
      console.error("Error saving locally:", error);
      throw new Error("Falha ao salvar localmente");
    }
  };

  const saveChecklist = async (checklist: Omit<ChecklistData, "id" | "synced">): Promise<{ success: boolean; offline: boolean }> => {
    if (navigator.onLine) {
      try {
        const success = await syncChecklist({ ...checklist, synced: true });
        if (success) {
          return { success: true, offline: false };
        }
      } catch (error) {
        console.error("Online save failed, saving offline:", error);
      }
    }

    try {
      saveLocally({ ...checklist, synced: false });
      return { success: true, offline: true };
    } catch {
      return { success: false, offline: true };
    }
  };

  // Sincronização automática quando internet volta
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      
      // Pequeno delay para garantir que a conexão está estável
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      
      syncTimeoutRef.current = setTimeout(() => {
        const pending = countPending();
        if (pending > 0) {
          toast({
            title: "Conexão restabelecida! 📶",
            description: `${pending} checklist${pending > 1 ? 's' : ''} pendente${pending > 1 ? 's' : ''}. Sincronizando automaticamente...`,
          });
          
          // Sincroniza automaticamente
          syncPendingChecklists(true);
        }
      }, 1500);
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      toast({
        title: "Você está offline 📴",
        description: "Os checklists serão salvos localmente e sincronizados quando a conexão voltar.",
        variant: "destructive",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Contar pendentes ao montar
    countPending();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [countPending, syncPendingChecklists]);

  // Retry function para tentar novamente
  const retrySync = useCallback(() => {
    return syncPendingChecklists(true);
  }, [syncPendingChecklists]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncResult,
    saveChecklist,
    syncPendingChecklists,
    retrySync,
  };
}
