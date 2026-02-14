import { ShieldAlert, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TenantSuspendedProps {
  tenantName?: string;
  suspendedAt?: string | null;
  suspendedReason?: string | null;
}

export default function TenantSuspended({ tenantName, suspendedAt, suspendedReason }: TenantSuspendedProps) {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-warning/30">
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="rounded-full bg-warning/10 p-4">
            <ShieldAlert className="w-10 h-10 text-warning" />
          </div>
          <h1 className="text-xl font-bold">Conta Suspensa</h1>
          {tenantName && (
            <p className="text-sm text-muted-foreground font-medium">{tenantName}</p>
          )}
          <p className="text-sm text-muted-foreground">
            O acesso à sua empresa foi temporariamente suspenso pelo administrador da plataforma.
          </p>
          {suspendedReason && (
            <div className="bg-muted rounded-lg p-3 w-full">
              <p className="text-xs text-muted-foreground font-medium mb-1">Motivo:</p>
              <p className="text-sm">{suspendedReason}</p>
            </div>
          )}
          {suspendedAt && (
            <p className="text-xs text-muted-foreground">
              Suspenso em: {format(new Date(suspendedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          )}
          <div className="flex flex-col gap-2 w-full mt-2">
            <Button variant="outline" className="gap-2" onClick={() => window.location.href = "mailto:suporte@maisenergiasolar.com"}>
              <Mail className="w-4 h-4" /> Contatar Suporte
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              Sair da conta
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
