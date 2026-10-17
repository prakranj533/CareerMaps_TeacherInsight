import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { CalendarDays, ClipboardList, Merge, Users } from "lucide-react";
import type { TeacherPunchEntry } from "@/lib/teacherPunches";
import { countReviewActivities, REVIEW_ACTIVITY_RATE, type TeacherReviewEntry } from "@/lib/teacherReviews";

const PAY_PER_CLASS = 300;

interface PunchAnalyticsProps {
  entries: TeacherPunchEntry[];
  title: string;
  description?: string;
  /** When provided, renders a per-teacher summary table with pay (admin view). */
  breakdown?: Map<string, TeacherPunchEntry[]>;
  /** Review visits keyed by reviewer — adds activity counts and ₹50/activity pay. */
  activity?: Map<string, TeacherReviewEntry[]>;
  /** Controlled month filter — when set, the built-in selector is hidden. */
  month?: string;
  /** Teacher view: list every class in the period. Admin/summary view omits the detail table. */
  detailed?: boolean;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const punchMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split("-");
  return `${MONTH_NAMES[Number(month) - 1] ?? month} '${year.slice(2)}`;
};

const StatChip = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
  </div>
);

export const PunchAnalytics = ({ entries, title, description, breakdown, activity, month, detailed }: PunchAnalyticsProps) => {
  // Uncontrolled mode (admin): own selector defaulting to the latest month,
  // matching the invoice flow's month-scoped view.
  const [internalMonth, setInternalMonth] = useState<string | null>(null);
  const isControlled = month !== undefined;

  const months = useMemo(
    () =>
      Array.from(
        new Set(entries.map((entry) => entry.monthKey).filter((key): key is string => Boolean(key)))
      ).sort((a, b) => b.localeCompare(a)),
    [entries]
  );

  const activeMonth = isControlled ? month : internalMonth ?? months[0] ?? "all";

  const filtered = useMemo(
    () => (activeMonth === "all" ? entries : entries.filter((entry) => entry.monthKey === activeMonth)),
    [entries, activeMonth]
  );

  // Duplicate punches (same class + date + subject) are shown but never counted.
  const unique = useMemo(() => filtered.filter((entry) => !entry.duplicate), [filtered]);
  const duplicateCount = filtered.length - unique.length;

  const stats = useMemo(() => {
    const totalStudents = unique.reduce((sum, entry) => sum + entry.students, 0);
    const merged = unique.filter((entry) => entry.merged).length;
    return {
      classes: unique.length,
      totalStudents,
      avgStudents: unique.length ? Math.round(totalStudents / unique.length) : 0,
      merged,
    };
  }, [unique]);

  // Month-on-month view is always unfiltered — it IS the monthly comparison.
  const classesPerMonth = useMemo(() => {
    const counts = new Map<string, number>();
    entries.forEach((entry) => {
      if (!entry.monthKey || entry.duplicate) return;
      counts.set(entry.monthKey, (counts.get(entry.monthKey) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, count]) => ({ month: punchMonthLabel(key), classes: count, active: key === activeMonth }));
  }, [entries, activeMonth]);

  const studentTrend = useMemo(
    () =>
      unique
        .filter((entry) => entry.date)
        .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
        .slice(-30)
        .map((entry) => ({ date: entry.date?.slice(5) ?? "", students: entry.students })),
    [unique]
  );

  const topCenters = useMemo(() => {
    const counts = new Map<string, number>();
    unique.forEach((entry) => {
      if (!entry.center) return;
      counts.set(entry.center, (counts.get(entry.center) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name: name.length > 18 ? `${name.slice(0, 18)}…` : name, fullName: name, classes: count }));
  }, [unique]);

  const subjectMix = useMemo(() => {
    const counts = new Map<string, number>();
    unique.forEach((entry) => {
      counts.set(entry.subject, (counts.get(entry.subject) ?? 0) + 1);
    });
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [unique]);

  const recentEntries = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
        .slice(0, detailed ? undefined : 8),
    [filtered, detailed]
  );

  const teacherRows = useMemo(() => {
    if (!breakdown) return [];
    const names = new Set([...breakdown.keys(), ...(activity?.keys() ?? [])]);
    return Array.from(names)
      .map((name) => {
        const punchList = breakdown.get(name) ?? [];
        const scopedAll = activeMonth === "all" ? punchList : punchList.filter((entry) => entry.monthKey === activeMonth);
        const scoped = scopedAll.filter((entry) => !entry.duplicate);
        const duplicates = scopedAll.length - scoped.length;
        const visitList = activity?.get(name) ?? [];
        const visits = activeMonth === "all" ? visitList : visitList.filter((entry) => entry.monthKey === activeMonth);
        const { feedbacks, counsellings, ptms } = countReviewActivities(visits);
        return {
          name,
          classes: scoped.length,
          duplicates,
          students: scoped.reduce((sum, entry) => sum + entry.students, 0),
          avgStudents: scoped.length ? Math.round(scoped.reduce((sum, entry) => sum + entry.students, 0) / scoped.length) : 0,
          merged: scoped.filter((entry) => entry.merged).length,
          feedbacks,
          counsellings,
          ptms,
          payment: scoped.length * PAY_PER_CLASS + (feedbacks + counsellings + ptms) * REVIEW_ACTIVITY_RATE,
          lastDate: scoped.reduce((latest, entry) => ((entry.date ?? "") > latest ? entry.date ?? "" : latest), ""),
        };
      })
      .sort((a, b) => b.classes - a.classes || b.feedbacks + b.counsellings - (a.feedbacks + a.counsellings));
  }, [breakdown, activity, activeMonth]);

  const paymentTotal = useMemo(() => teacherRows.reduce((sum, row) => sum + row.payment, 0), [teacherRows]);

  if (!entries.length) {
    return (
      <Card className="border-none bg-white/90 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-slate-900">{title}</CardTitle>
          <p className="text-sm text-muted-foreground">No class records found yet.</p>
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
              <CalendarDays className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.3em]">Class records</span>
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatChip label="Classes taught" value={stats.classes.toLocaleString()} />
          <StatChip label="Students reached" value={stats.totalStudents.toLocaleString()} />
          <StatChip label="Avg students / class" value={String(stats.avgStudents)} />
          <StatChip label="Merged classes" value={String(stats.merged)} />
          <StatChip label="Duplicates caught" value={String(duplicateCount)} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {classesPerMonth.length > 1 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Classes per month
              </p>
              <ChartContainer config={{ classes: { label: "Classes", color: "hsl(var(--chart-1))" } }} className="h-[200px] w-full">
                <BarChart data={classesPerMonth} margin={{ top: 10, bottom: 0, left: 0, right: 10 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="classes" fill="var(--color-classes)" radius={[6, 6, 0, 0]}>
                    {classesPerMonth.map((entry) => (
                      <Cell key={entry.month} fill="var(--color-classes)" opacity={entry.active ? 1 : 0.45} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>
          )}

          {studentTrend.length > 1 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Students per class
              </p>
              <ChartContainer config={{ students: { label: "Students", color: "hsl(var(--chart-2))" } }} className="h-[200px] w-full">
                <LineChart data={studentTrend} margin={{ top: 10, bottom: 0, left: 0, right: 10 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="students" stroke="var(--color-students)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ChartContainer>
            </div>
          )}

          {topCenters.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Top centers
              </p>
              <ChartContainer config={{ classes: { label: "Classes", color: "hsl(var(--chart-3))" } }} className="h-[200px] w-full">
                <BarChart data={topCenters} layout="vertical" margin={{ top: 0, bottom: 0, left: 10, right: 10 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false} fontSize={11} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="classes" fill="var(--color-classes)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ChartContainer>
            </div>
          )}

          {subjectMix.length > 1 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Subject mix
              </p>
              <ChartContainer config={{ mix: { label: "Classes" } }} className="mx-auto h-[200px] w-full">
                <PieChart>
                  <Pie
                    data={subjectMix}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={3}
                    stroke="transparent"
                  >
                    {subjectMix.map((entry, index) => (
                      <Cell key={`cell-${entry.name}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                </PieChart>
              </ChartContainer>
            </div>
          )}
        </div>

        {detailed && recentEntries.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ClipboardList className="h-4 w-4" /> All classes ({recentEntries.length})
            </p>
            <div className="max-h-[400px] overflow-y-auto overflow-x-auto rounded-xl border border-white/60">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_hsl(var(--border))]">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Center</TableHead>
                    <TableHead>Topic</TableHead>
                    <TableHead>Week</TableHead>
                    <TableHead className="text-right">Students</TableHead>
                    <TableHead className="text-center">Merged</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentEntries.map((entry, index) => (
                    <TableRow
                      key={`${entry.date}-${entry.center}-${index}`}
                      className={entry.duplicate ? "bg-amber-50/70" : undefined}
                    >
                      <TableCell>
                        {entry.date ?? "—"}
                        {entry.duplicate && (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                            duplicate
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate">{entry.center || "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={entry.topic}>
                        {entry.topic || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{entry.week || "—"}</TableCell>
                      <TableCell className="text-right">{entry.students}</TableCell>
                      <TableCell className="text-center">
                        {entry.merged ? <Merge className="inline h-4 w-4 text-amber-600" /> : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
                    <TableHead className="text-right">Classes</TableHead>
                    <TableHead className="text-right">Students</TableHead>
                    <TableHead className="text-right">Avg / class</TableHead>
                    <TableHead className="text-right">Merged</TableHead>
                    <TableHead className="text-right">Dupes</TableHead>
                    <TableHead className="text-right">Feedbacks</TableHead>
                    <TableHead className="text-right">Counselling</TableHead>
                    <TableHead className="text-right">PTMs</TableHead>
                    <TableHead className="text-right">Last class</TableHead>
                    <TableHead className="text-right">Pay (₹{PAY_PER_CLASS}/class + ₹{REVIEW_ACTIVITY_RATE}/activity)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teacherRows.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-right">{row.classes}</TableCell>
                      <TableCell className="text-right">{row.students}</TableCell>
                      <TableCell className="text-right font-medium">{row.avgStudents || "—"}</TableCell>
                      <TableCell className="text-right">{row.merged}</TableCell>
                      <TableCell className="text-right">{row.duplicates || "—"}</TableCell>
                      <TableCell className="text-right">{row.feedbacks}</TableCell>
                      <TableCell className="text-right">{row.counsellings}</TableCell>
                      <TableCell className="text-right">{row.ptms}</TableCell>
                      <TableCell className="text-right">{row.lastDate || "—"}</TableCell>
                      <TableCell className="text-right font-medium">₹{row.payment.toLocaleString("en-IN")}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-slate-50 font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{teacherRows.reduce((s, r) => s + r.classes, 0)}</TableCell>
                    <TableCell className="text-right">{teacherRows.reduce((s, r) => s + r.students, 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      {(() => {
                        const totalClasses = teacherRows.reduce((s, r) => s + r.classes, 0);
                        return totalClasses ? Math.round(teacherRows.reduce((s, r) => s + r.students, 0) / totalClasses) : "—";
                      })()}
                    </TableCell>
                    <TableCell className="text-right">{teacherRows.reduce((s, r) => s + r.merged, 0)}</TableCell>
                    <TableCell className="text-right">{teacherRows.reduce((s, r) => s + r.duplicates, 0)}</TableCell>
                    <TableCell className="text-right">{teacherRows.reduce((s, r) => s + r.feedbacks, 0)}</TableCell>
                    <TableCell className="text-right">{teacherRows.reduce((s, r) => s + r.counsellings, 0)}</TableCell>
                    <TableCell className="text-right">{teacherRows.reduce((s, r) => s + r.ptms, 0)}</TableCell>
                    <TableCell />
                    <TableCell className="text-right">₹{paymentTotal.toLocaleString("en-IN")}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
