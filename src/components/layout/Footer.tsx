import { forwardRef } from "react";
import { Phone, Mail, MapPin, Instagram, ArrowUpRight } from "lucide-react";
import logoBranca from "@/assets/logo-branca.png";

const Footer = forwardRef<HTMLElement>(function Footer(props, ref) {
  return (
    <footer ref={ref} className="py-10 bg-secondary text-secondary-foreground relative overflow-hidden">
      {/* Decorative glow */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/3 rounded-full blur-2xl translate-y-1/3 -translate-x-1/4" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <img
              src={logoBranca}
              alt="Mais Energia Solar"
              className="h-10 w-auto mb-4"
            />
            <p className="text-secondary-foreground/50 text-xs leading-relaxed max-w-xs">
              Soluções em energia solar fotovoltaica para residências, comércios, indústrias e propriedades rurais.
            </p>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display font-bold text-sm uppercase tracking-wider mb-4 text-secondary-foreground/80">Contato</h4>
            <div className="space-y-2.5">
              <a
                href="tel:+5532998437675"
                className="flex items-center gap-2 text-secondary-foreground/60 hover:text-secondary-foreground transition-colors text-xs"
              >
                <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                (32) 99843-7675
              </a>
              <a
                href="mailto:contato@maisenergiasolar.com.br"
                className="flex items-center gap-2 text-secondary-foreground/60 hover:text-secondary-foreground transition-colors text-xs"
              >
                <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                contato@maisenergiasolar.com.br
              </a>
              <div className="flex items-center gap-2 text-secondary-foreground/60 text-xs">
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                Cataguases - MG
              </div>
            </div>
          </div>

          {/* Social */}
          <div>
            <h4 className="font-display font-bold text-sm uppercase tracking-wider mb-4 text-secondary-foreground/80">Redes</h4>
            <div className="space-y-2.5">
              <a
                href="https://www.instagram.com/maismaisenergiasolaroficial/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-secondary-foreground/60 hover:text-secondary-foreground transition-colors text-xs group"
              >
                <Instagram className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate">@maismaisenergiasolaroficial</span>
                <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
              </a>
              <a
                href="https://wa.me/5532998437675"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-secondary-foreground/60 hover:text-secondary-foreground transition-colors text-xs group"
              >
                <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                WhatsApp
                <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
              </a>
            </div>
          </div>

          {/* Quick CTA */}
          <div>
            <h4 className="font-display font-bold text-sm uppercase tracking-wider mb-4 text-secondary-foreground/80">Economize</h4>
            <p className="text-secondary-foreground/50 text-xs leading-relaxed mb-3">
              Solicite seu orçamento gratuito e comece a economizar com energia solar.
            </p>
            <a
              href="https://wa.me/5532998437675?text=Ol%C3%A1%2C%20gostaria%20de%20um%20or%C3%A7amento%20de%20energia%20solar"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              Fale conosco
              <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-secondary-foreground/10 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[11px] text-secondary-foreground/35">
            © {new Date().getFullYear()} Mais Energia Solar. Todos os direitos reservados.
          </p>
          <p className="text-[11px] text-secondary-foreground/25">
            Cataguases, Minas Gerais · Brasil
          </p>
        </div>
      </div>
    </footer>
  );
});

export default Footer;
