import { useState } from "react";
import { CheckCircle2, ThumbsDown, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { CpfCnpjInput } from "@/components/shared/CpfCnpjInput";
import { motion } from "framer-motion";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface LandingCTAProps {
  onAccept: (nome: string, documento: string, observacoes: string) => Promise<void>;
  onReject: (motivo: string) => Promise<void>;
  consultorNome: string | null | undefined;
  consultorTelefone: string | null | undefined;
  empresaNome: string | null | undefined;
}

export function LandingCTA({
  onAccept, onReject,
  consultorNome, consultorTelefone, empresaNome,
}: LandingCTAProps) {
  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [recusaMotivo, setRecusaMotivo] = useState("");

  const handleAccept = async () => {
    if (!nome.trim()) {
      toast({ title: "Informe seu nome para aceitar", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await onAccept(nome, documento, observacoes);
      toast({ title: "Proposta aceita com sucesso!" });
    } catch (e: any) {
      toast({ title: "Erro ao aceitar", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    setSubmitting(true);
    try {
      await onReject(recusaMotivo);
      toast({ title: "Resposta registrada" });
    } catch (e: any) {
      toast({ title: "Erro ao registrar", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
      setShowReject(false);
    }
  };

  const waLink = consultorTelefone
    ? `https://wa.me/55${consultorTelefone.replace(/\D/g, "")}`
    : null;

  return (
    <section id="aceitar" className="py-20 sm:py-28 px-4 bg-[#0a0a0a] relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-lg mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-center mb-10">
            <p className="text-emerald-400 text-sm font-semibold tracking-widest uppercase mb-3">
              Sua Decisão
            </p>
            <h2 className="text-2xl sm:text-4xl font-bold text-white">
              Aceite sua proposta
            </h2>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 sm:p-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="lp-nome" className="text-white/70">Nome completo *</Label>
              <Input
                id="lp-nome"
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Seu nome completo"
                maxLength={100}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-amber-400/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lp-doc" className="text-white/70">CPF / CNPJ</Label>
              <CpfCnpjInput
                id="lp-doc"
                value={documento}
                onChange={setDocumento}
                label=""
                showValidation={false}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/30"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lp-obs" className="text-white/70">Observações (opcional)</Label>
              <Textarea
                id="lp-obs"
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
                placeholder="Alguma observação?"
                className="min-h-[60px] bg-white/10 border-white/20 text-white placeholder:text-white/30"
                maxLength={500}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                className="flex-1 gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold h-12 text-base rounded-xl"
                onClick={handleAccept}
                disabled={submitting || !nome.trim()}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                Aceitar Proposta
              </Button>
              <Button
                variant="outline"
                className="gap-2 border-white/20 text-white/60 hover:text-white hover:bg-white/10 h-12 rounded-xl"
                onClick={() => setShowReject(true)}
                disabled={submitting}
              >
                <ThumbsDown className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-[10px] text-white/30 text-center">
              Ao aceitar, você concorda com os termos desta proposta.
            </p>
          </div>

          {/* WhatsApp contact */}
          {waLink && (
            <div className="text-center mt-6">
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
                Falar com {consultorNome || empresaNome || "consultor"}
              </a>
            </div>
          )}
        </motion.div>
      </div>

      {/* Reject dialog */}
      <AlertDialog open={showReject} onOpenChange={setShowReject}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recusar esta proposta?</AlertDialogTitle>
            <AlertDialogDescription>
              Sua decisão será registrada e a equipe comercial será notificada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="lp-recusa">Motivo (opcional)</Label>
            <Textarea
              id="lp-recusa"
              value={recusaMotivo}
              onChange={e => setRecusaMotivo(e.target.value)}
              placeholder="Preço alto, optei por outro fornecedor, etc."
              className="min-h-[80px]"
              maxLength={500}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleReject}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar Recusa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
