import { Ban, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

interface TenantDisabledProps {
  tenantName?: string;
}

export default function TenantDisabled({ tenantName }: TenantDisabledProps) {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-destructive/30">
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <Ban className="w-10 h-10 text-destructive" />
          </div>
          <h1 className="text-xl font-bold">Conta Desativada</h1>
          {tenantName && (
            <p className="text-sm text-muted-foreground font-medium">{tenantName}</p>
          )}
          <p className="text-sm text-muted-foreground">
            A conta da sua empresa foi desativada. Seus dados estão seguros, mas o acesso ao sistema não está disponível.
          </p>
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
