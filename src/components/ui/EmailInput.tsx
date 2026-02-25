import { useState, useCallback, forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { validateEmail, EMAIL_PLACEHOLDER, normalizeEmail } from "@/lib/validations";
import { cn } from "@/lib/utils";

interface EmailInputProps extends Omit<React.ComponentProps<"input">, "type" | "onChange"> {
  value: string;
  onChange: (value: string) => void;
  /** Show error even if field hasn't been blurred yet */
  forceError?: boolean;
  /** If true, empty is also an error */
  required?: boolean;
  /** Normalize (lowercase) on blur */
  normalize?: boolean;
}

export const EmailInput = forwardRef<HTMLInputElement, EmailInputProps>(
  ({ value, onChange, forceError, required, normalize = true, className, ...props }, ref) => {
    const [touched, setTouched] = useState(false);

    const error = (() => {
      const trimmed = value.trim();
      if (required && !trimmed) return "E-mail é obrigatório";
      return validateEmail(trimmed);
    })();

    const showError = (touched || forceError) && !!error;

    const handleBlur = useCallback(() => {
      setTouched(true);
      if (normalize && value.trim()) {
        onChange(normalizeEmail(value));
      }
    }, [value, onChange, normalize]);

    return (
      <div className="w-full">
        <Input
          ref={ref}
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={props.placeholder || EMAIL_PLACEHOLDER}
          className={cn(showError && "border-destructive focus-visible:ring-destructive/40", className)}
          aria-invalid={showError || undefined}
          aria-describedby={showError ? `${props.id || "email"}-error` : undefined}
          {...props}
        />
        {showError && (
          <p id={`${props.id || "email"}-error`} role="alert" className="text-[11px] text-destructive mt-1">{error}</p>
        )}
      </div>
    );
  }
);

EmailInput.displayName = "EmailInput";
