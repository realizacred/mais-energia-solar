import { useState } from "react";
import { PhoneMissed } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

const QUICK_VARS = [
  { key: "{nome}", label: "Nome do Cliente" },
  { key: "{protocolo}", label: "Protocolo" },
];

export function CallManagementCard() {
  const [rejectCalls, setRejectCalls] = useState(true);
  const [message, setMessage] = useState(
    "Oi! ☀️ Nossos consultores estão em atendimento. Para que eu te responda mais rápido e fique tudo registrado, por favor, mande um áudio ou texto aqui."
  );
  const [notifyVendedor, setNotifyVendedor] = useState(false);
  const [vipOnly, setVipOnly] = useState(false);

  const insertVar = (v: string) => {
    setMessage((prev) => prev + " " + v);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <PhoneMissed className="h-4 w-4 text-destructive" />
          Gestão de Chamadas de Voz/Vídeo
        </CardTitle>
        <CardDescription className="text-xs">
          Configure como o sistema lida com ligações recebidas via WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Switch principal */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Recusar chamadas automaticamente</Label>
            <p className="text-xs text-muted-foreground">
              O sistema irá rejeitar a ligação e enviar uma mensagem explicativa.
            </p>
          </div>
          <Switch checked={rejectCalls} onCheckedChange={setRejectCalls} />
        </div>

        {/* Mensagem de recusa */}
        <div className={rejectCalls ? "" : "opacity-50 pointer-events-none"}>
          <Label className="text-sm font-medium">Mensagem de Resposta Automática</Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ex: Olá! Nosso atendimento é exclusivo por texto ou áudio gravado..."
            className="mt-1.5"
          />
          <div className="mt-2 space-y-1">
            <p className="text-[11px] text-muted-foreground">Variáveis rápidas (clique para inserir):</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_VARS.map((v) => (
                <button key={v.key} type="button" onClick={() => insertVar(v.key)} className="group">
                  <Badge
                    variant="outline"
                    className="cursor-pointer text-xs transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
                  >
                    {v.label}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Checkboxes */}
        <div className="space-y-3 pt-1">
          <div className="flex items-start gap-2">
            <Checkbox id="notify" checked={notifyVendedor} onCheckedChange={(v) => setNotifyVendedor(!!v)} />
            <Label htmlFor="notify" className="text-sm leading-tight cursor-pointer">
              Notificar o vendedor responsável quando houver tentativa de chamada
            </Label>
          </div>
          <div className="flex items-start gap-2">
            <Checkbox id="vip" checked={vipOnly} onCheckedChange={(v) => setVipOnly(!!v)} />
            <Label htmlFor="vip" className="text-sm leading-tight cursor-pointer">
              Aceitar chamadas apenas se o contato for da lista VIP
            </Label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
