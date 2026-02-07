import React, { useRef, useImperativeHandle, forwardRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface SignaturePadProps {
  label: string;
  onSignatureChange?: (dataUrl: string | null) => void;
}

export interface SignaturePadRef {
  getSignatureDataUrl: () => string | null;
  clear: () => void;
  isEmpty: () => boolean;
}

const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  ({ label, onSignatureChange }, ref) => {
    const signatureRef = useRef<SignatureCanvas>(null);

    useImperativeHandle(ref, () => ({
      getSignatureDataUrl: () => {
        if (signatureRef.current?.isEmpty()) {
          return null;
        }
        return signatureRef.current?.getTrimmedCanvas().toDataURL("image/png") || null;
      },
      clear: () => {
        signatureRef.current?.clear();
        onSignatureChange?.(null);
      },
      isEmpty: () => signatureRef.current?.isEmpty() ?? true,
    }));

    const handleEnd = () => {
      if (signatureRef.current && !signatureRef.current.isEmpty()) {
        const dataUrl = signatureRef.current.getTrimmedCanvas().toDataURL("image/png");
        onSignatureChange?.(dataUrl);
      }
    };

    const handleClear = () => {
      signatureRef.current?.clear();
      onSignatureChange?.(null);
    };

    return (
      <div className="space-y-2">
        <label className="text-sm font-medium">{label}</label>
        <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg bg-white overflow-hidden">
          <SignatureCanvas
            ref={signatureRef}
            canvasProps={{
              className: "w-full h-32 touch-none",
              style: { width: "100%", height: "128px" },
            }}
            backgroundColor="white"
            penColor="black"
            onEnd={handleEnd}
          />
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="gap-1"
          >
            <Trash2 className="h-3 w-3" />
            Limpar
          </Button>
        </div>
      </div>
    );
  }
);

SignaturePad.displayName = "SignaturePad";

export { SignaturePad };
