/**
 * PromocaoSolarmarket — Página dedicada da Fase 2 (Promoção Staging → CRM).
 *
 * Padronizada com o mesmo padrão visual de ImportacaoSolarmarket
 * (header premium + container max-w-[1400px] + ações no topo).
 * Reutiliza PromocaoSolarmarketSection (SSOT) para o conteúdo da fase.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PromocaoSolarmarketSection } from "@/components/admin/solarmarket/PromocaoSolarmarketSection";
import { PromocaoPreflightCard } from "@/components/admin/solarmarket/PromocaoPreflightCard";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useResetMigratedData } from "@/hooks/useResetMigratedData";
import { toast } from "@/hooks/use-toast";
import { Rocket, ArrowLeft, Sparkles, Eraser, Loader2, Cloud } from "lucide-react";

export default function PromocaoSolarmarket() {
  const resetMigrated = useResetMigratedData();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleClearArea = async () => {
    try {
      await resetMigrated.mutateAsync();
      setConfirmOpen(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      toast({ title: "Falha ao limpar área", description: message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 via-background to-background">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8 max-w-[1400px]">
        {/* ============= HEADER DE PRODUTO (mesmo padrão de ImportacaoSolarmarket) ============= */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5"
        >
          <div className="flex items-start gap-4 min-w-0">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/40 to-info/30 blur-lg opacity-70" aria-hidden />
              <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-info flex items-center justify-center shadow-md ring-1 ring-border">
                <Rocket className="w-7 h-7 text-primary-foreground" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  Promoção SolarMarket → CRM
                </h1>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-1.5">
                  <Sparkles className="w-3 h-3" />
                  Fase 2
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                Promove registros já importados em staging para o domínio canônico
                (clientes, projetos, propostas e versões).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/importacao-solarmarket">
                <ArrowLeft className="w-4 h-4" /> Importação (Fase 1)
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/importacao-solarmarket">
                <Cloud className="w-4 h-4" /> Ver staging
              </Link>
            </Button>

            {/* Botão de limpeza — área DEV */}
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={resetMigrated.isPending}
                  className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive"
                  title="DEV: limpa todos os registros canônicos criados pela promoção (clientes, projetos, propostas, versões, deals, recebimentos). Não toca no staging."
                >
                  {resetMigrated.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Eraser className="w-4 h-4" />
                  )}
                  Limpar área de promoção
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="w-[90vw] max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle>Limpar área de promoção (DEV)</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso apagará <strong>todos os registros canônicos</strong> criados pela
                    promoção: clientes, projetos, propostas nativas, versões, deals e recebimentos
                    com origem <code>solar_market</code>.
                    <br /><br />
                    <strong>Não afeta</strong> os dados de staging (<code>sm_*_raw</code>) —
                    você poderá repromover quando quiser.
                    <br /><br />
                    Use apenas em ambiente de desenvolvimento.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearArea}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Limpar tudo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </motion.div>

        <PromocaoSolarmarketSection />
      </div>
    </div>
  );
}
