import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, X } from "lucide-react";
import { format, parseISO, differenceInDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Servico } from "./types";
import { useState } from "react";

interface ServicoAlertsProps {
  servicos: Servico[];
}

export function ServicoAlerts({ servicos }: ServicoAlertsProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Serviços atrasados
  const atrasados = servicos.filter((s) => {
    const dataAgendada = new Date(s.data_agendada);
    dataAgendada.setHours(0, 0, 0, 0);
    return s.status === "agendado" && dataAgendada < hoje;
  });

  // Serviços para hoje
  const servicosHoje = servicos.filter((s) => {
    const dataAgendada = new Date(s.data_agendada);
    dataAgendada.setHours(0, 0, 0, 0);
    return (s.status === "agendado" || s.status === "em_andamento") && 
           dataAgendada.getTime() === hoje.getTime();
  });

  // Serviços para amanhã
  const amanha = addDays(hoje, 1);
  const servicosAmanha = servicos.filter((s) => {
    const dataAgendada = new Date(s.data_agendada);
    dataAgendada.setHours(0, 0, 0, 0);
    return s.status === "agendado" && dataAgendada.getTime() === amanha.getTime();
  });

  // Serviços pendentes de validação
  const pendentesValidacao = servicos.filter(
    (s) => s.status === "concluido" && !s.validado
  );

  if (atrasados.length === 0 && servicosHoje.length === 0 && servicosAmanha.length === 0 && pendentesValidacao.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {atrasados.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Serviços Atrasados</AlertTitle>
          <AlertDescription>
            Você tem <strong>{atrasados.length}</strong> serviço(s) com data passada que ainda não foram concluídos.
          </AlertDescription>
        </Alert>
      )}

      {servicosHoje.length > 0 && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertTitle>Serviços para Hoje</AlertTitle>
          <AlertDescription>
            <strong>{servicosHoje.length}</strong> serviço(s) agendado(s) para hoje.
          </AlertDescription>
        </Alert>
      )}

      {servicosAmanha.length > 0 && (
        <Alert className="border-blue-500/50 bg-blue-500/10">
          <Clock className="h-4 w-4 text-blue-500" />
          <AlertTitle className="text-blue-700 dark:text-blue-400">Serviços para Amanhã</AlertTitle>
          <AlertDescription className="text-blue-600 dark:text-blue-300">
            <strong>{servicosAmanha.length}</strong> serviço(s) agendado(s) para amanhã.
          </AlertDescription>
        </Alert>
      )}

      {pendentesValidacao.length > 0 && (
        <Alert className="border-purple-500/50 bg-purple-500/10">
          <AlertTriangle className="h-4 w-4 text-purple-500" />
          <AlertTitle className="text-purple-700 dark:text-purple-400">Pendentes de Validação</AlertTitle>
          <AlertDescription className="text-purple-600 dark:text-purple-300">
            <strong>{pendentesValidacao.length}</strong> serviço(s) concluído(s) aguardando validação.
          </AlertDescription>
        </Alert>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setDismissed(true)}
        className="text-xs text-muted-foreground"
      >
        <X className="h-3 w-3 mr-1" />
        Ocultar alertas
      </Button>
    </div>
  );
}
