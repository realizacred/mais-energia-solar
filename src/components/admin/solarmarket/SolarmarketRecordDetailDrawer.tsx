/**
 * SolarmarketRecordDetailDrawer — Visualização detalhada de um registro
 * importado da camada raw/staging do SolarMarket.
 *
 * Cada entidade (cliente, projeto, proposta, funil, custom_field) recebe
 * um layout dedicado com formatação inteligente dos campos conhecidos
 * + seção "Payload bruto" recolhível para auditoria completa.
 *
 * Toda extração de dados delegada aos parsers centralizados em
 * @/lib/solarmarket/parsers (RB-04/AP-01: nada de pick espalhado aqui).
 *
 * Reutiliza formatadores canônicos de @/lib/formatters/index.
 * RB-01/RB-02/RB-21/RB-08 mantidos.
 */
import { useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Users, FolderKanban, FileText, GitBranch, Settings2,
  ChevronDown, Code2, ExternalLink,
} from "lucide-react";
import {
  formatPhoneBR, formatDocument, formatCEP, formatDate, formatDateTime,
  formatBRL, formatUF, sanitizeText, formatInteger,
} from "@/lib/formatters/index";
import {
  parseSmCliente, parseSmProjeto, parseSmProposta, parseSmFunil, parseSmCustomField,
  type ExternalRef,
} from "@/lib/solarmarket/parsers";

export type RawEntityKind =
  | "clientes"
  | "projetos"
  | "propostas"
  | "funis"
  | "custom_fields";

export interface RawRecord {
  id: string;
  external_id: string | null;
  payload: any;
  imported_at: string | null;
  created_at: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: RawRecord | null;
  kind: RawEntityKind;
  onNavigate?: (kind: RawEntityKind, search: string) => void;
}

// ─── helpers de exibição ────────────────────────────────────────────────

function fmtTextOrDash(v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string") return sanitizeText(v) || "—";
  return String(v);
}

function fmtBoolean(v: any): string {
  if (v === true) return "Sim";
  if (v === false) return "Não";
  return "—";
}

function fmtNumberOrDash(v: number | null | undefined): string {
  if (v == null) return "—";
  return formatInteger(v);
}

function RefDisplay({ ref }: { ref: ExternalRef | null }) {
  if (!ref) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-foreground">{ref.label ?? ref.id ?? "—"}</span>
      {ref.id && ref.label && ref.label !== ref.id && (
        <code className="text-[10px] text-muted-foreground bg-muted/50 px-1 rounded">
          #{ref.id}
        </code>
      )}
    </span>
  );
}

// ─── primitives ─────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </p>
      <div className="text-sm text-foreground break-words">{children}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-foreground border-b border-border pb-1.5 mb-3">
      {children}
    </h3>
  );
}

function ChipList({ items }: { items: string[] }) {
  if (!items.length) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((it, i) => (
        <Badge key={i} variant="outline" className="text-xs">
          {it}
        </Badge>
      ))}
    </div>
  );
}

