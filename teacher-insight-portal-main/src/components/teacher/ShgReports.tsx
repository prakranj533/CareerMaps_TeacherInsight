import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, ClipboardList, MessageSquareQuote, Users } from "lucide-react";
import { centerLabel, centersMatch, matchCenterName } from "@/lib/shgCenters";
import type { TeacherPunchEntry } from "@/lib/teacherPunches";
import { countReviewActivities, type TeacherReviewEntry } from "@/lib/teacherReviews";

interface ShgReportsProps {
  /** All class records at SHGs this teacher reports punches for (any reporter). */
  punches: TeacherPunchEntry[];
  /** All field-review visits at those same SHGs. */
  reviews: TeacherReviewEntry[];
  /** Class records at SHGs the teacher only visited for feedback. */
  reviewedPunches?: TeacherPunchEntry[];
  /** Field-review visits at those feedback-only SHGs. */
  reviewedReviews?: TeacherReviewEntry[];
  /** Canonical SHG names from the "Teacher's SHGs" sheet — grouping and labels follow it. */
  centers?: string[];
  /** Controlled month filter from the dashboard selector. */
  month?: string;
}

interface ShgBucket {
  label: string;
  canonical?: string;
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

const cluster = (punches: TeacherPunchEntry[], reviews: TeacherReviewEntry[], canonical: string[] = []): ShgBucket[] => {
  const groups: ShgBucket[] = [];
  const place = (rawName: string, kind: "punch" | "review", entry: TeacherPunchEntry | TeacherReviewEntry) => {
    if (!rawName) return;
    const canonicalName = matchCenterName(rawName, canonical);
    let group = canonicalName
      ? groups.find((g) => g.canonical === canonicalName)
      : groups.find((g) => !g.canonical && g.names.some((name) => centersMatch(name, rawName)));
    if (!group) {
      group = {
        label: centerLabel(canonicalName ?? rawName),
        canonical: canonicalName ?? undefined,
        names: [],
        punches: [],
        reviews: [],
      };
      groups.push(group);
    }
    if (!group.names.includes(rawName)) group.names.push(rawName);
    (kind === "punch" ? group.punches : group.reviews).push(entry as never);
  };
  punches.forEach((entry) => place(entry.center, "punch", entry));
  reviews.forEach((entry) => place(entry.shg, "review", entry));
  return groups.sort(
    (a, b) => b.punches.length + b.reviews.length - (a.punches.length + a.reviews.length)
  );
};

const BucketCard = ({ bucket }: { bucket: ShgBucket }) => {
  const students = bucket.punches.reduce((sum, entry) => sum + entry.students, 0);
  const teachers = new Set(bucket.punches.map((entry) => entry.teacher).filter(Boolean));
  const { feedbacks, counsellings, ptms } = countReviewActivities(bucket.reviews);
  const latestReview = [...bucket.reviews].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0];
  const latestClass = [...bucket.punches].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0];

  return (
    <div className="space-y-3 rounded-2xl border border-white/80 bg-white/80 p-4 text-sm shadow-sm">
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
};

export const ShgReports = ({
  punches,
  reviews,
  reviewedPunches = [],
  reviewedReviews = [],
  centers = [],
  month = "all",
}: ShgReportsProps) => {
  const scopedPunches = useMemo(
    () =>
      (month === "all" ? punches : punches.filter((entry) => entry.monthKey === month)).filter(
        (entry) => !entry.duplicate
      ),
    [punches, month]
  );
  const scopedReviews = useMemo(
    () => (month === "all" ? reviews : reviews.filter((entry) => entry.monthKey === month)),
    [reviews, month]
  );
  const scopedReviewedPunches = useMemo(
    () =>
      (month === "all" ? reviewedPunches : reviewedPunches.filter((entry) => entry.monthKey === month)).filter(
        (entry) => !entry.duplicate
      ),
    [reviewedPunches, month]
  );
  const scopedReviewedReviews = useMemo(
    () => (month === "all" ? reviewedReviews : reviewedReviews.filter((entry) => entry.monthKey === month)),
    [reviewedReviews, month]
  );

  const buckets = useMemo(
    () => cluster(scopedPunches, scopedReviews, centers),
    [scopedPunches, scopedReviews, centers]
  );
  const feedbackBuckets = useMemo(
    () => cluster(scopedReviewedPunches, scopedReviewedReviews, centers),
    [scopedReviewedPunches, scopedReviewedReviews, centers]
  );

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

  if (!punches.length && !reviews.length && !reviewedPunches.length && !reviewedReviews.length) return null;

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
          {buckets.map((bucket) => (
            <BucketCard key={bucket.label} bucket={bucket} />
          ))}
        </div>

        {feedbackBuckets.length > 0 && (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                SHGs you've reviewed — {feedbackBuckets.length}
              </p>
              <p className="text-xs text-muted-foreground">
                Centers where you've logged feedback visits but don't report classes.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {feedbackBuckets.map((bucket) => (
                <BucketCard key={bucket.label} bucket={bucket} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
