import { useMemo, useState } from "react";
import { Plus, Pencil, Copy, Archive, Receipt, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LoadingState, EmptyState } from "@/components/ui-kit";
import { useDocumentTemplates } from "./useDocumentTemplates";
import { TemplateModal } from "./TemplateModal";
import { useBrandSettings } from "@/hooks/useBrandSettings";
import { RECIBO_SEED_TEMPLATES } from "./seedReciboTemplates";
import type { DocumentTemplate } from "./types";
import { format } from "date-fns";
import { toast } from "sonner";

/**
 * Aba Recibos — domínio dedicado dentro de Documentos & Assinaturas.
 * Reutiliza document_templates (categoria='recibo') sem duplicar lógica.
 * Branding (logo, CNPJ, contato) injetado via {{empresa.*}} pelo motor de geração.
 */
export function RecibosTab() {
  const [innerTab, setInnerTab] = useState<"templates" | "emitidos">("templates");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentTemplate | null>(null);

  const { data: templates, isLoading, upsert } = useDocumentTemplates("recibo");
  const { settings: brand } = useBrandSettings();

  const seeding = upsert.isPending;

  const handleSeed = async () => {
    try {
      for (const t of RECIBO_SEED_TEMPLATES) {
        // Evita duplicar se já existir nome igual
        if ((templates ?? []).some((x) => x.nome === t.nome)) continue;
        await upsert.mutateAsync({
          categoria: t.categoria,
          subcategoria: t.subcategoria,
          nome: t.nome,
          descricao: t.descricao,
          requires_signature_default: t.requires_signature_default,
          default_signers: [],
          form_schema: t.form_schema,
        } as Partial<DocumentTemplate>);
      }
      toast.success("Templates pré-configurados criados");
    } catch (e) {
      toast.error("Falha ao criar templates pré-configurados");
    }
  };

  const brandReady = useMemo(
    () => Boolean(brand?.logo_url || brand?.logo_small_url),
    [brand]
  );

  return (
    <div className="space-y-4">
      {/* Branding banner */}
      <Card className="border-l-4 border-l-primary">
        <CardContent className="p-4 flex items-center gap-4">
          {brand?.logo_small_url || brand?.logo_url ? (
            <img
              src={brand.logo_small_url || brand.logo_url || ""}
              alt="Logo da empresa"
              className="h-10 w-10 rounded object-contain bg-muted/30 p-1"
            />
          ) : (
            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center text-muted-foreground">
              <Receipt className="h-5 w-5" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground">
              Branding aplicado automaticamente nos recibos
            </p>
            <p className="text-[11px] text-muted-foreground">
              Logo, nome e dados de contato vêm de Configurações &gt; Identidade Visual.
              {!brandReady && " Configure o logo para que apareça nos recibos gerados."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs value={innerTab} onValueChange={(v) => setInnerTab(v as "templates" | "emitidos")}>
        <TabsList className="bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="templates" className="text-xs gap-1.5">
            <Receipt className="h-3.5 w-3.5" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="emitidos" className="text-xs gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Recibos emitidos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4 space-y-3">
          {isLoading ? (
            <LoadingState context="config" message="Carregando templates de recibo..." />
          ) : (templates ?? []).length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Nenhum template de recibo"
              description="Crie os templates pré-configurados (Sinal, Parcela e Quitação) ou adicione um manualmente."
              action={
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSeed} disabled={seeding} className="gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    {seeding ? "Criando..." : "Usar templates prontos"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(null);
                      setModalOpen(true);
                    }}
                    className="gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" /> Em branco
                  </Button>
                </div>
              }
            />
          ) : (
            <Card className="border-l-4 border-l-primary">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-primary" />
                  Templates de Recibo ({templates?.length})
                </CardTitle>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditing(null);
                    setModalOpen(true);
                  }}
                  className="h-7 gap-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" /> Novo
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(templates ?? []).map((tpl) => (
                    <div
                      key={tpl.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">
                            {tpl.nome}
                          </p>
                          {tpl.subcategoria && (
                            <Badge variant="secondary" className="text-[10px] capitalize">
                              {tpl.subcategoria}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px]">
                            v{tpl.version}
                          </Badge>
                        </div>
                        {tpl.descricao && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                            {tpl.descricao}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Atualizado {format(new Date(tpl.updated_at), "dd/MM/yy HH:mm")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditing(tpl);
                            setModalOpen(true);
                          }}
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="emitidos" className="mt-4">
          <EmptyState
            icon={Sparkles}
            title="Em breve"
            description="A listagem de recibos emitidos será integrada ao módulo de Conta Corrente para gerar recibos a partir de pagamentos registrados."
          />
        </TabsContent>
      </Tabs>

      <TemplateModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        template={editing}
        onSave={(data) =>
          upsert.mutate(
            { ...data, categoria: "recibo" } as Partial<DocumentTemplate>,
            { onSuccess: () => setModalOpen(false) }
          )
        }
        saving={upsert.isPending}
      />
    </div>
  );
}
