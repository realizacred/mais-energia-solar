import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { uploadDocumentFiles, DocumentFile } from "@/components/leads/DocumentUpload";

interface FormData {
  nome: string;
  telefone: string;
  email?: string;
  cpf_cnpj?: string;
  cep?: string;
  estado: string;
  cidade: string;
  bairro?: string;
  rua?: string;
  numero?: string;
  complemento?: string;
  disjuntor_id?: string;
  transformador_id?: string;
  localizacao?: string;
  observacoes?: string;
  simulacao_aceita_id?: string;
}

export interface OfflineConversion {
  leadId: string;
  leadNome: string;
  formData: FormData;
  identidadeFiles: DocumentFile[];
  comprovanteFiles: DocumentFile[];
  beneficiariaFiles: DocumentFile[];
  savedAt: string;
  synced?: boolean;
}

interface SyncResult {
  total: number;
  synced: number;
  failed: number;
}

const STORAGE_KEY = "offline_lead_conversions";

export function useOfflineConversionSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingConversions, setPendingConversions] = useState<OfflineConversion[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const syncInProgressRef = useRef(false);

  const loadPendingConversions = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const conversions: OfflineConversion[] = stored ? JSON.parse(stored) : [];
      const pending = conversions.filter((c) => !c.synced);
      setPendingConversions(pending);
      return pending;
    } catch {
      setPendingConversions([]);
      return [];
    }
  }, []);

  const syncConversion = async (conversion: OfflineConversion): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log("[syncConversion] Syncing conversion for lead:", conversion.leadNome);

      // Upload all documents
      const identidadeUrls = await uploadDocumentFiles(conversion.identidadeFiles, "identidade", supabase);
      const comprovanteUrls = await uploadDocumentFiles(conversion.comprovanteFiles, "comprovante", supabase);
      const beneficiariaUrls = await uploadDocumentFiles(conversion.beneficiariaFiles, "beneficiaria", supabase);

      // Create client
      const { data: cliente, error: clienteError } = await supabase
        .from("clientes")
        .insert({
          nome: conversion.formData.nome,
          telefone: conversion.formData.telefone,
          email: conversion.formData.email || null,
          cpf_cnpj: conversion.formData.cpf_cnpj || null,
          cep: conversion.formData.cep || null,
          estado: conversion.formData.estado,
          cidade: conversion.formData.cidade,
          bairro: conversion.formData.bairro || null,
          rua: conversion.formData.rua || null,
          numero: conversion.formData.numero || null,
          complemento: conversion.formData.complemento || null,
          lead_id: conversion.leadId,
          disjuntor_id: conversion.formData.disjuntor_id || null,
          transformador_id: conversion.formData.transformador_id || null,
          localizacao: conversion.formData.localizacao || null,
          observacoes: conversion.formData.observacoes || null,
          identidade_urls: identidadeUrls.length > 0 ? identidadeUrls : null,
          comprovante_endereco_urls: comprovanteUrls.length > 0 ? comprovanteUrls : null,
          comprovante_beneficiaria_urls: beneficiariaUrls.length > 0 ? beneficiariaUrls : null,
          simulacao_aceita_id: conversion.formData.simulacao_aceita_id || null,
        })
        .select()
        .single();

      if (clienteError) throw clienteError;

      // Update lead status to "Aguardando Validação" (admin needs to approve)
      const { data: convertidoStatus } = await supabase
        .from("lead_status")
        .select("id")
        .eq("nome", "Aguardando Validação")
        .single();

      if (convertidoStatus) {
        await supabase
          .from("leads")
          .update({ status_id: convertidoStatus.id })
          .eq("id", conversion.leadId);
      }

      console.log("[syncConversion] Successfully synced conversion:", cliente);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[syncConversion] Error:", errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const syncSingleConversion = useCallback(async (leadId: string): Promise<boolean> => {
    if (syncInProgressRef.current) {
      console.log("[syncSingleConversion] Sync already in progress, skipping");
      return false;
    }

    // Check online status at call time
    const currentlyOnline = navigator.onLine;
    console.log("[syncSingleConversion] Online status check:", currentlyOnline);
    
    if (!currentlyOnline) {
      toast({
        title: "Sem conexão",
        description: "Aguarde a conexão ser restabelecida.",
        variant: "destructive",
      });
      return false;
    }

    try {
      setSyncingId(leadId);
      syncInProgressRef.current = true;

      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return false;

      const conversions: OfflineConversion[] = JSON.parse(stored);
      const conversion = conversions.find((c) => c.leadId === leadId && !c.synced);

      if (!conversion) return false;

      const result = await syncConversion(conversion);

      if (result.success) {
        // Mark as synced
        const index = conversions.findIndex((c) => c.leadId === leadId);
        if (index >= 0) {
          conversions[index].synced = true;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(conversions));
        }

        toast({
          title: "Conversão sincronizada! ✓",
          description: `${conversion.leadNome} foi convertido em cliente.`,
        });

        loadPendingConversions();
        return true;
      } else {
        toast({
          title: "Falha na sincronização",
          description: result.error || "Tente novamente.",
          variant: "destructive",
        });
        return false;
      }
    } finally {
      setSyncingId(null);
      syncInProgressRef.current = false;
    }
  }, [loadPendingConversions]);

  const syncAllConversions = useCallback(async (): Promise<SyncResult> => {
    const result: SyncResult = { total: 0, synced: 0, failed: 0 };

    if (syncInProgressRef.current) {
      console.log("[syncAllConversions] Sync already in progress, skipping");
      return result;
    }

    // Check online status at call time
    const currentlyOnline = navigator.onLine;
    console.log("[syncAllConversions] Online status check:", currentlyOnline);
    
    if (!currentlyOnline) {
      toast({
        title: "Sem conexão",
        description: "Aguarde a conexão ser restabelecida.",
        variant: "destructive",
      });
      return result;
    }

    try {
      setIsSyncing(true);
      syncInProgressRef.current = true;

      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return result;

      const conversions: OfflineConversion[] = JSON.parse(stored);
      const pending = conversions.filter((c) => !c.synced);
      result.total = pending.length;

      if (pending.length === 0) {
        toast({
          title: "Tudo sincronizado! ✓",
          description: "Não há conversões pendentes.",
        });
        return result;
      }

      toast({
        title: "Sincronizando conversões...",
        description: `${pending.length} conversão(ões) pendente(s).`,
      });

      for (const conversion of pending) {
        setSyncingId(conversion.leadId);
        const syncResult = await syncConversion(conversion);

        if (syncResult.success) {
          const index = conversions.findIndex((c) => c.leadId === conversion.leadId);
          if (index >= 0) {
            conversions[index].synced = true;
            result.synced++;
          }
        } else {
          result.failed++;
        }
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversions));
      loadPendingConversions();

      if (result.failed === 0 && result.synced > 0) {
        toast({
          title: "Sincronização concluída! ✓",
          description: `${result.synced} conversão(ões) enviada(s) com sucesso.`,
        });
      } else if (result.synced > 0 && result.failed > 0) {
        toast({
          title: "Sincronização parcial",
          description: `${result.synced} enviada(s), ${result.failed} falhou(aram).`,
          variant: "destructive",
        });
      }

      return result;
    } finally {
      setIsSyncing(false);
      setSyncingId(null);
      syncInProgressRef.current = false;
    }
  }, [loadPendingConversions]);

  const removeConversion = useCallback((leadId: string) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      const conversions: OfflineConversion[] = JSON.parse(stored);
      const filtered = conversions.filter((c) => c.leadId !== leadId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      loadPendingConversions();

      toast({
        title: "Conversão removida",
        description: "A conversão pendente foi removida.",
      });
    } catch (error) {
      console.error("Error removing conversion:", error);
    }
  }, [loadPendingConversions]);

  // Track online status and auto-sync
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      const pending = loadPendingConversions();
      if (pending.length > 0) {
        toast({
          title: "Conexão restabelecida! 📶",
          description: `${pending.length} conversão(ões) pendente(s). Clique para sincronizar.`,
        });
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Load on mount
    loadPendingConversions();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [loadPendingConversions]);

  return {
    isOnline,
    pendingConversions,
    pendingCount: pendingConversions.length,
    isSyncing,
    syncingId,
    syncSingleConversion,
    syncAllConversions,
    removeConversion,
    refreshPending: loadPendingConversions,
  };
}
