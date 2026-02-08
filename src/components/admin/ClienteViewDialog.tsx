import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Upload,
  ExternalLink,
  Loader2,
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
  onRefresh?: () => void;
}

type DocCategory = "identidade" | "comprovante_endereco" | "comprovante_beneficiaria";

const DOC_CATEGORIES: { key: DocCategory; label: string; field: keyof ClienteData; bucket: string }[] = [
  { key: "identidade", label: "Identidade (RG/CNH)", field: "identidade_urls", bucket: "documentos-clientes" },
  { key: "comprovante_endereco", label: "Comprovante de Endereço", field: "comprovante_endereco_urls", bucket: "documentos-clientes" },
  { key: "comprovante_beneficiaria", label: "Comprovante Beneficiária", field: "comprovante_beneficiaria_urls", bucket: "documentos-clientes" },
];

function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

function getSignedUrl(bucket: string, path: string): Promise<string | null> {
  return supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600)
    .then(({ data }) => data?.signedUrl || null);
}

function DocumentThumbnail({ path, bucket, onClick }: { path: string; bucket: string; onClick: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(path);

  useEffect(() => {
    getSignedUrl(bucket, path).then((signedUrl) => {
      setUrl(signedUrl);
      setLoading(false);
    }).catch(() => {
      setError(true);
      setLoading(false);
    });
  }, [path, bucket]);

  if (loading) {
    return (
      <div className="w-20 h-20 rounded-lg border bg-muted flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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

function DocumentSection({
  label,
  paths,
  bucket,
  clienteId,
  field,
  onUpload,
  uploading,
}: {
  label: string;
  paths: string[];
  bucket: string;
  clienteId: string;
  field: string;
  onUpload: (field: string, files: FileList) => void;
  uploading: boolean;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handlePreview = async (path: string) => {
    const url = await getSignedUrl(bucket, path);
    if (url) {
      setPreviewUrl(url);
      setPreviewOpen(true);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground">{label}</h4>
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/*,.pdf"
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onUpload(field, e.target.files);
              }
              e.target.value = "";
            }}
          />
          <Button type="button" variant="outline" size="sm" className="gap-1.5 pointer-events-none" disabled={uploading}>
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            Anexar
          </Button>
        </label>
      </div>

      {paths.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {paths.map((path, idx) => (
            <DocumentThumbnail key={idx} path={path} bucket={bucket} onClick={() => handlePreview(path)} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">Nenhum documento anexado</p>
      )}

      {/* Full-screen preview */}
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

export function ClienteViewDialog({ cliente, open, onOpenChange, onRefresh }: ClienteViewDialogProps) {
  const { toast } = useToast();
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [localCliente, setLocalCliente] = useState<ClienteData | null>(null);

  useEffect(() => {
    if (cliente) setLocalCliente(cliente);
  }, [cliente]);

  const handleUpload = useCallback(async (field: string, files: FileList) => {
    if (!localCliente) return;
    setUploadingField(field);

    try {
      const uploadedPaths: string[] = [];

      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          toast({ title: "Arquivo muito grande", description: `${file.name} excede 10MB`, variant: "destructive" });
          continue;
        }

        const ext = file.name.split(".").pop();
        const fileName = `${localCliente.id}/${field}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

        const { error } = await supabase.storage
          .from("documentos-clientes")
          .upload(fileName, file, { contentType: file.type });

        if (error) {
          console.error("Upload error:", error);
          toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
          continue;
        }

        uploadedPaths.push(fileName);
      }

      if (uploadedPaths.length > 0) {
        const existingUrls = (localCliente as any)[field] || [];
        const newUrls = [...existingUrls, ...uploadedPaths];

        const { error: updateError } = await supabase
          .from("clientes")
          .update({ [field]: newUrls })
          .eq("id", localCliente.id);

        if (updateError) throw updateError;

        setLocalCliente((prev) => prev ? { ...prev, [field]: newUrls } : prev);

        toast({
          title: "Documento(s) anexado(s)!",
          description: `${uploadedPaths.length} arquivo(s) enviado(s) com sucesso.`,
        });

        onRefresh?.();
      }
    } catch (error: any) {
      console.error("Upload failed:", error);
      toast({ title: "Erro", description: error.message || "Falha no upload", variant: "destructive" });
    } finally {
      setUploadingField(null);
    }
  }, [localCliente, toast, onRefresh]);

  if (!localCliente) return null;

  const formatCurrency = (val: number | null) =>
    val ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val) : null;

  const endereco = [localCliente.rua, localCliente.numero, localCliente.complemento, localCliente.bairro]
    .filter(Boolean)
    .join(", ");
  const cidadeEstado = [localCliente.cidade, localCliente.estado].filter(Boolean).join(" - ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-primary" />
              {localCliente.nome}
            </DialogTitle>
            <Badge variant={localCliente.ativo ? "default" : "secondary"} className={localCliente.ativo ? "bg-success" : ""}>
              {localCliente.ativo ? "Ativo" : "Inativo"}
            </Badge>
          </div>
          <DialogDescription className="flex items-center gap-4 pt-1">
            <span className="flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" />
              {localCliente.telefone}
            </span>
            {localCliente.email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {localCliente.email}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 pb-6">
          <div className="space-y-5 pt-4">
            {/* Dados Pessoais */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                Dados Pessoais
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6">
                <InfoRow icon={CreditCard} label="CPF/CNPJ" value={localCliente.cpf_cnpj} />
                <InfoRow
                  icon={Calendar}
                  label="Nascimento"
                  value={localCliente.data_nascimento ? format(new Date(localCliente.data_nascimento + "T12:00:00"), "dd/MM/yyyy") : null}
                />
                <InfoRow
                  icon={Calendar}
                  label="Cliente desde"
                  value={format(new Date(localCliente.created_at), "dd/MM/yyyy", { locale: ptBR })}
                />
              </div>
            </section>

            <Separator />

            {/* Endereço */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Endereço
              </h3>
              <div className="pl-6 space-y-2">
                {endereco && <InfoRow icon={MapPin} label="Endereço" value={endereco} />}
                {cidadeEstado && <InfoRow icon={MapPin} label="Cidade" value={cidadeEstado} />}
                <InfoRow icon={MapPin} label="CEP" value={localCliente.cep} />
                {localCliente.localizacao && (
                  <div className="flex items-center gap-2 text-sm">
                    <Navigation className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a
                      href={localCliente.localizacao}
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
            </section>

            <Separator />

            {/* Projeto Solar */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Sun className="h-4 w-4" />
                Projeto Solar
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6">
                <InfoRow icon={Sun} label="Potência" value={localCliente.potencia_kwp ? `${localCliente.potencia_kwp} kWp` : null} />
                <InfoRow icon={DollarSign} label="Valor" value={formatCurrency(localCliente.valor_projeto)} />
                <InfoRow icon={Sun} label="Placas" value={localCliente.numero_placas?.toString()} />
                <InfoRow icon={Sun} label="Inversor" value={localCliente.modelo_inversor} />
                <InfoRow
                  icon={Calendar}
                  label="Instalação"
                  value={localCliente.data_instalacao ? format(new Date(localCliente.data_instalacao + "T12:00:00"), "dd/MM/yyyy") : null}
                />
              </div>
            </section>

            {/* Observações */}
            {localCliente.observacoes && (
              <>
                <Separator />
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Observações
                  </h3>
                  <p className="text-sm pl-6 whitespace-pre-wrap text-muted-foreground">{localCliente.observacoes}</p>
                </section>
              </>
            )}

            <Separator />

            {/* Documentos */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Image className="h-4 w-4" />
                Documentos
              </h3>
              <div className="pl-6 space-y-4">
                {DOC_CATEGORIES.map((cat) => (
                  <DocumentSection
                    key={cat.key}
                    label={cat.label}
                    paths={(localCliente as any)[cat.field] || []}
                    bucket={cat.bucket}
                    clienteId={localCliente.id}
                    field={cat.field as string}
                    onUpload={handleUpload}
                    uploading={uploadingField === cat.field}
                  />
                ))}
              </div>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
