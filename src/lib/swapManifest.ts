/**
 * Swaps the PWA manifest link in <head> to a different manifest file.
 * Returns a cleanup function that restores the original manifest.
 */
export function swapManifest(newHref: string): () => void {
  const link = document.querySelector('link[rel="manifest"]');
  if (!link) return () => {};

  const original = link.getAttribute("href") || "/manifest.webmanifest";
  link.setAttribute("href", newHref);

  return () => {
    link.setAttribute("href", original);
  };
}
