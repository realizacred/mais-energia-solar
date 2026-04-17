/**
 * BlocoExecucao — 3 ações disparáveis.
 * Sem pipeline global / sem etapa global. Cada botão chama o backend correto.
 */
import { useState } from "react";
import { Play, FolderPlus, Target, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui-kit";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Props {
  classifying: boolean;
  creating: boolean;
  applying: boolean;
  onClassify: () => void;
  onCreate: (confirmApply: boolean) => void;
  onApply: (confirmApply: boolean) => void;
}

export function BlocoExecucao({
  classifying,
  creating,
  applying,
  onClassify,
  onCreate,
  onApply,
}: Props) {
  const [applyMode, setApplyMode] = useState(false);
  const busy = classifying || creating || applying;

  return (
    <SectionCard
      icon={Play}
      title="Execução"
      description="Cada etapa é independente e idempotente. Padrão: dry-run. Ative APPLY para gravar no banco."
      variant="neutral"
    >
      <div className="space-y-4">
        {/* Apply switch */}
        <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className={applyMode ? "h-4 w-4 text-warning" : "h-4 w-4 text-muted-foreground"} />
            <Label htmlFor="apply-mode" className="text-sm cursor-pointer">
              {applyMode ? "Modo APPLY (grava no banco)" : "Modo dry-run (simulação)"}
            </Label>
          </div>
          <Switch id="apply-mode" checked={applyMode} onCheckedChange={setApplyMode} disabled={busy} />
        </div>

        {/* Buttons */}
        <div className="grid gap-3 sm:grid-cols-3">
          {/* 1. Classificar — sempre seguro, escreve em sm_project_classification */}
          <ActionButton
            icon={Play}
            label="Rodar classificação"
            sub="classify-sm-projects"
            loading={classifying}
            disabled={busy}
            onClick={onClassify}
          />

          {/* 2. Criar projetos nativos — exige confirmação se APPLY */}
          {applyMode ? (
            <ConfirmAction
              icon={FolderPlus}
              label="Criar projetos nativos"
              sub="create-projetos-from-sm · APPLY"
              variant="warning"
              loading={creating}
              disabled={busy}
              confirmTitle="Criar projetos nativos no banco?"
              confirmDesc="Vai inserir clientes e projetos a partir de todos os SM elegíveis. Idempotente, mas grava de fato."
              onConfirm={() => onCreate(true)}
            />
          ) : (
            <ActionButton
              icon={FolderPlus}
              label="Criar projetos nativos"
              sub="create-projetos-from-sm · dry-run"
              loading={creating}
              disabled={busy}
              onClick={() => onCreate(false)}
            />
          )}

          {/* 3. Aplicar funil/etapa */}
          {applyMode ? (
            <ConfirmAction
              icon={Target}
              label="Aplicar funil/etapa"
              sub="migrate-sm-proposals-v3 · APPLY"
              variant="warning"
              loading={applying}
              disabled={busy}
              confirmTitle="Aplicar funil/etapa em projetos nativos?"
              confirmDesc="Atualiza funil_id/etapa_id em projetos já criados, conforme sm_project_classification."
              onConfirm={() => onApply(true)}
            />
          ) : (
            <ActionButton
              icon={Target}
              label="Aplicar funil/etapa"
              sub="migrate-sm-proposals-v3 · dry-run"
              loading={applying}
              disabled={busy}
              onClick={() => onApply(false)}
            />
          )}
        </div>
      </div>
    </SectionCard>
  );
}

function ActionButton({
  icon: Icon,
  label,
  sub,
  loading,
  disabled,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  sub: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      className="h-auto py-3 px-3 flex flex-col items-start gap-1 text-left"
      disabled={disabled}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className="text-[10px] text-muted-foreground font-mono truncate w-full">{sub}</span>
    </Button>
  );
}

function ConfirmAction({
  icon: Icon,
  label,
  sub,
  loading,
  disabled,
  variant,
  confirmTitle,
  confirmDesc,
  onConfirm,
}: {
  icon: React.ElementType;
  label: string;
  sub: string;
  loading: boolean;
  disabled: boolean;
  variant: "warning";
  confirmTitle: string;
  confirmDesc: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          className="h-auto py-3 px-3 flex flex-col items-start gap-1 text-left border-warning/40"
          disabled={disabled}
        >
          <div className="flex items-center gap-2 w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-warning" /> : <Icon className="h-4 w-4 text-warning" />}
            <span className="text-sm font-medium">{label}</span>
          </div>
          <span className="text-[10px] text-warning font-mono truncate w-full">{sub}</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>{confirmDesc}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Confirmar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
