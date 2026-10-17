import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageSquareQuote, MapPin, Users } from "lucide-react";
import { punchMonthLabel } from "@/components/teacher/PunchAnalytics";
import { countReviewActivities, type TeacherReviewEntry } from "@/lib/teacherReviews";

interface TeacherReviewsProps {
  entries: TeacherReviewEntry[];
  title: string;
  description?: string;
  /** When provided, renders a per-teacher summary table (admin view). */
  breakdown?: Map<string, TeacherReviewEntry[]>;
  /** Controlled month filter — when set, the built-in selector is hidden. */
  month?: string;
}

const StatChip = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
  </div>
);

export const TeacherReviews = ({ entries, title, description, breakdown, month }: TeacherReviewsProps) => {
  const [internalMonth, setInternalMonth] = useState<string | null>(null);
  const isControlled = month !== undefined;

  const months = useMemo(
    () =>
      Array.from(
        new Set(entries.map((entry) => entry.monthKey).filter((key): key is string => Boolean(key)))
      ).sort((a, b) => b.localeCompare(a)),
    [entries]
  );

  const activeMonth = isControlled ? month : internalMonth ?? "all";

  const filtered = useMemo(
    () => (activeMonth === "all" ? entries : entries.filter((entry) => entry.monthKey === activeMonth)),
    [entries, activeMonth]
  );

  const stats = useMemo(() => {
    const { feedbacks, counsellings, ptms } = countReviewActivities(filtered);
    return {
      feedbacks,
      counsellings,
      ptms,
      centers: new Set(filtered.map((entry) => entry.center || entry.shg).filter(Boolean)).size,
    };
  }, [filtered]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
    [filtered]
  );

  const teacherRows = useMemo(() => {
    if (!breakdown) return [];
    return Array.from(breakdown.entries())
      .map(([name, list]) => {
        const scoped = activeMonth === "all" ? list : list.filter((entry) => entry.monthKey === activeMonth);
        const { feedbacks, counsellings, ptms } = countReviewActivities(scoped);
        return {
          name,
          reviews: scoped.length,
          feedbacks,
          counsellings,
          ptms,
          lastDate: scoped.reduce((latest, entry) => ((entry.date ?? "") > latest ? entry.date ?? "" : latest), ""),
        };
      })
      .sort((a, b) => b.reviews - a.reviews);
  }, [breakdown, activeMonth]);

  if (!entries.length) {
    return (
      <Card className="border-none bg-white/90 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-slate-900">{title}</CardTitle>
          <p className="text-sm text-muted-foreground">No reviews recorded yet.</p>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-none bg-gradient-to-br from-white via-sky-50 to-emerald-50 shadow-lg">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <MessageSquareQuote className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.3em]">Field reviews</span>
            </div>
            <CardTitle className="text-xl font-semibold text-slate-900">{title}</CardTitle>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {!isControlled && months.length > 0 && (
            <Select value={activeMonth} onValueChange={setInternalMonth}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {months.map((key) => (
                  <SelectItem key={key} value={key}>
                    {punchMonthLabel(key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatChip label="Feedbacks" value={String(stats.feedbacks)} />
          <StatChip label="Counselling sessions" value={String(stats.counsellings)} />
          <StatChip label="PTMs done" value={String(stats.ptms)} />
          <StatChip label="Centers visited" value={String(stats.centers)} />
        </div>

        {sorted.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            {sorted.slice(0, 10).map((entry, index) => (
              <div
                key={`${entry.date}-${entry.shg}-${index}`}
                className="space-y-2 rounded-2xl border border-white/80 bg-white/80 p-4 text-sm shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-primary">
                    <MapPin className="h-3.5 w-3.5" />
                    {entry.center || entry.shg || "Center"}
                    {entry.district ? `, ${entry.district}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {entry.date ?? "—"} · {entry.subject}
                  </span>
                </div>
                {entry.feedback && <p className="leading-relaxed text-slate-800">{entry.feedback}</p>}
                {entry.improvement && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-slate-600">Improve: </span>
                    {entry.improvement}
                  </p>
                )}
                {entry.assetFeedback && entry.assetFeedback.toLowerCase() !== "no issue" && (
                  <p className="text-xs leading-relaxed text-amber-700">
                    <span className="font-semibold">Assets: </span>
                    {entry.assetFeedback}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Reviewer: {entry.reviewer || "—"}
                  {entry.ptm ? ` · PTM: ${entry.ptm}` : ""}
                  {entry.activityType ? ` · ${entry.activityType}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}

        {teacherRows.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Users className="h-4 w-4" /> Per teacher
            </p>
            <div className="overflow-x-auto rounded-xl border border-white/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Teacher</TableHead>
                    <TableHead className="text-right">Feedbacks</TableHead>
                    <TableHead className="text-right">Counselling</TableHead>
                    <TableHead className="text-right">PTMs</TableHead>
                    <TableHead className="text-right">Last review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teacherRows.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-right">{row.feedbacks}</TableCell>
                      <TableCell className="text-right">{row.counsellings}</TableCell>
                      <TableCell className="text-right">{row.ptms}</TableCell>
                      <TableCell className="text-right">{row.lastDate || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
