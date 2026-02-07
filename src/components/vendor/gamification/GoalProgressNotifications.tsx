 import { useEffect } from "react";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
 import { Bell, CheckCircle, Target, Trophy, X } from "lucide-react";
 import { MetaNotification } from "@/hooks/useAdvancedMetrics";
 import { motion, AnimatePresence } from "framer-motion";
 
 interface GoalProgressNotificationsProps {
   notifications: MetaNotification[];
   onDismiss: (id: string) => void;
 }
 
const THRESHOLD_LABELS: Record<number, { label: string; color: string; icon: typeof Trophy }> = {
  50: { label: "Metade do caminho!", color: "bg-secondary/10 text-secondary border-secondary/30", icon: Target },
  80: { label: "Quase lá!", color: "bg-primary/10 text-primary border-primary/30", icon: Target },
  100: { label: "Meta atingida!", color: "bg-success/10 text-success border-success/30", icon: Trophy },
};
 
 const META_LABELS: Record<string, string> = {
   orcamentos: "Orçamentos",
   conversoes: "Conversões",
   valor: "Valor em Vendas",
 };
 
 export function GoalProgressNotifications({ 
   notifications, 
   onDismiss 
 }: GoalProgressNotificationsProps) {
   if (notifications.length === 0) return null;
 
   return (
     <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
       <CardHeader className="pb-2">
         <CardTitle className="text-base flex items-center gap-2">
           <Bell className="h-4 w-4 text-primary animate-pulse" />
           Notificações de Progresso
           <Badge variant="secondary" className="ml-auto">
             {notifications.length}
           </Badge>
         </CardTitle>
       </CardHeader>
       <CardContent className="space-y-2">
         <AnimatePresence mode="popLayout">
           {notifications.map((notification) => {
             const thresholdInfo = THRESHOLD_LABELS[notification.percentual_atingido] || THRESHOLD_LABELS[50];
             const metaLabel = META_LABELS[notification.tipo_meta] || notification.tipo_meta;
             const Icon = thresholdInfo.icon;
 
             return (
               <motion.div
                 key={notification.id}
                 initial={{ opacity: 0, x: -20 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: 20 }}
                 className={`flex items-center justify-between p-3 rounded-lg border ${thresholdInfo.color}`}
               >
                 <div className="flex items-center gap-3">
                   <Icon className="h-5 w-5" />
                   <div>
                     <p className="font-medium text-sm">
                       {thresholdInfo.label}
                     </p>
                     <p className="text-xs opacity-80">
                       Você atingiu {notification.percentual_atingido}% da meta de {metaLabel}
                     </p>
                   </div>
                 </div>
                 <Button
                   variant="ghost"
                   size="sm"
                   onClick={() => onDismiss(notification.id)}
                   className="h-8 w-8 p-0"
                 >
                   <X className="h-4 w-4" />
                 </Button>
               </motion.div>
             );
           })}
         </AnimatePresence>
       </CardContent>
     </Card>
   );
 }