import { extractDateMetadata, parseCSV, matchTeacherName } from "@/lib/teacherPunches";

const SHEET_ID = "1HhzXLzwHhN3tp3hn8AqVir8M8C6_F9l792-XFEwuLaU";
const GID = "584149272";

type ColumnIndices = {
  timestamp: number;
  reviewer: number;
  teacher: number;
  shg: number;
  subject?: number;
  feedback?: number;
  improvement?: number;
  assetFeedback?: number;
  ptm?: number;
  activityType?: number;
};

const COLUMN_ALIASES: Record<keyof ColumnIndices, string[]> = {
  timestamp: ["timestamp"],
  reviewer: ["yourname", "reviewer"],
  teacher: ["reviewaboutwhichteacher", "teacher"],
  shg: ["shgname", "center", "classname"],
  subject: ["subject"],
  feedback: ["detailfeedbackaboutteacher", "feedback"],
  improvement: ["howclassescanbeimproved", "improvement"],
  assetFeedback: ["assetmiccamlight", "assetfeedback"],
  ptm: ["careermapsawarenessptmhappened", "ptm"],
  activityType: [
    "whichoneoftheseareyouperforming",
    "areyoudoingcareercounsellingorfeedback",
    "activitytype",
  ],
};

const REQUIRED_COLUMNS: Array<keyof ColumnIndices> = ["timestamp", "teacher", "shg"];

export interface TeacherReviewEntry {
  teacher: string;
  reviewer: string;
  shg: string;
  center: string;
  district: string;
  subject: string;
  feedback: string;
  improvement: string;
  assetFeedback: string;
  ptm: string;
  activityType: string;
  date?: string;
  monthKey?: string;
}

// SHG Name arrives as "time / village / center / district / state".
const parseShg = (raw: string) => {
  const parts = raw.split("/").map((part) => part.trim()).filter(Boolean);
  return {
    center: parts[1] ?? "",
    district: parts[2] ?? "",
  };
};

export async function fetchTeacherReviewData(): Promise<TeacherReviewEntry[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to fetch review data from Google Sheets");
  }

  const rows = parseCSV(await response.text());
  if (!rows || rows.length <= 1) {
    return [];
  }

  const columnIndices = resolveColumnIndices(rows[0].map((column) => column?.trim() ?? ""));
  const entries: TeacherReviewEntry[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const activityType = getValue(row, columnIndices.activityType);
    // Counselling visits leave "Review about which teacher?" blank — the
    // reviewer is the reporting teacher running the session at their own SHG.
    const isCounsellingRow = activityType.toLowerCase().includes("counselling");
    const teacher = getValue(row, columnIndices.teacher) || (isCounsellingRow ? getValue(row, columnIndices.reviewer) : "");
    if (!teacher) continue;

    const shg = getValue(row, columnIndices.shg);
    const { date, monthKey } = extractDateMetadata(getValue(row, columnIndices.timestamp));
    const { center, district } = parseShg(shg);

    entries.push({
      teacher,
      reviewer: getValue(row, columnIndices.reviewer),
      shg,
      center,
      district,
      subject: getValue(row, columnIndices.subject) || "Unspecified",
      feedback: getValue(row, columnIndices.feedback),
      improvement: getValue(row, columnIndices.improvement),
      assetFeedback: getValue(row, columnIndices.assetFeedback),
      ptm: getValue(row, columnIndices.ptm),
      activityType,
      date,
      monthKey,
    });
  }

  return entries;
}

export function buildReviewIndex(
  entries: TeacherReviewEntry[],
  canonicalNames: string[]
): Map<string, TeacherReviewEntry[]> {
  const index = new Map<string, TeacherReviewEntry[]>();
  entries.forEach((entry) => {
    const key = matchTeacherName(entry.teacher, canonicalNames) ?? entry.teacher;
    const list = index.get(key) ?? [];
    list.push(entry);
    index.set(key, list);
  });
  return index;
}

/** Pay per review activity (feedback visit, counselling session, or PTM held). */
export const REVIEW_ACTIVITY_RATE = 50;

export const isPtmDone = (entry: TeacherReviewEntry) =>
  entry.ptm.trim().toLowerCase() === "yes";

export const isCounselling = (entry: TeacherReviewEntry) =>
  entry.activityType.toLowerCase().includes("counselling");

// Every logged visit counts as one feedback or one counselling session;
// a PTM held during the visit counts on top.
export const countReviewActivities = (entries: TeacherReviewEntry[]) => ({
  feedbacks: entries.filter((entry) => !isCounselling(entry)).length,
  counsellings: entries.filter(isCounselling).length,
  ptms: entries.filter(isPtmDone).length,
});

export const reviewActivityPay = (entries: TeacherReviewEntry[]) => {
  const { feedbacks, counsellings, ptms } = countReviewActivities(entries);
  return (feedbacks + counsellings + ptms) * REVIEW_ACTIVITY_RATE;
};

/** Same shape as buildReviewIndex but keyed by the reviewer (who did the visit). */
export function buildReviewerIndex(
  entries: TeacherReviewEntry[],
  canonicalNames: string[]
): Map<string, TeacherReviewEntry[]> {
  const index = new Map<string, TeacherReviewEntry[]>();
  entries.forEach((entry) => {
    if (!entry.reviewer) return;
    const key = matchTeacherName(entry.reviewer, canonicalNames) ?? entry.reviewer;
    const list = index.get(key) ?? [];
    list.push(entry);
    index.set(key, list);
  });
  return index;
}

function resolveColumnIndices(header: string[]): ColumnIndices {
  const normalizedHeader = header.map((name) => name.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const indices = {} as ColumnIndices;

  for (const key of Object.keys(COLUMN_ALIASES) as Array<keyof ColumnIndices>) {
    let foundIndex = -1;
    for (const alias of COLUMN_ALIASES[key]) {
      let index = normalizedHeader.indexOf(alias);
      if (index === -1) {
        index = normalizedHeader.findIndex((name) => name.startsWith(alias));
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

function getValue(row: string[], index?: number): string {
  if (index === undefined || index < 0) return "";
  return row[index]?.trim() ?? "";
}
