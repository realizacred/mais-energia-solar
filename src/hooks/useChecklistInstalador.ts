import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// ── Types ──────────────────────────────────────────────
export interface ChecklistTemplate {
  id: string;
  nome: string;
  tipo: string;
  descricao: string | null;
}

export interface ChecklistInstalador {
  id: string;
  template_id: string | null;
  status: string;
  fase_atual: string | null;
  data_agendada: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  observacoes: string | null;
  assinatura_instalador_url: string | null;
  assinatura_cliente_url: string | null;
  created_at: string;
}

export interface ChecklistTemplateItem {
  id: string;
  campo: string;
  tipo_campo: string;
  obrigatorio: boolean;
  ordem: number;
}

export interface ChecklistResposta {
  id: string;
  template_item_id: string | null;
  campo: string;
  valor_boolean: boolean | null;
  observacao: string | null;
}

export interface ChecklistArquivo {
  id: string;
  resposta_id: string | null;
  categoria: string;
  nome_arquivo: string;
  url: string;
  tipo_mime: string | null;
  tamanho_bytes: number | null;
}

const STALE = 1000 * 60 * 5;
const QK = "checklist_instalador" as const;

// ── Templates ativos ──
export function useChecklistTemplates() {
  return useQuery({
    queryKey: [QK, "templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_templates")
        .select("id, nome, tipo, descricao")
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as ChecklistTemplate[];
    },
    staleTime: STALE,
  });
}

// ── Checklists de um projeto ──
export function useChecklistsByProjeto(projetoId: string) {
  return useQuery({
    queryKey: [QK, "projeto", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklists_instalador")
        .select("id, template_id, status, fase_atual, data_agendada, data_inicio, data_fim, observacoes, assinatura_instalador_url, assinatura_cliente_url, created_at")
        .eq("projeto_id", projetoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ChecklistInstalador[];
    },
    staleTime: STALE,
    enabled: !!projetoId,
  });
}

// ── Items de template + respostas de um checklist ──
export function useChecklistDetail(checklistId: string | null, templateId: string | null) {
  const itemsQ = useQuery({
    queryKey: [QK, "items", templateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_template_items")
        .select("id, campo, tipo_campo, obrigatorio, ordem")
        .eq("template_id", templateId!)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as ChecklistTemplateItem[];
    },
    staleTime: STALE,
    enabled: !!templateId,
  });

  const respostasQ = useQuery({
    queryKey: [QK, "respostas", checklistId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_instalador_respostas")
        .select("id, template_item_id, campo, valor_boolean, observacao")
        .eq("checklist_id", checklistId!);
      if (error) throw error;
      return (data ?? []) as ChecklistResposta[];
    },
    staleTime: STALE,
    enabled: !!checklistId,
  });

  const arquivosQ = useQuery({
    queryKey: [QK, "arquivos", checklistId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_instalador_arquivos")
        .select("id, resposta_id, categoria, nome_arquivo, url, tipo_mime, tamanho_bytes")
        .eq("checklist_id", checklistId!);
      if (error) throw error;
      return (data ?? []) as ChecklistArquivo[];
    },
    staleTime: STALE,
    enabled: !!checklistId,
  });

  return {
    items: itemsQ.data ?? [],
    respostas: respostasQ.data ?? [],
    arquivos: arquivosQ.data ?? [],
    isLoading: itemsQ.isLoading || respostasQ.isLoading,
    isLoadingArquivos: arquivosQ.isLoading,
  };
}

// ── Helpers ──
async function getTenantAndUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("Não autenticado");
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();
  return { userId: user.id, tenantId: profile?.tenant_id as string };
}

/** Resolve deal_id → projetos.id (FK exige projetos.id, não deals.id) */
async function resolveProjetoId(dealId: string): Promise<string> {
  const { data, error } = await supabase
    .from("projetos")
    .select("id")
    .eq("deal_id", dealId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("Projeto não encontrado para este deal. Verifique se o projeto foi criado corretamente.");
  return data.id;
}

// ── Criar checklist ──
export function useCriarChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projetoId, templateId }: { projetoId: string; templateId: string }) => {
      const { userId, tenantId } = await getTenantAndUser();
      const { data, error } = await supabase
        .from("checklists_instalador")
        .insert({
          projeto_id: projetoId,
          instalador_id: userId,
          template_id: templateId,
          status: "agendado",
          tenant_id: tenantId,
        } as any)
        .select("id, template_id, status, fase_atual, data_agendada, data_inicio, data_fim, observacoes, assinatura_instalador_url, assinatura_cliente_url, created_at")
        .single();
      if (error) throw error;
      return data as ChecklistInstalador;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: [QK, "projeto", vars.projetoId] });
      toast({ title: "Checklist criado", description: "Checklist de instalação iniciado com sucesso." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao criar checklist", description: err.message, variant: "destructive" });
    },
  });
}

