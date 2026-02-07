 import { Dialog, DialogContent } from "@/components/ui/dialog";
 import { Button } from "@/components/ui/button";
 import { Printer, X } from "lucide-react";
 import { format } from "date-fns";
 import { ptBR } from "date-fns/locale";
 import { useRef } from "react";
 
 interface Pagamento {
   id: string;
   valor_pago: number;
   forma_pagamento: string;
   data_pagamento: string;
   observacoes: string | null;
 }
 
 interface ReciboDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   pagamento: Pagamento;
   clienteNome: string;
   descricaoRecebimento: string | null;
   numeroRecibo: number;
 }
 
 const FORMAS_PAGAMENTO: Record<string, string> = {
   pix: "PIX",
   boleto: "Boleto",
   cartao_credito: "Cartão de Crédito",
   cartao_debito: "Cartão de Débito",
   dinheiro: "Dinheiro",
   cheque: "Cheque",
   financiamento: "Financiamento",
 };
 
 const valorPorExtenso = (valor: number): string => {
   const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
   const especiais = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
   const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
   const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
 
   const converterGrupo = (n: number): string => {
     if (n === 0) return "";
     if (n === 100) return "cem";
     
     let resultado = "";
     const c = Math.floor(n / 100);
     const resto = n % 100;
     
     if (c > 0) {
       resultado = centenas[c];
       if (resto > 0) resultado += " e ";
     }
     
     if (resto >= 10 && resto < 20) {
       resultado += especiais[resto - 10];
     } else {
       const d = Math.floor(resto / 10);
       const u = resto % 10;
       if (d > 0) resultado += dezenas[d];
       if (d > 0 && u > 0) resultado += " e ";
       if (u > 0) resultado += unidades[u];
     }
     
     return resultado;
   };
 
   const reais = Math.floor(valor);
   const centavos = Math.round((valor - reais) * 100);
   
   if (reais === 0 && centavos === 0) return "zero reais";
   
   let extenso = "";
   
   if (reais > 0) {
     if (reais >= 1000000) {
       const milhoes = Math.floor(reais / 1000000);
       extenso += converterGrupo(milhoes) + (milhoes === 1 ? " milhão" : " milhões");
       const resto = reais % 1000000;
       if (resto > 0) extenso += " ";
     }
     
     const restoMilhao = reais % 1000000;
     if (restoMilhao >= 1000) {
       const milhares = Math.floor(restoMilhao / 1000);
       if (milhares === 1) {
         extenso += "mil";
       } else {
         extenso += converterGrupo(milhares) + " mil";
       }
       const resto = restoMilhao % 1000;
       if (resto > 0 && resto < 100) extenso += " e ";
       else if (resto > 0) extenso += " ";
     }
     
     const unidadesFinais = reais % 1000;
     if (unidadesFinais > 0) {
       if (reais >= 1000 && unidadesFinais < 100) {
         extenso += converterGrupo(unidadesFinais);
       } else {
         extenso += converterGrupo(unidadesFinais);
       }
     }
     
     extenso += reais === 1 ? " real" : " reais";
   }
   
   if (centavos > 0) {
     if (reais > 0) extenso += " e ";
     extenso += converterGrupo(centavos);
     extenso += centavos === 1 ? " centavo" : " centavos";
   }
   
   return extenso;
 };
 
 export function ReciboDialog({
   open,
   onOpenChange,
   pagamento,
   clienteNome,
   descricaoRecebimento,
   numeroRecibo,
 }: ReciboDialogProps) {
   const reciboRef = useRef<HTMLDivElement>(null);
 
   const formatCurrency = (value: number) => {
     return new Intl.NumberFormat("pt-BR", {
       style: "currency",
       currency: "BRL",
     }).format(value);
   };
 
   const handlePrint = () => {
     const printContent = reciboRef.current;
     if (!printContent) return;
 
     const printWindow = window.open("", "_blank");
     if (!printWindow) return;
 
     printWindow.document.write(`
       <!DOCTYPE html>
       <html>
         <head>
           <title>Recibo #${numeroRecibo.toString().padStart(4, "0")}</title>
           <style>
             @page {
               size: A5;
               margin: 15mm;
             }
             body {
               font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
               padding: 20px;
               max-width: 600px;
               margin: 0 auto;
               color: #333;
             }
             .recibo-header {
               text-align: center;
               border-bottom: 2px solid #333;
               padding-bottom: 15px;
               margin-bottom: 20px;
             }
             .recibo-header h1 {
               margin: 0;
               font-size: 24px;
               text-transform: uppercase;
               letter-spacing: 2px;
             }
             .recibo-header .numero {
               font-size: 14px;
               color: #666;
               margin-top: 5px;
             }
             .valor-destaque {
               background: #f5f5f5;
               padding: 15px;
               text-align: center;
               border-radius: 8px;
               margin: 20px 0;
             }
             .valor-destaque .valor {
               font-size: 28px;
               font-weight: bold;
               color: #2563eb;
             }
             .valor-destaque .extenso {
               font-size: 12px;
               color: #666;
               font-style: italic;
               margin-top: 5px;
             }
             .info-row {
               display: flex;
               justify-content: space-between;
               padding: 8px 0;
               border-bottom: 1px dashed #ddd;
             }
             .info-row .label {
               font-weight: 600;
               color: #555;
             }
             .info-row .value {
               text-align: right;
             }
             .assinatura {
               margin-top: 60px;
               text-align: center;
             }
             .assinatura .linha {
               border-top: 1px solid #333;
               width: 250px;
               margin: 0 auto;
               padding-top: 5px;
               font-size: 12px;
               color: #666;
             }
             .footer {
               text-align: center;
               margin-top: 30px;
               font-size: 10px;
               color: #999;
             }
             @media print {
               body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
             }
           </style>
         </head>
         <body>
           ${printContent.innerHTML}
         </body>
       </html>
     `);
     printWindow.document.close();
     printWindow.focus();
     setTimeout(() => {
       printWindow.print();
       printWindow.close();
     }, 250);
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="max-w-lg">
         <div className="flex justify-between items-center mb-4">
           <h2 className="text-lg font-semibold">Recibo de Pagamento</h2>
           <div className="flex gap-2">
             <Button onClick={handlePrint} className="gap-2">
               <Printer className="h-4 w-4" />
               Imprimir
             </Button>
             <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
               <X className="h-4 w-4" />
             </Button>
           </div>
         </div>
 
         <div 
           ref={reciboRef} 
           className="bg-card border rounded-lg p-6 space-y-4"
         >
           <div className="recibo-header text-center border-b-2 border-foreground pb-4">
             <h1 className="text-2xl font-bold tracking-wider uppercase">RECIBO</h1>
             <p className="numero text-sm text-muted-foreground mt-1">
               Nº {numeroRecibo.toString().padStart(4, "0")}
             </p>
           </div>
 
           <div className="valor-destaque bg-muted/50 p-4 text-center rounded-lg">
             <p className="valor text-3xl font-bold text-primary">
               {formatCurrency(pagamento.valor_pago)}
             </p>
             <p className="extenso text-xs text-muted-foreground italic mt-1">
               ({valorPorExtenso(pagamento.valor_pago)})
             </p>
           </div>
 
           <div className="space-y-2">
             <div className="info-row flex justify-between py-2 border-b border-dashed border-muted-foreground/30">
               <span className="label font-semibold text-muted-foreground">Recebido de:</span>
               <span className="value font-medium">{clienteNome}</span>
             </div>
             
             <div className="info-row flex justify-between py-2 border-b border-dashed border-muted-foreground/30">
               <span className="label font-semibold text-muted-foreground">Referente a:</span>
               <span className="value">{descricaoRecebimento || "Pagamento de serviços"}</span>
             </div>
             
             <div className="info-row flex justify-between py-2 border-b border-dashed border-muted-foreground/30">
               <span className="label font-semibold text-muted-foreground">Forma de Pagamento:</span>
               <span className="value">{FORMAS_PAGAMENTO[pagamento.forma_pagamento] || pagamento.forma_pagamento}</span>
             </div>
             
             <div className="info-row flex justify-between py-2 border-b border-dashed border-muted-foreground/30">
               <span className="label font-semibold text-muted-foreground">Data:</span>
               <span className="value">
                 {format(new Date(pagamento.data_pagamento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
               </span>
             </div>
 
             {pagamento.observacoes && (
               <div className="info-row flex justify-between py-2 border-b border-dashed border-muted-foreground/30">
                 <span className="label font-semibold text-muted-foreground">Observações:</span>
                 <span className="value text-sm">{pagamento.observacoes}</span>
               </div>
             )}
           </div>
 
           <div className="assinatura mt-12 text-center">
             <div className="linha border-t border-foreground w-64 mx-auto pt-2">
               <p className="text-xs text-muted-foreground">Assinatura do Recebedor</p>
             </div>
           </div>
 
           <div className="footer text-center mt-6 text-xs text-muted-foreground">
             <p>Documento gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
           </div>
         </div>
       </DialogContent>
     </Dialog>
   );
 }