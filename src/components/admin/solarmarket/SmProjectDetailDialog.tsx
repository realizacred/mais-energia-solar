import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { SmProject } from "@/hooks/useSolarMarket";

interface Props {
  project: SmProject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function renderValue(v: any): string {
  if (v == null || v === "" || v === "undefined") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Flatten a nested object into key-value pairs with dot notation */
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

/** Group fields by top-level key */
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
  if (!project) return null;

  const raw = project.raw_payload as any;
  const grouped = groupBySection(raw);
  const sortedSections = Object.keys(grouped).sort((a, b) => {
    const ia = SECTION_ORDER.indexOf(a);
    const ib = SECTION_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  // DB columns (non-raw)
  const dbFields: Array<{ key: string; value: any }> = [
    { key: "Nome", value: project.name },
    { key: "Status", value: project.status },
    { key: "Potência (kWp)", value: project.potencia_kwp },
    { key: "Valor", value: project.valor },
    { key: "Cidade", value: project.city },
    { key: "Estado", value: project.state },
    { key: "Tipo Instalação", value: project.installation_type },
    { key: "Consumo Energético", value: project.energy_consumption },
    { key: "Funil", value: (project as any).sm_funnel_name },
    { key: "Etapa", value: (project as any).sm_stage_name },
    { key: "Criado em", value: project.sm_created_at ? new Date(project.sm_created_at).toLocaleString("pt-BR") : null },
  ].filter(f => f.value != null && f.value !== "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            Projeto: {project.name || `#${project.sm_project_id}`}
            <Badge variant="outline" className="text-xs font-mono ml-2">ID {project.sm_project_id}</Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 pb-6">
          {/* DB columns summary */}
          {dbFields.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-foreground mb-2">Resumo</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {dbFields.map(f => (
                  <div key={f.key} className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground mr-2">{f.key}</span>
                    <span className="text-foreground text-right truncate max-w-[200px]">{renderValue(f.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw payload sections */}
          {sortedSections.length > 0 && (
            <Accordion type="multiple" defaultValue={sortedSections.slice(0, 3)} className="w-full">
              {sortedSections.map((section) => {
                const fields = grouped[section];
                return (
                  <AccordionItem key={section} value={section}>
                    <AccordionTrigger className="text-sm font-semibold py-2">
                      {section} <Badge variant="secondary" className="ml-2 text-[10px]">{fields.length}</Badge>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-1 gap-0 text-xs">
                        {fields.map((f, i) => {
                          const display = renderValue(f.value);
                          if (display.length > 500) return null; // skip huge blobs
                          return (
                            <div
                              key={`${f.key}-${i}`}
                              className="flex justify-between items-start py-1.5 px-1 border-b border-border/30 hover:bg-muted/20"
                            >
                              <span className="text-muted-foreground font-mono truncate mr-3 min-w-0 flex-shrink-0">{f.key}</span>
                              <span
                                className="text-foreground font-medium text-right truncate max-w-[250px]"
                                title={display}
                              >
                                {display}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}

          {!raw && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum dado encontrado no payload deste projeto.
            </p>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
