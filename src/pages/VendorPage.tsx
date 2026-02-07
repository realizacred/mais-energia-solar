import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/layout/Header";
import LeadFormWizard from "@/components/LeadFormWizard";
import { OfflineStatusBar } from "@/components/vendor/OfflineStatusBar";
import { OfflineDuplicateResolver } from "@/components/vendor/OfflineDuplicateResolver";
import { InstallAppBanner } from "@/components/vendor/InstallAppBanner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { AlertCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

type ValidationState = "loading" | "valid" | "invalid";

export default function VendorPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const navigate = useNavigate();
  const [vendedorNome, setVendedorNome] = useState<string | null>(null);
  const [validationState, setValidationState] = useState<ValidationState>("loading");

  // Validate vendor code and load name
  useEffect(() => {
    const validateAndLoadVendedor = async () => {
      if (!codigo) {
        setValidationState("invalid");
        return;
      }

      try {
        // Use secure RPC that allows public access (no auth required)
        const { data, error } = await supabase
          .rpc("validate_vendedor_code", { _codigo: codigo });

        if (error) {
          console.error("Error validating vendor:", error);
          setValidationState("invalid");
          return;
        }

        // RPC returns array, get first result
        const vendedor = Array.isArray(data) ? data[0] : data;

        if (vendedor) {
          setVendedorNome(vendedor.nome);
          setValidationState("valid");
        } else {
          setValidationState("invalid");
        }
      } catch (err) {
        console.error("Error validating vendor:", err);
        setValidationState("invalid");
      }
    };

    validateAndLoadVendedor();
  }, [codigo]);

  // Loading state
  if (validationState === "loading") {
    return <LoadingSpinner />;
  }

  // Invalid vendor code - show error page
  if (validationState === "invalid") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center py-12">
          <div className="container mx-auto px-4 text-center max-w-md">
            <div className="bg-card border rounded-lg p-8 shadow-lg">
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Link Inválido
              </h1>
              <p className="text-muted-foreground mb-4">
                O código de vendedor "{codigo}" não foi encontrado ou não está mais ativo.
              </p>
              <div className="bg-muted/50 rounded-lg p-4 mb-6 text-sm">
                <p className="text-muted-foreground mb-2">
                  Se você acredita que isso é um erro, entre em contato:
                </p>
                <a 
                  href={`https://wa.me/5532998437675?text=Olá! Estou tentando acessar o link de vendedor com código: ${codigo}, mas aparece como inválido.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
                >
                  <Phone className="w-4 h-4" />
                  (32) 99843-7675
                </a>
              </div>
              <Button 
                onClick={() => navigate("/")} 
                className="w-full"
              >
                Ir para a Página Inicial
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Valid vendor - show landing page
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col">
      <Header />
      <InstallAppBanner vendedorNome={vendedorNome} />
      <OfflineStatusBar vendedorNome={vendedorNome} />

      {/* Form Section - passa o código do vendedor */}
      <main className="flex-1 py-12">
        <div className="container mx-auto px-4">
          <OfflineDuplicateResolver vendedorNome={vendedorNome} />
          <LeadFormWizard vendorCode={codigo} />
        </div>
      </main>

      {/* Simple Footer */}
      <footer className="py-6 bg-secondary text-white text-center">
        <div className="container mx-auto px-4">
          <p className="text-sm opacity-80">
            © {new Date().getFullYear()} Mais Energia Solar. Todos os direitos reservados.
          </p>
          <p className="text-sm opacity-60 mt-1">
            <a href="tel:+5532998437675" className="hover:opacity-100">(32) 99843-7675</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
