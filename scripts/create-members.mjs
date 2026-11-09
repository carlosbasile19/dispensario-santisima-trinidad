// Creates the first platform members with a role and a temporary password.
//
//   SUPABASE_SECRET_KEY=... node scripts/create-members.mjs
//
// Needs the project's secret key (Supabase → Settings → API keys), which
// bypasses RLS: run it from a trusted machine and never commit the key.
// Passwords are generated here and printed once; each member should change
// theirs in "Mi cuenta" after the first sign-in. Safe to run again: members
// that already exist keep their password and only get their role updated.
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const MEMBERS = [
  { name: "Carlos Basile", email: "carlos@cmisantisimatrinidad.com", role: "admin" },
  { name: "Yaima Bruzon", email: "yaima@cmisantisimatrinidad.com", role: "admin" },
  { name: "José Morales", email: "josemorales@cmisantisimatrinidad.com", role: "director" },
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://xnbinvflvurdpvbctxfh.supabase.co";
const key = process.env.SUPABASE_SECRET_KEY;
if (!key) {
  console.error("Set SUPABASE_SECRET_KEY (Supabase → Settings → API keys → secret key).");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;

for (const member of MEMBERS) {
  let user = list.users.find((u) => u.email?.toLowerCase() === member.email);
  let password = null;

  if (!user) {
    password = randomBytes(12).toString("base64url");
    const { data, error } = await supabase.auth.admin.createUser({
      email: member.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: member.name },
    });
    if (error) throw error;
    user = data.user;
  }

  // The profile row is created by the on_auth_user_created trigger.
  const { error } = await supabase
    .from("profiles")
    .update({ role: member.role, full_name: member.name })
    .eq("id", user.id);
  if (error) throw error;

  console.log(
    `${member.email}  ·  ${member.role}  ·  ` +
      (password ? `temporary password: ${password}` : "already existed, password unchanged"),
  );
}
