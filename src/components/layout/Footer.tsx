import { forwardRef } from "react";
import { Phone, Mail, MapPin, Instagram, ArrowUpRight } from "lucide-react";
import logoBranca from "@/assets/logo-branca.png";

const Footer = forwardRef<HTMLElement>(function Footer(props, ref) {
  return (
    <footer ref={ref} className="py-16 bg-secondary text-secondary-foreground relative overflow-hidden">
      {/* Decorative */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <img
              src={logoBranca}
              alt="Mais Energia Solar"
              className="h-12 w-auto mb-5"
            />
            <p className="text-secondary-foreground/60 text-sm leading-relaxed max-w-md">
              Soluções em energia solar fotovoltaica para residências, comércios, indústrias e propriedades rurais. Desde 2009 gerando economia e impacto positivo.
            </p>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display font-bold text-base mb-5">Contato</h4>
            <div className="space-y-4">
              <a
                href="tel:+5532998437675"
                className="flex items-center gap-2.5 text-secondary-foreground/70 hover:text-secondary-foreground transition-colors text-sm group"
              >
                <Phone className="w-4 h-4 text-primary" />
                (32) 99843-7675
              </a>
              <a
                href="mailto:contato@maisenergiasolar.com.br"
                className="flex items-center gap-2.5 text-secondary-foreground/70 hover:text-secondary-foreground transition-colors text-sm group"
              >
                <Mail className="w-4 h-4 text-primary" />
                contato@maisenergiasolar.com.br
              </a>
              <div className="flex items-center gap-2.5 text-secondary-foreground/70 text-sm">
                <MapPin className="w-4 h-4 text-primary" />
                Cataguases - MG
              </div>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-display font-bold text-base mb-5">Links</h4>
            <div className="space-y-3">
              <a
                href="https://www.instagram.com/maismaisenergiasolaroficial/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 text-secondary-foreground/70 hover:text-secondary-foreground transition-colors text-sm"
              >
                <Instagram className="w-4 h-4 text-primary" />
                @maismaisenergiasolaroficial
                <ArrowUpRight className="w-3 h-3 opacity-50" />
              </a>
              <a
                href="https://wa.me/5532998437675"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 text-secondary-foreground/70 hover:text-secondary-foreground transition-colors text-sm"
              >
                <Phone className="w-4 h-4 text-primary" />
                WhatsApp
                <ArrowUpRight className="w-3 h-3 opacity-50" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-secondary-foreground/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-secondary-foreground/40">
            © {new Date().getFullYear()} Mais Energia Solar. Todos os direitos reservados.
          </p>
          <p className="text-xs text-secondary-foreground/30">
            Cataguases, Minas Gerais - Brasil
          </p>
        </div>
      </div>
    </footer>
  );
});

export default Footer;
