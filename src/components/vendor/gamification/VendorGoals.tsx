 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Progress } from "@/components/ui/progress";
 import { Badge } from "@/components/ui/badge";
 import { Target, CheckCircle2, TrendingUp } from "lucide-react";
 import { GoalProgress } from "@/hooks/useGamification";
 
 interface VendorGoalsProps {
   goals: GoalProgress[];
 }
 
 export function VendorGoals({ goals }: VendorGoalsProps) {
   const formatValue = (type: string, value: number) => {
     if (type === "valor") {
       return new Intl.NumberFormat("pt-BR", {
         style: "currency",
         currency: "BRL",
         maximumFractionDigits: 0,
       }).format(value);
     }
     return value.toString();
   };
 
  const allGoalsMet = goals.every((g) => g.percentage >= 100);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5 text-secondary" />
            Metas do Mês
          </CardTitle>
          {allGoalsMet && (
            <Badge className="bg-success text-success-foreground gap-1">
               <CheckCircle2 className="h-3 w-3" />
               Metas Batidas!
             </Badge>
           )}
         </div>
       </CardHeader>
       <CardContent className="space-y-4">
         {goals.length === 0 ? (
           <p className="text-center text-muted-foreground py-4">
             Carregando metas...
           </p>
         ) : (
           goals.map((goal) => (
             <div key={goal.type} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{goal.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {formatValue(goal.type, goal.current)} /{" "}
                      {formatValue(goal.type, goal.target)}
                    </span>
                    {goal.percentage >= 100 && (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                   )}
                 </div>
               </div>
               <div className="relative">
                 <Progress
                   value={goal.percentage}
                   className="h-3"
                 />
                 {goal.percentage < 100 && (
                   <div className="absolute right-0 -top-5 text-xs text-muted-foreground">
                     {Math.round(goal.percentage)}%
                   </div>
                 )}
               </div>
                {goal.percentage >= 75 && goal.percentage < 100 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-success" />
                    Faltam apenas {goal.target - goal.current}{" "}
                    {goal.type === "valor" ? "reais" : goal.type}!
                  </p>
               )}
             </div>
           ))
         )}
       </CardContent>
     </Card>
   );
 }