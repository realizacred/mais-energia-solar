import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlaskConical, Trash2 } from "lucide-react";
import { lazy, Suspense } from "react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const DevSeedTab = lazy(() => import("./DevSeedPage"));
const DevResetSeedTab = lazy(() => import("./DevResetSeedPage"));

export default function DevToolsPage() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">🛠️ Ferramentas de Desenvolvimento</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ferramentas para criar e limpar dados de teste no ambiente atual.
        </p>
      </div>

      <Tabs defaultValue="seed" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="seed" className="flex-1 gap-2">
            <FlaskConical className="h-4 w-4" />
            Seed
          </TabsTrigger>
          <TabsTrigger value="reset" className="flex-1 gap-2">
            <Trash2 className="h-4 w-4" />
            Limpar Seed
          </TabsTrigger>
        </TabsList>

        <TabsContent value="seed">
          <Suspense fallback={<LoadingSpinner />}>
            <DevSeedTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="reset">
          <Suspense fallback={<LoadingSpinner />}>
            <DevResetSeedTab />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