// ── Toggle item ──
export function useToggleItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      checklistId, templateItemId, campo, currentValue, existingRespostaId,
    }: {
      checklistId: string;
      templateItemId: string;
      campo: string;
      currentValue: boolean | null;
      existingRespostaId?: string;
    }) => {
      const newVal = !currentValue;
      if (existingRespostaId) {
        const { error } = await supabase
          .from("checklist_instalador_respostas")
          .update({ valor_boolean: newVal, conforme: newVal } as any)
          .eq("id", existingRespostaId);
        if (error) throw error;
      } else {
        const { userId, tenantId } = await getTenantAndUser();
        const { error } = await supabase
          .from("checklist_instalador_respostas")
          .insert({
            checklist_id: checklistId,
            template_item_id: templateItemId,
            campo,
            fase: "instalacao",
            valor_boolean: newVal,
            conforme: newVal,
            respondido_por: userId,
            tenant_id: tenantId,
          } as any);
        if (error) throw error;
      }
      return { checklistId };
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: [QK, "respostas", vars.checklistId] });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });
}

// ── Salvar observação de um item ──
export function useSalvarObservacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      checklistId, templateItemId, campo, observacao, existingRespostaId,
    }: {
      checklistId: string;
      templateItemId: string;
      campo: string;
      observacao: string;
      existingRespostaId?: string;
    }) => {
      if (existingRespostaId) {
        const { error } = await supabase
          .from("checklist_instalador_respostas")
          .update({ observacao } as any)
          .eq("id", existingRespostaId);
        if (error) throw error;
      } else {
        const { userId, tenantId } = await getTenantAndUser();
        const { error } = await supabase
          .from("checklist_instalador_respostas")
          .insert({
            checklist_id: checklistId,
            template_item_id: templateItemId,
            campo,
            fase: "instalacao",
            observacao,
            respondido_por: userId,
            tenant_id: tenantId,
          } as any);
        if (error) throw error;
      }
      return { checklistId };
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: [QK, "respostas", vars.checklistId] });
    },
  });
}

// ── Upload de foto por item ──
export function useUploadFotoItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      checklistId, respostaId, file,
    }: {
      checklistId: string;
      respostaId: string;
      file: File;
    }) => {
      const { tenantId } = await getTenantAndUser();
      const ext = file.name.split(".").pop() || "jpg";
      const storagePath = `${tenantId}/${checklistId}/${respostaId}/${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("checklist-assets")
        .upload(storagePath, file, { upsert: false });
      if (uploadErr) throw uploadErr;

      const { error: dbErr } = await supabase
        .from("checklist_instalador_arquivos")
        .insert({
          checklist_id: checklistId,
          resposta_id: respostaId,
          categoria: "foto_item",
          nome_arquivo: file.name,
          url: storagePath,
          tipo_mime: file.type,
          tamanho_bytes: file.size,
          tenant_id: tenantId,
        } as any);
      if (dbErr) throw dbErr;

      return { checklistId };
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: [QK, "arquivos", vars.checklistId] });
    },
    onError: (err: Error) => {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    },
  });
}

// ── Finalizar checklist (status + assinaturas) ──
export function useFinalizarChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      checklistId, projetoId, assinaturaInstaladorUrl, assinaturaClienteUrl,
    }: {
      checklistId: string;
      projetoId: string;
      assinaturaInstaladorUrl: string | null;
      assinaturaClienteUrl: string | null;
    }) => {
      // Upload signatures to storage if provided
      const { tenantId } = await getTenantAndUser();
      let instUrl = assinaturaInstaladorUrl;
      let cliUrl = assinaturaClienteUrl;

      if (assinaturaInstaladorUrl?.startsWith("data:")) {
        const blob = await fetch(assinaturaInstaladorUrl).then(r => r.blob());
        const path = `${tenantId}/${checklistId}/assinatura_instalador.png`;
        await supabase.storage.from("checklist-assets").upload(path, blob, { upsert: true, contentType: "image/png" });
        instUrl = path;
      }
      if (assinaturaClienteUrl?.startsWith("data:")) {
        const blob = await fetch(assinaturaClienteUrl).then(r => r.blob());
        const path = `${tenantId}/${checklistId}/assinatura_cliente.png`;
        await supabase.storage.from("checklist-assets").upload(path, blob, { upsert: true, contentType: "image/png" });
        cliUrl = path;
      }

      const { error } = await supabase
        .from("checklists_instalador")
        .update({
          status: "finalizado",
          data_fim: new Date().toISOString(),
          assinatura_instalador_url: instUrl,
          assinatura_cliente_url: cliUrl,
        } as any)
        .eq("id", checklistId);
      if (error) throw error;

      return { projetoId };
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: [QK, "projeto", vars.projetoId] });
      toast({ title: "Checklist finalizado", description: "Instalação concluída com sucesso!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao finalizar", description: err.message, variant: "destructive" });
    },
  });
}
