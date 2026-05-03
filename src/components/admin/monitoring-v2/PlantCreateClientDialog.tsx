/**
 * PlantCreateClientDialog — Create client for a plant.
 *
 * ARCHITECTURE: This dialog creates the client record only.
 * It does NOT write to monitor_plants.client_id (legacy/deprecated).
 * Canonical client resolution for plants uses:
 *   unit_plant_links → units_consumidoras → cliente_id
 * See resolveClienteFromPlant() in clienteResolution.ts.
 *
 * After creating the client, the user should link it via the UC form.
 */
import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmailInput } from "@/components/ui/EmailInput";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PhoneInput } from "@/components/ui-kit/inputs/PhoneInput";
import { CpfCnpjInput } from "@/components/shared/CpfCnpjInput";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plantId: string;
}

export function PlantCreateClientDialog({ open, onOpenChange, plantId }: Props) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");

  const resetForm = () => {
    setNome("");
    setEmail("");
    setTelefone("");
    setCpfCnpj("");
    setDataNascimento("");
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!nome.trim() || !telefone.trim()) {
        throw new Error("Nome e telefone são obrigatórios");
      }

      // 1. Create client
      const { data: newClient, error: insertErr } = await supabase
        .from("clientes")
        .insert({
          nome: nome.trim(),
          telefone: telefone.trim(),
          email: email.trim() || null,
          cpf_cnpj: cpfCnpj.trim() || null,
          data_nascimento: dataNascimento || null,
        } as any)
        .select("id")
        .single();

      if (insertErr) {
        if (insertErr.code === "23505" && insertErr.message?.includes("cpf_cnpj")) {
          throw new Error("Já existe um cliente com este CPF/CNPJ neste tenant.");
        }
        throw insertErr;
      }

      // NOTE: No longer writes to monitor_plants.client_id (legacy).
      // Client should be linked via UC → cliente_id (canonical path).
      return newClient;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitor-plant-detail", plantId] });
      queryClient.invalidateQueries({ queryKey: ["monitor-plants-health"] });
      queryClient.invalidateQueries({ queryKey: ["monitor-dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["clientes-search"] });
      toast.success("Cliente criado. Vincule-o à UC desta usina para completar o vínculo canônico.");
      resetForm();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao criar cliente"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <UserPlus className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Novo Cliente
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cadastre e vincule automaticamente à usina
            </p>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Nome *</Label>
              <Input
                placeholder="Nome completo do cliente"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Telefone *</Label>
              <PhoneInput
                value={telefone}
                onChange={setTelefone}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">E-mail</Label>
              <EmailInput
                value={email}
                onChange={setEmail}
                placeholder="cliente@email.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">CPF / CNPJ</Label>
              <CpfCnpjInput
                value={cpfCnpj}
                onChange={setCpfCnpj}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Data de nascimento</Label>
              <Input
                type="date"
                value={dataNascimento}
                onChange={(e) => setDataNascimento(e.target.value)}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button
            variant="outline"
            onClick={() => { resetForm(); onOpenChange(false); }}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !nome.trim() || !telefone.trim()}
          >
            {mutation.isPending ? "Salvando..." : "Criar e Vincular"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
