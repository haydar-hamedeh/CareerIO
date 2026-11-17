import Image from "next/image";
import { companyLogoUrl } from "@/lib/company";
import { avatarPalette } from "@/lib/jobs/format";

const sizes = {
  md: { box: "h-12 w-12 rounded-2xl text-lg", px: 48 },
  lg: { box: "h-14 w-14 rounded-2xl text-xl", px: 56 },
  xl: { box: "h-20 w-20 rounded-[22px] text-3xl", px: 80 },
} as const;

/** The company logo, or its first letter on a soft colour when it has none. */
export function CompanyAvatar({ name, logoPath, size = "md" }: { name: string; logoPath?: string | null; size?: keyof typeof sizes }) {
  const s = sizes[size];
  const url = companyLogoUrl(logoPath);
  if (url) {
    return (
      <span aria-hidden className={`grid shrink-0 place-items-center overflow-hidden bg-white ring-1 ring-line ${s.box}`}>
        <Image src={url} alt="" width={s.px} height={s.px} unoptimized className="h-full w-full object-contain p-1" />
      </span>
    );
  }
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center font-display font-extrabold ${s.box} ${avatarPalette[name.length % avatarPalette.length]}`}>
      {name[0]?.toUpperCase()}
    </span>
  );
}
