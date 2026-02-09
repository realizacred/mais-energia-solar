import { forwardRef } from "react";
import { Phone, Mail, MapPin, Instagram } from "lucide-react";
import { useBrandSettings } from "@/hooks/useBrandSettings";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import logoBrancaFallback from "@/assets/logo-branca.png";

const Footer = forwardRef<HTMLElement>(function Footer(props, ref) {
  const { settings: brandSettings } = useBrandSettings();
  const { get } = useSiteSettings();

  const logoBranca = brandSettings?.logo_white_url || brandSettings?.logo_url || logoBrancaFallback;
  const nomeEmpresa = get("nome_empresa");
  const slogan = get("slogan");
  const telefone = get("telefone");
  const whatsapp = get("whatsapp");
  const email = get("email");
  const cidade = get("cidade");
  const estado = get("estado");
  const instagramUrl = get("instagram_url");

  return (
    <footer ref={ref} className="relative bg-secondary text-secondary-foreground overflow-hidden">
      {/* Top accent line — laranja vibrante */}
      <div className="h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/30" />

      <div className="container mx-auto px-4 py-5 relative z-10">
        {/* Single row layout — compact */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo + tagline */}
          <div className="flex items-center gap-3">
            <img
              src={logoBranca}
              alt={nomeEmpresa}
              className="h-7 w-auto"
            />
            <div className="hidden sm:block w-px h-5 bg-secondary-foreground/15" />
            <p className="hidden sm:block text-secondary-foreground/40 text-xs">
              {slogan}
            </p>
          </div>

          {/* Contact links inline */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <a
              href={`tel:+${whatsapp}`}
              className="flex items-center gap-1.5 text-secondary-foreground/50 hover:text-primary transition-colors text-xs group"
            >
              <Phone className="w-3 h-3" />
              <span>{telefone}</span>
            </a>

            <a
              href={`mailto:${email}`}
              className="flex items-center gap-1.5 text-secondary-foreground/50 hover:text-primary transition-colors text-xs group"
            >
              <Mail className="w-3 h-3" />
              <span className="hidden sm:inline">{email}</span>
              <span className="sm:hidden">E-mail</span>
            </a>

            <div className="flex items-center gap-1.5 text-secondary-foreground/40 text-xs">
              <MapPin className="w-3 h-3" />
              <span>{cidade} - {estado}</span>
            </div>

            <div className="flex items-center gap-2">
              {instagramUrl && (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-7 h-7 rounded-full bg-secondary-foreground/8 hover:bg-primary/20 flex items-center justify-center transition-colors group"
                  aria-label="Instagram"
                >
                  <Instagram className="w-3.5 h-3.5 text-secondary-foreground/40 group-hover:text-primary transition-colors" />
                </a>
              )}
              <a
                href={`https://wa.me/${whatsapp}?text=${encodeURIComponent((get as any)("whatsapp_mensagem_padrao") || "Olá, gostaria de um orçamento de energia solar")}`}
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
            © {new Date().getFullYear()} {nomeEmpresa} · Todos os direitos reservados
          </p>
        </div>
      </div>
    </footer>
  );
});

export default Footer;
