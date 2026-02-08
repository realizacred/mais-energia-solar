import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/layout/Header";
import LeadFormWizard from "@/components/LeadFormWizard";
import { OfflineStatusBar } from "./OfflineStatusBar";
import { OfflineDuplicateResolver } from "./OfflineDuplicateResolver";
import { InstallAppBanner } from "./InstallAppBanner";

export function VendorLandingPage() {
  const [searchParams] = useSearchParams();
  const codigo = searchParams.get("v");
  const [vendedorNome, setVendedorNome] = useState<string | null>(null);

  // Load vendedor name from code for offline data isolation
  useEffect(() => {
    const loadVendedorNome = async () => {
      if (!codigo) return;
      
      const { data } = await supabase
        .from("vendedores")
        .select("nome")
        .eq("codigo", codigo)
        .eq("ativo", true)
        .maybeSingle();
      
      if (data) {
        setVendedorNome(data.nome);
      }
    };

    loadVendedorNome();
  }, [codigo]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex flex-col">
      <Header />
      {/* Spacer for fixed header */}
      <div className="h-14 sm:h-16" />
      <InstallAppBanner vendedorNome={vendedorNome} />
      <OfflineStatusBar vendedorNome={vendedorNome} />

      {/* Form Section */}
      <main className="flex-1 py-10 sm:py-14">
        <div className="container mx-auto px-4">
          <OfflineDuplicateResolver vendedorNome={vendedorNome} />
          <LeadFormWizard />
        </div>
      </main>

      {/* Simple Footer */}
      <footer className="py-5 bg-secondary text-secondary-foreground text-center border-t border-secondary-foreground/5">
        <div className="container mx-auto px-4">
          <p className="text-sm opacity-60">
            © {new Date().getFullYear()} Mais Energia Solar. Todos os direitos reservados.
          </p>
          <p className="text-sm opacity-40 mt-1">
            <a href="tel:+5532998437675" className="hover:opacity-80 transition-opacity">(32) 99843-7675</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
