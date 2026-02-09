import { Link, useLocation } from "react-router-dom";
import { Phone, LogIn, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileNav } from "./MobileNav";
import { TopBannerCarousel } from "./TopBannerCarousel";
import { useAuth } from "@/hooks/useAuth";
import { useLogo } from "@/hooks/useLogo";

interface HeaderProps {
  showCalculadora?: boolean;
  showAdmin?: boolean;
  children?: React.ReactNode;
}

const navLinks = [
  { label: "Home", href: "#" },
  { label: "Quem Somos", href: "#quem-somos" },
  { label: "Serviços", href: "#servicos" },
  { label: "Obras Realizadas", href: "#obras" },
  { label: "Contato", href: "#contato" },
];

export default function Header({
  showCalculadora = true,
  showAdmin = true,
  children,
}: HeaderProps) {
  const { user } = useAuth();
  const logo = useLogo();
  const location = useLocation();
  const isHomePage = location.pathname === "/";

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (isHomePage && href.startsWith("#")) {
      e.preventDefault();
      if (href === "#") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        const el = document.getElementById(href.replace("#", ""));
        el?.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  const scrollToContact = () => {
    if (isHomePage) {
      document.getElementById("contato")?.scrollIntoView({ behavior: "smooth" });
    } else {
      window.location.href = "/#contato";
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Top Banner Carousel — fused with header */}
      {isHomePage && <TopBannerCarousel />}

      {/* Main navigation bar */}
      <div className="bg-card/95 backdrop-blur-xl border-b border-border/30 shadow-sm">
        <div className="container mx-auto px-4 h-14 sm:h-16 flex items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 transition-all duration-200 hover:opacity-80"
          >
            <img
              src={logo}
              alt="Logo"
              className="h-8 sm:h-10 md:h-11 w-auto"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {isHomePage && navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-all duration-200 link-underline rounded-lg hover:bg-accent/50"
              >
                {link.label}
              </a>
            ))}

            {!isHomePage && (
              <Link
                to="/"
                className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-all duration-200 rounded-lg hover:bg-accent/50"
              >
                Home
              </Link>
            )}

            {children}

            {showAdmin && !user && (
              <Link to="/auth">
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-1 gap-2 font-medium text-muted-foreground hover:text-foreground transition-all duration-300"
                >
                  <LogIn className="w-4 h-4" />
                  Acessar
                </Button>
              </Link>
            )}

            {user && (
              <Link to="/portal">
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-1 gap-2 font-medium text-muted-foreground hover:text-foreground transition-all duration-300"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Meu Portal
                </Button>
              </Link>
            )}

            <Button
              size="sm"
              onClick={scrollToContact}
              className="ml-2 gap-2 font-bold rounded-full bg-primary hover:bg-primary/90 shadow-primary hover:shadow-lg hover:shadow-primary/30 transition-all duration-300 hover:-translate-y-0.5"
            >
              <Phone className="w-4 h-4" />
              Orçamento
            </Button>
          </nav>

          {/* Mobile Navigation */}
          <div className="flex items-center gap-2 lg:hidden">
            {children}
            <MobileNav showCalculadora={showCalculadora} showAdmin={showAdmin} />
          </div>
        </div>
      </div>
    </header>
  );
}