function RawPayload({ payload }: { payload: any }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between">
          <span className="flex items-center gap-2 text-xs">
            <Code2 className="w-3.5 h-3.5" />
            Payload bruto ({Object.keys(payload ?? {}).length} chaves)
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <pre className="bg-muted/50 border border-border rounded-md p-3 text-[11px] font-mono text-foreground overflow-x-auto max-h-[400px] overflow-y-auto">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

function MetaFooter({ record }: { record: RawRecord }) {
  return (
    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
      <Field label="ID Externo">
        <code className="text-xs">{record.external_id ?? "—"}</code>
      </Field>
      <Field label="Importado em">
        {formatDateTime(record.imported_at ?? record.created_at)}
      </Field>
    </div>
  );
}

// ─── headers por tipo ───────────────────────────────────────────────────

const KIND_META: Record<RawEntityKind, { icon: any; title: string; subtitle: string }> = {
  clientes: { icon: Users, title: "Cliente importado", subtitle: "Dados brutos do SolarMarket" },
  projetos: { icon: FolderKanban, title: "Projeto importado", subtitle: "Dados brutos do SolarMarket" },
  propostas: { icon: FileText, title: "Proposta importada", subtitle: "Dados brutos do SolarMarket" },
  funis: { icon: GitBranch, title: "Funil importado", subtitle: "Dados brutos do SolarMarket" },
  custom_fields: { icon: Settings2, title: "Campo customizado importado", subtitle: "Dados brutos do SolarMarket" },
};

// ─── views por entidade ─────────────────────────────────────────────────

function ClienteView({ record, onNavigate }: { record: RawRecord; onNavigate?: Props["onNavigate"] }) {
  const c = parseSmCliente(record.payload);

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Identificação</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome">{fmtTextOrDash(c.nome)}</Field>
          <Field label="CPF/CNPJ">{c.documento ? formatDocument(String(c.documento)) : "—"}</Field>
          <Field label="Telefone">{formatPhoneBR(c.telefone)}</Field>
          <Field label="Telefone secundário">{formatPhoneBR(c.telefoneSecundario)}</Field>
          <Field label="E-mail">{fmtTextOrDash(c.email)}</Field>
          <Field label="Data de Nascimento">{c.dataNascimento ? formatDate(c.dataNascimento) : "—"}</Field>
          <Field label="Responsável"><RefDisplay ref={c.responsavel} /></Field>
        </div>
      </div>

      <div>
        <SectionTitle>Endereço</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="CEP">{c.cep ? formatCEP(String(c.cep)) : "—"}</Field>
          <Field label="Logradouro">{fmtTextOrDash(c.rua)}</Field>
          <Field label="Número">{fmtTextOrDash(c.numero)}</Field>
          <Field label="Complemento">{fmtTextOrDash(c.complemento)}</Field>
          <Field label="Bairro">{fmtTextOrDash(c.bairro)}</Field>
          <Field label="Cidade">{fmtTextOrDash(c.cidade)}</Field>
          <Field label="Estado (UF)">{c.uf ? formatUF(String(c.uf)) : "—"}</Field>
        </div>
      </div>

      {c.observacoes && (
        <div>
          <SectionTitle>Observações</SectionTitle>
          <p className="text-sm text-foreground whitespace-pre-wrap">{fmtTextOrDash(c.observacoes)}</p>
        </div>
      )}

      {onNavigate && record.external_id && (
        <div>
          <SectionTitle>Navegação relacional</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate("projetos", record.external_id!)}
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Ver projetos relacionados
            </Button>
          </div>
        </div>
      )}

      <MetaFooter record={record} />
      <RawPayload payload={record.payload} />
    </div>
  );
}

