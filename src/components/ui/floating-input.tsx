import * as React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export interface FloatingInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: React.ReactNode;
  error?: string;
  success?: boolean;
  showSuccessIcon?: boolean;
}

const FloatingInput = React.forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ className, label, icon, error, success, type, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const hasValue = props.value !== undefined && props.value !== "";

    return (
      <div className="relative">
        <div className="relative">
          {icon && (
            <motion.div
              className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2 z-10 transition-colors duration-200",
                isFocused ? "text-primary" : "text-muted-foreground",
                error && "text-destructive",
                success && "text-green-500"
              )}
              animate={{ scale: isFocused ? 1.1 : 1 }}
              transition={{ duration: 0.2 }}
            >
              {icon}
            </motion.div>
          )}
          <input
            type={type}
            autoComplete="off"
            data-lpignore="true"
            data-form-type="other"
            className={cn(
              "flex h-14 w-full rounded-xl border-2 bg-background px-4 pt-5 pb-2 text-base transition-all duration-200",
              "focus:outline-none focus:ring-0",
              icon && "pl-11",
              !error && !success && "border-muted-foreground/25 focus:border-primary",
              error && "border-destructive bg-destructive/5",
              success && "border-green-500 bg-green-500/5",
              className
            )}
            ref={ref}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            {...props}
          />
          <motion.label
            className={cn(
              "absolute left-4 pointer-events-none transition-all duration-200 origin-left",
              icon && "left-11",
              isFocused || hasValue
                ? "top-2 text-xs font-medium"
                : "top-1/2 -translate-y-1/2 text-base",
              isFocused ? "text-primary" : "text-muted-foreground",
              error && "text-destructive",
              success && "text-green-500"
            )}
            animate={{
              y: isFocused || hasValue ? 0 : "-50%",
              scale: isFocused || hasValue ? 0.85 : 1,
            }}
            transition={{ duration: 0.2 }}
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
            className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500"
          >
            ✓
          </motion.div>
        )}
      </div>
    );
  }
);
FloatingInput.displayName = "FloatingInput";

export { FloatingInput };
