import {
  CheckCircle2,
  Copy,
  ExternalLink,
  HelpCircle,
  MessageCircle,
  Server,
  Smartphone,
  Link2,
  Webhook,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StepProps {
  number: number;
  title: string;
  description: string;
  details: React.ReactNode;
  icon: React.ReactNode;
}

function GuideStep({ number, title, description, details, icon }: StepProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
          {number}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {icon}
            <h4 className="font-semibold text-sm text-foreground">{title}</h4>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0 ml-11 text-sm text-muted-foreground space-y-2 border-t border-border/50">
          <div className="pt-3">{details}</div>
        </div>
      )}
    </div>
  );
}

export function WaSetupGuide() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <HelpCircle className="h-4 w-4" />
          Como Configurar
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[90vw] max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <MessageCircle className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Guia de Configuração — WhatsApp via Evolution API
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Siga os passos abaixo para conectar sua instância do WhatsApp ao sistema.
            </p>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-5 overflow-y-auto max-h-[70vh]">

        {/* Prerequisites */}
        <div className="rounded-lg bg-muted/50 border border-border p-4 space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Pré-requisitos
          </h3>
          <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
            <li>
              Ter a{" "}
              <a
                href="https://doc.evolution-api.com/v2/pt/get-started/introduction"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 inline-flex items-center gap-0.5"
              >
                Evolution API v2 <ExternalLink className="h-3 w-3" />
              </a>{" "}
              instalada e acessível (self-hosted ou cloud)
            </li>
            <li>Um número de WhatsApp disponível para conectar</li>
            <li>Acesso administrativo a este painel</li>
          </ul>
        </div>

        {/* Steps */}
        <div className="space-y-3 mt-2">
          <GuideStep
            number={1}
            title="Crie uma instância na Evolution API"
            description="Acesse o painel da Evolution API e crie uma nova instância."
            icon={<Server className="h-4 w-4 text-muted-foreground" />}
            details={
              <div className="space-y-2">
                <p>
                  No painel da Evolution API (normalmente em{" "}
                  <code className="bg-muted px-1 rounded text-xs">https://seu-servidor/manager</code>
                  ), crie uma nova instância. Anote:
                </p>
                <ul className="list-disc ml-4 space-y-1 text-xs">
                  <li>
                    <strong>Instance Name</strong> — o identificador único (ex:{" "}
                    <code className="bg-muted px-1 rounded">whatsapp-vendas</code>)
                  </li>
                  <li>
                    <strong>URL da API</strong> — o endereço base do seu servidor Evolution
                  </li>
                </ul>
                <div className="rounded bg-warning/10 border border-warning/20 p-2 text-xs text-warning">
                  💡 Dica: Use nomes descritivos como <code>vendas-principal</code> ou{" "}
                  <code>suporte-atendimento</code>.
                </div>
              </div>
            }
          />

          <GuideStep
            number={2}
            title="Cadastre a instância neste painel"
            description='Clique em "Nova Instância" e preencha os dados.'
            icon={<Smartphone className="h-4 w-4 text-muted-foreground" />}
            details={
              <div className="space-y-2">
                <p>
                  Clique no botão <Badge variant="outline" className="text-xs">+ Nova Instância</Badge> no
                  topo da página e preencha:
                </p>
                <ul className="list-disc ml-4 space-y-1 text-xs">
                  <li>
                    <strong>Nome da Instância</strong> — nome amigável para identificação interna
                  </li>
                  <li>
                    <strong>Instance Key</strong> — o mesmo nome/identificador que você criou na Evolution
                    API
                  </li>
                  <li>
                    <strong>URL da Evolution API</strong> — ex:{" "}
                    <code className="bg-muted px-1 rounded">https://evolution.suaempresa.com</code>
                  </li>
                  <li>
                    <strong>Consultor</strong> (opcional) — vincule a um consultor para filtrar conversas
                    automaticamente
                  </li>
                </ul>
              </div>
            }
          />

          <GuideStep
            number={3}
            title="Configure o Webhook na Evolution API"
            description="Copie a URL do webhook e cole nas configurações da instância."
            icon={<Webhook className="h-4 w-4 text-muted-foreground" />}
            details={
              <div className="space-y-2">
                <p>
                  Após cadastrar a instância aqui, clique no menu{" "}
                  <Badge variant="outline" className="text-xs">⋮</Badge> do card e selecione{" "}
                  <strong>"Copiar URL Webhook"</strong>.
                </p>
                <p>Na Evolution API, acesse as configurações da instância e em <strong>Webhook</strong>:</p>
                <ul className="list-disc ml-4 space-y-1 text-xs">
                  <li>Cole a URL copiada no campo de webhook</li>
                  <li>
                    Ative os eventos:{" "}
                    <code className="bg-muted px-1 rounded text-[10px]">MESSAGES_UPSERT</code>,{" "}
                    <code className="bg-muted px-1 rounded text-[10px]">CONNECTION_UPDATE</code>,{" "}
                    <code className="bg-muted px-1 rounded text-[10px]">MESSAGES_UPDATE</code>
                  </li>
                  <li>Salve as configurações</li>
                </ul>
                <div className="rounded bg-info/10 border border-info/20 p-2 text-xs text-info">
                  ℹ️ A URL do webhook inclui um <strong>secret</strong> único gerado automaticamente para
                  segurança.
                </div>
              </div>
            }
          />

          <GuideStep
            number={4}
            title="Conecte o WhatsApp (QR Code)"
            description="Escaneie o QR Code na Evolution API para autenticar."
            icon={<Link2 className="h-4 w-4 text-muted-foreground" />}
            details={
              <div className="space-y-2">
                <p>
                  Na Evolution API, vá até a instância e clique em <strong>"Connect"</strong> ou{" "}
                  <strong>"QR Code"</strong>.
                </p>
                <ul className="list-disc ml-4 space-y-1 text-xs">
                  <li>Abra o WhatsApp no celular</li>
                  <li>
                    Vá em <strong>Configurações → Aparelhos conectados → Conectar aparelho</strong>
                  </li>
                  <li>Escaneie o QR Code exibido</li>
                </ul>
                <p className="text-xs">
                  Após escanear, volte aqui e clique em{" "}
                  <Badge variant="outline" className="text-xs">Sincronizar Status</Badge> — o status
                  deve mudar para{" "}
                  <Badge className="bg-success/10 text-success border-success/20 text-xs">Conectado</Badge>
                  .
                </p>
              </div>
            }
          />

          <GuideStep
            number={5}
            title="Pronto! Comece a usar o Inbox"
            description="Acesse o Inbox WhatsApp para ver e responder mensagens."
            icon={<CheckCircle2 className="h-4 w-4 text-muted-foreground" />}
            details={
              <div className="space-y-2">
                <p>
                  Com a instância conectada, as mensagens aparecerão automaticamente no{" "}
                  <strong>Inbox WhatsApp</strong> (menu lateral → Atendimento → Inbox WhatsApp).
                </p>
                <ul className="list-disc ml-4 space-y-1 text-xs">
                  <li>Filtre por instância para ver conversas específicas</li>
                  <li>Vincule conversas a leads existentes</li>
                  <li>Transfira conversas entre atendentes</li>
                  <li>Adicione notas internas e tags</li>
                </ul>
              </div>
            }
          />
        </div>

        {/* Footer */}
        <div className="rounded-lg bg-muted/30 border border-border p-3 mt-2">
          <p className="text-xs text-muted-foreground text-center">
            Precisa de ajuda? Consulte a{" "}
            <a
              href="https://doc.evolution-api.com/v2/pt/get-started/introduction"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 inline-flex items-center gap-0.5"
            >
              documentação da Evolution API <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
