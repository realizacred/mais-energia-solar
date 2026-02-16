import { useFeatureDiscovery } from "@/hooks/useFeatureDiscovery";
import { SmartBeacon } from "@/components/ui/SmartBeacon";

/**
 * Renders SmartBeacon overlays for all unseen features on the current page.
 * Mount once near the app root (inside Router context).
 */
export function FeatureDiscoveryLayer() {
  const { activeBeacons, dismiss } = useFeatureDiscovery();

  if (activeBeacons.length === 0) return null;

  return (
    <>
      {activeBeacons.map((beacon) => (
        <SmartBeacon key={beacon.hint.id} beacon={beacon} onDismiss={dismiss} />
      ))}
    </>
  );
}
