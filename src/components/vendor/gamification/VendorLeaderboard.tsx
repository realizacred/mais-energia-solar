 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import { Trophy, Medal, Award, TrendingUp } from "lucide-react";
 import { VendedorPerformance } from "@/hooks/useGamification";
 
 interface VendorLeaderboardProps {
   ranking: VendedorPerformance[];
   currentVendedorId: string | null;
   myRankPosition: number | null;
 }
 
 export function VendorLeaderboard({
   ranking,
   currentVendedorId,
   myRankPosition,
 }: VendorLeaderboardProps) {
   const getRankIcon = (position: number) => {
     switch (position) {
       case 1:
         return <Trophy className="h-5 w-5 text-yellow-500" />;
       case 2:
         return <Medal className="h-5 w-5 text-gray-400" />;
       case 3:
         return <Award className="h-5 w-5 text-amber-600" />;
       default:
         return <span className="text-muted-foreground font-medium">{position}º</span>;
     }
   };
 
   const getRankBadge = (position: number) => {
     switch (position) {
       case 1:
         return "bg-gradient-to-r from-yellow-400 to-yellow-600 text-white";
       case 2:
         return "bg-gradient-to-r from-gray-300 to-gray-500 text-white";
       case 3:
         return "bg-gradient-to-r from-amber-500 to-amber-700 text-white";
       default:
         return "";
     }
   };
 
   const topThree = ranking.slice(0, 3);
   const others = ranking.slice(3, 10);
 
   return (
     <Card>
       <CardHeader className="pb-3">
         <div className="flex items-center justify-between">
           <CardTitle className="text-lg flex items-center gap-2">
             <Trophy className="h-5 w-5 text-yellow-500" />
             Ranking do Mês
           </CardTitle>
           {myRankPosition && (
             <Badge variant="outline" className="gap-1">
               <TrendingUp className="h-3 w-3" />
               Você: {myRankPosition}º lugar
             </Badge>
           )}
         </div>
       </CardHeader>
       <CardContent className="space-y-4">
         {ranking.length === 0 ? (
           <p className="text-center text-muted-foreground py-4">
             Nenhum dado de ranking disponível ainda
           </p>
         ) : (
           <>
             {/* Top 3 Podium */}
             <div className="grid grid-cols-3 gap-2 mb-4">
               {[1, 0, 2].map((idx) => {
                 const vendor = topThree[idx];
                 if (!vendor) return <div key={idx} />;
 
                 const isMe = vendor.vendedor_id === currentVendedorId;
                 const position = idx === 1 ? 1 : idx === 0 ? 2 : 3;
 
                 return (
                   <div
                     key={vendor.vendedor_id}
                     className={`text-center p-3 rounded-lg transition-all ${
                       idx === 1
                         ? "bg-gradient-to-b from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border-2 border-yellow-300 dark:border-yellow-700 -mt-2"
                         : "bg-muted/50"
                     } ${isMe ? "ring-2 ring-primary" : ""}`}
                   >
                     <div className="flex justify-center mb-2">
                       {getRankIcon(position)}
                     </div>
                     <p
                       className={`font-semibold text-sm truncate ${
                         isMe ? "text-primary" : ""
                       }`}
                     >
                       {vendor.vendedor_nome}
                     </p>
                     <p className="text-xs text-muted-foreground">
                       {vendor.pontuacao_total} pts
                     </p>
                     <div className="mt-1 flex justify-center gap-1">
                       <Badge variant="secondary" className="text-xs">
                         {vendor.total_orcamentos} orç
                       </Badge>
                       <Badge variant="secondary" className="text-xs">
                         {vendor.total_conversoes} conv
                       </Badge>
                     </div>
                   </div>
                 );
               })}
             </div>
 
             {/* Rest of ranking */}
             {others.length > 0 && (
               <div className="space-y-2">
                 {others.map((vendor) => {
                   const isMe = vendor.vendedor_id === currentVendedorId;
                   return (
                     <div
                       key={vendor.vendedor_id}
                       className={`flex items-center justify-between p-2 rounded-lg ${
                         isMe ? "bg-primary/10 ring-1 ring-primary" : "bg-muted/30"
                       }`}
                     >
                       <div className="flex items-center gap-3">
                         <span className="w-6 text-center text-sm text-muted-foreground">
                           {vendor.posicao_ranking}º
                         </span>
                         <span
                           className={`text-sm ${
                             isMe ? "font-semibold text-primary" : ""
                           }`}
                         >
                           {vendor.vendedor_nome}
                         </span>
                       </div>
                       <div className="flex items-center gap-2">
                         <Badge variant="outline" className="text-xs">
                           {vendor.pontuacao_total} pts
                         </Badge>
                       </div>
                     </div>
                   );
                 })}
               </div>
             )}
           </>
         )}
       </CardContent>
     </Card>
   );
 }