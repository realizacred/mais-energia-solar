import { createRoot } from "react-dom/client";
import { initSentry } from "./lib/sentry";
import { initPWAPromptCapture } from "./lib/pwa-install-prompt";
import { applyRouteManifest } from "./lib/pwa-route-manifest";
import { cleanupLegacyServiceWorkers, debugServiceWorkers } from "./lib/sw-cleanup";
import App from "./App.tsx";
import "./index.css";

const isLovablePreview = typeof window !== "undefined" && window.location.hostname.includes("lovableproject.com");

// 1. Remove stale/legacy SWs BEFORE anything else.
// In Lovable preview we disable cached SW responses to avoid serving old UI after edits.
cleanupLegacyServiceWorkers({ aggressive: isLovablePreview });

// 2. Aplicar manifest correto baseado na rota ANTES de qualquer coisa
applyRouteManifest();

// 3. Capturar beforeinstallprompt ANTES de qualquer componente montar
initPWAPromptCapture();

// 4. Debug SW state in dev
if (import.meta.env.DEV) {
  debugServiceWorkers();
}

// 5. Inicializar error tracking antes de renderizar
initSentry();

createRoot(document.getElementById("root")!).render(<App />);
