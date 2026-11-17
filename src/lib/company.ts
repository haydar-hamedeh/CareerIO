/** Public URL of a company logo in the `company-logos` bucket. Safe to use on the server and in the browser. */
export function companyLogoUrl(path: string | null | undefined): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!path || !base) return null;
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/company-logos/${path}`;
}

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
