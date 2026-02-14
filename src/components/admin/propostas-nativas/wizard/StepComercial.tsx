import { Briefcase } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type ComercialData, UF_LIST } from "./types";

interface Props {
  comercial: ComercialData;
  onComercialChange: (c: ComercialData) => void;
}

export function StepComercial({ comercial, onComercialChange }: Props) {
  const update = (field: keyof ComercialData, value: string) => {
    onComercialChange({ ...comercial, [field]: value });
  };

  return (
    <div className="space-y-5">
      <h3 className="text-base font-bold flex items-center gap-2">
        <Briefcase className="h-4 w-4 text-primary" /> Dados Comerciais
      </h3>

      {/* Responsável */}
      <div className="rounded-xl border border-border/50 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Responsável</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome</Label>
            <Input value={comercial.responsavel_nome} onChange={e => update("responsavel_nome", e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">E-mail</Label>
            <Input type="email" value={comercial.responsavel_email} onChange={e => update("responsavel_email", e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Celular</Label>
            <Input value={comercial.responsavel_celular} onChange={e => update("responsavel_celular", e.target.value)} className="h-9" />
          </div>
        </div>
      </div>

      {/* Representante */}
      <div className="rounded-xl border border-border/50 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Representante</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome</Label>
            <Input value={comercial.representante_nome} onChange={e => update("representante_nome", e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">E-mail</Label>
            <Input type="email" value={comercial.representante_email} onChange={e => update("representante_email", e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Celular</Label>
            <Input value={comercial.representante_celular} onChange={e => update("representante_celular", e.target.value)} className="h-9" />
          </div>
        </div>
      </div>

      {/* Empresa integradora */}
      <div className="rounded-xl border border-border/50 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Empresa Integradora</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Empresa</Label>
            <Input value={comercial.empresa_nome} onChange={e => update("empresa_nome", e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">CNPJ/CPF</Label>
            <Input value={comercial.empresa_cnpj_cpf} onChange={e => update("empresa_cnpj_cpf", e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Estado</Label>
            <Select value={comercial.empresa_estado} onValueChange={v => update("empresa_estado", v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>
                {UF_LIST.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Cidade</Label>
            <Input value={comercial.empresa_cidade} onChange={e => update("empresa_cidade", e.target.value)} className="h-9" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Projeto ID Externo</Label>
          <Input value={comercial.projeto_id_externo} onChange={e => update("projeto_id_externo", e.target.value)} placeholder="Referência externa (opcional)" className="h-9" />
        </div>
      </div>
    </div>
  );
}
