import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { markCameFromSistema } from "@/components/pwa/SistemaInstallBanner";

/**
 * PWA entry point for the full system.
 * Detects user role and redirects to the appropriate area:
 * - admin/gerente/financeiro → /admin
 * - vendedor/consultor → /vendedor
 * - instalador → /instalador
 * - fallback → /admin
 */
export default function Sistema() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  // Swap manifest for sistema PWA
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]');
    const original = link?.getAttribute("href") || "/manifest.webmanifest";
    link?.setAttribute("href", "/sistema-manifest.json");

    let themeMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeMeta) {
      themeMeta = document.createElement("meta");
      themeMeta.setAttribute("name", "theme-color");
      document.head.appendChild(themeMeta);
    }
    const originalTheme = themeMeta.getAttribute("content") || "#e8760d";
    themeMeta.setAttribute("content", "#e8760d");

    return () => {
      link?.setAttribute("href", original);
      themeMeta?.setAttribute("content", originalTheme);
    };
  }, []);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth?from=sistema", { replace: true });
    }
  }, [user, loading, navigate]);

  // Role detection & redirect
  useEffect(() => {
    if (!user) return;

    const detectRole = async () => {
      try {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        const userRoles = (roles ?? []).map((r) => r.role);

        if (userRoles.some((r) => ["admin", "gerente", "financeiro"].includes(r))) {
          navigate("/admin", { replace: true });
        } else if (userRoles.includes("instalador")) {
          navigate("/instalador", { replace: true });
        } else if (userRoles.some((r) => ["vendedor", "consultor"].includes(r))) {
          navigate("/vendedor", { replace: true });
        } else {
          // Fallback — try admin
          navigate("/admin", { replace: true });
        }
      } catch {
        navigate("/admin", { replace: true });
      } finally {
        setChecking(false);
      }
    };

    detectRole();
  }, [user, navigate]);

  if (loading || checking) return <LoadingSpinner />;
  return null;
}
