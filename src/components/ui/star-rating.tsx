 import * as React from "react";
 import { Star } from "lucide-react";
 import { cn } from "@/lib/utils";
 
 interface StarRatingProps {
   value: number;
   onChange?: (value: number) => void;
   max?: number;
   size?: "sm" | "md" | "lg" | "xl";
   readonly?: boolean;
   showLabel?: boolean;
   className?: string;
 }
 
 const SIZE_CLASSES = {
   sm: "h-4 w-4",
   md: "h-6 w-6",
   lg: "h-8 w-8",
   xl: "h-10 w-10",
 };
 
 const RATING_LABELS: Record<number, string> = {
   1: "Muito Ruim",
   2: "Ruim",
   3: "Regular",
   4: "Bom",
   5: "Excelente",
 };
 
 export function StarRating({
   value,
   onChange,
   max = 5,
   size = "md",
   readonly = false,
   showLabel = false,
   className,
 }: StarRatingProps) {
   const [hoverValue, setHoverValue] = React.useState<number | null>(null);
 
   const displayValue = hoverValue ?? value;
 
   const handleClick = (starValue: number) => {
     if (!readonly && onChange) {
       onChange(starValue);
     }
   };
 
   const handleMouseEnter = (starValue: number) => {
     if (!readonly) {
       setHoverValue(starValue);
     }
   };
 
   const handleMouseLeave = () => {
     if (!readonly) {
       setHoverValue(null);
     }
   };
 
   return (
     <div className={cn("flex flex-col items-center gap-2", className)}>
       <div className="flex items-center gap-1">
         {Array.from({ length: max }, (_, i) => {
           const starValue = i + 1;
           const isFilled = starValue <= displayValue;
 
           return (
             <button
               key={starValue}
               type="button"
               onClick={() => handleClick(starValue)}
               onMouseEnter={() => handleMouseEnter(starValue)}
               onMouseLeave={handleMouseLeave}
               disabled={readonly}
               className={cn(
                 "transition-all duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-sm",
                 !readonly && "cursor-pointer hover:scale-110 active:scale-95",
                 readonly && "cursor-default"
               )}
               aria-label={`${starValue} de ${max} estrelas`}
             >
               <Star
                 className={cn(
                   SIZE_CLASSES[size],
                   "transition-colors duration-150",
                   isFilled
                     ? "fill-warning text-warning"
                     : "fill-transparent text-muted-foreground/40"
                 )}
               />
             </button>
           );
         })}
       </div>
       {showLabel && displayValue > 0 && (
         <span className="text-sm font-medium text-muted-foreground animate-fade-in">
           {RATING_LABELS[displayValue] || `${displayValue} estrelas`}
         </span>
       )}
     </div>
   );
 }
 
 // Display variant for showing ratings (readonly)
 interface StarRatingDisplayProps {
   value: number;
   max?: number;
   size?: "sm" | "md" | "lg";
   showCount?: boolean;
   count?: number;
   className?: string;
 }
 
 export function StarRatingDisplay({
   value,
   max = 5,
   size = "sm",
   showCount = false,
   count,
   className,
 }: StarRatingDisplayProps) {
   return (
     <div className={cn("flex items-center gap-2", className)}>
       <div className="flex items-center gap-0.5">
         {Array.from({ length: max }, (_, i) => {
           const starValue = i + 1;
           const isFull = starValue <= Math.floor(value);
           const isPartial = starValue === Math.ceil(value) && value % 1 !== 0;
           const partialWidth = isPartial ? (value % 1) * 100 : 0;
 
           return (
             <div key={starValue} className="relative">
               <Star
                 className={cn(
                   SIZE_CLASSES[size],
                   "fill-transparent text-muted-foreground/30"
                 )}
               />
               {(isFull || isPartial) && (
                 <div
                   className="absolute inset-0 overflow-hidden"
                   style={{ width: isFull ? "100%" : `${partialWidth}%` }}
                 >
                   <Star
                     className={cn(
                       SIZE_CLASSES[size],
                       "fill-warning text-warning"
                     )}
                   />
                 </div>
               )}
             </div>
           );
         })}
       </div>
       {showCount && count !== undefined && (
         <span className="text-sm text-muted-foreground">
           ({count})
         </span>
       )}
       <span className="text-sm font-medium">
         {value.toFixed(1)}
       </span>
     </div>
   );
 }