function ProjetoView({ record, onNavigate }: { record: RawRecord; onNavigate?: Props["onNavigate"] }) {
  const pr = parseSmProjeto(record.payload);
  const c = pr.cliente;
  const isExcluido = !!pr.excluidoEm;

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Identificação</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Identificador">
            <code className="text-xs">{pr.id ?? "—"}</code>
          </Field>
          <Field label="Status">
            {isExcluido ? (
              <Badge variant="outline" className="border-destructive text-destructive">Excluído na origem</Badge>
            ) : (
              <Badge variant="outline" className="border-success/40 text-success">Ativo</Badge>
            )}
          </Field>
          <Field label="Nome">{fmtTextOrDash(pr.nome)}</Field>
          <Field label="Data de inclusão">{pr.criadoEm ? formatDateTime(pr.criadoEm) : "—"}</Field>
          {isExcluido && (
            <Field label="Data de exclusão">{formatDateTime(pr.excluidoEm)}</Field>
          )}
        </div>
        {pr.descricao && (
          <div className="mt-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Descrição</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{fmtTextOrDash(pr.descricao)}</p>
          </div>
        )}
      </div>

      {c && (
        <div>
          <SectionTitle>Cliente relacionado</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nome">{fmtTextOrDash(c.nome)}</Field>
            <Field label="Empresa">{fmtTextOrDash(c.empresa)}</Field>
            <Field label="CPF/CNPJ">{c.documento ? formatDocument(String(c.documento)) : "—"}</Field>
            <Field label="E-mail">{fmtTextOrDash(c.email)}</Field>
            <Field label="Celular">{formatPhoneBR(c.telefone)}</Field>
            <Field label="Telefone secundário">{formatPhoneBR(c.telefoneSecundario)}</Field>
            <Field label="CEP">{c.cep ? formatCEP(String(c.cep)) : "—"}</Field>
            <Field label="Endereço">{fmtTextOrDash(c.endereco)}</Field>
            <Field label="Número">{fmtTextOrDash(c.numero)}</Field>
            <Field label="Complemento">{fmtTextOrDash(c.complemento)}</Field>
            <Field label="Bairro">{fmtTextOrDash(c.bairro)}</Field>
            <Field label="Cidade">{fmtTextOrDash(c.cidade)}</Field>
            <Field label="Estado">{c.uf ? formatUF(String(c.uf)) : "—"}</Field>
          </div>
        </div>
      )}

      <div>
        <SectionTitle>Pessoas</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Responsável"><RefDisplay ref={pr.responsavel} /></Field>
          <Field label="E-mail do responsável">{fmtTextOrDash(pr.responsavel?.email)}</Field>
          <Field label="Representante"><RefDisplay ref={pr.representante} /></Field>
          <Field label="E-mail do representante">{fmtTextOrDash(pr.representante?.email)}</Field>
        </div>
      </div>

      <div className="rounded-md border border-dashed border-border bg-muted/20 p-3">
        <p className="text-xs font-medium text-muted-foreground mb-1">
          Campos não disponíveis neste endpoint de projeto
        </p>
        <p className="text-[11px] text-muted-foreground">
          A rota <code className="bg-muted/60 px-1 rounded">/projects</code> da API SolarMarket não retorna:
          status, valor/orçamento, funis, etapas, propostas, solicitações, etiquetas, motivo de perda
          e métricas de atividades. Esses dados são agregados durante a migração a partir de outros endpoints.
        </p>
      </div>

      {onNavigate && c?.id && (
        <div>
          <SectionTitle>Navegação relacional</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate("clientes", c.id!)}
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Ver cliente externo
            </Button>
            {record.external_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate("propostas", record.external_id!)}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Ver propostas relacionadas
              </Button>
            )}
          </div>
        </div>
      )}

      <MetaFooter record={record} />
      <RawPayload payload={record.payload} />
    </div>
  );
}

function PropostaView({ record, onNavigate }: { record: RawRecord; onNavigate?: Props["onNavigate"] }) {
  const pp = parseSmProposta(record.payload);
  const link = pp.pdfUrl ?? pp.link;

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Identificação</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Título">{fmtTextOrDash(pp.titulo)}</Field>
          <Field label="Status">
            {pp.status ? <Badge variant="outline">{String(pp.status)}</Badge> : "—"}
          </Field>
          <Field label="Projeto externo"><RefDisplay ref={pp.projeto} /></Field>
          <Field label="Cliente externo"><RefDisplay ref={pp.cliente} /></Field>
          <Field label="Responsável"><RefDisplay ref={pp.responsavel} /></Field>
          <Field label="Valor total">
            {pp.valorTotal != null ? formatBRL(pp.valorTotal) : "—"}
          </Field>
          <Field label="Validade">
            {pp.validadeAte ? formatDate(pp.validadeAte) : "—"}
          </Field>
          <Field label="Link / PDF">
            {link ? (
              <a
                href={String(link)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1 text-sm"
              >
                Abrir <ExternalLink className="w-3 h-3" />
              </a>
            ) : "—"}
          </Field>
        </div>
      </div>

      {pp.descricao && (
        <div>
          <SectionTitle>Descrição</SectionTitle>
          <p className="text-sm text-foreground whitespace-pre-wrap">{fmtTextOrDash(pp.descricao)}</p>
        </div>
      )}

      <div>
        <SectionTitle>Datas</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Data de inclusão">{pp.criadoEm ? formatDateTime(pp.criadoEm) : "—"}</Field>
          <Field label="Atualizado em">{pp.atualizadoEm ? formatDateTime(pp.atualizadoEm) : "—"}</Field>
        </div>
      </div>

      {onNavigate && (
        <div>
          <SectionTitle>Navegação relacional</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {pp.projeto?.id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate("projetos", pp.projeto!.id!)}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Ver projeto externo
              </Button>
            )}
            {pp.cliente?.id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate("clientes", pp.cliente!.id!)}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Ver cliente externo
              </Button>
            )}
          </div>
        </div>
      )}

      <MetaFooter record={record} />
      <RawPayload payload={record.payload} />
    </div>
  );
}

