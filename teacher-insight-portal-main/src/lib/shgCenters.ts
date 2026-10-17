// Center/SHG names arrive in two shapes across the sheets:
//   "17:21:06 / Agauna/ Kalwari/ AMBEDKARNAGAR/ UP"  (time / village / center / district / state)
//   "Obara Aurangabad"                              (center + district)
// Matching is done on normalized tokens from the meaningful parts so the
// same SHG merges across both formats.

export const centerTokens = (raw: string): string[] => {
  const source = raw.includes("/")
    ? raw.split("/").slice(1, 4).join(" ")
    : raw;
  return source
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !/^\d+$/.test(token));
};

export const centerKey = (raw: string): string => centerTokens(raw).join(" ");

// Two centers are the same when their token sets are identical or one is a
// subset of the other ("Obara Aurangabad" ⊂ "CEC-Obara Obra Aurangabad").
// Single shared tokens are too weak, so subset matches require 2+ tokens.
export const centersMatch = (a: string, b: string): boolean => {
  const tokensA = centerTokens(a);
  const tokensB = centerTokens(b);
  if (!tokensA.length || !tokensB.length) return false;

  const keyA = tokensA.join(" ");
  const keyB = tokensB.join(" ");
  if (keyA === keyB) return true;

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  const isSubset = (small: Set<string>, big: Set<string>) =>
    small.size >= 2 && [...small].every((token) => big.has(token));
  return isSubset(setA, setB) || isSubset(setB, setA);
};

// Human-friendly label: "village · center · district" for the slash format.
export const centerLabel = (raw: string): string => {
  if (raw.includes("/")) {
    const parts = raw
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);
    const label = parts.slice(1, 4).join(" · ");
    if (label) return label;
  }
  return raw.trim();
};
