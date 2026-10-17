import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, ClipboardList, MessageSquareQuote, Users } from "lucide-react";
import { centerLabel, centersMatch } from "@/lib/shgCenters";
import type { TeacherPunchEntry } from "@/lib/teacherPunches";
import { countReviewActivities, type TeacherReviewEntry } from "@/lib/teacherReviews";

interface ShgReportsProps {
  /** All class records at this teacher's SHGs (any reporting teacher). */
  punches: TeacherPunchEntry[];
  /** All field-review visits at this teacher's SHGs. */
  reviews: TeacherReviewEntry[];
  /** Controlled month filter from the dashboard selector. */
  month?: string;
}

interface ShgBucket {
  label: string;
  names: string[];
  punches: TeacherPunchEntry[];
  reviews: TeacherReviewEntry[];
}

const StatChip = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
  </div>
);

export const ShgReports = ({ punches, reviews, month = "all" }: ShgReportsProps) => {
  const scopedPunches = useMemo(
    () => (month === "all" ? punches : punches.filter((entry) => entry.monthKey === month)),
    [punches, month]
  );
  const scopedReviews = useMemo(
    () => (month === "all" ? reviews : reviews.filter((entry) => entry.monthKey === month)),
    [reviews, month]
  );

  const buckets = useMemo(() => {
    const groups: ShgBucket[] = [];
    const place = (rawName: string, kind: "punch" | "review", entry: TeacherPunchEntry | TeacherReviewEntry) => {
      if (!rawName) return;
      let group = groups.find((g) => g.names.some((name) => centersMatch(name, rawName)));
      if (!group) {
        group = { label: centerLabel(rawName), names: [], punches: [], reviews: [] };
        groups.push(group);
      }
      if (!group.names.includes(rawName)) group.names.push(rawName);
      (kind === "punch" ? group.punches : group.reviews).push(entry as never);
    };
    scopedPunches.forEach((entry) => place(entry.center, "punch", entry));
    scopedReviews.forEach((entry) => place(entry.shg, "review", entry));
    return groups.sort(
      (a, b) => b.punches.length + b.reviews.length - (a.punches.length + a.reviews.length)
    );
  }, [scopedPunches, scopedReviews]);

  const totals = useMemo(() => {
    const students = scopedPunches.reduce((sum, entry) => sum + entry.students, 0);
    const { feedbacks, counsellings, ptms } = countReviewActivities(scopedReviews);
    return {
      shgs: buckets.length,
      classes: scopedPunches.length,
      students,
      avgStudents: scopedPunches.length ? Math.round(students / scopedPunches.length) : 0,
      feedbacks,
      counsellings,
      ptms,
    };
  }, [buckets, scopedPunches, scopedReviews]);

  if (!punches.length && !reviews.length) return null;

  return (
    <Card className="border-none bg-gradient-to-br from-white via-sky-50 to-emerald-50 shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-2 text-primary">
          <Building2 className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-[0.3em]">SHG reports</span>
        </div>
        <CardTitle className="text-xl font-semibold text-slate-900">Your SHGs</CardTitle>
        <p className="text-sm text-muted-foreground">
          Everything logged at the centers you report on — classes, students and field reviews.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatChip label="SHGs covered" value={String(totals.shgs)} />
          <StatChip label="Classes at your SHGs" value={String(totals.classes)} />
          <StatChip label="Avg students / class" value={String(totals.avgStudents)} />
          <StatChip label="Review visits" value={String(totals.feedbacks + totals.counsellings)} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {buckets.map((bucket) => {
            const students = bucket.punches.reduce((sum, entry) => sum + entry.students, 0);
            const teachers = new Set(bucket.punches.map((entry) => entry.teacher).filter(Boolean));
            const { feedbacks, counsellings, ptms } = countReviewActivities(bucket.reviews);
            const latestReview = [...bucket.reviews].sort((a, b) =>
              (b.date ?? "").localeCompare(a.date ?? "")
            )[0];
            const latestClass = [...bucket.punches].sort((a, b) =>
              (b.date ?? "").localeCompare(a.date ?? "")
            )[0];

            return (
              <div
                key={bucket.label}
                className="space-y-3 rounded-2xl border border-white/80 bg-white/80 p-4 text-sm shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-900">
                    <Building2 className="h-4 w-4 text-primary" />
                    {bucket.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Last activity {latestReview?.date ?? latestClass?.date ?? "—"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ClipboardList className="h-3.5 w-3.5" />
                    {bucket.punches.length} classes · {students} students
                    {bucket.punches.length ? ` (avg ${Math.round(students / bucket.punches.length)})` : ""}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {teachers.size} teacher{teachers.size === 1 ? "" : "s"}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquareQuote className="h-3.5 w-3.5" />
                    {feedbacks} feedback · {counsellings} counselling · {ptms} PTM
                  </span>
                </div>

                {teachers.size > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Teachers: {[...teachers].slice(0, 6).join(", ")}
                    {teachers.size > 6 ? ` +${teachers.size - 6} more` : ""}
                  </p>
                )}

                {latestReview?.feedback && (
                  <p className="border-l-2 border-primary/30 pl-3 text-xs leading-relaxed text-slate-700">
                    {latestReview.feedback}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
