import { TeacherData } from "@/pages/TeacherPortal";

const SHEET_ID = "1Oyz0XkemLeHjUQOBW1KrSKYTlhyvRfjXc3jNp9eZoSM";

type ColumnIndices = {
  teacher: number;
  subject: number;
  finalScore: number;
  engagement: number;
  classIssues: number;
  instructorIssues: number;
  contentStructure: number;
  platformUsage: number;
  sessionDate?: number;
};

const COLUMN_ALIASES: Record<keyof ColumnIndices, string[]> = {
  teacher: ["teacher", "teachers"],
  subject: ["subject", "subjects", "subjectname", "subjectfromai"],
  finalScore: ["finalscore100", "finalscore", "overallscore"],
  engagement: ["engagement20", "engagementscore", "engagement"],
  classIssues: ["classissues20", "classissues"],
  instructorIssues: ["instructorissues20", "instructorissues", "teacherissues"],
  contentStructure: ["contentstructure20", "contentstructure"],
  platformUsage: ["platformtoolusage20", "platformtoolusage", "platformusage"],
  sessionDate: ["datecreated", "sessiondate", "date", "classdate"],
};

const REQUIRED_COLUMNS: Array<keyof ColumnIndices> = [
  "teacher",
  "subject",
  "finalScore",
];

export async function fetchGoogleSheetData(): Promise<TeacherData[]> {
  try {
    // Using CSV export - no API key needed!
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error("Failed to fetch data from Google Sheets");
    }

function resolveColumnIndices(header: string[]): ColumnIndices {
  const normalizedHeader = header.map(normalizeHeaderName);
  const indices = {} as ColumnIndices;
  
  for (const key of Object.keys(COLUMN_ALIASES) as Array<keyof ColumnIndices>) {
    const aliasList = COLUMN_ALIASES[key];
    let foundIndex = -1;
    for (const alias of aliasList) {
      const normalizedAlias = normalizeHeaderName(alias);
      const index = normalizedHeader.indexOf(normalizedAlias);
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

function parseNumericValue(row: string[], index?: number): number {
  const value = parseFloat(getValue(row, index));
  return Number.isFinite(value) ? value : 0;
}

function sanitizeSubject(subject: string): string {
  if (!subject) return "Unspecified";
  const firstLine = subject.split(/\r?\n/)[0]?.trim() ?? "";
  if (!firstLine) return "Unspecified";
  const cleaned = firstLine.replace(/Scores?:.*$/i, "").trim();
  return cleaned || "Unspecified";
}

type DateMetadata = {
  date?: string;
  monthKey?: string;
};

function extractDateMetadata(value: string): DateMetadata {
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

  const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (dmyMatch) {
    const [, day, month, yearRaw] = dmyMatch;
    const fullYear = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw.padStart(4, "0");
    const normalizedMonth = padNumber(month);
    const normalizedDay = padNumber(day);
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
    
    const csvText = await response.text();
    const rows = parseCSV(csvText);
    
    if (!rows || rows.length <= 1) {
      return [];
    }
    
    const header = rows[0].map((column) => column?.trim() ?? "");
    const columnIndices = resolveColumnIndices(header);

    const teacherMap = new Map<string, any>();
    
    // Process each row (skip header at index 0)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      // Column values based on resolved sheet structure
      const teacherName = getValue(row, columnIndices.teacher);
      const subject = getValue(row, columnIndices.subject);
      const resolvedSubject = sanitizeSubject(subject);
      const resolvedTeacherName = teacherName || `Unassigned - ${resolvedSubject}`;
      const finalScore = parseNumericValue(row, columnIndices.finalScore);
      const engagement = parseNumericValue(row, columnIndices.engagement);
      const classIssues = parseNumericValue(row, columnIndices.classIssues);
      const instructorIssues = parseNumericValue(row, columnIndices.instructorIssues);
      const contentStructure = parseNumericValue(row, columnIndices.contentStructure);
      const platformUsage = parseNumericValue(row, columnIndices.platformUsage);
      const { date, monthKey } = extractDateMetadata(getValue(row, columnIndices.sessionDate));
      
      if (!teacherMap.has(resolvedTeacherName)) {
        teacherMap.set(resolvedTeacherName, {
          name: resolvedTeacherName,
          subject: resolvedSubject,
          classes: 0,
          sessions: [],
          totalScore: 0,
          totalEngagement: 0,
          totalClassIssues: 0,
          totalInstructorIssues: 0,
          totalContentStructure: 0,
          totalPlatformUsage: 0,
          hasAssignedTeacher: Boolean(teacherName),
        });
      }
      
      const teacher = teacherMap.get(resolvedTeacherName);
      teacher.classes++;
      teacher.sessions.push({
        score: finalScore,
        engagement,
        classIssues,
        instructorIssues,
        contentStructure,
        platformUsage,
        date,
        monthKey,
      });
      teacher.totalScore += finalScore;
      teacher.totalEngagement += engagement;
      teacher.totalClassIssues += classIssues;
      teacher.totalInstructorIssues += instructorIssues;
      teacher.totalContentStructure += contentStructure;
      teacher.totalPlatformUsage += platformUsage;
    }
    
    // Calculate averages and format data
    const teachers: TeacherData[] = Array.from(teacherMap.values()).map((teacher) => {
      const sessionCount = teacher.classes;
      return {
        name: teacher.hasAssignedTeacher ? teacher.name : `${teacher.name} (Auto)` ,
        subject: teacher.subject,
        classes: teacher.classes,
        avgScore: sessionCount > 0 ? Math.round(teacher.totalScore / sessionCount) : 0,
        avgEngagement: sessionCount > 0 ? Math.round((teacher.totalEngagement / sessionCount) * 5) : 0, // Convert to percentage
        avgClassIssues: sessionCount > 0 ? Math.round((teacher.totalClassIssues / sessionCount) * 5) : 0,
        avgInstructorPerformance: sessionCount > 0 ? Math.round((teacher.totalInstructorIssues / sessionCount) * 5) : 0,
        avgContentStructure: sessionCount > 0 ? Math.round((teacher.totalContentStructure / sessionCount) * 5) : 0,
        avgPlatformUsage: sessionCount > 0 ? Math.round((teacher.totalPlatformUsage / sessionCount) * 5) : 0,
        sessions: teacher.sessions,
        hasAssignedTeacher: teacher.hasAssignedTeacher,
      };
    });
    
    return teachers;
  } catch (error) {
    console.error("Error fetching Google Sheet data:", error);
    throw error;
  }
}

// Simple CSV parser
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
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
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (currentField || currentRow.length > 0) {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      }
      // Skip \r\n combinations
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
    } else {
      currentField += char;
    }
  }
  
  // Add last field and row if exists
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }
  
  return rows;
}
