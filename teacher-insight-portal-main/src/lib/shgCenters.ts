// Center/SHG names arrive in two shapes across the sheets:
//   "17:21:06 / Agauna/ Kalwari/ AMBEDKARNAGAR/ UP"  (time / village / center / district / state)
//   "Kalwari Ambedkarnagar"                         (center + district)
// SHG identity is the center + district pair; the village is just the venue.
// Name parts are compared as fuzzy token sets so spelling drift
// ("Sitamarahi"/"Sitamarhi", "Bramhpur"/"Brahmapur", "Obara"/"Obra")
// and multi-word districts ("PRATAPGARH&FATEHPUR") still merge.

interface CenterSig {
  village: string;
  center: string;
  district: string;
}

const tokens = (raw: string): string[] =>
  raw
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !/^\d+$/.test(token));

const sig = (raw: string): CenterSig => {
  if (raw.includes("/")) {
    const parts = raw.split("/").map((part) => part.trim());
    return {
      village: tokens(parts[1] ?? "").join(" "),
      center: tokens(parts[2] ?? "").join(" "),
      district: tokens(parts[3] ?? "").join(" "),
    };
  }
  const words = tokens(raw);
  return {
    village: "",
    center: words.slice(0, -1).join(" ") || words[0] || "",
    district: words[words.length - 1] || "",
  };
};

const editDistance = (a: string, b: string): number => {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = prev[j];
      prev[j] = next;
    }
  }
  return prev[b.length];
};

// Loose equality for a single place token: exact, prefix, or small typo.
const tokenEq = (a: string, b: string): boolean => {
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return true;
  return Math.min(a.length, b.length) >= 6 && editDistance(a, b) <= 2;
};

// Two name parts match when every token of the smaller side has a fuzzy
// twin in the bigger side (handles uncertain word boundaries).
const partEq = (a: string, b: string): boolean => {
  const setA = new Set(tokens(a));
  const setB = new Set(tokens(b));
  if (!setA.size || !setB.size) return a === b;
  const subset = (small: Set<string>, big: Set<string>) =>
    [...small].every((token) => [...big].some((other) => tokenEq(token, other)));
  return setA.size <= setB.size ? subset(setA, setB) : subset(setB, setA);
};

export const centersMatch = (a: string, b: string): boolean => {
  const sigA = sig(a);
  const sigB = sig(b);
  const sameCenter =
    partEq(sigA.center, sigB.center) ||
    (sigA.village !== "" && partEq(sigA.village, sigB.center)) ||
    (sigB.village !== "" && partEq(sigA.center, sigB.village));
  if (sameCenter && partEq(sigA.district, sigB.district)) return true;

  // Fallback: whole-name fuzzy subset (min 2 tokens) for odd formats.
  const allA = new Set(tokens(a));
  const allB = new Set(tokens(b));
  const subset = (small: Set<string>, big: Set<string>) =>
    small.size >= 2 && [...small].every((token) => [...big].some((other) => tokenEq(token, other)));
  return subset(allA, allB) || subset(allB, allA);
};

// Stable dedupe key: normalized center + district.
export const centerKey = (raw: string): string => {
  const { center, district } = sig(raw);
  return `${center}|${district}`;
};

// Audit-sheet SHG names ("SHG TC TIKAMGARH BIRDHA(23:21:02)") carry the same
// time code the punch sheet prefixes to its class names — the strongest join
// key, with location-token overlap as fallback.
const SHG_CODE_RE = /(\d{2}:\d{2}:\d{2})/;

export const shgCode = (raw: string): string | null => raw.match(SHG_CODE_RE)?.[1] ?? null;

// Filler words in audit-sheet names that carry no location information.
const AUDIT_STOP_TOKENS = new Set([
  "shg", "tc", "cec", "sr", "jr", "up", "mp", "cg", "bihar", "jharkhand", "center", "centre",
]);

export const shgAuditNameMatches = (centerRaw: string, auditName: string): boolean => {
  const centerCode = shgCode(centerRaw);
  const auditCode = shgCode(auditName);
  if (centerCode && auditCode) return centerCode === auditCode;

  const auditTokens = tokens(auditName.replace(SHG_CODE_RE, " ")).filter(
    (token) => !AUDIT_STOP_TOKENS.has(token)
  );
  const centerTokens = tokens(centerRaw);
  if (!auditTokens.length || !centerTokens.length) return false;
  return auditTokens.every((token) => centerTokens.some((other) => tokenEq(token, other)));
};

// Human-friendly label: "center · district".
export const centerLabel = (raw: string): string => {
  if (raw.includes("/")) {
    const parts = raw
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);
    const label = parts.slice(2, 4).join(" · ");
    if (label) return label;
  }
  return raw.trim();
};
