 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import { Lock, Sparkles } from "lucide-react";
 import { Achievement } from "@/hooks/useGamification";
 
 interface VendorAchievementsProps {
   achievements: Achievement[];
   totalPoints: number;
 }
 
 export function VendorAchievements({
   achievements,
   totalPoints,
 }: VendorAchievementsProps) {
   const unlockedCount = achievements.filter((a) => a.unlocked).length;
 
   return (
     <Card>
       <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Conquistas
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {unlockedCount}/{achievements.length}
              </Badge>
              <Badge className="bg-primary text-primary-foreground">
                {totalPoints} pts
              </Badge>
           </div>
         </div>
       </CardHeader>
       <CardContent>
         <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
           {achievements.map((achievement) => (
             <div
               key={achievement.id}
                className={`relative p-3 rounded-lg border text-center transition-all ${
                  achievement.unlocked
                    ? "bg-gradient-to-b from-primary/10 to-primary/20 border-primary/30"
                    : "bg-muted/30 border-dashed opacity-60"
                }`}
             >
               {!achievement.unlocked && (
                 <div className="absolute top-1 right-1">
                   <Lock className="h-3 w-3 text-muted-foreground" />
                 </div>
               )}
               <div className="text-2xl mb-1">
                 {achievement.unlocked ? achievement.icon : "🔒"}
               </div>
               <p
                 className={`text-xs font-medium ${
                   achievement.unlocked ? "" : "text-muted-foreground"
                 }`}
               >
                 {achievement.name}
               </p>
               <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                 {achievement.description}
               </p>
                {achievement.unlocked && (
                  <Badge
                    variant="secondary"
                    className="mt-1 text-[10px] bg-primary/20"
                  >
                   +{achievement.points} pts
                 </Badge>
               )}
             </div>
           ))}
         </div>
       </CardContent>
     </Card>
   );
 }