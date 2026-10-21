import { useMemo, useState } from "react";
import { LinkedText } from "@/components/teacher/LinkedText";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardList } from "lucide-react";
import { centerLabel, centersMatch, matchCenterName, shgAuditNameMatches } from "@/lib/shgCenters";
import type { TeacherPunchEntry } from "@/lib/teacherPunches";

export interface ShgAuditScore {
  shgName?: string;
  score: number;
  monthKey?: string;
}

interface ShgPunchRecordsProps {
  /** Class records at SHGs the teacher reports on (any teacher's classes there). */
  punches: TeacherPunchEntry[];
  /** Class records at SHGs the teacher only visited for feedback. */
  reviewedPunches?: TeacherPunchEntry[];
  /** Audit rows with SHG names — powers the Quality Avg stat. */
  audits?: ShgAuditScore[];
  /** Canonical SHG names from the "Teacher's SHGs" sheet — grouping and labels follow it. */
  centers?: string[];
  /** Controlled month filter from the dashboard selector. */
  month?: string;
}

interface ShgCluster {
  key: string;
  label: string;
  canonical: string | null;
  names: string[];
  entries: TeacherPunchEntry[];
  reviewedOnly: boolean;
  qualityAvg: number | null;
  lastClassAt: number;
}

const parseWhen = (entry: TeacherPunchEntry): number => {
  const parsed = entry.timestamp ? new Date(entry.timestamp) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) return parsed.getTime();
  const dated = entry.date ? new Date(`${entry.date}T00:00:00`) : null;
  return dated && !Number.isNaN(dated.getTime()) ? dated.getTime() : 0;
};

const formatWhen = (entry: TeacherPunchEntry): string => {
  const parsed = entry.timestamp ? new Date(entry.timestamp) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  }
  return entry.date ?? "—";
};

const qualityTone = (quality: number | null) =>
  quality === null
    ? "text-slate-400"
    : quality >= 90
      ? "text-emerald-700"
      : quality >= 75
        ? "text-blue-700"
        : quality >= 60
          ? "text-amber-700"
          : "text-rose-700";

const StatTile = ({
  label,
  value,
  tone,
  valueClass,
}: {
  label: string;
  value: string;
  tone: string;
  valueClass?: string;
}) => (
  <div className={`rounded-2xl border p-4 text-center shadow-sm ${tone}`}>
    <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
    <p className={`mt-1 font-bold ${valueClass ?? "text-2xl"}`}>{value}</p>
  </div>
);

