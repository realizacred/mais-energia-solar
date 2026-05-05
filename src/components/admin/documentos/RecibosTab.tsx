import { useMemo, useState } from "react";
import { Plus, Pencil, Receipt, Sparkles, FileText, Download, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LoadingState, EmptyState } from "@/components/ui-kit";
import { useDocumentTemplates } from "./useDocumentTemplates";
import { TemplateModal } from "./TemplateModal";
import { EmitirReciboModal } from "./EmitirReciboModal";
import { useBrandSettings } from "@/hooks/useBrandSettings";
import { RECIBO_SEED_TEMPLATES } from "./seedReciboTemplates";
import {
  useRecibos,
  useReciboPDF,
  useDeleteRecibo,
  getReciboSignedUrl,
  type ReciboEmitido,
} from "@/hooks/useRecibos";
import type { DocumentTemplate } from "./types";
import { format } from "date-fns";
import { toast } from "sonner";

const STATUS_LABEL: Record<ReciboEmitido["status"], string> = {
  emitido: "Emitido",
  enviado: "Enviado",
  assinado: "Assinado",
  cancelado: "Cancelado",
};

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Aba Recibos — domínio dedicado dentro de Documentos & Assinaturas.
 * Reutiliza document_templates (categoria='recibo') sem duplicar lógica.
 * Branding (logo, CNPJ, contato) injetado via {{empresa.*}} pelo motor de geração.
 */
export function RecibosTab() {
  const [innerTab, setInnerTab] = useState<"templates" | "emitidos">("templates");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentTemplate | null>(null);
  const [emitirOpen, setEmitirOpen] = useState(false);

  const { data: templates, isLoading, upsert } = useDocumentTemplates("recibo");
  const { settings: brand } = useBrandSettings();
  const { data: recibos, isLoading: loadingRecibos } = useRecibos();
  const regenPdf = useReciboPDF();
  const deleteRecibo = useDeleteRecibo();

  const seeding = upsert.isPending;

  const handleSeed = async () => {
    try {
      for (const t of RECIBO_SEED_TEMPLATES) {
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
    } catch {
      toast.error("Falha ao criar templates pré-configurados");
    }
  };

  const brandReady = useMemo(
    () => Boolean(brand?.logo_url || brand?.logo_small_url),
    [brand],
  );

  async function handleOpenPdf(r: ReciboEmitido) {
    try {
      let path = r.pdf_path;
      if (!path) {
        const res = await regenPdf.mutateAsync(r.id);
        path = res.pdf_path;
      }
      const url = await getReciboSignedUrl(path!);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível abrir o PDF");
    }
  }

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
          <Button onClick={() => setEmitirOpen(true)} className="gap-2 shrink-0">
            <FileText className="h-4 w-4" /> Emitir recibo
          </Button>
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
            Recibos emitidos {recibos?.length ? `(${recibos.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4 space-y-3">
          {isLoading ? (
            <LoadingState context="config" message="Carregando templates de recibo..." />
          ) : (templates ?? []).length === 0 ? (
            <div className="space-y-3">
              <EmptyState
                icon={Receipt}
                title="Nenhum template de recibo"
                description="Crie os templates pré-configurados (Sinal, Parcela e Quitação) ou adicione um manualmente."
                action={{
                  label: seeding ? "Criando..." : "Usar templates prontos",
                  onClick: handleSeed,
                  icon: Sparkles,
                }}
              />
              <div className="flex justify-center">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setEditing(null); setModalOpen(true); }}
                  className="gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" /> Criar em branco
                </Button>
              </div>
            </div>
          ) : (
            <Card className="border-l-4 border-l-primary">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-primary" />
                  Templates de Recibo ({templates?.length})
                </CardTitle>
                <Button
                  size="sm"
                  onClick={() => { setEditing(null); setModalOpen(true); }}
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
                          <p className="text-sm font-medium text-foreground truncate">{tpl.nome}</p>
                          {tpl.subcategoria && (
                            <Badge variant="secondary" className="text-[10px] capitalize">{tpl.subcategoria}</Badge>
                          )}
                          <Badge variant="outline" className="text-[10px]">v{tpl.version}</Badge>
                        </div>
                        {tpl.descricao && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{tpl.descricao}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Atualizado {format(new Date(tpl.updated_at), "dd/MM/yy HH:mm")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7"
                          onClick={() => { setEditing(tpl); setModalOpen(true); }}
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
          {loadingRecibos ? (
            <LoadingState context="config" message="Carregando recibos..." />
          ) : (recibos ?? []).length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Nenhum recibo emitido"
              description="Clique em 'Emitir recibo' para gerar o primeiro recibo a partir de um template."
              action={{ label: "Emitir recibo", onClick: () => setEmitirOpen(true), icon: FileText }}
            />
          ) : (
            <Card className="border-l-4 border-l-primary">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Histórico de recibos ({recibos!.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recibos!.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">
                            {r.cliente?.nome ?? "—"}
                          </span>
                          <Badge variant="outline" className="text-[10px]">{STATUS_LABEL[r.status]}</Badge>
                          {r.template?.nome && (
                            <Badge variant="secondary" className="text-[10px]">{r.template.nome}</Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {fmtBRL(Number(r.valor))} • {format(new Date(r.emitido_em), "dd/MM/yy HH:mm")}
                          {r.numero ? ` • Nº ${r.numero}` : ""}
                        </p>
                        {r.descricao && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{r.descricao}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7"
                          title="Visualizar PDF"
                          onClick={() => handleOpenPdf(r)}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7"
                          title="Regerar PDF"
                          disabled={regenPdf.isPending}
                          onClick={() => regenPdf.mutate(r.id)}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                          title="Excluir"
                          onClick={() => {
                            if (confirm("Excluir este recibo?")) deleteRecibo.mutate(r.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <TemplateModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        template={editing}
        onSave={(data) =>
          upsert.mutate(
            { ...data, categoria: "recibo" } as Partial<DocumentTemplate>,
            { onSuccess: () => setModalOpen(false) },
          )
        }
        saving={upsert.isPending}
      />

      <EmitirReciboModal
        open={emitirOpen}
        onOpenChange={setEmitirOpen}
        onEmitted={() => setInnerTab("emitidos")}
      />
    </div>
  );
}
