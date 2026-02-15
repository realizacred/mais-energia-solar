import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Policy {
  id: string;
  name: string;
  description: string | null;
}

interface PolicyVersion {
  id: string;
  policy_id: string;
  version_number: number;
  status: "draft" | "active" | "archived";
  published_at: string | null;
  notes: string | null;
  created_at: string;
}

export function usePricingPolicy() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [versions, setVersions] = useState<PolicyVersion[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const activeVersionStatus = versions.find((v) => v.id === selectedVersionId)?.status ?? null;

  // Load policies
  useEffect(() => {
    loadPolicies();
  }, []);

  // Load versions when policy changes
  useEffect(() => {
    if (selectedPolicyId) {
      loadVersions(selectedPolicyId);
    } else {
      setVersions([]);
      setSelectedVersionId(null);
    }
  }, [selectedPolicyId]);

  async function loadPolicies() {
    setLoading(true);
    const { data, error } = await supabase
      .from("pricing_policies")
      .select("id, name, description")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar políticas", description: error.message, variant: "destructive" });
    } else {
      setPolicies(data || []);
      if (data && data.length > 0 && !selectedPolicyId) {
        setSelectedPolicyId(data[0].id);
      }
    }
    setLoading(false);
  }

  async function loadVersions(policyId: string) {
    const { data, error } = await supabase
      .from("pricing_policy_versions")
      .select("id, policy_id, version_number, status, published_at, notes, created_at")
      .eq("policy_id", policyId)
      .order("version_number", { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar versões", description: error.message, variant: "destructive" });
    } else {
      setVersions((data as PolicyVersion[]) || []);
      // Auto-select active version, or latest draft
      const active = data?.find((v: any) => v.status === "active");
      const latestDraft = data?.find((v: any) => v.status === "draft");
      setSelectedVersionId(active?.id || latestDraft?.id || data?.[0]?.id || null);
    }
  }

  const createPolicy = useCallback(async (name: string) => {
    const { data, error } = await supabase
      .from("pricing_policies")
      .insert({ name } as any)
      .select("id, name, description")
      .single();

    if (error) {
      toast({ title: "Erro ao criar política", description: error.message, variant: "destructive" });
      return;
    }

    setPolicies((prev) => [data as any, ...prev]);
    setSelectedPolicyId((data as any).id);
    toast({ title: "Política criada" });
  }, []);

  const createVersion = useCallback(async () => {
    if (!selectedPolicyId) return;

    const nextNumber = versions.length > 0 ? Math.max(...versions.map((v) => v.version_number)) + 1 : 1;

    const { data, error } = await supabase
      .from("pricing_policy_versions")
      .insert({ policy_id: selectedPolicyId, version_number: nextNumber } as any)
      .select("id, policy_id, version_number, status, published_at, notes, created_at")
      .single();

    if (error) {
      toast({ title: "Erro ao criar versão", description: error.message, variant: "destructive" });
      return;
    }

    const newVersion = data as unknown as PolicyVersion;
    setVersions((prev) => [newVersion, ...prev]);
    setSelectedVersionId(newVersion.id);
    toast({ title: `Versão ${newVersion.version_number} criada como rascunho` });
  }, [selectedPolicyId, versions]);

  const publishVersion = useCallback(async (versionId: string) => {
    // Archive currently active version first
    const currentActive = versions.find((v) => v.status === "active");
    if (currentActive) {
      await supabase
        .from("pricing_policy_versions")
        .update({ status: "archived" } as any)
        .eq("id", currentActive.id);
    }

    const { error } = await supabase
      .from("pricing_policy_versions")
      .update({ status: "active", published_at: new Date().toISOString() } as any)
      .eq("id", versionId);

    if (error) {
      toast({ title: "Erro ao publicar", description: error.message, variant: "destructive" });
      return;
    }

    if (selectedPolicyId) await loadVersions(selectedPolicyId);
    toast({ title: "Versão publicada com sucesso" });
  }, [versions, selectedPolicyId]);

  const archiveVersion = useCallback(async (versionId: string) => {
    const { error } = await supabase
      .from("pricing_policy_versions")
      .update({ status: "archived" } as any)
      .eq("id", versionId);

    if (error) {
      toast({ title: "Erro ao arquivar", description: error.message, variant: "destructive" });
      return;
    }

    if (selectedPolicyId) await loadVersions(selectedPolicyId);
    toast({ title: "Versão arquivada" });
  }, [selectedPolicyId]);

  const deleteVersion = useCallback(async (versionId: string) => {
    // Delete child records first (cost components, pricing methods)
    const [ccRes, pmRes] = await Promise.all([
      supabase.from("pricing_cost_components").delete().eq("version_id", versionId),
      supabase.from("pricing_methods").delete().eq("version_id", versionId),
    ]);
    if (ccRes.error || pmRes.error) {
      toast({ title: "Erro ao limpar dependências", description: (ccRes.error || pmRes.error)?.message, variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("pricing_policy_versions").delete().eq("id", versionId);
    if (error) {
      toast({ title: "Erro ao excluir versão", description: error.message, variant: "destructive" });
      return;
    }

    if (selectedPolicyId) await loadVersions(selectedPolicyId);
    toast({ title: "Versão excluída" });
  }, [selectedPolicyId]);

  const deletePolicy = useCallback(async (policyId: string) => {
    // First delete all versions and their children
    const { data: policyVersions } = await supabase
      .from("pricing_policy_versions")
      .select("id")
      .eq("policy_id", policyId);

    if (policyVersions && policyVersions.length > 0) {
      const vIds = policyVersions.map((v: any) => v.id);
      await Promise.all([
        supabase.from("pricing_cost_components").delete().in("version_id", vIds),
        supabase.from("pricing_methods").delete().in("version_id", vIds),
      ]);
      await supabase.from("pricing_policy_versions").delete().eq("policy_id", policyId);
    }

    const { error } = await supabase.from("pricing_policies").delete().eq("id", policyId);
    if (error) {
      toast({ title: "Erro ao excluir política", description: error.message, variant: "destructive" });
      return;
    }

    setPolicies((prev) => prev.filter((p) => p.id !== policyId));
    if (selectedPolicyId === policyId) {
      setSelectedPolicyId(null);
    }
    toast({ title: "Política excluída" });
  }, [selectedPolicyId]);

  const seedSolarTemplate = useCallback(async () => {
    // Create policy
    const { data: policy, error: pErr } = await supabase
      .from("pricing_policies")
      .insert({ name: "Política Solar Padrão", description: "Política de precificação padrão para sistemas fotovoltaicos residenciais e comerciais." } as any)
      .select("id, name, description")
      .single();
    if (pErr || !policy) {
      toast({ title: "Erro ao criar política", description: pErr?.message, variant: "destructive" });
      return;
    }

    // Create version
    const { data: version, error: vErr } = await supabase
      .from("pricing_policy_versions")
      .insert({ policy_id: (policy as any).id, version_number: 1, notes: "Template solar padrão com custos típicos do mercado brasileiro." } as any)
      .select("id")
      .single();
    if (vErr || !version) {
      toast({ title: "Erro ao criar versão", description: vErr?.message, variant: "destructive" });
      return;
    }

    const vId = (version as any).id;

    // Seed cost components
    const components = [
      { version_id: vId, category: "Equipamentos", name: "Módulos Fotovoltaicos", calculation_strategy: "cost_per_kwp", parameters: { unit_cost: 1200 }, display_order: 1, is_active: true, description: "Painéis solares — custo por kWp instalado" },
      { version_id: vId, category: "Equipamentos", name: "Inversor Solar", calculation_strategy: "cost_per_kwp", parameters: { unit_cost: 600 }, display_order: 2, is_active: true, description: "Inversor grid-tie — proporcional à potência" },
      { version_id: vId, category: "Equipamentos", name: "Estrutura de Fixação", calculation_strategy: "cost_per_kwp", parameters: { unit_cost: 250 }, display_order: 3, is_active: true, description: "Suportes, trilhos e parafusos de fixação" },
      { version_id: vId, category: "Equipamentos", name: "Materiais Elétricos (CC/CA)", calculation_strategy: "cost_per_kwp", parameters: { unit_cost: 180 }, display_order: 4, is_active: true, description: "Cabos, conectores MC4, disjuntores, DPS, stringbox" },
      { version_id: vId, category: "Serviços", name: "Mão de Obra — Instalação", calculation_strategy: "cost_per_kwp", parameters: { unit_cost: 400 }, display_order: 5, is_active: true, description: "Equipe de instalação elétrica e mecânica" },
      { version_id: vId, category: "Serviços", name: "Projeto Elétrico e Homologação", calculation_strategy: "fixed_amount", parameters: { amount: 1500 }, display_order: 6, is_active: true, description: "Elaboração do projeto e protocolo junto à concessionária" },
      { version_id: vId, category: "Logística", name: "Frete de Equipamentos", calculation_strategy: "percentage_of_cost", parameters: { percentage: 3 }, display_order: 7, is_active: true, description: "Percentual sobre custo de equipamentos" },
      { version_id: vId, category: "Logística", name: "Deslocamento da Equipe", calculation_strategy: "cost_per_km", parameters: { unit_cost: 2.5 }, display_order: 8, is_active: true, description: "Custo por km de deslocamento até o local" },
      { version_id: vId, category: "Administrativo", name: "Custos Administrativos", calculation_strategy: "percentage_of_cost", parameters: { percentage: 5 }, display_order: 9, is_active: true, description: "Overhead operacional (escritório, ferramentas, seguros)" },
      { version_id: vId, category: "Impostos", name: "Impostos sobre Serviço (ISS)", calculation_strategy: "percentage_of_cost", parameters: { percentage: 5 }, display_order: 10, is_active: true, description: "ISS sobre valor do serviço prestado" },
      { version_id: vId, category: "Seguros", name: "Seguro de Obra e Garantia", calculation_strategy: "fixed_amount", parameters: { amount: 800 }, display_order: 11, is_active: true, description: "Seguro durante instalação + garantia estendida" },
    ];

    const { error: cErr } = await supabase.from("pricing_cost_components").insert(components as any);
    if (cErr) {
      toast({ title: "Erro ao criar componentes", description: cErr.message, variant: "destructive" });
      return;
    }

    // Seed pricing method
    const { error: mErr } = await supabase.from("pricing_methods").insert({
      version_id: vId,
      method_type: "margin_on_cost",
      default_margin_percent: 25,
      default_tax_percent: 8.65,
      kit_margin_override_percent: 15,
      kit_tax_override_percent: null,
    } as any);
    if (mErr) {
      toast({ title: "Erro ao criar método", description: mErr.message, variant: "destructive" });
    }

    setPolicies((prev) => [policy as any, ...prev]);
    setSelectedPolicyId((policy as any).id);
    toast({ title: "Template solar criado com sucesso!", description: "Política com 11 componentes de custo prontos para uso." });
  }, []);

  return {
    policies,
    versions,
    selectedPolicyId,
    selectedVersionId,
    setSelectedPolicyId,
    setSelectedVersionId,
    createPolicy,
    createVersion,
    publishVersion,
    archiveVersion,
    deleteVersion,
    deletePolicy,
    seedSolarTemplate,
    loading,
    activeVersionStatus,
  };
}
