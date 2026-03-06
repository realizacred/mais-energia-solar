/**
 * UCDetailPage — Full detail page for a Unidade Consumidora.
 * Route: /admin/ucs/:id
 * Tabs: Geral, Configurações, Medidor, Faturas, Vínculos de Usinas, Histórico
 */
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { unitService } from "@/services/unitService";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, ArrowLeft, MapPin, Zap, FileText, Settings, Gauge, Link2, History } from "lucide-react";
import { UCMeterTab } from "./UCMeterTab";
import { UCBillingSettingsTab } from "./UCBillingSettingsTab";
import { UCInvoicesTab } from "./UCInvoicesTab";
import { UCPlantLinksTab } from "./UCPlantLinksTab";

const UC_TYPE_LABELS: Record<string, string> = {
  consumo: "Consumo",
  gd_geradora: "GD Geradora",
  beneficiaria: "Beneficiária",
};

export default function UCDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

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
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/ucs")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
      </div>

      <PageHeader
        icon={Building2}
        title={uc.nome}
        description={`Código: ${uc.codigo_uc}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {UC_TYPE_LABELS[uc.tipo_uc] || uc.tipo_uc}
            </Badge>
            <StatusBadge variant={uc.is_archived ? "muted" : uc.status === "active" ? "success" : "warning"} dot>
              {uc.is_archived ? "Arquivada" : uc.status === "active" ? "Ativa" : uc.status}
            </StatusBadge>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Concessionária</p>
              <p className="text-sm font-medium">{uc.concessionaria_nome || "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Classificação</p>
              <p className="text-sm font-medium">{uc.classificacao_grupo || "—"}{uc.classificacao_subgrupo ? ` / ${uc.classificacao_subgrupo}` : ""}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Modalidade</p>
              <p className="text-sm font-medium">{uc.modalidade_tarifaria || "—"}</p>
            </div>
          </CardContent>
        </Card>
        {enderecoStr && (
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Endereço</p>
                <p className="text-sm font-medium truncate">{enderecoStr}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="geral" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="geral" className="gap-1"><Building2 className="w-3.5 h-3.5" /> Geral</TabsTrigger>
          <TabsTrigger value="config" className="gap-1"><Settings className="w-3.5 h-3.5" /> Configurações</TabsTrigger>
          <TabsTrigger value="medidor" className="gap-1"><Gauge className="w-3.5 h-3.5" /> Medidor</TabsTrigger>
          <TabsTrigger value="faturas" className="gap-1"><FileText className="w-3.5 h-3.5" /> Faturas</TabsTrigger>
          <TabsTrigger value="usinas" className="gap-1"><Link2 className="w-3.5 h-3.5" /> Vínculos</TabsTrigger>
          <TabsTrigger value="historico" className="gap-1"><History className="w-3.5 h-3.5" /> Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="geral">
          <Card>
            <CardContent className="py-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Código da UC</p>
                  <p className="text-sm font-mono font-medium">{uc.codigo_uc}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Nome / Denominação</p>
                  <p className="text-sm font-medium">{uc.nome}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Tipo da UC</p>
                  <Badge variant="outline">{UC_TYPE_LABELS[uc.tipo_uc] || uc.tipo_uc}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Concessionária</p>
                  <p className="text-sm">{uc.concessionaria_nome || "Não definida"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Classificação</p>
                  <p className="text-sm">{uc.classificacao_grupo || "—"}{uc.classificacao_subgrupo ? ` / ${uc.classificacao_subgrupo}` : ""}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Modalidade Tarifária</p>
                  <p className="text-sm">{uc.modalidade_tarifaria || "—"}</p>
                </div>
                {enderecoStr && (
                  <div className="md:col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">Endereço</p>
                    <p className="text-sm">{enderecoStr}</p>
                  </div>
                )}
                {uc.observacoes && (
                  <div className="md:col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">Observações</p>
                    <p className="text-sm">{uc.observacoes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config">
          <UCBillingSettingsTab unitId={uc.id} />
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
  );
}
