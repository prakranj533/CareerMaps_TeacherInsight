import { normalizeTeacherKey } from "@/lib/teacherDirectory";

const SHEET_ID = "18HJF-96eP2fioYvg90guMficXrokek7Zmlchoz_5d_s";
const GID = "2055020596";

type ColumnIndices = {
  timestamp: number;
  teacher: number;
  subject: number;
  primaryStudents: number;
  secondaryStudents?: number;
  merged?: number;
  center?: number;
  topic?: number;
  subTopic?: number;
  week?: number;
  reportingTeacher?: number;
};

const COLUMN_ALIASES: Record<keyof ColumnIndices, string[]> = {
  timestamp: ["timestamp", "date", "datecreated"],
  teacher: ["nameofteacher", "teacher", "trainer"],
  subject: ["subject"],
  primaryStudents: ["numberofstudentsprimarycenter", "students"],
  secondaryStudents: ["numberofstudentsinsecondarycenter", "secondary"],
  merged: ["merged", "mergedwithcenter"],
  center: ["primaryclassname", "center", "classname"],
  topic: ["topictaught", "topic"],
  subTopic: ["subtopiccovered", "subtopic"],
  week: ["week"],
  reportingTeacher: ["reportingteacher"],
};

const REQUIRED_COLUMNS: Array<keyof ColumnIndices> = [
  "timestamp",
  "teacher",
  "subject",
  "primaryStudents",
];

export interface TeacherPunchEntry {
  teacher: string;
  center: string;
  subject: string;
  students: number;
  topic: string;
  subTopic: string;
  week: string;
  reportingTeacher: string;
  date?: string;
  monthKey?: string;
  merged?: boolean;
}

export async function fetchTeacherPunchData(): Promise<TeacherPunchEntry[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to fetch punch data from Google Sheets");
  }

  const csvText = await response.text();
  const rows = parseCSV(csvText);

  if (!rows || rows.length <= 1) {
    return [];
  }

  const header = rows[0].map((column) => column?.trim() ?? "");
  const columnIndices = resolveColumnIndices(header);
  const entries: TeacherPunchEntry[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const teacherName = getValue(row, columnIndices.teacher);
    if (!teacherName) continue;

    const subject = getValue(row, columnIndices.subject) || "Unspecified";
    const primaryStudents = parseInteger(getValue(row, columnIndices.primaryStudents));
    const secondaryStudents = parseInteger(getValue(row, columnIndices.secondaryStudents));
    const totalStudents = primaryStudents + secondaryStudents;
    const mergedFlag = parseBoolean(getValue(row, columnIndices.merged));

    const timestamp = getValue(row, columnIndices.timestamp);
    const { date, monthKey } = extractDateMetadata(timestamp);

    entries.push({
      teacher: teacherName,
      center: getValue(row, columnIndices.center),
      subject,
      students: totalStudents,
      topic: getValue(row, columnIndices.topic),
      subTopic: getValue(row, columnIndices.subTopic),
      week: getValue(row, columnIndices.week),
      reportingTeacher: getValue(row, columnIndices.reportingTeacher),
      date,
      monthKey,
      merged: mergedFlag,
    });
  }

  return entries;
}

const tokensOf = (name: string) => name.toLowerCase().split(/\s+/).filter(Boolean);

// The punch sheet uses informal names (first names, reversed order, typos)
// while the audit sheet holds canonical names. Match conservatively and
// only accept unique candidates.
export function matchTeacherName(punchName: string, candidates: string[]): string | null {
  const key = normalizeTeacherKey(punchName);
  if (!key) return null;

  const exact = candidates.find((name) => normalizeTeacherKey(name) === key);
  if (exact) return exact;

  const punchTokens = tokensOf(punchName);

  // Shared whole token + any single-letter tokens in the candidate must be
  // initials of the remaining punch tokens ("Maheshwari Dipti" -> "Dipti M").
  const tokenMatches = candidates.filter((name) => {
    const candidateTokens = tokensOf(name);
    const shared = candidateTokens.filter((token) => punchTokens.includes(token));
    if (!shared.length) return false;
    const remainingPunch = punchTokens.filter((token) => !shared.includes(token));
    return candidateTokens
      .filter((token) => !shared.includes(token))
      .every((token) => token.length === 1 && remainingPunch.some((p) => p.startsWith(token)));
  });
  if (tokenMatches.length === 1) return tokenMatches[0];

  // First-token match when unambiguous
  const firstMatches = candidates.filter((name) => tokensOf(name)[0] === punchTokens[0]);
  if (firstMatches.length === 1) return firstMatches[0];

  // Prefix match on the normalized key (covers spelling drift like
  // "Yashaswani" vs "Yashashwini" when one prefixes the other).
  const prefixMatches = candidates.filter((name) => {
    const candidateKey = normalizeTeacherKey(name);
    return (
      key.length >= 6 &&
      candidateKey.length >= 6 &&
      (candidateKey.startsWith(key) || key.startsWith(candidateKey))
    );
  });
  if (prefixMatches.length === 1) return prefixMatches[0];

  return null;
}

