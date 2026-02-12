import { LinksInstalacaoPage } from "@/components/admin/LinksInstalacaoPage";

interface Props {
  portal: ReturnType<typeof import("@/hooks/useVendedorPortal").useVendedorPortal>;
}

export default function VendorLinksView({ portal }: Props) {
  const { vendedor, isAdminMode, isViewingAsVendedor } = portal;

  if (!vendedor) return null;

  // Admin without impersonation — show admin view with all vendors + instalador PWA
  if (vendedor.id === "admin" && !isViewingAsVendedor) {
    return <LinksInstalacaoPage isAdminView />;
  }

  // Real vendor OR admin viewing as specific vendor — show only that vendor's links
  // No instalador PWA (this is the consultant context)
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
