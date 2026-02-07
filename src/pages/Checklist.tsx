import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ChecklistForm } from "@/components/checklist/ChecklistForm";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { 
  ClipboardList, 
  LogOut, 
  Menu,
  X,
  History,
  Plus,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import logoImg from "@/assets/logo.png";

 const PAGE_TITLE = "Registro de Serviço";

interface ChecklistRecord {
  id: string;
  data_instalacao: string;
  endereco: string;
  nome_cliente: string;
  created_at: string;
}

export default function Checklist() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<"form" | "history">("form");
  const [menuOpen, setMenuOpen] = useState(false);
  const [checklists, setChecklists] = useState<ChecklistRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Redireciona para login se não autenticado
  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth?from=checklist", { replace: true });
    }
  }, [user, loading, navigate]);

  const fetchHistory = async () => {
    if (!user) return;
    
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("checklists_instalacao")
        .select("id, data_instalacao, endereco, nome_cliente, created_at")
        .eq("instalador_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setChecklists(data || []);
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (view === "history" && user) {
      fetchHistory();
    }
  }, [view, user]);

  const handleSignOut = async () => {
    await signOut();
    setView("form");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-lg">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <img src={logoImg} alt="Logo" className="h-8" />
               <span className="font-semibold hidden sm:inline">Registro</span>
               <span className="sr-only">{PAGE_TITLE}</span>
            </div>

            {/* Desktop nav - só mostra opções completas se logado */}
            <div className="hidden md:flex items-center gap-2">
              <Button
                variant={view === "form" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView("form")}
                className="gap-1"
              >
                <Plus className="h-4 w-4" />
                Novo
              </Button>
              <Button
                variant={view === "history" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView("history")}
                className="gap-1"
              >
                <History className="h-4 w-4" />
                Histórico
              </Button>
              <div className="w-px h-6 bg-primary-foreground/20 mx-2" />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="gap-1"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </div>

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-primary-foreground/20 py-2">
            <div className="container mx-auto px-4 space-y-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setView("form");
                  setMenuOpen(false);
                }}
                className="w-full justify-start gap-2"
              >
                 <Plus className="h-4 w-4" />
                 Novo Registro
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setView("history");
                  setMenuOpen(false);
                }}
                className="w-full justify-start gap-2"
              >
                <History className="h-4 w-4" />
                Histórico
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="w-full justify-start gap-2 text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6 max-w-2xl">
        {view === "form" ? (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <ClipboardList className="h-6 w-6 text-primary" />
                {PAGE_TITLE}
              </h1>
             <p className="text-muted-foreground text-sm mt-1">
               Preencha os dados do serviço realizado
             </p>
            </div>
            <ChecklistForm onSuccess={() => setView("form")} />
          </>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <History className="h-6 w-6 text-primary" />
                Histórico
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Seus últimos registros de serviço
              </p>
            </div>

            {loadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : checklists.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
             <p>Nenhum registro encontrado</p>
                 <Button
                   variant="link"
                   onClick={() => setView("form")}
                   className="mt-2"
                 >
                   Criar primeiro registro
                 </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {checklists.map((checklist) => (
                  <div
                    key={checklist.id}
                    className="p-4 bg-card rounded-lg border shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium">{checklist.nome_cliente}</h3>
                        <p className="text-sm text-muted-foreground">
                          {checklist.endereco}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(checklist.data_instalacao), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
