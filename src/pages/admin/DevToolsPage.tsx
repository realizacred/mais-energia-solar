import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlaskConical, Trash2, Wrench, Download, Cloud, User, FolderX } from "lucide-react";
import { lazy, Suspense } from "react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const DevSeedTab = lazy(() => import("./DevSeedPage"));
const DevResetSeedTab = lazy(() => import("./DevResetSeedPage"));
const DevResetImportedTab = lazy(() => import("./DevResetImportedPage"));
const DevResetMigratedTab = lazy(() => import("./DevResetMigratedPage"));
const DevResetNativeTab = lazy(() => import("./DevResetNativePage"));
const DevResetProjectAreaTab = lazy(() => import("./DevResetProjectAreaPage"));
const DevResetSmTotalTab = lazy(() => import("./DevResetSmTotalPage"));

export default function DevToolsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
          <Wrench className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Ferramentas de Desenvolvimento</h1>
          <p className="text-sm text-muted-foreground">
            Ferramentas para criar e limpar dados de teste no ambiente atual.
          </p>
        </div>
      </div>

      <Tabs defaultValue="reset-imported" className="w-full">
        <TabsList className="w-full overflow-x-auto flex-wrap h-auto">
          <TabsTrigger value="seed" className="flex-1 gap-2 shrink-0 whitespace-nowrap">
            <FlaskConical className="h-4 w-4" /> Seed
          </TabsTrigger>
          <TabsTrigger value="reset-seed" className="flex-1 gap-2 shrink-0 whitespace-nowrap">
            <Trash2 className="h-4 w-4" /> Limpar Seed
          </TabsTrigger>
          <TabsTrigger value="reset-imported" className="flex-1 gap-2 shrink-0 whitespace-nowrap">
            <Download className="h-4 w-4" /> Reset Importados
          </TabsTrigger>
          <TabsTrigger value="reset-migrated" className="flex-1 gap-2 shrink-0 whitespace-nowrap">
            <Cloud className="h-4 w-4" /> Reset Migrados
          </TabsTrigger>
          <TabsTrigger value="reset-native" className="flex-1 gap-2 shrink-0 whitespace-nowrap">
            <User className="h-4 w-4" /> Reset Nativos
          </TabsTrigger>
          <TabsTrigger value="reset-project-area" className="flex-1 gap-2 shrink-0 whitespace-nowrap">
            <FolderX className="h-4 w-4" /> Reset Área Projeto
          </TabsTrigger>
          <TabsTrigger value="reset-all" className="flex-1 gap-2 shrink-0 whitespace-nowrap">
            <Trash2 className="h-4 w-4" /> Reset Total
          </TabsTrigger>
        </TabsList>

        <TabsContent value="seed">
          <Suspense fallback={<LoadingSpinner />}><DevSeedTab /></Suspense>
        </TabsContent>
        <TabsContent value="reset-seed">
          <Suspense fallback={<LoadingSpinner />}><DevResetSeedTab /></Suspense>
        </TabsContent>
        <TabsContent value="reset-imported">
          <Suspense fallback={<LoadingSpinner />}><DevResetImportedTab /></Suspense>
        </TabsContent>
        <TabsContent value="reset-migrated">
          <Suspense fallback={<LoadingSpinner />}><DevResetMigratedTab /></Suspense>
        </TabsContent>
        <TabsContent value="reset-native">
          <Suspense fallback={<LoadingSpinner />}><DevResetNativeTab /></Suspense>
        </TabsContent>
        <TabsContent value="reset-project-area">
          <Suspense fallback={<LoadingSpinner />}><DevResetProjectAreaTab /></Suspense>
        </TabsContent>
        <TabsContent value="reset-all">
          <Suspense fallback={<LoadingSpinner />}><DevResetSmTotalTab /></Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
