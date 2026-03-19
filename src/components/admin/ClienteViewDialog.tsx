import { useState, useEffect } from "react";
import { ClientLinkedPlants } from "./monitoring-v2/ClientLinkedPlants";
import { Spinner } from "@/components/ui-kit/Spinner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Sun,
  DollarSign,
  Calendar,
  FileText,
  Image,
  ExternalLink,
  Eye,
  CreditCard,
  Navigation,
  MessageSquare,
  Zap,
  Download,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ClienteData {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  cpf_cnpj: string | null;
  data_nascimento: string | null;
  cep: string | null;
  estado: string | null;
  cidade: string | null;
  bairro: string | null;
  rua: string | null;
  numero: string | null;
  complemento: string | null;
  potencia_kwp: number | null;
  valor_projeto: number | null;
  data_instalacao: string | null;
  numero_placas: number | null;
  modelo_inversor: string | null;
  observacoes: string | null;
  lead_id: string | null;
  localizacao: string | null;
  ativo: boolean;
  created_at: string;
  identidade_urls: string[] | null;
  comprovante_endereco_urls: string[] | null;
  comprovante_beneficiaria_urls: string[] | null;
  disjuntor_id: string | null;
  transformador_id: string | null;
}

interface ClienteViewDialogProps {
  cliente: ClienteData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DocCategory = { label: string; field: keyof ClienteData };

const DOC_CATEGORIES: DocCategory[] = [
  { label: "Identidade (RG/CNH)", field: "identidade_urls" },
  { label: "Comprovante de Endereço", field: "comprovante_endereco_urls" },
  { label: "Comprovante Beneficiária", field: "comprovante_beneficiaria_urls" },
];

function getSignedUrl(path: string): Promise<string | null> {
  return supabase.storage
    .from("documentos-clientes")
    .createSignedUrl(path, 3600)
    .then(({ data }) => data?.signedUrl || null);
}

function DocumentThumbnail({ path, onClick }: { path: string; onClick: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(path);

  useEffect(() => {
    getSignedUrl(path)
      .then((signedUrl) => { setUrl(signedUrl); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [path]);

  if (loading) {
    return (
      <div className="w-20 h-20 rounded-lg border border-border bg-muted flex items-center justify-center">
        <Spinner size="sm" />
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className="w-20 h-20 rounded-lg border border-border bg-muted flex items-center justify-center">
        <FileText className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-20 h-20 rounded-lg border-2 border-transparent hover:border-primary overflow-hidden transition-colors group relative"
    >
      {isImage ? (
        <img src={url} alt="Documento" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-muted flex flex-col items-center justify-center gap-1">
          <FileText className="h-6 w-6 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground truncate max-w-full px-1">
            {path.split("/").pop()}
          </span>
        </div>
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
        <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
      </div>
    </button>
  );
}

function ReadOnlyDocumentSection({ label, paths }: { label: string; paths: string[] }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handlePreview = async (path: string) => {
    const url = await getSignedUrl(path);
    if (url) { setPreviewUrl(url); setPreviewOpen(true); }
  };

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground">{label}</h4>

      {paths.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {paths.map((path, idx) => (
            <DocumentThumbnail key={idx} path={path} onClick={() => handlePreview(path)} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">Nenhum documento anexado</p>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
          <DialogHeader className="p-4 border-b border-border shrink-0">
            <DialogTitle className="text-sm">{label}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto bg-muted/50 flex items-center justify-center p-4">
            {previewUrl && /\.(jpg|jpeg|png|gif|webp)/i.test(previewUrl) ? (
              <img src={previewUrl} alt="Documento" className="max-w-full max-h-full object-contain" />
            ) : previewUrl ? (
              <iframe src={previewUrl} title="Documento" className="w-full h-full min-h-[500px]" />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

export function ClienteViewDialog({ cliente, open, onOpenChange }: ClienteViewDialogProps) {
  if (!cliente) return null;

  const formatCurrency = (val: number | null) =>
    val ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val) : null;

  const endereco = [cliente.rua, cliente.numero, cliente.complemento, cliente.bairro]
    .filter(Boolean)
    .join(", ");
  const cidadeEstado = [cliente.cidade, cliente.estado].filter(Boolean).join(" - ");

  const googleMapsQuery = [cliente.rua, cliente.numero, cliente.bairro, cliente.cidade, cliente.estado]
    .filter(Boolean)
    .join(", ");
  const googleMapsUrl = cliente.localizacao || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(googleMapsQuery)}`;

  const totalDocs = (cliente.identidade_urls?.length || 0) +
    (cliente.comprovante_endereco_urls?.length || 0) +
    (cliente.comprovante_beneficiaria_urls?.length || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-[780px] p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">

        {/* HEADER */}
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              {cliente.nome}
            </DialogTitle>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="w-3 h-3" />{cliente.telefone}
              </span>
              {cliente.email && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Mail className="w-3 h-3" />{cliente.email}
                </span>
              )}
              <Badge
                variant="outline"
                className={
                  cliente.ativo
                    ? "bg-success/10 text-success border-success/20 text-xs"
                    : "bg-muted text-muted-foreground border-border text-xs"
                }
              >
                {cliente.ativo ? "Ativo" : "Inativo"}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* BODY 2 COLUNAS */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border flex-1 min-h-0 overflow-y-auto">

          {/* COLUNA ESQUERDA */}
          <div className="p-5 space-y-5">

            {/* Dados do cliente */}
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <User className="w-3 h-3" /> Dados do cliente
              </p>
              <div className="grid grid-cols-2 gap-3">
                <InfoField label="CPF/CNPJ" value={cliente.cpf_cnpj} />
                <InfoField
                  label="Data de nascimento"
                  value={cliente.data_nascimento ? format(new Date(cliente.data_nascimento + "T12:00:00"), "dd/MM/yyyy") : null}
                />
                <InfoField
                  label="Cliente desde"
                  value={format(new Date(cliente.created_at), "dd/MM/yyyy", { locale: ptBR })}
                />
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Endereço */}
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <MapPin className="w-3 h-3" /> Endereço
              </p>
              <div className="space-y-1.5">
                {endereco && <p className="text-sm text-foreground">{endereco}</p>}
                <div className="grid grid-cols-2 gap-3">
                  <InfoField label="Cidade/UF" value={cidadeEstado || null} />
                  <InfoField label="CEP" value={cliente.cep} />
                </div>
                {(endereco || cliente.localizacao) && (
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary flex items-center gap-1 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" /> Ver no Google Maps
                  </a>
                )}
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Projeto Solar */}
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Zap className="w-3 h-3" /> Projeto solar
              </p>
              {cliente.potencia_kwp ? (
                <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/30 gap-1">
                      <Zap className="w-3 h-3" />{cliente.potencia_kwp} kWp
                    </Badge>
                    {cliente.valor_projeto && (
                      <span className="text-xs text-muted-foreground">{formatCurrency(cliente.valor_projeto)}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <InfoField label="Placas" value={cliente.numero_placas?.toString() || null} />
                    <InfoField label="Inversor" value={cliente.modelo_inversor} />
                    <InfoField
                      label="Data instalação"
                      value={cliente.data_instalacao ? format(new Date(cliente.data_instalacao + "T12:00:00"), "dd/MM/yyyy") : null}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Nenhum projeto vinculado</p>
              )}
            </div>
          </div>

          {/* COLUNA DIREITA */}
          <div className="p-5 space-y-5">

            {/* Documentos */}
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <FileText className="w-3 h-3" /> Documentos
                {totalDocs > 0 && (
                  <Badge variant="outline" className="bg-primary/5 text-primary border-primary/30 text-[10px] px-1.5 py-0">
                    {totalDocs}
                  </Badge>
                )}
              </p>
              <div className="space-y-4">
                {DOC_CATEGORIES.map((cat) => (
                  <ReadOnlyDocumentSection
                    key={cat.field}
                    label={cat.label}
                    paths={(cliente as any)[cat.field] || []}
                  />
                ))}
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Observações */}
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3" /> Observações
              </p>
              <div className="p-3 rounded-lg bg-muted/30 border border-border text-sm text-muted-foreground leading-relaxed min-h-[80px]">
                {cliente.observacoes || "Sem observações"}
              </div>
            </div>
          </div>

          {/* Usinas vinculadas */}
          <div className="px-5 pb-4">
            <ClientLinkedPlants clientId={cliente.id} />
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
