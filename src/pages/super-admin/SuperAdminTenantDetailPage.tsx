/**
 * SuperAdminTenantDetailPage — wrapper de rota: lê :tenantId e renderiza o detail.
 */
import { useNavigate, useParams } from "react-router-dom";
import { SuperAdminTenantDetail } from "@/components/super-admin/SuperAdminTenantDetail";

export default function SuperAdminTenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  if (!tenantId) {
    navigate("/super-admin/tenants", { replace: true });
    return null;
  }
  return (
    <SuperAdminTenantDetail
      tenantId={tenantId}
      onBack={() => navigate("/super-admin/tenants")}
    />
  );
}
