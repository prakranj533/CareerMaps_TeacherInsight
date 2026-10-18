import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { TrendingUp } from "lucide-react";
import type { TeacherData } from "@/pages/TeacherPortal";
import type { TeacherPunchEntry } from "@/lib/teacherPunches";
import { countReviewActivities, type TeacherReviewEntry } from "@/lib/teacherReviews";

interface MonthlyProgressProps {
  /** All audit sessions — unscoped by the dashboard month selector. */
  sessions: TeacherData["sessions"];
  /** The teacher's own punch records across all months. */
  punches: TeacherPunchEntry[];
  /** Field-review visits about the teacher. */
  reviews?: TeacherReviewEntry[];
}

interface MonthRow {
  key: string;
  label: string;
  classes: number;
  students: number;
  visits: number;
  audits: number;
  score: number | null;
  engagement: number | null;
  teaching: number | null;
  content: number | null;
  platform: number | null;
  /** Score change vs the previous month that has audits. */
  scoreDelta: number | null;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split("-");
  return `${MONTH_NAMES[Number(month) - 1] ?? month} ${year}`;
};

export const MonthlyProgress = ({ sessions, punches, reviews = [] }: MonthlyProgressProps) => {
  const rows = useMemo(() => {
    const acc = new Map<
      string,
      {
        classes: number;
        students: number;
        feedback: number;
        counselling: number;
        ptms: number;
        audits: number;
        score: number;
        engagement: number;
        classIssues: number;
        instructor: number;
        content: number;
        platform: number;
      }
    >();
    const bucket = (key: string) => {
      let entry = acc.get(key);
      if (!entry) {
        entry = {
          classes: 0,
          students: 0,
          feedback: 0,
          counselling: 0,
          ptms: 0,
          audits: 0,
          score: 0,
          engagement: 0,
          classIssues: 0,
          instructor: 0,
          content: 0,
          platform: 0,
        };
        acc.set(key, entry);
      }
      return entry;
    };

    sessions.forEach((session) => {
      if (!session.monthKey) return;
      const entry = bucket(session.monthKey);
      entry.audits += 1;
      entry.score += session.score || 0;
      entry.engagement += session.engagement || 0;
      entry.classIssues += session.classIssues || 0;
      entry.instructor += session.instructorIssues || 0;
      entry.content += session.contentStructure || 0;
      entry.platform += session.platformUsage || 0;
    });

    punches.forEach((entry) => {
      if (!entry.monthKey || entry.duplicate) return;
      const row = bucket(entry.monthKey);
      row.classes += 1;
      row.students += entry.students;
    });

    const visitsByMonth = new Map<string, TeacherReviewEntry[]>();
    reviews.forEach((entry) => {
      if (!entry.monthKey) return;
      const list = visitsByMonth.get(entry.monthKey) ?? [];
      list.push(entry);
      visitsByMonth.set(entry.monthKey, list);
    });
    visitsByMonth.forEach((list, key) => {
      const { feedbacks, counsellings, ptms } = countReviewActivities(list);
      const row = bucket(key);
      row.feedback = feedbacks;
      row.counselling = counsellings;
      row.ptms = ptms;
    });

    const sortedKeys = [...acc.keys()].sort();
    let previousScore: number | null = null;
    const built = sortedKeys.map((key) => {
      const entry = acc.get(key)!;
      const pct = (total: number) => (entry.audits ? Math.round((total / entry.audits) * 5) : null);
      const score = entry.audits ? Math.round(entry.score / entry.audits) : null;
      const row: MonthRow = {
        key,
        label: monthLabel(key),
        classes: entry.classes,
        students: entry.students,
        visits: entry.feedback + entry.counselling + entry.ptms,
        audits: entry.audits,
        score,
        engagement: pct(entry.engagement),
        teaching: pct(entry.instructor),
        content: pct(entry.content),
        platform: pct(entry.platform),
        scoreDelta: score !== null && previousScore !== null ? score - previousScore : null,
      };
      if (score !== null) previousScore = score;
      return row;
    });
    return built;
  }, [sessions, punches, reviews]);

  const chartData = useMemo(
    () => rows.map((row) => ({ month: row.label, classes: row.classes, score: row.score ?? 0 })),
    [rows]
  );

  // Table reads newest first; the chart stays chronological.
  const tableRows = useMemo(() => [...rows].reverse(), [rows]);

  if (!rows.length) return null;

  return (
    <Card className="border-none bg-white/90 shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-2 text-primary">
          <TrendingUp className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-[0.3em]">Month-on-month</span>
        </div>
        <CardTitle className="text-xl font-semibold text-slate-900">Your progress by month</CardTitle>
        <p className="text-sm text-muted-foreground">
          Classes taught, students reached, review visits and audit quality for every month — unaffected
          by the month selector above.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {chartData.length > 1 && (
          <ChartContainer
            config={{
              classes: { label: "Classes", color: "hsl(var(--chart-2))" },
              score: { label: "Avg score", color: "hsl(var(--chart-1))" },
            }}
            className="h-[220px] w-full"
          >
            <ComposedChart data={chartData} margin={{ top: 10, bottom: 0, left: 0, right: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis yAxisId="left" allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} fontSize={12} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar yAxisId="left" dataKey="classes" fill="var(--color-classes)" radius={[6, 6, 0, 0]} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="score"
                stroke="var(--color-score)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ChartContainer>
        )}

        <div className="overflow-x-auto rounded-xl border border-white/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Classes</TableHead>
                <TableHead className="text-right">Students</TableHead>
                <TableHead className="text-right">Review visits</TableHead>
                <TableHead className="text-right">Audits</TableHead>
                <TableHead className="text-right">Avg score</TableHead>
                <TableHead className="text-right">Δ score</TableHead>
                <TableHead className="text-right">Engagement</TableHead>
                <TableHead className="text-right">Teaching</TableHead>
                <TableHead className="text-right">Content</TableHead>
                <TableHead className="text-right">Platform</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableRows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="whitespace-nowrap font-medium">{row.label}</TableCell>
                  <TableCell className="text-right">{row.classes || "—"}</TableCell>
                  <TableCell className="text-right">{row.students ? row.students.toLocaleString() : "—"}</TableCell>
                  <TableCell className="text-right">{row.visits || "—"}</TableCell>
                  <TableCell className="text-right">{row.audits || "—"}</TableCell>
                  <TableCell className="text-right font-medium">{row.score === null ? "—" : `${row.score}%`}</TableCell>
                  <TableCell
                    className={`text-right ${
                      row.scoreDelta === null
                        ? "text-muted-foreground"
                        : row.scoreDelta > 0
                          ? "text-emerald-600"
                          : row.scoreDelta < 0
                            ? "text-rose-600"
                            : "text-muted-foreground"
                    }`}
                  >
                    {row.scoreDelta === null ? "—" : `${row.scoreDelta > 0 ? "+" : ""}${row.scoreDelta}`}
                  </TableCell>
                  <TableCell className="text-right">{row.engagement === null ? "—" : `${row.engagement}%`}</TableCell>
                  <TableCell className="text-right">{row.teaching === null ? "—" : `${row.teaching}%`}</TableCell>
                  <TableCell className="text-right">{row.content === null ? "—" : `${row.content}%`}</TableCell>
                  <TableCell className="text-right">{row.platform === null ? "—" : `${row.platform}%`}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
