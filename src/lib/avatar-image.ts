/** Only public, versioned Supabase avatar objects may use the image optimizer. */
export function canOptimizeAvatar(src: string, supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL): boolean {
  if (!supabaseUrl) return false;
  try {
    const image = new URL(src);
    return image.origin === new URL(supabaseUrl).origin
      && image.pathname.startsWith("/storage/v1/object/public/avatars/")
      && !image.search;
  } catch {
    return false;
  }
}
