import { Link, useLocation } from "react-router-dom";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileNav } from "./MobileNav";
import logo from "@/assets/logo.png";

interface HeaderProps {
  showCalculadora?: boolean;
  showAdmin?: boolean;
  children?: React.ReactNode;
}

const WHATSAPP_NUMBER = "5532998437675";

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
    <header className="bg-card/80 backdrop-blur-xl fixed top-0 left-0 right-0 z-50 border-b border-border/20 shadow-xs">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2 transition-all duration-200 hover:opacity-80 group"
        >
          <img
            src={logo}
            alt="Mais Energia Solar"
            className="h-8 sm:h-10 md:h-11 w-auto"
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-0.5">
          {isHomePage && navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={(e) => handleNavClick(e, link.href)}
              className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors link-underline rounded-lg hover:bg-accent/50"
            >
              {link.label}
            </a>
          ))}

          {!isHomePage && (
            <Link
              to="/"
              className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent/50"
            >
              Home
            </Link>
          )}

          {children}

          <Button
            size="sm"
            onClick={scrollToContact}
            className="ml-3 gap-2 font-bold rounded-full bg-primary hover:bg-primary/90 shadow-primary hover:shadow-lg hover:shadow-primary/30 transition-all duration-300 hover:-translate-y-0.5"
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
    </header>
  );
}
