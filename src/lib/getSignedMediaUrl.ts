/**
 * Central helper to resolve PRIVATE storage media via signed URLs.
 *
 * Onda 1 hardening: never trust legacy public URLs for sensitive buckets
 * (e.g. wa-attachments). Always derive a fresh signed URL from storage_path.
 *
 * Behaviour:
 * - If `storagePath` is provided → returns a signed URL (default 1h).
 * - If only a legacy `fallbackUrl` exists → returns it (so old data does not
 *   break the UI; the URL may 403 if the bucket is now private — caller
 *   should treat this as a soft warning, not an error).
 * - On any failure → logs a structured warning and returns `fallbackUrl ?? null`.
 *
 * NEVER call `storage.getPublicUrl` for buckets considered private.
 */
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_BUCKET = "wa-attachments";
const DEFAULT_EXPIRES = 60 * 60; // 1 hour

export interface SignedMediaInput {
  storagePath?: string | null;
  bucket?: string;
  fallbackUrl?: string | null;
  expiresIn?: number;
}

export async function getSignedMediaUrl(
  input: SignedMediaInput,
): Promise<string | null> {
  const bucket = input.bucket ?? DEFAULT_BUCKET;
  const expiresIn = input.expiresIn ?? DEFAULT_EXPIRES;

  if (!input.storagePath) {
    if (!input.fallbackUrl) {
      // Inconsistency: media reference without any URL or path
      console.warn("[getSignedMediaUrl] missing storage_path and fallback", { bucket });
      return null;
    }
    return input.fallbackUrl;
  }

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(input.storagePath, expiresIn);

    if (error || !data?.signedUrl) {
      console.warn("[getSignedMediaUrl] sign failed", {
        bucket,
        storagePath: input.storagePath,
        error: error?.message,
      });
      return input.fallbackUrl ?? null;
    }
    return data.signedUrl;
  } catch (err: any) {
    console.warn("[getSignedMediaUrl] exception", {
      bucket,
      storagePath: input.storagePath,
      error: err?.message,
    });
    return input.fallbackUrl ?? null;
  }
}

/**
 * Batch resolver for lists of media references. Runs in parallel.
 */
export async function resolveSignedMediaUrls<T extends SignedMediaInput>(
  items: T[],
): Promise<(string | null)[]> {
  return Promise.all(items.map((it) => getSignedMediaUrl(it)));
}
