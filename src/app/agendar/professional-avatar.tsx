import Image from "next/image";
import { canOptimizeAvatar } from "@/lib/avatar-image";

// The professional's photo on the booking pages, or their initials in the
// brand's frost tile when they have not uploaded one.

const SIZES = {
  sm: "size-11 text-[15px]",
  md: "size-14 text-lg",
  lg: "size-[72px] text-2xl",
} as const;

export function ProfessionalAvatar({
  name,
  src,
  size = "lg",
}: {
  name: string;
  src: string | null;
  size?: keyof typeof SIZES;
}) {
  const initials = name
    .replace(/^(Dr|Dra|Lcda|Lcdo|Lic|Od|Bioan)\.\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  if (src) {
    const pixels = size === "lg" ? 72 : size === "md" ? 56 : 44;
    return (
      <Image src={src} unoptimized={!canOptimizeAvatar(src)} alt="" width={pixels} height={pixels} sizes={`${pixels}px`} className={`${SIZES[size]} shrink-0 rounded-full bg-frost object-cover ring-4 ring-white`} />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${SIZES[size]} grid shrink-0 place-items-center rounded-full bg-frost font-serif text-navy ring-4 ring-white`}
    >
      {initials || "·"}
    </span>
  );
}
