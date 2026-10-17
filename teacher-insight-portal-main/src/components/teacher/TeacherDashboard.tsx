import { useMemo, useState } from "react";
import { TeacherData, TeacherRule } from "@/pages/TeacherPortal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { ArrowLeft, BookOpen, ClipboardCheck, ClipboardList, LogOut, Trophy, Users } from "lucide-react";
import type { TeacherPunchEntry } from "@/lib/teacherPunches";
import type { TeacherReviewEntry } from "@/lib/teacherReviews";
import { PunchAnalytics } from "@/components/teacher/PunchAnalytics";
import { TeacherReviews } from "@/components/teacher/TeacherReviews";
import { ShgReports } from "@/components/teacher/ShgReports";

interface TeacherDashboardProps {
  teacher: TeacherData;
  cohort: TeacherData[];
  rules: TeacherRule[];
  punches: TeacherPunchEntry[];
  reviews: TeacherReviewEntry[];
  shgPunches: TeacherPunchEntry[];
  shgReviews: TeacherReviewEntry[];
  shgReviewedPunches: TeacherPunchEntry[];
  shgReviewedReviews: TeacherReviewEntry[];
  email: string;
  onSignOut: () => void;
  onBack: () => void;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split("-");
  return `${MONTH_NAMES[Number(month) - 1] ?? month} ${year}`;
};

// Recomputes per-teacher aggregates when scoping to a single month,
// mirroring the averages used across the portal.
const scopeTeacherToMonth = (teacher: TeacherData, monthKey: string): TeacherData => {
  if (monthKey === "all") return teacher;
  const sessions = teacher.sessions.filter((session) => session.monthKey === monthKey);
  if (!sessions.length) {
    return {
      ...teacher,
      classes: 0,
      avgScore: 0,
      avgEngagement: 0,
      avgClassIssues: 0,
      avgInstructorPerformance: 0,
      avgContentStructure: 0,
      avgPlatformUsage: 0,
      sessions: [],
    };
  }

  const totals = sessions.reduce(
    (acc, session) => ({
      score: acc.score + (session.score || 0),
      engagement: acc.engagement + (session.engagement || 0),
      classIssues: acc.classIssues + (session.classIssues || 0),
      instructor: acc.instructor + (session.instructorIssues || 0),
      content: acc.content + (session.contentStructure || 0),
      platform: acc.platform + (session.platformUsage || 0),
    }),
    { score: 0, engagement: 0, classIssues: 0, instructor: 0, content: 0, platform: 0 }
  );

  const n = sessions.length;
  return {
    ...teacher,
    classes: n,
    avgScore: Math.round(totals.score / n),
    avgEngagement: Math.round((totals.engagement / n) * 5),
    avgClassIssues: Math.round((totals.classIssues / n) * 5),
    avgInstructorPerformance: Math.round((totals.instructor / n) * 5),
    avgContentStructure: Math.round((totals.content / n) * 5),
    avgPlatformUsage: Math.round((totals.platform / n) * 5),
    sessions,
  };
};

