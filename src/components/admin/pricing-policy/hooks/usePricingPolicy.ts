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
    loading,
    activeVersionStatus,
  };
}