export const ShgPunchRecords = ({ punches, reviewedPunches = [], audits = [], centers = [], month = "all" }: ShgPunchRecordsProps) => {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const scopedPunches = useMemo(
    () => (month === "all" ? punches : punches.filter((entry) => entry.monthKey === month)),
    [punches, month]
  );
  const scopedReviewed = useMemo(
    () => (month === "all" ? reviewedPunches : reviewedPunches.filter((entry) => entry.monthKey === month)),
    [reviewedPunches, month]
  );
  const scopedAudits = useMemo(
    () => (month === "all" ? audits : audits.filter((entry) => entry.monthKey === month)),
    [audits, month]
  );

  const clusters = useMemo(() => {
    const groups: ShgCluster[] = [];
    const place = (entry: TeacherPunchEntry, reviewedOnly: boolean) => {
      const rawName = entry.center;
      if (!rawName) return;
      const canonicalName = matchCenterName(rawName, centers);
      let group = canonicalName
        ? groups.find((g) => g.canonical === canonicalName)
        : groups.find((g) => !g.canonical && g.names.some((name) => centersMatch(name, rawName)));
      if (!group) {
        group = {
          key: canonicalName ?? `shg-${groups.length}`,
          canonical: canonicalName,
          label: centerLabel(canonicalName ?? rawName),
          names: [],
          entries: [],
          reviewedOnly,
          qualityAvg: null,
          lastClassAt: 0,
        };
        groups.push(group);
      }
      if (!group.names.includes(rawName)) group.names.push(rawName);
      group.entries.push(entry);
      if (!reviewedOnly) group.reviewedOnly = false;
      const when = parseWhen(entry);
      if (when > group.lastClassAt) group.lastClassAt = when;
    };
    scopedPunches.forEach((entry) => place(entry, false));
    scopedReviewed.forEach((entry) => place(entry, true));

    // Quality Avg joins each cluster to audit-sheet SHG names, preferring the
    // canonical audit spelling ("SHG TC TIKAMGARH BIRDHA(23:21:02)") as label.
    const auditNames = [...new Set(scopedAudits.map((a) => a.shgName).filter((n): n is string => Boolean(n)))];
    groups.forEach((group) => {
      const matched = auditNames.filter((name) =>
        group.names.some((raw) => shgAuditNameMatches(raw, name))
      );
      const scores = scopedAudits
        .filter((a) => a.shgName && matched.includes(a.shgName))
        .map((a) => a.score);
      group.qualityAvg = scores.length
        ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10
        : null;
      if (matched.length && !group.canonical) group.label = matched[0];
    });

    return groups.sort((a, b) => b.lastClassAt - a.lastClassAt);
  }, [scopedPunches, scopedReviewed, scopedAudits, centers]);

  const active = clusters.find((cluster) => cluster.key === selectedKey) ?? clusters[0] ?? null;

  const activeStats = useMemo(() => {
    if (!active) return null;
    const unique = active.entries.filter((entry) => !entry.duplicate);
    const totalStudents = unique.reduce((sum, entry) => sum + entry.students, 0);
    return {
      classes: unique.length,
      totalStudents,
      avgStudents: unique.length ? Math.round((totalStudents / unique.length) * 10) / 10 : 0,
      subjects: new Set(unique.map((entry) => entry.subject.trim().toLowerCase()).filter(Boolean)).size,
    };
  }, [active]);

  const rows = useMemo(
    () => (active ? [...active.entries].sort((a, b) => parseWhen(b) - parseWhen(a)) : []),
    [active]
  );

  if (!clusters.length) return null;

  return (
    <Card className="border-none bg-gradient-to-br from-white via-sky-50 to-emerald-50 shadow-lg">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <ClipboardList className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.3em]">SHG records</span>
            </div>
            <CardTitle className="text-xl font-semibold text-slate-900">Punch-in Records per SHG</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Attendance records submitted through the punch-in form for the selected center, newest
              first. Teacher names are hidden.
            </p>
          </div>
          <Select value={active?.key ?? ""} onValueChange={setSelectedKey}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue placeholder="Select SHG center" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {clusters.map((cluster) => (
                <SelectItem key={cluster.key} value={cluster.key}>
                  {cluster.label}
                  {cluster.reviewedOnly ? " (reviewed)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {active && activeStats && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatTile
                label="Classes"
                value={String(activeStats.classes)}
                tone="border-emerald-200 bg-emerald-50/80 text-emerald-800"
              />
              <StatTile
                label="Students / Class"
                value={String(activeStats.avgStudents)}
                tone="border-blue-200 bg-blue-50/80 text-blue-800"
              />
              <StatTile
                label="Total Students"
                value={activeStats.totalStudents.toLocaleString()}
                tone="border-indigo-200 bg-indigo-50/80 text-indigo-800"
              />
              <StatTile
                label="Subjects"
                value={String(activeStats.subjects)}
                tone="border-purple-200 bg-purple-50/80 text-purple-800"
              />
              <StatTile
                label="Quality Avg"
                value={active.qualityAvg === null ? "—" : String(active.qualityAvg)}
                tone="border-amber-200 bg-amber-50/80 text-amber-800"
                valueClass={`text-2xl ${qualityTone(active.qualityAvg)}`}
              />
              <StatTile
                label="Last Class"
                value={
                  active.lastClassAt
                    ? new Date(active.lastClassAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "2-digit",
                        year: "numeric",
                      })
                    : "—"
                }
                tone="border-slate-200 bg-slate-50/80 text-slate-700"
                valueClass="pt-1 text-base"
              />
            </div>

            <div className="max-h-[420px] overflow-auto rounded-xl border border-white/60">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_hsl(var(--border))]">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Topic</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Sub-topic</TableHead>
                    <TableHead className="text-right">Students</TableHead>
                    <TableHead>Merged</TableHead>
                    <TableHead>Week</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((entry, index) => (
                    <TableRow
                      key={`${entry.timestamp ?? entry.date}-${entry.subject}-${index}`}
                      className={entry.duplicate ? "bg-amber-50/70" : undefined}
                    >
                      <TableCell className="whitespace-nowrap text-slate-700">
                        {formatWhen(entry)}
                        {entry.duplicate && (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                            duplicate
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.subject ? <Badge variant="secondary">{entry.subject}</Badge> : "—"}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate" title={entry.topic}>
                        {entry.topic || "—"}
                      </TableCell>
                      <TableCell className="min-w-[180px] max-w-[300px] whitespace-pre-wrap break-words"><LinkedText text={entry.material} /></TableCell>
                      <TableCell className="max-w-[220px] truncate text-slate-600" title={entry.subTopic}>
                        {entry.subTopic || "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">{entry.students}</TableCell>
                      <TableCell>
                        {entry.merged ? (
                          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                            Yes{entry.mergedWith ? `: ${entry.mergedWith}` : ""}
                          </Badge>
                        ) : (
                          "No"
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-slate-600">{entry.week || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
