import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EmailInput } from "@/components/ui/EmailInput";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PhoneInput } from "@/components/ui-kit/inputs/PhoneInput";
import { CurrencyInput } from "@/components/ui-kit/inputs/CurrencyInput";
import { CpfCnpjInput } from "@/components/shared/CpfCnpjInput";
import { AddressFields, type AddressData } from "@/components/shared/AddressFields";
import { Loader2, AlertTriangle, Users, FolderPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useClientes, useSalvarCliente, type ClienteRow } from "@/hooks/useClientes";
import { useClienteProjetoAberto } from "@/hooks/useProjetoCreateForm";

const schema = z.object({
  nomeProjeto: z.string().trim().max(150, "Nome do projeto deve ter no máximo 150 caracteres").optional(),
  descricao: z.string().trim().max(1000, "Descrição deve ter no máximo 1000 caracteres").optional(),
  consultorId: z.string().trim().min(1, "Consultor responsável é obrigatório"),
  etiquetaId: z.string().optional(),
  clienteNome: z.string().trim().min(2, "Nome do cliente é obrigatório").max(150, "Nome do cliente deve ter no máximo 150 caracteres"),
  clienteEmail: z.union([z.literal(""), z.string().trim().email("E-mail inválido").max(255, "E-mail deve ter no máximo 255 caracteres")]),
  clienteEmpresa: z.string().trim().max(150, "Nome da empresa deve ter no máximo 150 caracteres").optional(),
  clienteCpfCnpj: z.string().trim().max(18, "CPF/CNPJ inválido").optional(),
  clienteTelefone: z.string().trim().min(10, "Telefone celular é obrigatório").max(11, "Telefone inválido"),
  valor: z.number().min(0).optional(),
  cep: z.string().trim().max(9, "CEP inválido").optional().or(z.literal("")),
  rua: z.string().trim().max(150, "Logradouro deve ter no máximo 150 caracteres").optional().or(z.literal("")),
  numero: z.string().trim().max(20, "Número deve ter no máximo 20 caracteres").optional().or(z.literal("")),
  complemento: z.string().trim().max(100, "Complemento deve ter no máximo 100 caracteres").optional().or(z.literal("")),
  bairro: z.string().trim().max(100, "Bairro deve ter no máximo 100 caracteres").optional().or(z.literal("")),
  cidade: z.string().trim().max(100, "Cidade deve ter no máximo 100 caracteres").optional().or(z.literal("")),
  estado: z.string().trim().max(2, "UF inválida").optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

export interface NovoProjetoData {
  nome: string;
  consultorId: string;
  valor?: number;
  pipelineId?: string;
  stageId?: string;
  clienteId: string;
  descricao: string;
  etiqueta: string;
  notas: string;
  cliente: {
    nome: string;
    email: string;
    empresa: string;
    cpfCnpj: string;
    telefone: string;
    cep: string;
    estado: string;
    cidade: string;
    endereco: string;
    numero: string;
    bairro: string;
    complemento: string;
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultores: { id: string; nome: string }[];
  onSubmit?: (data: NovoProjetoData) => void | Promise<void>;
  defaultConsultorId?: string;
  dynamicEtiquetas?: { id: string; nome: string; cor: string }[];
  pipelines?: { id: string; name: string }[];
  stages?: { id: string; name: string; pipeline_id: string; position: number; is_closed?: boolean }[];
  defaultPipelineId?: string;
  defaultStageId?: string;
}

export function NovoProjetoModal({
  open,
  onOpenChange,
  consultores,
  onSubmit,
  defaultConsultorId,
  dynamicEtiquetas = [],
  pipelines = [],
  stages = [],
  defaultPipelineId,
  defaultStageId,
}: Props) {
  const { data: clientes = [] } = useClientes();
  const salvarCliente = useSalvarCliente();
  const [selectedCliente, setSelectedCliente] = useState<ClienteRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      nomeProjeto: "",
      descricao: "",
      consultorId: defaultConsultorId || "",
      etiquetaId: "",
      clienteNome: "",
      clienteEmail: "",
      clienteEmpresa: "",
      clienteCpfCnpj: "",
      clienteTelefone: "",
      valor: 0,
      cep: "",
      rua: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      estado: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    setSelectedCliente(null);
    form.reset({
      nomeProjeto: "",
      descricao: "",
      consultorId: defaultConsultorId || "",
      etiquetaId: "",
      clienteNome: "",
      clienteEmail: "",
      clienteEmpresa: "",
      clienteCpfCnpj: "",
      clienteTelefone: "",
      valor: 0,
      cep: "",
      rua: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      estado: "",
    });
  }, [open, defaultConsultorId, form]);

  const clienteNome = form.watch("clienteNome");
  const similares = useMemo(() => {
    const term = clienteNome?.trim().toLowerCase() || "";
    if (term.length < 2) return [];
    return clientes
      .filter((c) => c.nome.toLowerCase().includes(term))
      .slice(0, 8);
  }, [clienteNome, clientes]);

  const projetoExistenteQuery = useClienteProjetoAberto(selectedCliente?.id ?? null);

  const resolvedPipelineId = defaultPipelineId || pipelines[0]?.id || "";
  const resolvedStageId = useMemo(() => {
    if (defaultStageId) return defaultStageId;
    if (!resolvedPipelineId) return "";
    const first = stages
      .filter((s) => s.pipeline_id === resolvedPipelineId && !s.is_closed)
      .sort((a, b) => a.position - b.position)[0];
    return first?.id || "";
  }, [defaultStageId, resolvedPipelineId, stages]);

  const addressValue: AddressData = {
    cep: form.watch("cep") || "",
    rua: form.watch("rua") || "",
    numero: form.watch("numero") || "",
    complemento: form.watch("complemento") || "",
    bairro: form.watch("bairro") || "",
    cidade: form.watch("cidade") || "",
    estado: form.watch("estado") || "",
  };

  const handleAddressChange = (addr: AddressData) => {
    form.setValue("cep", addr.cep, { shouldValidate: true });
    form.setValue("rua", addr.rua, { shouldValidate: true });
    form.setValue("numero", addr.numero, { shouldValidate: true });
    form.setValue("complemento", addr.complemento, { shouldValidate: true });
    form.setValue("bairro", addr.bairro, { shouldValidate: true });
    form.setValue("cidade", addr.cidade, { shouldValidate: true });
    form.setValue("estado", addr.estado, { shouldValidate: true });
  };

  const handleSelectSimilar = (cliente: ClienteRow) => {
    setSelectedCliente(cliente);
    form.reset({
      nomeProjeto: form.getValues("nomeProjeto") || cliente.nome,
      descricao: form.getValues("descricao") || "",
      consultorId: form.getValues("consultorId") || defaultConsultorId || "",
      etiquetaId: form.getValues("etiquetaId") || "",
      clienteNome: cliente.nome || "",
      clienteEmail: cliente.email || "",
      clienteEmpresa: cliente.empresa || "",
      clienteCpfCnpj: cliente.cpf_cnpj || "",
      clienteTelefone: cliente.telefone || "",
      valor: form.getValues("valor") || 0,
      cep: cliente.cep || "",
      rua: cliente.rua || "",
      numero: cliente.numero || "",
      complemento: cliente.complemento || "",
      bairro: cliente.bairro || "",
      cidade: cliente.cidade || "",
      estado: cliente.estado || "",
    });
  };

  const handleConsultorAvatarClick = (consultorId: string) => {
    form.setValue("consultorId", consultorId, { shouldValidate: true, shouldDirty: true });
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    if (projetoExistenteQuery.data) return;

    setSubmitting(true);
    try {
      let clienteId = selectedCliente?.id || "";

      if (!clienteId) {
        const created = await salvarCliente.mutateAsync({
          data: {
            nome: values.clienteNome.trim(),
            telefone: values.clienteTelefone.trim(),
            email: values.clienteEmail?.trim() || null,
            empresa: values.clienteEmpresa?.trim() || null,
            cpf_cnpj: values.clienteCpfCnpj?.trim() || null,
            cep: values.cep.trim(),
            estado: values.estado.trim(),
            cidade: values.cidade.trim(),
            bairro: values.bairro.trim(),
            rua: values.rua.trim(),
            numero: values.numero.trim(),
            complemento: values.complemento?.trim() || null,
            cliente_code: `CLI-${Date.now()}`,
            ativo: true,
          },
        });
        clienteId = created.id;
      }

      await onSubmit?.({
        nome: values.nomeProjeto?.trim() || values.clienteNome.trim(),
        consultorId: values.consultorId,
        valor: values.valor && values.valor > 0 ? values.valor : undefined,
        pipelineId: resolvedPipelineId || undefined,
        stageId: resolvedStageId || undefined,
        clienteId,
        descricao: values.descricao?.trim() || "",
        etiqueta: values.etiquetaId || "",
        notas: "",
        cliente: {
          nome: values.clienteNome.trim(),
          email: values.clienteEmail?.trim() || "",
          empresa: values.clienteEmpresa?.trim() || "",
          cpfCnpj: values.clienteCpfCnpj?.trim() || "",
          telefone: values.clienteTelefone.trim(),
          cep: values.cep.trim(),
          estado: values.estado.trim(),
          cidade: values.cidade.trim(),
          endereco: values.rua.trim(),
          numero: values.numero.trim(),
          bairro: values.bairro.trim(),
          complemento: values.complemento?.trim() || "",
        },
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-[1100px] p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        {/* §25 Header: ícone + título */}
        <DialogHeader className="flex flex-row items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FolderPlus className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">Novo Projeto</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Preencha os dados do projeto e do cliente</p>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-4 py-3.5">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-5 gap-y-4">
                {/* ── Coluna 1: Projeto ── */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-primary">Projeto</h3>
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                      <Users className="w-3 h-3 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">Nome do Projeto</Label>
                    <Input placeholder="Nome do projeto" className="h-8 text-sm" {...form.register("nomeProjeto")} />
                    {form.formState.errors.nomeProjeto && <p className="text-xs text-destructive">{form.formState.errors.nomeProjeto.message}</p>}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">Descrição</Label>
                    <Textarea placeholder="Escreva aqui" className="min-h-[52px] resize-y text-sm" {...form.register("descricao")} />
                    {form.formState.errors.descricao && <p className="text-xs text-destructive">{form.formState.errors.descricao.message}</p>}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">Consultor responsável <span className="text-destructive">*</span></Label>
                    <Controller
                      control={form.control}
                      name="consultorId"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {consultores.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {consultores.length > 0 && (
                      <div className="flex items-center gap-1 pt-0.5 flex-wrap">
                        {consultores.slice(0, 8).map((c) => {
                          const active = form.watch("consultorId") === c.id;
                          return (
                            <Button
                              key={c.id}
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full p-0"
                              onClick={() => handleConsultorAvatarClick(c.id)}
                              aria-label={`Selecionar ${c.nome}`}
                            >
                              <Avatar className={cn("w-6 h-6 border-2 transition-all", active ? "border-primary ring-1 ring-primary" : "border-muted")}>
                                <AvatarFallback className={cn("text-[9px] font-bold", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                                  {c.nome.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            </Button>
                          );
                        })}
                      </div>
                    )}
                    {form.formState.errors.consultorId && <p className="text-xs text-destructive">{form.formState.errors.consultorId.message}</p>}
                  </div>

                  {dynamicEtiquetas.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-muted-foreground">Etiqueta</Label>
                      <Controller
                        control={form.control}
                        name="etiquetaId"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Selecione uma opção" />
                            </SelectTrigger>
                            <SelectContent>
                              {dynamicEtiquetas.map((e) => (
                                <SelectItem key={e.id} value={e.id}>
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: e.cor }} />
                                    {e.nome}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">Valor estimado (opcional)</Label>
                    <Controller
                      control={form.control}
                      name="valor"
                      render={({ field }) => (
                        <CurrencyInput value={field.value || 0} onChange={field.onChange} className="h-8" />
                      )}
                    />
                  </div>
                </div>

                {/* ── Coluna 2: Cliente ── */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-foreground">Cliente</h3>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">Nome do Cliente <span className="text-destructive">*</span></Label>
                    <Input
                      placeholder="Digite o nome do cliente"
                      className={cn("h-8 text-sm", form.formState.errors.clienteNome && "border-destructive")}
                      {...form.register("clienteNome", {
                        onChange: () => {
                          if (selectedCliente) setSelectedCliente(null);
                        },
                      })}
                    />
                    {form.formState.errors.clienteNome && <p className="text-xs text-destructive">{form.formState.errors.clienteNome.message}</p>}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">Email do Cliente</Label>
                    <Controller
                      name="clienteEmail"
                      control={form.control}
                      render={({ field }) => (
                        <EmailInput value={field.value || ""} onChange={field.onChange} placeholder="Digite o email do cliente" className="h-8 text-sm" />
                      )}
                    />
                    {form.formState.errors.clienteEmail && <p className="text-xs text-destructive">{form.formState.errors.clienteEmail.message}</p>}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">Nome da Empresa</Label>
                    <Input placeholder="Digite o nome da empresa" className="h-8 text-sm" {...form.register("clienteEmpresa")} />
                    {form.formState.errors.clienteEmpresa && <p className="text-xs text-destructive">{form.formState.errors.clienteEmpresa.message}</p>}
                  </div>

                  <div className="space-y-1">
                    <Controller
                      control={form.control}
                      name="clienteCpfCnpj"
                      render={({ field }) => (
                        <CpfCnpjInput value={field.value || ""} onChange={field.onChange} label="CNPJ/CPF" showValidation={false} />
                      )}
                    />
                    {form.formState.errors.clienteCpfCnpj && <p className="text-xs text-destructive">{form.formState.errors.clienteCpfCnpj.message}</p>}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">Telefone Celular <span className="text-destructive">*</span></Label>
                    <Controller
                      control={form.control}
                      name="clienteTelefone"
                      render={({ field }) => (
                        <PhoneInput value={field.value || ""} onChange={field.onChange} className={cn(form.formState.errors.clienteTelefone && "border-destructive")} />
                      )}
                    />
                    {form.formState.errors.clienteTelefone && <p className="text-xs text-destructive">{form.formState.errors.clienteTelefone.message}</p>}
                  </div>
                </div>

                {/* ── Coluna 3: Clientes similares ── */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-foreground">Clientes similares</h3>

                  {similares.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-1">Nenhum cliente similar</p>
                  ) : (
                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                      {similares.map((c) => (
                        <Button
                          key={c.id}
                          type="button"
                          variant="ghost"
                          onClick={() => handleSelectSimilar(c)}
                          className={cn(
                            "w-full h-auto justify-start rounded-lg border p-2.5 text-left hover:bg-muted/50",
                            selectedCliente?.id === c.id ? "border-primary bg-primary/5" : "border-border"
                          )}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{c.nome}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{c.telefone}</p>
                            {c.email && <p className="text-[11px] text-muted-foreground truncate">{c.email}</p>}
                          </div>
                        </Button>
                      ))}
                    </div>
                  )}

                  {projetoExistenteQuery.data && (
                    <div className="flex items-start gap-2 rounded-lg border border-warning/50 bg-warning/10 p-2.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-foreground">Projeto {projetoExistenteQuery.data.codigo || projetoExistenteQuery.data.id} já existe</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Não é possível criar outro projeto enquanto houver um em andamento.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Endereço ── */}
              <div className="space-y-2.5 border-t border-border pt-3.5 mt-4">
                <h3 className="text-xs font-bold uppercase tracking-wide text-foreground">Endereço</h3>
                <AddressFields value={addressValue} onChange={handleAddressChange} />
                {(form.formState.errors.cep || form.formState.errors.rua || form.formState.errors.numero || form.formState.errors.bairro || form.formState.errors.cidade || form.formState.errors.estado) && (
                  <div className="space-y-0.5">
                    {form.formState.errors.cep && <p className="text-xs text-destructive">{form.formState.errors.cep.message}</p>}
                    {form.formState.errors.rua && <p className="text-xs text-destructive">{form.formState.errors.rua.message}</p>}
                    {form.formState.errors.numero && <p className="text-xs text-destructive">{form.formState.errors.numero.message}</p>}
                    {form.formState.errors.bairro && <p className="text-xs text-destructive">{form.formState.errors.bairro.message}</p>}
                    {form.formState.errors.cidade && <p className="text-xs text-destructive">{form.formState.errors.cidade.message}</p>}
                    {form.formState.errors.estado && <p className="text-xs text-destructive">{form.formState.errors.estado.message}</p>}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="flex justify-end gap-2 px-4 py-3 border-t border-border bg-muted/30 shrink-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Fechar</Button>
            <Button type="submit" disabled={submitting || !!projetoExistenteQuery.data}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              {submitting ? "Cadastrando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
