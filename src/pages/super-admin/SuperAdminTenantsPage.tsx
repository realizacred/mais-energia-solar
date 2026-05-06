/**
 * SuperAdminTenantsPage — wrapper de rota para a lista de tenants existente.
 * Não duplica lógica: reaproveita SuperAdminTenantList.
 */
import { useNavigate } from "react-router-dom";
import { SuperAdminTenantList } from "@/components/super-admin/SuperAdminTenantList";

export default function SuperAdminTenantsPage() {
  const navigate = useNavigate();
  return (
    <SuperAdminTenantList
      onSelectTenant={(id) => navigate(`/super-admin/tenants/${id}`)}
    />
  );
}
