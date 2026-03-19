import { createRoot } from "react-dom/client";
import { initSentry } from "./lib/sentry";
import { initPWAPromptCapture } from "./lib/pwa-install-prompt";
import { applyRouteManifest } from "./lib/pwa-route-manifest";
import { cleanupLegacyServiceWorkers, debugServiceWorkers } from "./lib/sw-cleanup";
import App from "./App.tsx";
import "./index.css";

// 1. Remove legacy SWs BEFORE anything else (passive & active cleanup)
cleanupLegacyServiceWorkers();

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
