/**
 * SolarmarketRecordDetailDrawer — Visualização detalhada de um registro
 * importado da camada raw/staging do SolarMarket.
 *
 * Cada entidade (cliente, projeto, proposta, funil, custom_field) recebe
 * um layout dedicado com formatação inteligente dos campos conhecidos
 * + seção "Payload bruto" recolhível para auditoria completa.
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
  formatBRL, formatUF, sanitizeText,
} from "@/lib/formatters/index";

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

// ─── helpers ────────────────────────────────────────────────────────────

function pick(payload: any, ...keys: string[]): any {
  if (!payload) return null;
  for (const k of keys) {
    const v = payload[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
}

function fmtTextOrDash(v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string") return sanitizeText(v) || "—";
  return String(v);
}

function fmtBoolean(v: any): string {
  if (v === true || v === "true" || v === 1) return "Sim";
  if (v === false || v === "false" || v === 0) return "Não";
  return "—";
}

function asArray(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  return [v];
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

function ChipList({ items }: { items: any[] }) {
  if (!items.length) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((it, i) => (
        <Badge key={i} variant="outline" className="text-xs">
          {typeof it === "object" ? (it.label ?? it.name ?? it.value ?? JSON.stringify(it)) : String(it)}
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
  const p = record.payload ?? {};
  const nome = pick(p, "name", "nome", "razao_social", "fantasia", "company");
  const tel = pick(p, "primaryPhone", "phone", "telefone", "celular", "mobile", "phone_number", "secondaryPhone");
  const email = pick(p, "email");
  const doc = pick(p, "cnpjCpf", "cpf_cnpj", "document", "documento", "cpf", "cnpj");
  const nascimento = pick(p, "birth_date", "data_nascimento", "birthday", "birthDate");
  // SolarMarket: campos de endereço estão no nível raiz do payload (não aninhados)
  const endereco = (typeof p.address === "object" && p.address !== null) ? p.address : p;
  const cep = pick(endereco, "zipCode", "zip", "zip_code", "cep", "postal_code");
  const rua = pick(endereco, "street", "rua", "logradouro", "address_line", "address");
  const numero = pick(endereco, "number", "numero");
  const complemento = pick(endereco, "complement", "complemento");
  const bairro = pick(endereco, "neighborhood", "bairro", "district");
  const cidade = pick(endereco, "city", "cidade", "municipio");
  const estado = pick(endereco, "state", "estado", "uf");
  const obs = pick(p, "notes", "observations", "observacoes", "obs");
  const leadExterno = pick(p, "lead_id", "external_lead_id", "lead", "responsible");

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Identificação</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome">{fmtTextOrDash(nome)}</Field>
          <Field label="CPF/CNPJ">{doc ? formatDocument(String(doc)) : "—"}</Field>
          <Field label="Telefone">{formatPhoneBR(tel)}</Field>
          <Field label="E-mail">{fmtTextOrDash(email)}</Field>
          <Field label="Data de Nascimento">{nascimento ? formatDate(nascimento) : "—"}</Field>
          {leadExterno && (
            <Field label="Lead externo">
              <code className="text-xs">{String(leadExterno)}</code>
            </Field>
          )}
        </div>
      </div>

      <div>
        <SectionTitle>Endereço</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="CEP">{cep ? formatCEP(String(cep)) : "—"}</Field>
          <Field label="Logradouro">{fmtTextOrDash(rua)}</Field>
          <Field label="Número">{fmtTextOrDash(numero)}</Field>
          <Field label="Complemento">{fmtTextOrDash(complemento)}</Field>
          <Field label="Bairro">{fmtTextOrDash(bairro)}</Field>
          <Field label="Cidade">{fmtTextOrDash(cidade)}</Field>
          <Field label="Estado (UF)">{estado ? formatUF(String(estado)) : "—"}</Field>
        </div>
      </div>

      {obs && (
        <div>
          <SectionTitle>Observações</SectionTitle>
          <p className="text-sm text-foreground whitespace-pre-wrap">{fmtTextOrDash(obs)}</p>
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
  const p = record.payload ?? {};
  const titulo = pick(p, "name", "nome", "title", "titulo");
  const status = pick(p, "status", "stage_status", "situacao");
  const clienteExt = pick(p, "client_id", "cliente_id", "customer_id", "client");
  const funilExt = pick(p, "funnel_id", "funil_id", "pipeline_id", "funnel");
  const etapaExt = pick(p, "stage_id", "etapa_id", "step_id", "stage");
  const cidade = pick(p, "city", "cidade");
  const uf = pick(p, "state", "estado", "uf");
  const valor = pick(p, "value", "valor", "budget", "orcamento", "amount");
  const criadoEm = pick(p, "created_at", "createdAt", "criado_em");
  const atualizadoEm = pick(p, "updated_at", "updatedAt", "atualizado_em");

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Identificação</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Título">{fmtTextOrDash(titulo)}</Field>
          <Field label="Status">
            {status ? <Badge variant="outline">{String(status)}</Badge> : "—"}
          </Field>
          <Field label="Cliente externo">
            {clienteExt ? <code className="text-xs">{String(clienteExt)}</code> : "—"}
          </Field>
          <Field label="Valor / Orçamento">
            {typeof valor === "number" ? formatBRL(valor) : valor ? formatBRL(Number(valor)) : "—"}
          </Field>
        </div>
      </div>

      <div>
        <SectionTitle>Pipeline</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Funil externo">
            {funilExt ? <code className="text-xs">{String(funilExt)}</code> : "—"}
          </Field>
          <Field label="Etapa externa">
            {etapaExt ? <code className="text-xs">{String(etapaExt)}</code> : "—"}
          </Field>
        </div>
      </div>

      <div>
        <SectionTitle>Localização e datas</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Cidade">{fmtTextOrDash(cidade)}</Field>
          <Field label="UF">{uf ? formatUF(String(uf)) : "—"}</Field>
          <Field label="Criado em">{criadoEm ? formatDateTime(criadoEm) : "—"}</Field>
          <Field label="Atualizado em">{atualizadoEm ? formatDateTime(atualizadoEm) : "—"}</Field>
        </div>
      </div>

      {onNavigate && (
        <div>
          <SectionTitle>Navegação relacional</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {clienteExt && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate("clientes", String(clienteExt))}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Ver cliente externo
              </Button>
            )}
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
  const p = record.payload ?? {};
  const titulo = pick(p, "title", "name", "nome", "titulo", "description", "descricao");
  const status = pick(p, "status", "situacao");
  const projetoExt = pick(p, "project_id", "projeto_id", "deal_id");
  const clienteExt = pick(p, "client_id", "cliente_id", "customer_id");
  const valorTotal = pick(p, "total_value", "valor_total", "total", "amount", "value");
  const desc = pick(p, "description", "descricao", "notes", "observacoes");
  const link = pick(p, "pdf_url", "url", "link", "file_url");

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Identificação</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Título">{fmtTextOrDash(titulo)}</Field>
          <Field label="Status">
            {status ? <Badge variant="outline">{String(status)}</Badge> : "—"}
          </Field>
          <Field label="Projeto externo">
            {projetoExt ? <code className="text-xs">{String(projetoExt)}</code> : "—"}
          </Field>
          <Field label="Cliente externo">
            {clienteExt ? <code className="text-xs">{String(clienteExt)}</code> : "—"}
          </Field>
          <Field label="Valor total">
            {typeof valorTotal === "number"
              ? formatBRL(valorTotal)
              : valorTotal
                ? formatBRL(Number(valorTotal))
                : "—"}
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
            ) : (
              "—"
            )}
          </Field>
        </div>
      </div>

      {desc && (
        <div>
          <SectionTitle>Descrição</SectionTitle>
          <p className="text-sm text-foreground whitespace-pre-wrap">{fmtTextOrDash(desc)}</p>
        </div>
      )}

      {onNavigate && (
        <div>
          <SectionTitle>Navegação relacional</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {projetoExt && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate("projetos", String(projetoExt))}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Ver projeto externo
              </Button>
            )}
            {clienteExt && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate("clientes", String(clienteExt))}
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
  const p = record.payload ?? {};
  const nome = pick(p, "name", "nome", "title");
  const ordem = pick(p, "order", "ordem", "position", "sort");
  const stages = asArray(pick(p, "stages", "etapas", "steps"));

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Identificação</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome">{fmtTextOrDash(nome)}</Field>
          <Field label="Ordem">{ordem != null ? String(ordem) : "—"}</Field>
        </div>
      </div>

      <div>
        <SectionTitle>Etapas detectadas ({stages.length})</SectionTitle>
        {stages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma etapa encontrada no payload.
          </p>
        ) : (
          <div className="space-y-1.5">
            {stages.map((s: any, i: number) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/30"
              >
                <Badge variant="outline" className="text-xs">{i + 1}</Badge>
                <span className="text-sm text-foreground flex-1">
                  {typeof s === "object"
                    ? (s.name ?? s.nome ?? s.title ?? JSON.stringify(s))
                    : String(s)}
                </span>
                {typeof s === "object" && s.id && (
                  <code className="text-[10px] text-muted-foreground">{String(s.id)}</code>
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
  const p = record.payload ?? {};
  const nome = pick(p, "name", "nome", "label", "title");
  const tipo = pick(p, "type", "tipo", "field_type");
  const obrigatorio = pick(p, "required", "obrigatorio", "is_required");
  const opcoes = asArray(pick(p, "options", "opcoes", "values", "choices"));

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Identificação</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome">{fmtTextOrDash(nome)}</Field>
          <Field label="Tipo">
            {tipo ? <Badge variant="outline">{String(tipo)}</Badge> : "—"}
          </Field>
          <Field label="Obrigatório">{fmtBoolean(obrigatorio)}</Field>
          <Field label="Total de opções">{opcoes.length}</Field>
        </div>
      </div>

      {opcoes.length > 0 && (
        <div>
          <SectionTitle>Opções / Enumerações</SectionTitle>
          <ChipList items={opcoes} />
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
