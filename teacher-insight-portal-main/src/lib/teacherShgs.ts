import { matchTeacherName, parseCSV } from "@/lib/teacherPunches";

// "Teacher's SHGs" tab of the punch spreadsheet — the canonical
// SHG → reporting-teacher assignment (46 SHGs).
const SHEET_ID = "18HJF-96eP2fioYvg90guMficXrokek7Zmlchoz_5d_s";
const GID = "2013996491";

export interface ShgAssignment {
  shg: string;
  reportingTeacher: string;
  branch: string;
  region: string;
  state: string;
}

export async function fetchShgAssignments(): Promise<ShgAssignment[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to fetch SHG assignments from Google Sheets");
  }

  const rows = parseCSV(await response.text());
  if (!rows || rows.length <= 1) return [];

  const header = rows[0].map((column) => column?.trim().toLowerCase().replace(/[^a-z0-9]/g, "") ?? "");
  const col = (...aliases: string[]) => header.findIndex((name) => aliases.some((alias) => name.startsWith(alias)));

  const shgCol = col("shgsunderreportingteacher", "shg");
  const teacherCol = col("reportingteacher");
  const branchCol = col("branchname");
  const regionCol = col("region");
  const stateCol = col("states", "state");
  if (shgCol === -1) return [];

  const assignments: ShgAssignment[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const shg = row[shgCol]?.trim() ?? "";
    if (!shg) continue;
    assignments.push({
      shg,
      reportingTeacher: teacherCol >= 0 ? row[teacherCol]?.trim() ?? "" : "",
      branch: branchCol >= 0 ? row[branchCol]?.trim() ?? "" : "",
      region: regionCol >= 0 ? row[regionCol]?.trim() ?? "" : "",
      state: stateCol >= 0 ? row[stateCol]?.trim() ?? "" : "",
    });
  }
  return assignments;
}

/** Canonical SHG names assigned to a teacher (fuzzy-matched reporter names). */
export function shgsForTeacher(
  assignments: ShgAssignment[],
  teacherName: string,
  canonicalNames: string[]
): string[] {
  return assignments
    .filter(
      (assignment) =>
        assignment.reportingTeacher &&
        (matchTeacherName(assignment.reportingTeacher, canonicalNames) ?? assignment.reportingTeacher) ===
          teacherName
    )
    .map((assignment) => assignment.shg);
}
