import { LinksInstalacaoPage } from "@/components/admin/LinksInstalacaoPage";

interface Props {
  portal: ReturnType<typeof import("@/hooks/useVendedorPortal").useVendedorPortal>;
}

export default function VendorLinksView({ portal }: Props) {
  const { vendedor } = portal;

  if (!vendedor) return null;

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
