
import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { AdminRouteBoundary } from "@/components/admin/AdminRouteBoundary";

// Lazy imports...
const LeadsView = lazy(() => import("@/components/admin/views/LeadsView").then(m => ({ default: m.LeadsView })));
const LeadsPipeline = lazy(() => import("@/components/admin/LeadsPipeline"));
// ... (I'll need to replicate all imports here)

export function AdminRoutes() {
  return (
    <AdminRouteBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          {/* Routes list here */}
        </Routes>
      </Suspense>
    </AdminRouteBoundary>
  );
}
