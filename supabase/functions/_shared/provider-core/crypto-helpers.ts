/**
 * Crypto Helpers — SSOT for all hashing/signing used by provider adapters.
 * Uses node:crypto for MD5/SHA1 (legacy algos not in Web Crypto).
 */
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

export async function sha256Hex(text: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function md5Hex(text: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("md5").update(text, "utf8").digest("hex");
}

export async function md5Base64(text: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  const hash = createHash("md5").update(text).digest("base64");
  return hash;
}

export async function hmacSha1Base64(secret: string, data: string): Promise<string> {
  const { createHmac } = await import("node:crypto");
  const sig = createHmac("sha1", secret).update(data).digest("base64");
  return sig;
}

/** Growatt custom MD5: replace '0' at even hex positions with 'c' */
export async function growattMd5(password: string): Promise<{ raw: string; custom: string }> {
  const raw = await md5Hex(password);
  let custom = raw;
  for (let i = 0; i < custom.length; i += 2) {
    if (custom[i] === "0") {
      custom = custom.substring(0, i) + "c" + custom.substring(i + 1);
    }
  }
  return { raw, custom };
}

/** Hoymiles password: MD5(hex) + "." + base64(SHA256(raw digest)) */
export async function hoymilesPasswordEncode(password: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  const md5HexStr = createHash("md5").update(password, "utf8").digest("hex");
  const sha256Digest = createHash("sha256").update(password, "utf8").digest();
  const sha256B64 = btoa(String.fromCharCode(...new Uint8Array(sha256Digest)));
  return `${md5HexStr}.${sha256B64}`;
}
