import { UserX, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export default function UserDeactivated() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-muted">
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="rounded-full bg-muted p-4">
            <UserX className="w-10 h-10 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold">Acesso Desativado</h1>
          <p className="text-sm text-muted-foreground">
            Seu usuário foi desativado pelo administrador. Entre em contato com o responsável pela sua empresa.
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
