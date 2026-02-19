import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserPlus, X, Users, Eye, Edit, Crown } from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { useToast } from "@/hooks/use-toast";

interface WaParticipantsProps {
  conversationId: string;
  tenantId: string;
  assignedTo: string | null;
}

const ROLE_LABELS: Record<string, { label: string; icon: typeof Crown }> = {
  owner: { label: "Responsável", icon: Crown },
  collaborator: { label: "Colaborador", icon: Edit },
  viewer: { label: "Visualizador", icon: Eye },
};

export function WaParticipants({ conversationId, tenantId, assignedTo }: WaParticipantsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("viewer");

  // Fetch active participants
  const { data: participants, isLoading } = useQuery({
    queryKey: ["wa-participants", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_conversation_participants")
        .select("id, user_id, role, is_active, created_at")
        .eq("conversation_id", conversationId)
        .eq("is_active", true);
      if (error) throw error;

      if (!data?.length) return [];
      const userIds = data.map((p) => p.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .in("user_id", userIds);
      const nameMap = Object.fromEntries((profiles || []).map((p) => [p.user_id, p.nome]));
      return data.map((p) => ({ ...p, nome: nameMap[p.user_id] || "Usuário" }));
    },
  });

  // Fetch available users for adding
  const { data: availableUsers } = useQuery({
    queryKey: ["wa-participants-available", tenantId, conversationId],
    enabled: addDialogOpen,
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .eq("tenant_id", tenantId)
        .eq("ativo", true);
      if (error) throw error;

      const existingIds = new Set((participants || []).map((p) => p.user_id));
      return (profiles || []).filter((p) => !existingIds.has(p.user_id) && p.user_id !== assignedTo);
    },
  });

  // Add participant
  const addMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser || !user) throw new Error("Selecione um usuário");

      const { error } = await supabase.from("wa_conversation_participants").insert({
        tenant_id: tenantId,
        conversation_id: conversationId,
        user_id: selectedUser,
        role: selectedRole as any,
        added_by: user.id,
      });
      if (error) throw error;

      // Audit event
      await supabase.from("wa_participant_events").insert({
        tenant_id: tenantId,
        conversation_id: conversationId,
        user_id: selectedUser,
        event_type: "added",
        role: selectedRole as any,
        performed_by: user.id,
      });
    },
    onSuccess: () => {
      toast({ title: "Participante adicionado" });
      setSelectedUser("");
      setAddDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["wa-participants", conversationId] });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    },
  });

  // Remove participant
  const removeMutation = useMutation({
    mutationFn: async (participantId: string) => {
      const participant = participants?.find((p) => p.id === participantId);
      if (!participant || !user) return;

      await supabase
        .from("wa_conversation_participants")
        .update({ is_active: false, removed_at: new Date().toISOString() })
        .eq("id", participantId);

      await supabase.from("wa_participant_events").insert({
        tenant_id: tenantId,
        conversation_id: conversationId,
        user_id: participant.user_id,
        event_type: "removed",
        performed_by: user.id,
      });
    },
    onSuccess: () => {
      toast({ title: "Participante removido" });
      queryClient.invalidateQueries({ queryKey: ["wa-participants", conversationId] });
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Participantes</span>
          {participants && participants.length > 0 && (
            <Badge variant="secondary" className="text-xs">{participants.length}</Badge>
          )}
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm">
              <UserPlus className="h-4 w-4 mr-1" /> Chamar apoio
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Adicionar participante</DialogTitle>
              <DialogDescription>Selecione quem deve participar desta conversa.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar usuário" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers?.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="collaborator">Colaborador (vê e comenta)</SelectItem>
                  <SelectItem value="viewer">Visualizador (somente leitura)</SelectItem>
                </SelectContent>
              </Select>
              <Button
                className="w-full"
                disabled={!selectedUser || addMutation.isPending}
                onClick={() => addMutation.mutate()}
              >
                {addMutation.isPending ? <Spinner size="sm" className="mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                Adicionar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Spinner size="sm" />
      ) : !participants?.length ? (
        <p className="text-xs text-muted-foreground">Nenhum participante adicional.</p>
      ) : (
        <ScrollArea className="max-h-40">
          <div className="space-y-1">
            {participants.map((p) => {
              const roleConfig = ROLE_LABELS[p.role] || ROLE_LABELS.viewer;
              const RoleIcon = roleConfig.icon;
              return (
                <div key={p.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50 group">
                  <div className="flex items-center gap-2">
                    <RoleIcon className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">{p.nome}</span>
                    <Badge variant="outline" className="text-[10px]">{roleConfig.label}</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={() => removeMutation.mutate(p.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
