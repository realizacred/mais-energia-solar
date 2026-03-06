/**
 * UCDetailPage — Full detail page for a Unidade Consumidora.
 * Route: /admin/ucs/:id
 * Improved with prominent header banner, restructured Config tab.
 */
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { unitService, type UCRecord } from "@/services/unitService";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, ArrowLeft, MapPin, Zap, FileText, Settings, Gauge, Link2, History, Edit, Trash2, Mail, Lock, Sun } from "lucide-react";
import { UCMeterTab } from "./UCMeterTab";
import { UCBillingSettingsTab } from "./UCBillingSettingsTab";
import { UCInvoicesTab } from "./UCInvoicesTab";
import { UCPlantLinksTab } from "./UCPlantLinksTab";
import { UCFormDialog } from "./UCFormDialog";

const UC_TYPE_LABELS: Record<string, string> = {
  consumo: "Consumo",
  gd_geradora: "GD Geradora",
  beneficiaria: "Beneficiária",
};

export default function UCDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: uc, isLoading, error } = useQuery({
    queryKey: ["uc_detail", id],
    queryFn: () => unitService.getById(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !uc) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/ucs")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <div className="text-center py-12 text-muted-foreground">UC não encontrada.</div>
      </div>
    );
  }

  const end = uc.endereco || {};
  const enderecoStr = [end.logradouro, end.numero, end.bairro, end.cidade, end.estado].filter(Boolean).join(", ");

  return (
    <div className="space-y-0">
      {/* Back button */}
      <div className="p-4 md:px-6 md:pt-6 pb-0">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/ucs")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
      </div>

      {/* Hero header banner — inspired by reference */}
      <div className="mx-4 md:mx-6 mt-3 rounded-xl bg-gradient-to-r from-card to-muted/30 border shadow-sm p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-6">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Denominação</p>
              <p className="text-sm font-bold truncate">{uc.nome}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Contrato</p>
              <p className="text-sm font-bold font-mono">{uc.codigo_uc}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Concessionária</p>
              <p className="text-sm font-bold truncate">{uc.concessionaria_nome || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Classificação</p>
              <p className="text-sm font-bold">{uc.classificacao_grupo || "—"}{uc.classificacao_subgrupo ? ` - ${uc.classificacao_subgrupo}` : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="text-xs">
              {UC_TYPE_LABELS[uc.tipo_uc] || uc.tipo_uc}
            </Badge>
            <StatusBadge variant={uc.is_archived ? "muted" : uc.status === "active" ? "success" : "warning"} dot>
              {uc.is_archived ? "Arquivada" : uc.status === "active" ? "Ativa" : uc.status}
            </StatusBadge>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="p-4 md:p-6 space-y-4">
        <Tabs defaultValue="geral" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="geral" className="gap-1"><Building2 className="w-3.5 h-3.5" /> Geral</TabsTrigger>
            <TabsTrigger value="config" className="gap-1"><Settings className="w-3.5 h-3.5" /> Configurações</TabsTrigger>
            <TabsTrigger value="medidor" className="gap-1"><Gauge className="w-3.5 h-3.5" /> Medidor</TabsTrigger>
            <TabsTrigger value="faturas" className="gap-1"><FileText className="w-3.5 h-3.5" /> Faturas</TabsTrigger>
            <TabsTrigger value="usinas" className="gap-1"><Link2 className="w-3.5 h-3.5" /> Vínculos</TabsTrigger>
            <TabsTrigger value="historico" className="gap-1"><History className="w-3.5 h-3.5" /> Histórico</TabsTrigger>
          </TabsList>

          {/* === GERAL TAB === */}
          <TabsContent value="geral" className="space-y-6">
            {/* Credit section */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-muted-foreground">
                <Zap className="w-4 h-4" /> Crédito
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="py-5">
                    <p className="text-xs text-muted-foreground mb-1">Crédito Acumulado</p>
                    <p className="text-2xl font-bold">0.00 <span className="text-sm font-normal text-muted-foreground">kWh</span></p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-5">
                    <p className="text-xs text-muted-foreground mb-1">Crédito Adicionado</p>
                    <p className="text-2xl font-bold">0.00 <span className="text-sm font-normal text-muted-foreground">kWh</span></p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Usinas Relacionadas */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-muted-foreground">
                <Sun className="w-4 h-4" /> Usinas Relacionadas
              </h3>
              <UCPlantLinksTab unitId={uc.id} ucTipo={uc.tipo_uc} />
            </div>

            {/* Faturas Preview */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-muted-foreground">
                <FileText className="w-4 h-4" /> Lista de Faturas
              </h3>
              <UCInvoicesTab unitId={uc.id} />
            </div>

            {/* Details card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Dados da UC</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Código da UC</p>
                    <p className="text-sm font-mono font-medium">{uc.codigo_uc}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Nome / Denominação</p>
                    <p className="text-sm font-medium">{uc.nome}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Tipo da UC</p>
                    <Badge variant="outline" className="text-xs">{UC_TYPE_LABELS[uc.tipo_uc] || uc.tipo_uc}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Concessionária</p>
                    <p className="text-sm">{uc.concessionaria_nome || "Não definida"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Modalidade Tarifária</p>
                    <p className="text-sm">{uc.modalidade_tarifaria || "—"}</p>
                  </div>
                  {enderecoStr && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Endereço</p>
                      <p className="text-sm">{enderecoStr}</p>
                    </div>
                  )}
                  {uc.observacoes && (
                    <div className="md:col-span-2">
                      <p className="text-xs text-muted-foreground mb-0.5">Observações</p>
                      <p className="text-sm">{uc.observacoes}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* === CONFIGURAÇÕES TAB — Restructured like reference === */}
          <TabsContent value="config" className="space-y-6">
            {/* Cadastro section */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Cadastro</CardTitle>
                  <Button variant="link" size="sm" className="text-primary h-auto p-0 text-xs" onClick={() => setEditDialogOpen(true)}>
                    <Edit className="w-3 h-3 mr-1" /> Editar Cadastro
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex gap-1">
                  <span className="text-muted-foreground min-w-[120px]">Denominação:</span>
                  <span>{uc.nome}</span>
                </div>
                <div className="flex gap-1">
                  <span className="text-muted-foreground min-w-[120px]">Concessionária:</span>
                  <span>{uc.concessionaria_nome || "Não definida"}</span>
                </div>
                <div className="flex gap-1">
                  <span className="text-muted-foreground min-w-[120px]">Contrato:</span>
                  <span className="font-mono">{uc.codigo_uc}</span>
                </div>
                <div className="flex gap-1">
                  <span className="text-muted-foreground min-w-[120px]">Classificação:</span>
                  <span>{uc.classificacao_grupo || "—"}{uc.classificacao_subgrupo ? ` - ${uc.classificacao_subgrupo}` : ""}</span>
                </div>
                <div className="flex gap-1">
                  <span className="text-muted-foreground min-w-[120px]">Modalidade:</span>
                  <span>{uc.modalidade_tarifaria || "—"}</span>
                </div>
              </CardContent>
            </Card>

            {/* Vincular usina */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Sun className="w-4 h-4" /> Instalar Usina</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">Selecione a usina que deseja vincular, apenas usinas sem lista de compensação serão listadas.</p>
                <UCPlantLinksTab unitId={uc.id} ucTipo={uc.tipo_uc} />
              </CardContent>
            </Card>

            {/* Faturas por E-mail */}
            <UCBillingSettingsTab unitId={uc.id} />

            {/* Remover */}
            <Card className="border-destructive/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-destructive">Outros</CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="link" size="sm" className="text-destructive h-auto p-0 text-xs">
                  <Trash2 className="w-3 h-3 mr-1" /> Remover UC
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="medidor">
            <UCMeterTab unitId={uc.id} />
          </TabsContent>

          <TabsContent value="faturas">
            <UCInvoicesTab unitId={uc.id} />
          </TabsContent>

          <TabsContent value="usinas">
            <UCPlantLinksTab unitId={uc.id} ucTipo={uc.tipo_uc} />
          </TabsContent>

          <TabsContent value="historico">
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <History className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm font-medium">Histórico de atividades</p>
                <p className="text-xs">O registro de alterações desta UC aparecerá aqui.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <UCFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        editingUC={uc}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["uc_detail", id] });
          setEditDialogOpen(false);
        }}
      />
    </div>
  );
}
