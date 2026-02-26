import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Keyboard, Search } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { useEstoqueSaldos, useCreateMovimento, type EstoqueSaldo } from "@/hooks/useEstoque";
import { FormModalTemplate, FormGrid } from "@/components/ui-kit/FormModalTemplate";
import { Badge } from "@/components/ui/badge";

interface BarcodeScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemNotFound: (sku: string) => void;
}

type ScanResult = {
  code: string;
  item: EstoqueSaldo | null;
};

export function BarcodeScannerDialog({ open, onOpenChange, onItemNotFound }: BarcodeScannerDialogProps) {
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [manualCode, setManualCode] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [quantidade, setQuantidade] = useState("1");
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<string>("barcode-scanner-container");

  const { data: saldos = [] } = useEstoqueSaldos();
  const createMov = useCreateMovimento();

  const findItemByCode = useCallback(
    (code: string): EstoqueSaldo | null => {
      const normalized = code.trim().toLowerCase();
      return saldos.find(
        (s) => s.sku?.toLowerCase() === normalized || s.nome.toLowerCase() === normalized
      ) || null;
    },
    [saldos]
  );

  const handleCodeScanned = useCallback(
    (code: string) => {
      const item = findItemByCode(code);
      setScanResult({ code, item });
      setQuantidade("1");
      // Stop camera after scan
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
        setScanning(false);
      }
    },
    [findItemByCode]
  );

  // Start camera scanner
  useEffect(() => {
    if (!open || mode !== "camera" || scanResult) return;

    let html5Qr: Html5Qrcode | null = null;
    const timerId = setTimeout(() => {
      html5Qr = new Html5Qrcode(containerRef.current);
      scannerRef.current = html5Qr;
      html5Qr
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText) => {
            handleCodeScanned(decodedText);
          },
          () => {} // ignore errors during scanning
        )
        .then(() => setScanning(true))
        .catch(() => {
          setMode("manual");
        });
    }, 300);

    return () => {
      clearTimeout(timerId);
      if (html5Qr?.isScanning) {
        html5Qr.stop().catch(() => {});
      }
      setScanning(false);
    };
  }, [open, mode, scanResult, handleCodeScanned]);

  // Cleanup on close
  useEffect(() => {
    if (!open) {
      setScanResult(null);
      setManualCode("");
      setQuantidade("1");
      setScanning(false);
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    }
  }, [open]);

  const handleManualSearch = () => {
    if (!manualCode.trim()) return;
    handleCodeScanned(manualCode.trim());
  };

  const handleEntrada = () => {
    if (!scanResult?.item || Number(quantidade) <= 0) return;
    createMov.mutate(
      {
        item_id: scanResult.item.item_id,
        tipo: "entrada",
        quantidade: Number(quantidade),
        origem: "purchase",
        observacao: `Entrada via scanner - SKU: ${scanResult.code}`,
      },
      {
        onSuccess: () => {
          setScanResult(null);
          setManualCode("");
          // Re-enable camera for next scan
        },
      }
    );
  };

  const handleCadastrar = () => {
    if (!scanResult) return;
    onItemNotFound(scanResult.code);
    onOpenChange(false);
  };

  const handleScanAgain = () => {
    setScanResult(null);
    setManualCode("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Scanner de Estoque
          </DialogTitle>
        </DialogHeader>

        {!scanResult ? (
          <div className="space-y-4">
            {/* Mode switcher */}
            <div className="flex gap-2">
              <Button
                variant={mode === "camera" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("camera")}
                className="flex-1"
              >
                <Camera className="h-4 w-4 mr-1.5" />
                Câmera
              </Button>
              <Button
                variant={mode === "manual" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("manual")}
                className="flex-1"
              >
                <Keyboard className="h-4 w-4 mr-1.5" />
                Digitar
              </Button>
            </div>

            {mode === "camera" ? (
              <div className="space-y-2">
                <div
                  id={containerRef.current}
                  className="w-full rounded-lg overflow-hidden bg-muted min-h-[200px]"
                />
                {scanning && (
                  <p className="text-xs text-muted-foreground text-center animate-pulse">
                    Aponte a câmera para o código de barras ou QR Code...
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label>Código / SKU</Label>
                  <div className="flex gap-2">
                    <Input
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      placeholder="Digite ou escaneie o código..."
                      onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
                      autoFocus
                    />
                    <Button onClick={handleManualSearch} disabled={!manualCode.trim()}>
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Scan Result */
          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Código lido:</span>
                <Badge variant="outline" className="font-mono text-xs">{scanResult.code}</Badge>
              </div>

              {scanResult.item ? (
                <>
                  <div className="border-t pt-2">
                    <p className="font-semibold text-foreground">{scanResult.item.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      Estoque atual: {scanResult.item.estoque_atual} {scanResult.item.unidade}
                    </p>
                  </div>

                  <div className="border-t pt-3 space-y-3">
                    <div>
                      <Label>Quantidade para entrada</Label>
                      <Input
                        type="number"
                        value={quantidade}
                        onChange={(e) => setQuantidade(e.target.value)}
                        min="0.01"
                        step="1"
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={handleScanAgain}>
                        Escanear outro
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={handleEntrada}
                        disabled={Number(quantidade) <= 0 || createMov.isPending}
                      >
                        {createMov.isPending ? "Salvando..." : "Dar Entrada"}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="border-t pt-2">
                    <p className="text-sm text-destructive font-medium">
                      Item não encontrado no estoque.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Deseja cadastrar um novo item com este código?
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={handleScanAgain}>
                      Escanear outro
                    </Button>
                    <Button className="flex-1" onClick={handleCadastrar}>
                      Cadastrar Item
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
