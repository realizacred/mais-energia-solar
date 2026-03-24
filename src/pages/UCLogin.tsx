/**
 * UCLogin — Public login page for client portal users.
 * Route: /uc/login
 * Uses client_portal_login RPC for authentication.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";

export default function UCLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("client_portal_login" as any, {
        p_email: email.trim().toLowerCase(),
        p_password: password,
      });

      if (error) throw error;

      const result = data as any;
      if (!result?.success) {
        toast.error(result?.error || "Email ou senha incorretos.");
        return;
      }

      // result contains: { success, token, unit_id, email }
      const token = result.token;
      if (!token) {
        toast.error("Erro ao obter acesso. Contate o administrador.");
        return;
      }

      toast.success("Login realizado com sucesso!");
      navigate(`/uc/${token}`, { replace: true });
    } catch (err: any) {
      console.error("Login error:", err);
      toast.error(err?.message || "Erro ao realizar login. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-3 pb-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Building2 className="w-7 h-7 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Portal do Cliente</CardTitle>
            <CardDescription className="mt-1">
              Acesse sua unidade consumidora para acompanhar faturas, economia e energia.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full w-10 p-0"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full gap-2" disabled={loading || !email.trim() || !password}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Não possui acesso? Solicite ao seu gestor de energia.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
