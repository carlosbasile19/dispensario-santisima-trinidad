// Public Supabase settings. NEXT_PUBLIC_* values are inlined at build time,
// so they must be referenced literally (no dynamic process.env[key] lookups).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local (or run `vercel env pull .env.local`).",
  );
}

export const env = { supabaseUrl, supabasePublishableKey };
