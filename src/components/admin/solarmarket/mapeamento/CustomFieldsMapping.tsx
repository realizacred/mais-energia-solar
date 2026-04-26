/**
 * CustomFieldsMapping — Mapeamento de campos customizados SolarMarket → CRM.
 *
 * Para cada campo do SM, o admin escolhe uma ação:
 *  - map         → vincular a deal_custom_field existente
 *  - create      → criar novo deal_custom_field (informa nome + contexto)
 *  - map_native  → gravar em path nativo da proposta (whitelist)
 *  - ignore      → não migrar
 *
 * Etapa C da migração de garantias/telhado (Cenário A — snapshot nativo).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tags,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Link2,
  Plus,
  Ban,
  Settings2,
} from "lucide-react";
import {
  useSmCustomFieldsStaging,
  useCustomFieldMappings,
  useSaveCustomFieldMapping,
  NATIVE_TARGETS,
  type CfAction,
  type SmField,
} from "@/hooks/useSmCustomFieldMapping";
import { useCustomFieldsList } from "@/hooks/useCustomFieldsSettings";
import { toast } from "sonner";

const ACTION_LABELS: Record<CfAction, { label: string; icon: typeof Link2; cls: string }> = {
  map: { label: "Vincular", icon: Link2, cls: "bg-info/10 text-info border-info/20" },
  create_new: { label: "Criar novo", icon: Plus, cls: "bg-primary/10 text-primary border-primary/20" },
  map_native: { label: "Campo nativo", icon: Sparkles, cls: "bg-success/10 text-success border-success/20" },
  ignore: { label: "Ignorar", icon: Ban, cls: "bg-muted text-muted-foreground border-border" },
};

const CONTEXTS = [
  { value: "projeto", label: "Projeto" },
  { value: "pre_dimensionamento", label: "Pré-dimensionamento" },
  { value: "pos_dimensionamento", label: "Pós-dimensionamento" },
];

const FIELD_TYPES = [
  { value: "text", label: "Texto curto" },
  { value: "textarea", label: "Texto longo" },
  { value: "select", label: "Lista" },
  { value: "file", label: "Arquivo" },
  { value: "currency", label: "Moeda" },
  { value: "boolean", label: "Sim/Não" },
];

interface Props {
  tenantId: string;
}

export function CustomFieldsMapping({ tenantId }: Props) {
  const { data: smFields, isLoading: loadingFields } = useSmCustomFieldsStaging(tenantId);
  const { data: mappings } = useCustomFieldMappings(tenantId);
  const { data: crmFields } = useCustomFieldsList();
  const saveMutation = useSaveCustomFieldMapping();

  // Buffer local para edição linha-a-linha antes de salvar.
  const [drafts, setDrafts] = useState<Record<string, Partial<{
    action: CfAction;
    crm_field_id: string | null;
    crm_field_name_input: string;
    crm_field_context: string;
    crm_field_type: string;
    crm_native_target: string;
  }>>>({});

  const totalCampos = smFields?.length ?? 0;
  const totalMapeados = useMemo(
    () => (smFields ?? []).filter((f) => mappings?.[f.key]).length,
    [smFields, mappings],
  );

  function getRowState(field: SmField) {
    const saved = mappings?.[field.key];
    const draft = drafts[field.key] ?? {};
    return {
      action: (draft.action ?? saved?.action ?? "") as CfAction | "",
      crm_field_id: draft.crm_field_id ?? saved?.crm_field_id ?? "",
      crm_field_name_input:
        draft.crm_field_name_input ?? saved?.crm_field_name_input ?? "",
      crm_field_context:
        draft.crm_field_context ?? saved?.crm_field_context ?? "projeto",
      crm_field_type: draft.crm_field_type ?? saved?.crm_field_type ?? "text",
      crm_native_target: draft.crm_native_target ?? saved?.crm_native_target ?? "",
    };
  }

  function patch(key: string, patch: Record<string, any>) {
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  // Autosave por linha (debounce 700ms): persiste assim que o draft está válido,
  // evitando perda de estado ao navegar entre etapas do wizard.
  const autosaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => {
    if (!smFields) return;
    for (const f of smFields) {
      const draft = drafts[f.key];
      if (!draft) continue;
      const s = getRowState(f);
      // Validação mínima por ação
      const valid =
        (s.action === "map" && !!s.crm_field_id) ||
        (s.action === "create_new" && !!s.crm_field_name_input.trim()) ||
        (s.action === "map_native" && !!s.crm_native_target) ||
        s.action === "ignore";
      if (!valid) continue;

      // Reagenda timer
      if (autosaveTimers.current[f.key]) clearTimeout(autosaveTimers.current[f.key]);
      autosaveTimers.current[f.key] = setTimeout(() => {
        saveMutation.mutate(
          {
            tenantId,
            smField: f,
            action: s.action as CfAction,
            crm_field_id: s.crm_field_id || null,
            crm_field_name_input: s.crm_field_name_input || null,
            crm_field_context: s.crm_field_context || null,
            crm_field_type: s.crm_field_type || null,
            crm_native_target: s.crm_native_target || null,
          },
          {
            onSuccess: () => {
              setDrafts((prev) => {
                const next = { ...prev };
                delete next[f.key];
                return next;
              });
            },
          },
        );
      }, 700);
    }
    // cleanup ao desmontar
    return () => {
      // não limpa aqui para não cancelar saves pendentes durante re-render normal
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts, smFields, tenantId]);

  // Garante flush ao desmontar (ex: usuário clicou em "Voltar"/"Continuar").
  useEffect(() => {
    return () => {
      const timers = autosaveTimers.current;
      Object.keys(timers).forEach((k) => {
        clearTimeout(timers[k]);
      });
    };
  }, []);

  async function handleSave(field: SmField) {
    const s = getRowState(field);
    if (!s.action) return;

    if (s.action === "map" && !s.crm_field_id) {
      toast.error("Selecione um campo do CRM");
      return;
    }
    if (s.action === "create_new" && !s.crm_field_name_input.trim()) {
      toast.error("Informe o nome do novo campo");
      return;
    }
    if (s.action === "map_native" && !s.crm_native_target) {
      toast.error("Selecione o campo nativo de destino");
      return;
    }

    try {
      await saveMutation.mutateAsync({
        tenantId,
        smField: field,
        action: s.action,
        crm_field_id: s.crm_field_id || null,
        crm_field_name_input: s.crm_field_name_input || null,
        crm_field_context: s.crm_field_context || null,
        crm_field_type: s.crm_field_type || null,
        crm_native_target: s.crm_native_target || null,
      });
      // limpa draft após persistir
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[field.key];
        return next;
      });
      toast.success(`Campo "${field.key}" salvo`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar mapeamento";
      toast.error(msg);
    }
  }

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
              <Tags className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-foreground">
                Mapeamento de campos customizados
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Decida como cada campo do SolarMarket deve ser tratado: vincular a
                um campo existente, criar um novo, mapear para um campo nativo da
                proposta (telhado, garantias) ou ignorar.
              </p>
            </div>
          </div>
          {!loadingFields && smFields && (
            <Badge
              variant="outline"
              className={
                totalMapeados === totalCampos
                  ? "bg-success/10 text-success border-success/20"
                  : "bg-warning/10 text-warning border-warning/20"
              }
            >
              {totalMapeados} de {totalCampos} mapeados
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loadingFields && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        )}

        {!loadingFields && (!smFields || smFields.length === 0) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-md bg-muted/30">
            <AlertCircle className="w-4 h-4 text-warning" />
            Nenhum campo customizado encontrado no staging.
          </div>
        )}

        {!loadingFields &&
          smFields?.map((f) => {
            const state = getRowState(f);
            const saved = mappings?.[f.key];
            const isDirty = !!drafts[f.key];
            const ActionIcon = state.action ? ACTION_LABELS[state.action].icon : Settings2;

            return (
              <div
                key={f.key}
                className="rounded-lg border border-border bg-background p-3 space-y-3"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-sm font-semibold text-foreground bg-muted px-1.5 py-0.5 rounded">
                        {f.key}
                      </code>
                      {f.label && (
                        <span className="text-xs text-muted-foreground">— {f.label}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Tipo SM: <span className="font-medium">{f.type ?? "—"}</span>
                      {f.topic && (
                        <>
                          {" • "}Tópico: <span className="font-medium">{f.topic}</span>
                        </>
                      )}
                    </p>
                  </div>
                  {saved && !isDirty && (
                    <Badge variant="outline" className={ACTION_LABELS[saved.action].cls}>
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      {ACTION_LABELS[saved.action].label}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[180px_1fr_auto] gap-2 items-end">
                  {/* Ação */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Ação</Label>
                    <Select
                      value={state.action || undefined}
                      onValueChange={(v) => patch(f.key, { action: v as CfAction })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(ACTION_LABELS) as CfAction[]).map((act) => {
                          const meta = ACTION_LABELS[act];
                          const Icon = meta.icon;
                          return (
                            <SelectItem key={act} value={act}>
                              <span className="flex items-center gap-1.5">
                                <Icon className="w-3.5 h-3.5" />
                                {meta.label}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Configuração específica por ação */}
                  <div>
                    {state.action === "map" && (
                      <>
                        <Label className="text-xs text-muted-foreground">
                          Campo do CRM
                        </Label>
                        <Select
                          value={state.crm_field_id || undefined}
                          onValueChange={(v) => patch(f.key, { crm_field_id: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um campo..." />
                          </SelectTrigger>
                          <SelectContent>
                            {(crmFields ?? []).map((cf: any) => (
                              <SelectItem key={cf.id} value={cf.id}>
                                {cf.title}
                                <span className="text-muted-foreground ml-1">
                                  ({cf.field_context})
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    )}

                    {state.action === "create" && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="sm:col-span-1">
                          <Label className="text-xs text-muted-foreground">
                            Nome do novo campo
                          </Label>
                          <Input
                            placeholder="Ex: Observações técnicas"
                            value={state.crm_field_name_input}
                            onChange={(e) =>
                              patch(f.key, { crm_field_name_input: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Contexto</Label>
                          <Select
                            value={state.crm_field_context}
                            onValueChange={(v) => patch(f.key, { crm_field_context: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CONTEXTS.map((c) => (
                                <SelectItem key={c.value} value={c.value}>
                                  {c.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Tipo</Label>
                          <Select
                            value={state.crm_field_type}
                            onValueChange={(v) => patch(f.key, { crm_field_type: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FIELD_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value}>
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {state.action === "map_native" && (
                      <>
                        <Label className="text-xs text-muted-foreground">
                          Campo nativo da proposta
                        </Label>
                        <Select
                          value={state.crm_native_target || undefined}
                          onValueChange={(v) => patch(f.key, { crm_native_target: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o destino..." />
                          </SelectTrigger>
                          <SelectContent>
                            {NATIVE_TARGETS.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    )}

                    {state.action === "ignore" && (
                      <p className="text-xs text-muted-foreground italic pt-5">
                        Este campo não será migrado.
                      </p>
                    )}

                    {!state.action && (
                      <p className="text-xs text-muted-foreground italic pt-5">
                        Escolha uma ação para configurar este campo.
                      </p>
                    )}
                  </div>

                  <Button
                    size="sm"
                    onClick={() => handleSave(f)}
                    disabled={!isDirty || saveMutation.isPending}
                  >
                    <ActionIcon className="w-3.5 h-3.5 mr-1" />
                    {saveMutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </div>
            );
          })}
      </CardContent>
    </Card>
  );
}
