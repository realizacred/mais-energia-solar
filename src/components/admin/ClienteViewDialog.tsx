import { useState, useEffect } from "react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SectionCard } from "@/components/ui-kit/SectionCard";
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
      <div className="w-20 h-20 rounded-lg border bg-muted flex items-center justify-center">
        <Spinner size="sm" />
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className="w-20 h-20 rounded-lg border bg-muted flex items-center justify-center">
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
      <h4 className="text-sm font-medium text-muted-foreground">{label}</h4>

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
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="text-sm">{label}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-[400px] max-h-[75vh] overflow-auto bg-muted/50 flex items-center justify-center p-4">
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

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <span className="text-muted-foreground">{label}: </span>
        <span className="font-medium">{value}</span>
      </div>
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-primary" />
              {cliente.nome}
            </DialogTitle>
            <Badge variant={cliente.ativo ? "default" : "secondary"} className={cliente.ativo ? "bg-success" : ""}>
              {cliente.ativo ? "Ativo" : "Inativo"}
            </Badge>
          </div>
          <DialogDescription className="flex items-center gap-4 pt-1">
            <span className="flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" />
              {cliente.telefone}
            </span>
            {cliente.email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {cliente.email}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 pb-6">
          <div className="space-y-4 pt-4">
            {/* Card: Dados Pessoais */}
            <SectionCard icon={User} title="Dados do Cliente" variant="blue">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <InfoRow icon={CreditCard} label="CPF/CNPJ" value={cliente.cpf_cnpj} />
                <InfoRow
                  icon={Calendar}
                  label="Nascimento"
                  value={cliente.data_nascimento ? format(new Date(cliente.data_nascimento + "T12:00:00"), "dd/MM/yyyy") : null}
                />
                <InfoRow
                  icon={Calendar}
                  label="Cliente desde"
                  value={format(new Date(cliente.created_at), "dd/MM/yyyy", { locale: ptBR })}
                />
              </div>
            </SectionCard>

            {/* Card: Endereço */}
            <SectionCard icon={MapPin} title="Endereço" variant="green">
              <div className="space-y-2">
                {endereco && <InfoRow icon={MapPin} label="Endereço" value={endereco} />}
                {cidadeEstado && <InfoRow icon={MapPin} label="Cidade" value={cidadeEstado} />}
                <InfoRow icon={MapPin} label="CEP" value={cliente.cep} />
                {cliente.localizacao && (
                  <div className="flex items-center gap-2 text-sm">
                    <Navigation className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a
                      href={cliente.localizacao}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      Ver no Google Maps
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Card: Projeto Solar */}
            <SectionCard icon={Sun} title="Projeto Solar" variant="neutral">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <InfoRow icon={Sun} label="Potência" value={cliente.potencia_kwp ? `${cliente.potencia_kwp} kWp` : null} />
                <InfoRow icon={DollarSign} label="Valor" value={formatCurrency(cliente.valor_projeto)} />
                <InfoRow icon={Sun} label="Placas" value={cliente.numero_placas?.toString()} />
                <InfoRow icon={Sun} label="Inversor" value={cliente.modelo_inversor} />
                <InfoRow
                  icon={Calendar}
                  label="Instalação"
                  value={cliente.data_instalacao ? format(new Date(cliente.data_instalacao + "T12:00:00"), "dd/MM/yyyy") : null}
                />
              </div>
            </SectionCard>

            {/* Card: Observações */}
            {cliente.observacoes && (
              <SectionCard icon={FileText} title="Observações" variant="neutral">
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{cliente.observacoes}</p>
              </SectionCard>
            )}

            {/* Card: Documentos */}
            <SectionCard icon={Image} title="Documentos" variant="blue">
              <div className="space-y-4">
                {DOC_CATEGORIES.map((cat) => (
                  <ReadOnlyDocumentSection
                    key={cat.field}
                    label={cat.label}
                    paths={(cliente as any)[cat.field] || []}
                  />
                ))}
              </div>
            </SectionCard>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
