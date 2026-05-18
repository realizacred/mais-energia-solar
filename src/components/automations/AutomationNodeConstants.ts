import { AutomationFlowNode, TriggerType, ActionType, TRIGGER_LABELS, ACTION_LABELS, AutomationNodeType } from "@/types/automation-flow";
import { 
  MessageCircle, 
  Anchor, 
  Mail, 
  Target, 
  GitBranch, 
  Search, 
  FileText,
  CheckSquare,
  Bell,
  XCircle,
  CheckCircle2,
  UserCog,
  ArrowRightLeft,
  FolderOpen,
  User
} from "lucide-react";

export const nodeIcons: Record<AutomationNodeType, any> = {
  trigger: FileText,
  action: Target,
  condition: GitBranch,
  search: Search,
};

export const actionIcons: Record<string, any> = {
  whatsapp: MessageCircle,
  webhook: Anchor,
  mover_etapa: ArrowRightLeft,
  email: Mail,
  projeto: FolderOpen,
  atividade: CheckSquare,
  cliente: User,
  notificar_responsavel: Bell,
};

export const nodeColors: Record<AutomationNodeType, string> = {
  trigger: "bg-teal-600",
  action: "bg-blue-600",
  condition: "bg-teal-500",
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
  condition: "text-teal-500 dark:text-teal-400",
  search: "text-purple-600 dark:text-purple-400",
};