export const TeacherDashboard = ({ teacher, cohort, rules, punches, reviews, shgPunches, shgReviews, shgReviewedPunches, shgReviewedReviews, email, onSignOut, onBack }: TeacherDashboardProps) => {
  const [month, setMonth] = useState("all");

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    teacher.sessions.forEach((session) => session.monthKey && set.add(session.monthKey));
    punches.forEach((entry) => entry.monthKey && set.add(entry.monthKey));
    reviews.forEach((entry) => entry.monthKey && set.add(entry.monthKey));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [teacher, punches, reviews]);

  const scopedTeacher = useMemo(() => scopeTeacherToMonth(teacher, month), [teacher, month]);
  const scopedCohort = useMemo(
    () => cohort.map((entry) => scopeTeacherToMonth(entry, month)).filter((entry) => month === "all" || entry.sessions.length > 0),
    [cohort, month]
  );
  const ranking = useMemo(() => {
    const ranked = [...scopedCohort].sort((a, b) => b.avgScore - a.avgScore);
    const rank = ranked.findIndex((entry) => entry.name === scopedTeacher.name) + 1;
    const total = scopedCohort.length;
    const beaten = scopedCohort.filter((entry) => entry.avgScore < scopedTeacher.avgScore).length;
    const percentile = total > 1 ? Math.round((beaten / (total - 1)) * 100) : 100;
    const topPercent = Math.max(1, Math.ceil((rank / Math.max(total, 1)) * 100));
    return { rank, total, percentile, topPercent };
  }, [scopedCohort, scopedTeacher]);

  const subjectRanking = useMemo(() => {
    const peers = scopedCohort.filter((entry) => entry.subject === scopedTeacher.subject);
    if (peers.length < 2) return null;
    const ranked = [...peers].sort((a, b) => b.avgScore - a.avgScore);
    const rank = ranked.findIndex((entry) => entry.name === scopedTeacher.name) + 1;
    return { topPercent: Math.max(1, Math.ceil((rank / peers.length) * 100)) };
  }, [scopedCohort, scopedTeacher]);

  const scoreRange = useMemo(() => {
    const scores = scopedCohort.map((entry) => entry.avgScore);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const position = max > min ? ((scopedTeacher.avgScore - min) / (max - min)) * 100 : 50;
    return { min, max, position: Math.min(Math.max(position, 0), 100) };
  }, [scopedCohort, scopedTeacher]);

  const trend = useMemo(
    () =>
      scopedTeacher.sessions
        .filter((session) => session.date)
        .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
        .slice(-30)
        .map((session) => ({ date: session.date?.slice(5) ?? "", score: session.score })),
    [scopedTeacher]
  );

  const recentSessions = useMemo(
    () =>
      [...scopedTeacher.sessions]
        .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
        .slice(0, 10),
    [scopedTeacher]
  );

  const bandLabel =
    ranking.topPercent <= 25
      ? "Top quartile — keep it up!"
      : ranking.topPercent <= 50
        ? "Above average"
        : ranking.topPercent <= 75
          ? "Room to grow"
          : "Focus area — coaching recommended";

  // Classes taught = punch-sheet entries (deduped), not audit sessions.
  const scopedPunches = useMemo(
    () =>
      (month === "all" ? punches : punches.filter((entry) => entry.monthKey === month)).filter(
        (entry) => !entry.duplicate
      ),
    [punches, month]
  );

  const avgStudentsPerClass = useMemo(() => {
    if (!scopedPunches.length) return null;
    const total = scopedPunches.reduce((sum, entry) => sum + entry.students, 0);
    return Math.round(total / scopedPunches.length);
  }, [scopedPunches]);

  const metrics = [
    { label: "Classes taught", value: scopedPunches.length.toLocaleString() },
    { label: "Avg students / class", value: avgStudentsPerClass === null ? "—" : String(avgStudentsPerClass) },
    { label: "Sessions audited", value: scopedTeacher.sessions.length.toLocaleString() },
    { label: "Avg lesson score", value: `${scopedTeacher.avgScore}%` },
    { label: "Engagement", value: `${scopedTeacher.avgEngagement}%` },
    { label: "Teaching quality", value: `${scopedTeacher.avgInstructorPerformance}%` },
    { label: "Content structure", value: `${scopedTeacher.avgContentStructure}%` },
    { label: "Platform usage", value: `${scopedTeacher.avgPlatformUsage}%` },
    { label: "Classroom issues", value: `${scopedTeacher.avgClassIssues}%` },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.06),_transparent_55%)] p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={onBack} className="hidden sm:inline-flex" aria-label="Go back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{teacher.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {teacher.subject} · Signed in as {email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {availableMonths.map((key) => (
                  <SelectItem key={key} value={key}>
                    {monthLabel(key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={onSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>

        <Card className="border-none bg-gradient-to-br from-white via-sky-50 to-emerald-50 shadow-2xl">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <Trophy className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.3em]">Your ranking</span>
            </div>
            <CardTitle className="text-3xl font-semibold text-slate-900">
              {ranking.rank > 0 ? `Top ${ranking.topPercent}%` : "No audits this month"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Your average score is higher than {ranking.percentile}% of other teachers. {bandLabel}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                <span>Percentile</span>
                <span>{ranking.percentile}%</span>
              </div>
              <Progress value={ranking.percentile} className="mt-2 h-2" />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                <span>Cohort spread ({scoreRange.min}%–{scoreRange.max}%)</span>
                <span>You · {scopedTeacher.avgScore}%</span>
              </div>
              <div className="relative h-3 w-full rounded-full bg-gradient-to-r from-rose-200 via-amber-200 to-emerald-300">
                <div
                  className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-900 shadow"
                  style={{ left: `${scoreRange.position}%` }}
                  aria-label={`Your score ${teacher.avgScore}%`}
                />
              </div>
            </div>

            {subjectRanking && (
              <div className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-slate-700">
                <Users className="h-4 w-4 text-primary" />
                Top {subjectRanking.topPercent}% among {teacher.subject} teachers
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <Card key={metric.label} className="border-none bg-white/90 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{metric.label}</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{metric.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {trend.length > 1 && (
          <Card className="border-none bg-white/90 shadow-lg">
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <BookOpen className="h-5 w-5" />
                <span className="text-xs font-semibold uppercase tracking-[0.3em]">Score trend</span>
              </div>
              <CardTitle className="text-xl font-semibold text-slate-900">Lesson scores over time</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{ score: { label: "Score", color: "hsl(var(--chart-1))" } }} className="h-[220px] w-full">
                <LineChart data={trend} margin={{ top: 10, bottom: 0, left: 0, right: 10 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={12} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="score" stroke="var(--color-score)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        <Card className="border-none bg-white/90 shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <ClipboardCheck className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.3em]">Recent sessions</span>
            </div>
            <CardTitle className="text-xl font-semibold text-slate-900">Your last {recentSessions.length} audits</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Score /100</TableHead>
                  <TableHead className="text-right">Engagement /20</TableHead>
                  <TableHead className="text-right">Teaching /20</TableHead>
                  <TableHead className="text-right">Content /20</TableHead>
                  <TableHead className="text-right">Platform /20</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSessions.map((session, index) => (
                  <TableRow key={`${session.date ?? "session"}-${index}`}>
                    <TableCell>{session.date ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">{session.score}</TableCell>
                    <TableCell className="text-right">{session.engagement}</TableCell>
                    <TableCell className="text-right">{session.instructorIssues}</TableCell>
                    <TableCell className="text-right">{session.contentStructure}</TableCell>
                    <TableCell className="text-right">{session.platformUsage}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <PunchAnalytics
          entries={punches}
          title="Your classes"
          description="Classes you've logged on the punch form — counts, students, centers and topics."
          month={month}
          detailed
        />

        <TeacherReviews
          entries={reviews}
          title="Feedback about you"
          description="Field-review notes logged about your classes."
          month={month}
        />

        <ShgReports
          punches={shgPunches}
          reviews={shgReviews}
          reviewedPunches={shgReviewedPunches}
          reviewedReviews={shgReviewedReviews}
          month={month}
        />

        <Card className="border-none bg-gradient-to-br from-white via-sky-50 to-emerald-50 shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <ClipboardList className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.3em]">Guidelines</span>
            </div>
            <CardTitle className="text-xl font-semibold text-slate-900">Rules Sheet</CardTitle>
            <p className="text-sm text-muted-foreground">Teacher guidelines set by the admin.</p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {rules.map((rule, index) => (
              <section key={rule.id} className="rounded-2xl border border-white/80 bg-white/80 p-5 shadow-sm">
                <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">
                  Rule {String(index + 1).padStart(2, "0")}
                </p>
                <p className="text-sm leading-relaxed text-slate-800">{rule.text}</p>
              </section>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
