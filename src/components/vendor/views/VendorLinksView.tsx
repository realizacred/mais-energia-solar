import { LinksInstalacaoPage } from "@/components/admin/LinksInstalacaoPage";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface Props {
  portal: ReturnType<typeof import("@/hooks/useVendedorPortal").useVendedorPortal>;
}

export default function VendorLinksView({ portal }: Props) {
  const { vendedor } = portal;

  if (!vendedor) return null;

  // Admin without a linked vendedor record — can't generate valid links
  if (vendedor.id === "admin") {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="flex items-center gap-3 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-medium text-sm text-amber-800">
              Nenhum consultor vinculado ao seu usuário
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Para ver seus links pessoais, vincule seu usuário a um registro de consultor em Administração → Usuários.
              Ou use o parâmetro <code className="bg-amber-200/50 px-1 rounded">?as=CODIGO</code> para visualizar como um consultor específico.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Real vendor (or admin with linked vendedor) — show individual links
  return (
    <LinksInstalacaoPage
      vendedor={{
        nome: vendedor.nome,
        slug: vendedor.slug || vendedor.codigo,
        codigo: vendedor.codigo,
      }}
    />
  );
}
