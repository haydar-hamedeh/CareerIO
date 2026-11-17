import { countries, countryByCode } from "./countries";

export function splitPhone(phone: string | null, countryCode: string | null) {
  if (!phone) return { dialCode: countryCode, national: "" };
  const m = phone.match(/^\+(\d{1,4})\s*(.*)$/);
  if (!m) return { dialCode: countryCode, national: phone };
  const digits = m[1] + m[2].replace(/\D/g, "");
  const own = countryCode ? countryByCode.get(countryCode) : undefined;
  const match =
    own && digits.startsWith(own.dial)
      ? own
      : [...countries].sort((a, b) => b.dial.length - a.dial.length).find((c) => digits.startsWith(c.dial));
  if (!match) return { dialCode: countryCode, national: m[2] };
  const rest = phone.replace(/^\+/, "").replace(new RegExp(`^${match.dial}\s*`), "");
  return { dialCode: match.code, national: rest };
}

export function joinPhone(dialCode: string | null, national: string) {
  const dial = dialCode ? (countryByCode.get(dialCode)?.dial ?? "") : "";
  const n = national.trim().replace(/^0+/, "");
  return n ? `+${dial} ${n}`.trim() : "";
}
