/**
 * R2 upload/delete utility using aws4fetch for S3-compatible signing.
 *
 * Environment variables required:
 *   CF_ACCOUNT_ID          — Cloudflare account ID (shared with Pages/Workers)
 *   R2_ACCESS_KEY_ID       — R2 API token access key
 *   R2_SECRET_ACCESS_KEY   — R2 API token secret key
 *   R2_PUBLIC_URL          — CDN base URL (e.g. https://cdn.glazebot.gg)
 *
 * Bucket names are hardcoded per environment:
 *   production → glazebot-production-public / glazebot-production-private
 *   staging    → glazebot-staging-public / glazebot-staging-private
 *
 * Environment is detected from SUPABASE_URL (production project ref vs staging).
 */

import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

const PRODUCTION_PROJECT_REF = "tspalglvgypdktuhgqtf";

function isProduction(): boolean {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  return url.includes(PRODUCTION_PROJECT_REF);
}

function getR2Client(): AwsClient {
  return new AwsClient({
    accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID") ?? "",
    secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY") ?? "",
    region: "auto",
    service: "s3",
  });
}

function publicBucketName(): string {
  return isProduction() ? "glazebot-production-public" : "glazebot-staging-public";
}

function bucketEndpoint(): string {
  const accountId = Deno.env.get("CF_ACCOUNT_ID") ?? "";
  return `https://${accountId}.r2.cloudflarestorage.com/${publicBucketName()}`;
}

function publicUrl(): string {
  return Deno.env.get("R2_PUBLIC_URL") ?? "";
}

// ─── Path Helpers ───────────────────────────────────────────────────

export function characterPortraitKey(id: string): string {
  return `character-data/${id}/images/main_portrait.png`;
}

export function characterTaglineKey(id: string): string {
  return `character-data/${id}/sounds/tagline.mp3`;
}

export function characterMediaPrefix(id: string): string {
  return `character-data/${id}/`;
}

// ─── Upload ─────────────────────────────────────────────────────────

/**
 * Upload a file to the public R2 bucket.
 * Returns the full CDN URL for the uploaded object.
 */
export async function uploadToPublicBucket(
  key: string,
  body: Uint8Array | ArrayBuffer,
  contentType: string,
): Promise<string> {
  const r2 = getR2Client();
  const url = `${bucketEndpoint()}/${key}`;

  const res = await r2.fetch(url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`R2 upload failed (${res.status}): ${text}`);
  }

  return `${publicUrl()}/${key}`;
}

// ─── Delete Prefix ──────────────────────────────────────────────────

/**
 * Delete all objects under a given prefix in the public R2 bucket.
 * Uses S3 ListObjectsV2 + DeleteObject. Returns the number of objects deleted.
 */
export async function deletePublicBucketPrefix(prefix: string): Promise<number> {
  const r2 = getR2Client();
  const endpoint = bucketEndpoint();

  // List objects with prefix
  const listUrl = `${endpoint}?list-type=2&prefix=${encodeURIComponent(prefix)}`;
  const listRes = await r2.fetch(listUrl, { method: "GET" });

  if (!listRes.ok) {
    const text = await listRes.text();
    throw new Error(`R2 list failed (${listRes.status}): ${text}`);
  }

  const xml = await listRes.text();

  // Parse keys from XML (simple regex — R2 returns standard S3 XML)
  const keys: string[] = [];
  const keyRegex = /<Key>([^<]+)<\/Key>/g;
  let match;
  while ((match = keyRegex.exec(xml)) !== null) {
    keys.push(match[1]);
  }

  // Delete each object
  let deleted = 0;
  for (const key of keys) {
    const delRes = await r2.fetch(`${endpoint}/${key}`, { method: "DELETE" });
    if (delRes.ok) deleted++;
  }

  return deleted;
}
