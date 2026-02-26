import { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { Printer } from "lucide-react";
import type { EstoqueSaldo } from "@/hooks/useEstoque";
import { CATEGORIA_LABELS } from "@/hooks/useEstoque";

interface ItemQRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: EstoqueSaldo | null;
}

export function ItemQRCodeDialog({ open, onOpenChange, item }: ItemQRCodeDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!item) return null;

  const qrValue = item.sku || item.nome;

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank", "width=400,height=300");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etiqueta - ${item.nome}</title>
        <style>
          body { margin: 0; padding: 16px; font-family: Arial, sans-serif; }
          .label { border: 1px dashed #ccc; padding: 12px; width: 280px; text-align: center; }
          .name { font-size: 14px; font-weight: bold; margin-bottom: 4px; }
          .sku { font-size: 11px; color: #666; margin-bottom: 8px; }
          .cat { font-size: 10px; color: #999; margin-top: 4px; }
          svg { margin: 0 auto; }
          @media print { .label { border: 1px solid #000; } }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="name">${item.nome}</div>
          ${item.sku ? `<div class="sku">SKU: ${item.sku}</div>` : ""}
          ${printRef.current.querySelector("svg")?.outerHTML || ""}
          <div class="cat">${CATEGORIA_LABELS[item.categoria] || item.categoria} · ${item.unidade}</div>
        </div>
        <script>window.onload = function() { window.print(); window.close(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>QR Code - Etiqueta</DialogTitle>
        </DialogHeader>

        <div ref={printRef} className="flex flex-col items-center gap-3 py-4">
          <p className="font-semibold text-foreground text-sm text-center">{item.nome}</p>
          {item.sku && (
            <p className="text-xs text-muted-foreground font-mono">SKU: {item.sku}</p>
          )}
          <QRCodeSVG value={qrValue} size={160} level="M" />
          <p className="text-[10px] text-muted-foreground">
            {CATEGORIA_LABELS[item.categoria] || item.categoria} · {item.unidade}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1.5" />
            Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
