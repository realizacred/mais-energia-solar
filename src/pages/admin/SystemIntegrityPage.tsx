import React, { useState } from "react";
import { 
  ShieldAlert, ShieldCheck, RefreshCw, Filter, 
  AlertCircle, AlertTriangle, Info, ExternalLink, Database, 
  FileText, DollarSign, MessageSquare, Briefcase, History,
  Search
} from "lucide-react";
import { useSystemIntegrity, IntegrityFinding } from "@/hooks/useSystemIntegrity";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Spinner } from "@/components/ui-kit/Spinner";
import { PageHeader } from "@/components/ui-kit";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const DOMAIN_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  projections: { label: "Projeções", icon: Database, color: "text-blue-500" },
  propostas: { label: "Propostas", icon: FileText, color: "text-purple-500" },
  financeiro: { label: "Financeiro", icon: DollarSign, color: "text-green-500" },
  whatsapp: { label: "WhatsApp", icon: MessageSquare, color: "text-emerald-500" },
  jobs: { label: "Jobs", icon: Briefcase, color: "text-orange-500" },
  timeline: { label: "Timeline", icon: History, color: "text-slate-500" },
};

const SEVERITY_CONFIG: Record<string, { label: string; icon: any; color: string; badge: string }> = {
  critical: { label: "Crítico", icon: AlertCircle, color: "text-destructive", badge: "destructive" },
  warning: { label: "Atenção", icon: AlertTriangle, color: "text-warning", badge: "warning" },
  info: { label: "Info", icon: Info, color: "text-info", badge: "secondary" },
};

export default function SystemIntegrityPage() {
  const { data: findings = [], isLoading, refetch, isRefetching } = useSystemIntegrity();
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filteredFindings = findings.filter(f => {
    const matchesDomain = domainFilter === "all" || f.domain === domainFilter;
    const matchesSeverity = severityFilter === "all" || f.severity === severityFilter;
    const matchesSearch = !search || 
      f.title.toLowerCase().includes(search.toLowerCase()) || 
      f.description.toLowerCase().includes(search.toLowerCase());
    return matchesDomain && matchesSeverity && matchesSearch;
  });

  const criticalCount = findings.filter(f => f.severity === "critical").length;
  const warningCount = findings.filter(f => f.severity === "warning").length;
  const infoCount = findings.filter(f => f.severity === "info").length;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader 
          title="Integridade do Sistema" 
          description="Auditoria automática de consistência de dados e processos"
          icon={ShieldAlert}
        />
        <Button 
          onClick={() => refetch()} 
          disabled={isLoading || isRefetching}
          variant="outline"
          className="w-full sm:w-auto"
        >
          {isRefetching ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Reverificar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={cn(criticalCount > 0 ? "border-destructive/50 bg-destructive/5" : "")}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" /> Problemas Críticos
            </CardDescription>
            <CardTitle className="text-3xl font-bold">{criticalCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className={cn(warningCount > 0 ? "border-warning/50 bg-warning/5" : "")}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Alertas de Atenção
            </CardDescription>
            <CardTitle className="text-3xl font-bold">{warningCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Info className="h-4 w-4 text-info" /> Observações
            </CardDescription>
            <CardTitle className="text-3xl font-bold">{infoCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por título ou descrição..." 
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={domainFilter} onValueChange={setDomainFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Domínio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Domínios</SelectItem>
                  {Object.entries(DOMAIN_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Severidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="critical">Crítico</SelectItem>
                  <SelectItem value="warning">Atenção</SelectItem>
                  <SelectItem value="info">Informativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Findings Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">Severidade</TableHead>
              <TableHead className="w-[150px]">Domínio</TableHead>
              <TableHead>Achado</TableHead>
              <TableHead>Ação Recomendada</TableHead>
              <TableHead className="w-[100px] text-right">Links</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-48 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Spinner size="lg" />
                    <p className="text-sm text-muted-foreground">Auditando integridade do sistema...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredFindings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-48 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <ShieldCheck className="h-12 w-12 text-success opacity-50" />
                    <p className="font-medium">Nenhuma inconsistência encontrada</p>
                    <p className="text-sm text-muted-foreground">O sistema está operando com alta integridade.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredFindings.map((finding) => {
                const domain = DOMAIN_LABELS[finding.domain] || { label: finding.domain, icon: Database, color: "text-slate-500" };
                const sev = SEVERITY_CONFIG[finding.severity] || { label: finding.severity, icon: Info, color: "text-slate-500", badge: "secondary" };
                const Icon = domain.icon;

                return (
                  <TableRow key={finding.id}>
                    <TableCell>
                      <Badge variant={sev.badge as any} className="gap-1">
                        <sev.icon className="h-3 w-3" />
                        {sev.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Icon className={cn("h-4 w-4", domain.color)} />
                        {domain.label}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-bold text-sm leading-none">{finding.title}</p>
                        <p className="text-xs text-muted-foreground">{finding.description}</p>
                        <p className="text-[10px] text-muted-foreground/60 italic">
                          ID: {finding.entity_id}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-medium text-foreground/80 bg-muted/50 p-2 rounded border border-border/40">
                        {finding.recommended_action}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      {finding.entity_type === 'deal' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <a href={`/admin/crm/pipeline?deal_id=${finding.entity_id}`} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                      {finding.entity_type === 'projeto' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <a href={`/admin/operacional/projetos/${finding.entity_id}`} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
