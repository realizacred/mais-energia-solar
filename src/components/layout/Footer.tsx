import { forwardRef } from "react";
import { Phone, Mail, MapPin, Instagram, ArrowUpRight } from "lucide-react";
import logoBranca from "@/assets/logo-branca.png";

const Footer = forwardRef<HTMLElement>(function Footer(props, ref) {
  return (
    <footer ref={ref} className="relative bg-secondary text-secondary-foreground overflow-hidden">
      {/* Top accent line */}
      <div className="h-0.5 bg-gradient-to-r from-primary via-primary/60 to-transparent" />

      <div className="container mx-auto px-4 py-5 relative z-10">
        {/* Single row layout — compact */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo + tagline */}
          <div className="flex items-center gap-3">
            <img
              src={logoBranca}
              alt="Mais Energia Solar"
              className="h-7 w-auto"
            />
            <div className="hidden sm:block w-px h-5 bg-secondary-foreground/15" />
            <p className="hidden sm:block text-secondary-foreground/40 text-xs">
              Energia solar para todos
            </p>
          </div>

          {/* Contact links inline */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <a
              href="tel:+5532998437675"
              className="flex items-center gap-1.5 text-secondary-foreground/50 hover:text-primary transition-colors text-xs group"
            >
              <Phone className="w-3 h-3" />
              <span>(32) 99843-7675</span>
            </a>

            <a
              href="mailto:contato@maisenergiasolar.com.br"
              className="flex items-center gap-1.5 text-secondary-foreground/50 hover:text-primary transition-colors text-xs group"
            >
              <Mail className="w-3 h-3" />
              <span className="hidden sm:inline">contato@maisenergiasolar.com.br</span>
              <span className="sm:hidden">E-mail</span>
            </a>

            <div className="flex items-center gap-1.5 text-secondary-foreground/40 text-xs">
              <MapPin className="w-3 h-3" />
              <span>Cataguases - MG</span>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="https://www.instagram.com/maismaisenergiasolaroficial/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-7 h-7 rounded-full bg-secondary-foreground/8 hover:bg-primary/20 flex items-center justify-center transition-colors group"
                aria-label="Instagram"
              >
                <Instagram className="w-3.5 h-3.5 text-secondary-foreground/40 group-hover:text-primary transition-colors" />
              </a>
              <a
                href="https://wa.me/5532998437675?text=Ol%C3%A1%2C%20gostaria%20de%20um%20or%C3%A7amento%20de%20energia%20solar"
                target="_blank"
                rel="noopener noreferrer"
                className="w-7 h-7 rounded-full bg-secondary-foreground/8 hover:bg-primary/20 flex items-center justify-center transition-colors group"
                aria-label="WhatsApp"
              >
                <Phone className="w-3.5 h-3.5 text-secondary-foreground/40 group-hover:text-primary transition-colors" />
              </a>
            </div>
          </div>
        </div>

        {/* Copyright — ultra slim */}
        <div className="mt-3 pt-3 border-t border-secondary-foreground/6 flex items-center justify-center">
          <p className="text-[11px] text-secondary-foreground/25">
            © {new Date().getFullYear()} Mais Energia Solar · Todos os direitos reservados
          </p>
        </div>
      </div>
    </footer>
  );
});

export default Footer;
