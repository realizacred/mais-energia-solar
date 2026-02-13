import { LoadingState } from "@/components/ui-kit/LoadingState";

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <LoadingState message="Carregando..." size="lg" />
    </div>
  );
}
