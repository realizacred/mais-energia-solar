import * as React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface FloatingSelectProps {
  label: string;
  icon?: React.ReactNode;
  error?: string;
  success?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}

const FloatingSelect = React.forwardRef<HTMLButtonElement, FloatingSelectProps>(
  ({ className, label, icon, error, success, value, onValueChange, options, placeholder }, ref) => {
    const hasValue = value !== undefined && value !== "";

    return (
      <div className="relative">
        <div className="relative">
          {icon && (
            <div
              className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2 z-10 transition-colors duration-200",
                hasValue ? "text-primary" : "text-muted-foreground",
                error && "text-destructive",
                success && "text-green-500"
              )}
            >
              {icon}
            </div>
          )}
          <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger
              ref={ref}
              className={cn(
                "h-14 w-full rounded-xl border-2 bg-background px-4 pt-5 pb-2 text-base transition-all duration-200",
                "focus:ring-0 focus:ring-offset-0",
                icon && "pl-11",
                !error && !success && "border-muted-foreground/25 focus:border-primary",
                error && "border-destructive bg-destructive/5",
                success && "border-green-500 bg-green-500/5",
                className
              )}
            >
              <SelectValue placeholder="" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <motion.label
            className={cn(
              "absolute left-4 pointer-events-none transition-all duration-200 origin-left",
              icon && "left-11",
              hasValue
                ? "top-2 text-xs font-medium text-primary"
                : "top-1/2 -translate-y-1/2 text-base text-muted-foreground",
              error && "text-destructive",
              success && "text-green-500"
            )}
          >
            {label}
          </motion.label>
        </div>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1.5 text-sm text-destructive flex items-center gap-1"
          >
            <span>⚠️</span> {error}
          </motion.p>
        )}
        {success && !error && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute right-10 top-1/2 -translate-y-1/2 text-green-500"
          >
            ✓
          </motion.div>
        )}
      </div>
    );
  }
);
FloatingSelect.displayName = "FloatingSelect";

export { FloatingSelect };