function FunilView({ record }: { record: RawRecord }) {
  const f = parseSmFunil(record.payload);

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Identificação</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome">{fmtTextOrDash(f.nome)}</Field>
          <Field label="Ordem">{f.ordem != null ? String(f.ordem) : "—"}</Field>
          <Field label="Total de etapas">{f.etapas.length}</Field>
          <Field label="Criado em">{f.criadoEm ? formatDateTime(f.criadoEm) : "—"}</Field>
        </div>
      </div>

      {f.descricao && (
        <div>
          <SectionTitle>Descrição</SectionTitle>
          <p className="text-sm text-foreground whitespace-pre-wrap">{fmtTextOrDash(f.descricao)}</p>
        </div>
      )}

      <div>
        <SectionTitle>Etapas detectadas ({f.etapas.length})</SectionTitle>
        {f.etapas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma etapa encontrada no payload.
          </p>
        ) : (
          <div className="space-y-1.5">
            {f.etapas.map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/30"
              >
                <Badge variant="outline" className="text-xs">{s.ordem ?? i + 1}</Badge>
                <span className="text-sm text-foreground flex-1">
                  {fmtTextOrDash(s.nome)}
                </span>
                {s.status && (
                  <Badge variant="outline" className="text-[10px]">{s.status}</Badge>
                )}
                {s.id && (
                  <code className="text-[10px] text-muted-foreground">#{s.id}</code>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <MetaFooter record={record} />
      <RawPayload payload={record.payload} />
    </div>
  );
}

function CustomFieldView({ record }: { record: RawRecord }) {
  const cf = parseSmCustomField(record.payload);

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Identificação</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome">{fmtTextOrDash(cf.nome)}</Field>
          <Field label="Tipo">
            {cf.tipo ? <Badge variant="outline">{String(cf.tipo)}</Badge> : "—"}
          </Field>
          <Field label="Obrigatório">{fmtBoolean(cf.obrigatorio)}</Field>
          <Field label="Total de opções">{cf.opcoes.length}</Field>
          <Field label="Grupo">{fmtTextOrDash(cf.grupo)}</Field>
          <Field label="Aplica-se a">{fmtTextOrDash(cf.entidade)}</Field>
          <Field label="Valor padrão">
            {cf.valorPadrao == null
              ? "—"
              : typeof cf.valorPadrao === "object"
                ? <code className="text-xs">{JSON.stringify(cf.valorPadrao)}</code>
                : String(cf.valorPadrao)}
          </Field>
        </div>
      </div>

      {cf.opcoes.length > 0 && (
        <div>
          <SectionTitle>Opções / Enumerações</SectionTitle>
          <ChipList items={cf.opcoes} />
        </div>
      )}

      <MetaFooter record={record} />
      <RawPayload payload={record.payload} />
    </div>
  );
}

// ─── componente principal ───────────────────────────────────────────────

export function SolarmarketRecordDetailDrawer({
  open, onOpenChange, record, kind, onNavigate,
}: Props) {
  if (!record) return null;
  const meta = KIND_META[kind];
  const Icon = meta.icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto"
      >
        <SheetHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base">{meta.title}</SheetTitle>
              <SheetDescription className="text-xs">{meta.subtitle}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6">
          {kind === "clientes" && <ClienteView record={record} onNavigate={onNavigate} />}
          {kind === "projetos" && <ProjetoView record={record} onNavigate={onNavigate} />}
          {kind === "propostas" && <PropostaView record={record} onNavigate={onNavigate} />}
          {kind === "funis" && <FunilView record={record} />}
          {kind === "custom_fields" && <CustomFieldView record={record} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
