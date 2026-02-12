import { LinksInstalacaoPage } from "@/components/admin/LinksInstalacaoPage";

interface Props {
  portal: ReturnType<typeof import("@/hooks/useVendedorPortal").useVendedorPortal>;
}

export default function VendorLinksView({ portal }: Props) {
  const { vendedor, isViewingAsVendedor } = portal;

  if (!vendedor) return null;

  // Admin without impersonation — show all vendor links (admin view)
  if (vendedor.id === "admin" && !isViewingAsVendedor) {
    return <LinksInstalacaoPage />;
  }

  // Real vendor OR admin viewing as specific vendor — show that vendor's links
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