export function buildPunchIndex(
  entries: TeacherPunchEntry[],
  canonicalNames: string[]
): Map<string, TeacherPunchEntry[]> {
  const index = new Map<string, TeacherPunchEntry[]>();
  entries.forEach((entry) => {
    const key = matchTeacherName(entry.teacher, canonicalNames) ?? entry.teacher;
    const list = index.get(key) ?? [];
    list.push(entry);
    index.set(key, list);
  });
  return index;
}

function resolveColumnIndices(header: string[]): ColumnIndices {
  const normalizedHeader = header.map(normalizeHeaderName);
  const indices = {} as ColumnIndices;

  for (const key of Object.keys(COLUMN_ALIASES) as Array<keyof ColumnIndices>) {
    const aliasList = COLUMN_ALIASES[key];
    let foundIndex = -1;

    for (const alias of aliasList) {
      const normalizedAlias = normalizeHeaderName(alias);
      let index = normalizedHeader.indexOf(normalizedAlias);
      // Long Google-Form headers (e.g. "Topic Taught: Mention standard...")
      // are matched by prefix when no exact column exists.
      if (index === -1) {
        index = normalizedHeader.findIndex((name) => name.startsWith(normalizedAlias));
      }
      if (index !== -1) {
        foundIndex = index;
        break;
      }
    }

    if (foundIndex === -1) {
      if (REQUIRED_COLUMNS.includes(key)) {
        throw new Error(`Missing required column: ${key}`);
      }
      continue;
    }

    indices[key] = foundIndex;
  }

  for (const required of REQUIRED_COLUMNS) {
    if (typeof indices[required] !== "number") {
      throw new Error(`Missing required column: ${required}`);
    }
  }

  return indices;
}

function normalizeHeaderName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getValue(row: string[], index?: number): string {
  if (index === undefined || index < 0) return "";
  return row[index]?.trim() ?? "";
}

function parseInteger(value: string): number {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseBoolean(value: string): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return ["yes", "y", "true", "1"].includes(normalized);
}

export function extractDateMetadata(value: string): { date?: string; monthKey?: string } {
  if (!value) return {};
  const trimmed = value.trim();
  if (!trimmed) return {};

  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const normalizedMonth = padNumber(month);
    const normalizedDay = padNumber(day);
    return {
      date: `${year}-${normalizedMonth}-${normalizedDay}`,
      monthKey: `${year}-${normalizedMonth}`,
    };
  }

  const flexibleMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (flexibleMatch) {
    const [, part1, part2, yearRaw] = flexibleMatch;
    const fullYear = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw.padStart(4, "0");
    const firstNumber = Number(part1);
    const secondNumber = Number(part2);
    const looksLikeDMY = firstNumber > 12 && secondNumber <= 12;
    const monthValue = looksLikeDMY ? part2 : part1;
    const dayValue = looksLikeDMY ? part1 : part2;
    const normalizedMonth = padNumber(monthValue);
    const normalizedDay = padNumber(dayValue);
    return {
      date: `${fullYear}-${normalizedMonth}-${normalizedDay}`,
      monthKey: `${fullYear}-${normalizedMonth}`,
    };
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return { date: trimmed };
  }

  const year = parsed.getUTCFullYear();
  const month = padNumber(parsed.getUTCMonth() + 1);
  const day = padNumber(parsed.getUTCDate());

  return {
    date: `${year}-${month}-${day}`,
    monthKey: `${year}-${month}`,
  };
}

function padNumber(value: string | number): string {
  return String(value).padStart(2, "0");
}

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = "";
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (currentField || currentRow.length > 0) {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
      }
      // Skip \r\n combinations
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}
