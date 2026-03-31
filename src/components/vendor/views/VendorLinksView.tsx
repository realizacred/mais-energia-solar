import { LinksInstalacaoPage } from "@/components/admin/LinksInstalacaoPage";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Link } from "lucide-react";

interface Props {
  portal: ReturnType<typeof import("@/hooks/useVendedorPortal").useVendedorPortal>;
}

export default function VendorLinksView({ portal }: Props) {
  const { vendedor } = portal;

  if (!vendedor) return null;

  // Admin without a linked vendedor record — can't generate valid links
  if (vendedor.id === "admin") {
    return (
      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="flex items-center gap-3 p-4">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
          <div>
            <p className="font-medium text-sm text-warning">
              Nenhum consultor vinculado ao seu usuário
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Para ver seus links pessoais, vincule seu usuário a um registro de consultor em Administração → Usuários.
              Ou use o parâmetro <code className="bg-warning/10 px-1 rounded">?as=CODIGO</code> para visualizar como um consultor específico.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Real vendor (or admin with linked vendedor) — show individual links
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Link className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Captação & App</h1>
            <p className="text-sm text-muted-foreground">Seus links e ferramentas de captação</p>
          </div>
        </div>
      </div>
      <LinksInstalacaoPage
        vendedor={{
          nome: vendedor.nome,
          slug: vendedor.slug || vendedor.codigo,
          codigo: vendedor.codigo,
        }}
      />
    </div>
  );
}
