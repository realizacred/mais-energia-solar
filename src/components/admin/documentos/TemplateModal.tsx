import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Upload, ChevronDown, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { VariablesPanel } from "./VariablesPanel";
import { TemplateFormBuilder } from "./TemplateFormBuilder";
import type { DocumentTemplate, DocumentCategory, FormFieldSchema, DefaultSigner, CATEGORY_LABELS } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  template: DocumentTemplate | null;
  onSave: (data: Partial<DocumentTemplate>) => void;
  saving: boolean;
}

const CATS: { value: DocumentCategory; label: string }[] = [
  { value: "contrato", label: "Contratos" },
  { value: "procuracao", label: "Procurações" },
  { value: "proposta", label: "Propostas" },
  { value: "termo", label: "Termos" },
];

const DEFAULT_SIGNER_ROLES = ["Contratante", "Testemunha 1", "Testemunha 2", "Empresa"];

export function TemplateModal({ open, onOpenChange, template, onSave, saving }: Props) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState<DocumentCategory>("contrato");
  const [subcategoria, setSubcategoria] = useState("");
  const [requiresSig, setRequiresSig] = useState(false);
  const [formFields, setFormFields] = useState<FormFieldSchema[]>([]);
  const [defaultSigners, setDefaultSigners] = useState<DefaultSigner[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [existingPath, setExistingPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    if (template) {
      setNome(template.nome);
      setDescricao(template.descricao || "");
      setCategoria(template.categoria);
      setSubcategoria(template.subcategoria || "");
      setRequiresSig(template.requires_signature_default);
      setFormFields(template.form_schema || []);
      setDefaultSigners(template.default_signers || []);
      setExistingPath(template.docx_storage_path);
      setFile(null);
    } else {
      setNome(""); setDescricao(""); setCategoria("contrato"); setSubcategoria("");
      setRequiresSig(false); setFormFields([]); setDefaultSigners([]);
      setExistingPath(null); setFile(null);
    }
  }, [template, open]);

  useEffect(() => {
    if (requiresSig && defaultSigners.length === 0) {
      setDefaultSigners(DEFAULT_SIGNER_ROLES.map((role, i) => ({ role, required: true, order: i })));
    }
  }, [requiresSig]);

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("Nome obrigatório"); return; }
    if (!existingPath && !file) { toast.error("Upload do arquivo .docx obrigatório"); return; }

    let storagePath = existingPath;

    if (file) {
      setUploading(true);
      try {
        const { data: profile } = await supabase.from("profiles").select("tenant_id").single();
        const tid = profile?.tenant_id;
        if (!tid) throw new Error("Tenant não encontrado");

        await supabase.auth.refreshSession();
        const fileName = `${tid}/templates/${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from("document-files").upload(fileName, file);
        if (error) throw error;
        storagePath = fileName;
        // Prevent duplicate resubmits
        setExistingPath(storagePath);
        setFile(null);
      } catch (e: any) {
        toast.error(`Erro no upload: ${e.message}`);
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    onSave({
      ...(template?.id ? { id: template.id } : {}),
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      categoria,
      subcategoria: subcategoria.trim() || null,
      docx_storage_path: storagePath,
      requires_signature_default: requiresSig,
      default_signers: defaultSigners,
      form_schema: formFields,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{template ? "Editar modelo" : "Novo modelo de documento"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6">
          {/* Left — Form */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do modelo *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Contrato de Prestação de Serviço" className="h-9 text-sm" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Arquivo .docx *</Label>
              {existingPath && !file ? (
                <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/40">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-xs truncate flex-1">{existingPath.split("/").pop()}</span>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setExistingPath(null)}>
                    Alterar arquivo
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="h-9 text-xs"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Descrição</Label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} className="text-sm resize-none" placeholder="Opcional" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Categoria</Label>
                <Select value={categoria} onValueChange={(v) => setCategoria(v as DocumentCategory)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATS.map((c) => <SelectItem key={c.value} value={c.value} className="text-sm">{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Subcategoria</Label>
                <Input value={subcategoria} onChange={(e) => setSubcategoria(e.target.value)} placeholder="Opcional" className="h-9 text-sm" />
              </div>
            </div>

            {/* Formulário fields */}
            <Collapsible open={formOpen} onOpenChange={setFormOpen}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" className="w-full justify-between h-8 text-xs font-semibold">
                  Formulário ({formFields.length} campo{formFields.length !== 1 ? "s" : ""})
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${formOpen ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <TemplateFormBuilder fields={formFields} onChange={setFormFields} />
              </CollapsibleContent>
            </Collapsible>

            {/* Signature config */}
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <Switch checked={requiresSig} onCheckedChange={setRequiresSig} />
              <div>
                <p className="text-sm font-medium">Requer assinatura online</p>
                <p className="text-xs text-muted-foreground">Enviar para assinatura eletrônica por padrão</p>
              </div>
            </div>

            {requiresSig && defaultSigners.length > 0 && (
              <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                <p className="text-xs font-semibold text-muted-foreground">Signatários padrão</p>
                {defaultSigners.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-4 text-muted-foreground">{i + 1}.</span>
                    <Input
                      value={s.role}
                      onChange={(e) => {
                        const next = [...defaultSigners];
                        next[i] = { ...next[i], role: e.target.value };
                        setDefaultSigners(next);
                      }}
                      className="h-7 text-xs flex-1"
                    />
                    <Switch
                      checked={s.required}
                      onCheckedChange={(v) => {
                        const next = [...defaultSigners];
                        next[i] = { ...next[i], required: v };
                        setDefaultSigners(next);
                      }}
                    />
                    <span className="text-muted-foreground">Obrig.</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right — Variables Panel */}
          <div className="border rounded-lg p-3 bg-muted/20">
            <p className="text-xs font-semibold mb-2">Variáveis disponíveis</p>
            <p className="text-[10px] text-muted-foreground mb-3">Clique para copiar e cole no seu .docx</p>
            <VariablesPanel />
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || uploading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || uploading}>
            {saving || uploading ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
