import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import { getPublicUrl } from "@/lib/getPublicUrl";
import { useNavigate } from "react-router-dom";
import { ProposalSnapshotView } from "@/components/admin/propostas-nativas/ProposalSnapshotView";
import { StepDocumento } from "@/components/admin/propostas-nativas/wizard/StepDocumento";
import { ProposalViewsCard } from "@/components/admin/propostas-nativas/ProposalViewsCard";
import {
  Zap, SunMedium, DollarSign, FileText, Eye, Pencil, Copy, Trash2, Download,
  ChevronDown, MoreVertical, ExternalLink, AlertCircle, AlertTriangle, CheckCircle, Loader2,
  Link2, MessageCircle, Mail, CalendarCheck, RefreshCw, Home, Building2, Star, FolderOpen, MessageSquareText, RotateCcw,
  FilePlus, FileCheck, Clock, TrendingUp, PiggyBank, Timer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatNumberBR } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { renderProposal, sendProposal } from "@/services/proposalApi";
import { useLazyTemplateAssign } from "@/hooks/useLazyTemplateAssign";
import { formatDateTime, formatDate, formatTime, formatDateShort } from "@/lib/dateUtils";
import { ProposalMessageDrawer } from "./ProposalMessageDrawer";
import { ProposalMessageHistory } from "./ProposalMessageHistory";
import { ClonePropostaModal } from "./ClonePropostaModal";
import { useExcluirProposta } from "@/hooks/usePropostasProjetoTab";
import { usePropostaExpandedSnapshot, usePropostaExpandedUcs, usePropostaExpandedKitItems, usePropostaAuditLogs, usePropostaEvents, type UCDetailData, type ProposalEventEntry } from "@/hooks/usePropostaExpandedData";
import { useReabrirProposta, useIsAdminOrGerente } from "@/hooks/useReabrirProposta";
import { useProposalTemplates } from "@/hooks/useProposalTemplates";
import { PropostaBadge } from "./PropostaBadge";

// ... keep existing code (types and hooks)

export function PropostaExpandedDetail({ proposta: p, isPrincipal, isExpanded, onToggle, dealId, customerId, onRefresh, isOutdated, onSetPrincipal, onArchive }: Props) {
  // ... keep existing state and logic

  return (
    <>
      {/* ... keep existing structure */}

      {/* Accepted Proposal Edit Lock Dialog */}
      <Dialog open={editAceitaDialogOpen} onOpenChange={setEditAceitaDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[480px]">
          <DialogHeader>
            <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mb-4 mx-auto">
              <AlertTriangle className="h-6 w-6 text-warning" />
            </div>
            <DialogTitle className="text-foreground text-center">
              Esta proposta foi aceita pelo cliente
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground text-center leading-relaxed">
              Editar diretamente uma proposta aceita pode criar inconsistências entre o que foi assinado/aprovado e o orçamento no sistema. Recomendamos duplicar a proposta e trabalhar na cópia.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-sm font-medium text-foreground">Motivo da edição *</label>
            <Textarea
              placeholder="Informe o motivo para editar esta proposta aceita..."
              value={editAceitaMotivo}
              onChange={(e) => setEditAceitaMotivo(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setEditAceitaDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="outline" className="w-full sm:w-auto text-muted-foreground border-muted hover:bg-muted" onClick={confirmEditAceita} disabled={!editAceitaMotivo.trim() || cancellingDocs}>
              {cancellingDocs ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Editar mesmo assim
            </Button>
            <Button className="w-full sm:w-auto" onClick={() => { setEditAceitaDialogOpen(false); setCloneModalOpen(true); }}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicar proposta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
