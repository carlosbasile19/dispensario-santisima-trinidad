// A booking calendar's link, /agendar/<slug>: 3 to 60 lower-case letters,
// digits and single hyphens. The same check as calendars_slug_format.

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const isSlug = (value: unknown): value is string =>
  typeof value === "string" && value.length >= 3 && value.length <= 60 && SLUG_PATTERN.test(value);

/** "Dr. José Morales" → "dr-jose-morales", as a suggestion while typing a link. */
export const slugify = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
