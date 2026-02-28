import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SmProject } from "@/hooks/useSolarMarket";
import { LoadingState } from "@/components/ui-kit/LoadingState";

interface Props {
  project: SmProject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className="text-sm font-medium text-foreground min-h-[20px]">{value || "—"}</p>
    </div>
  );
}

function renderValue(v: any): string {
  if (v == null || v === "" || v === "undefined") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function flattenObject(obj: any, prefix = ""): Array<{ key: string; value: any }> {
  const entries: Array<{ key: string; value: any }> = [];
  if (!obj || typeof obj !== "object") return entries;
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      entries.push(...flattenObject(v, fullKey));
    } else {
      entries.push({ key: fullKey, value: v });
    }
  }
  return entries;
}

function groupBySection(raw: any): Record<string, Array<{ key: string; value: any }>> {
  const groups: Record<string, Array<{ key: string; value: any }>> = {};
  if (!raw || typeof raw !== "object") return groups;
  for (const [topKey, topVal] of Object.entries(raw)) {
    if (topVal && typeof topVal === "object" && !Array.isArray(topVal)) {
      const section = topKey.charAt(0).toUpperCase() + topKey.slice(1);
      groups[section] = flattenObject(topVal);
    } else {
      if (!groups["Geral"]) groups["Geral"] = [];
      groups["Geral"].push({ key: topKey, value: topVal });
    }
  }
  return groups;
}

const SECTION_ORDER = ["Geral", "Client", "Responsible", "Representative", "CustomFields"];

export function SmProjectDetailDialog({ project, open, onOpenChange }: Props) {
  // Fetch raw_payload on demand when dialog opens
  const { data: rawPayload, isLoading: loadingPayload } = useQuery({
    queryKey: ["sm-project-payload", project?.id],
    enabled: open && !!project?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("solar_market_projects")
        .select("raw_payload")
        .eq("id", project!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.raw_payload ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!project) return null;

  const raw = rawPayload;
  const grouped = groupBySection(raw);
  const sortedSections = Object.keys(grouped).sort((a, b) => {
    const ia = SECTION_ORDER.indexOf(a);
    const ib = SECTION_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[calc(100dvh-2rem)] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base">
              {project.name || `Projeto #${project.sm_project_id}`}
            </DialogTitle>
            <Badge variant="outline" className="text-[10px] font-mono">ID {project.sm_project_id}</Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Resumo */}
          <div className="space-y-3 mb-5">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resumo</h4>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome" value={project.name} />
              <Field label="Status" value={project.status} />
              <Field label="Potência (kWp)" value={project.potencia_kwp?.toString()} />
              <Field label="Valor" value={project.valor ? `R$ ${Number(project.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : null} />
              <Field label="Cidade" value={project.city} />
              <Field label="Estado" value={project.state} />
              <Field label="Tipo Instalação" value={project.installation_type} />
              <Field label="Consumo Energético" value={project.energy_consumption?.toString()} />
              <Field label="Criado em" value={project.sm_created_at ? new Date(project.sm_created_at).toLocaleDateString("pt-BR") : null} />
            </div>
          </div>

          {/* Raw payload sections */}
          {loadingPayload ? (
            <LoadingState message="Carregando detalhes..." />
          ) : sortedSections.length > 0 ? (
            <Accordion type="multiple" defaultValue={sortedSections.slice(0, 2)} className="w-full">
              {sortedSections.map((section) => {
                const fields = grouped[section];
                return (
                  <AccordionItem key={section} value={section}>
                    <AccordionTrigger className="text-xs font-semibold py-2">
                      {section} <Badge variant="secondary" className="ml-2 text-[10px]">{fields.length}</Badge>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-1 gap-0 text-xs">
                        {fields.map((f, i) => {
                          const display = renderValue(f.value);
                          if (display.length > 500) return null;
                          return (
                            <div key={`${f.key}-${i}`} className="flex justify-between items-start py-1.5 px-1 border-b border-border/30">
                              <span className="text-muted-foreground font-mono truncate mr-3">{f.key}</span>
                              <span className="text-foreground text-right truncate max-w-[200px]" title={display}>{display}</span>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          ) : !raw ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum dado encontrado no payload deste projeto.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
