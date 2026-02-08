import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, Calculator, LogIn, Phone, Home, LogOut, LayoutDashboard, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { useBrandSettings } from "@/hooks/useBrandSettings";
import logoFallback from "@/assets/logo.png";

interface MobileNavProps {
  showCalculadora?: boolean;
  showAdmin?: boolean;
}

const WHATSAPP_NUMBER = "5532998437675";

const navLinks = [
  { label: "Home", href: "#", icon: Home },
  { label: "Quem Somos", href: "#quem-somos", icon: Sun },
  { label: "Serviços", href: "#servicos", icon: Sun },
  { label: "Obras Realizadas", href: "#obras", icon: Sun },
  { label: "Contato", href: "#contato", icon: Phone },
];

export function MobileNav({ showCalculadora = true, showAdmin = true }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { settings } = useBrandSettings();
  const logo = settings?.logo_url || logoFallback;
  const navigate = useNavigate();

  const handleWhatsApp = () => {
    window.open(`https://wa.me/${WHATSAPP_NUMBER}`, "_blank");
    setOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    setOpen(false);
    navigate("/");
  };

  const handlePortal = () => {
    setOpen(false);
    navigate("/portal");
  };

  const handleNavClick = (href: string) => {
    setOpen(false);
    if (href === "#") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (href.startsWith("#")) {
      const el = document.getElementById(href.replace("#", ""));
      el?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const isHomePage = window.location.pathname === "/";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden relative">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Abrir menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[300px] sm:w-[340px] p-0 !bg-background border-l border-border/30 shadow-2xl">
        <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
        <div className="flex flex-col h-full">
          {/* Header with logo */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
            <Link to="/" onClick={() => setOpen(false)}>
              <img src={logo} alt="Logo" className="h-8" />
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
            {isHomePage && navLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => handleNavClick(link.href)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-accent/60 active:bg-accent transition-all w-full text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                  <link.icon className="h-4 w-4 text-primary" />
                </div>
                <span className="font-medium text-sm text-foreground">{link.label}</span>
              </button>
            ))}

            {!isHomePage && (
              <Link
                to="/"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-accent/60 transition-all"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center">
                  <Home className="h-4 w-4 text-primary" />
                </div>
                <span className="font-medium text-sm">Início</span>
              </Link>
            )}

            {showCalculadora && (
              <Link
                to="/calculadora"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-accent/60 transition-all"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center">
                  <Calculator className="h-4 w-4 text-primary" />
                </div>
                <span className="font-medium text-sm">Simulador</span>
              </Link>
            )}

            <div className="py-2 px-4">
              <div className="h-px bg-border/40" />
            </div>

            <button
              onClick={handleWhatsApp}
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-accent/60 transition-all w-full text-left group"
            >
              <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center group-hover:bg-success/20 transition-colors">
                <Phone className="h-4 w-4 text-success" />
              </div>
              <span className="font-medium text-sm">WhatsApp</span>
            </button>

            {user && (
              <button
                onClick={handlePortal}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-accent/60 transition-all w-full text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
                  <LayoutDashboard className="h-4 w-4 text-secondary" />
                </div>
                <span className="font-medium text-sm">Meu Portal</span>
              </button>
            )}
          </nav>

          {/* Footer */}
          <div className="px-4 py-4 border-t border-border/30 space-y-3">
            {user ? (
              <>
                <p className="text-xs text-muted-foreground truncate px-1">
                  {user.email}
                </p>
                <Button
                  variant="outline"
                  className="w-full gap-2 text-destructive hover:text-destructive hover:bg-destructive/5 rounded-xl"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </Button>
              </>
            ) : (
              showAdmin && (
                <Link to="/auth" onClick={() => setOpen(false)}>
                  <Button className="w-full gap-2 rounded-xl font-bold">
                    <LogIn className="h-4 w-4" />
                    Acessar Sistema
                  </Button>
                </Link>
              )
            )}
            <p className="text-[11px] text-center text-muted-foreground/50">
              © {new Date().getFullYear()} Mais Energia Solar
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
