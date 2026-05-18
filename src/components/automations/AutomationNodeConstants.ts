import { AutomationFlowNode, TriggerType, ActionType, TRIGGER_LABELS, ACTION_LABELS, AutomationNodeType } from "@/types/automation-flow";
import { 
  MessageCircle, 
  Anchor, 
  FolderKanban, 
  Mail, 
  Target, 
  GitBranch, 
  Search, 
  FileText,
  CheckSquare,
  Bell
} from "lucide-react";

export const nodeIcons: Record<AutomationNodeType, any> = {
  trigger: FileText,
  action: Target,
  condition: GitBranch,
  search: Search,
};

export const actionIcons: Record<ActionType, any> = {
  whatsapp: MessageCircle,
  webhook: Anchor,
  mover_etapa: FolderKanban,
  email: Mail,
  criar_atividade: CheckSquare,
  notificar_responsavel: Bell,
};

export const nodeColors: Record<AutomationNodeType, string> = {
  trigger: "bg-teal-600",
  action: "bg-blue-600",
  condition: "bg-orange-600",
  search: "bg-purple-600",
};

export const nodeTitles: Record<AutomationNodeType, string> = {
  trigger: "Gatilho",
  action: "Ação",
  condition: "Condicional",
  search: "Procurar",
};

export const nodeTitleColors: Record<AutomationNodeType, string> = {
  trigger: "text-teal-600 dark:text-teal-400",
  action: "text-blue-600 dark:text-blue-400",
  condition: "text-orange-600 dark:text-orange-400",
  search: "text-purple-600 dark:text-purple-400",
};
