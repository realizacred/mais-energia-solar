import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, LogOut } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default function PendingApproval() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth", { replace: true });
      return;
    }

    // Poll for approval status every 10 seconds
    if (!user) return;

    const checkApproval = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("status")
        .eq("user_id", user.id)
        .single();

      if (profile?.status === "aprovado") {
        navigate("/auth", { replace: true }); // Re-trigger role check
      }
    };

    checkApproval();
    const interval = setInterval(checkApproval, 10000);
    return () => clearInterval(interval);
  }, [user, loading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  if (loading) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header showCalculadora={false} showAdmin={false} />

      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border/50 shadow-xl">
          <CardContent className="flex flex-col items-center gap-5 py-10">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">
              Aguardando Aprovação
            </h2>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Sua conta foi criada com sucesso! Um administrador precisa aprovar
              seu acesso antes que você possa utilizar o sistema. Você receberá
              acesso assim que for aprovado.
            </p>
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="mt-2 gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
