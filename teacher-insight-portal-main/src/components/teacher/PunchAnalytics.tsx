import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface PunchAnalyticsProps {
  entries: TeacherPunchEntry[];
  title: string;
  description?: string;
  /** When provided, renders a per-teacher summary table (admin view). */
  breakdown?: Map<string, TeacherPunchEntry[]>;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split("-");
  return `${MONTH_NAMES[Number(month) - 1] ?? month} '${year.slice(2)}`;
};

const StatChip = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
  </div>
);

export const PunchAnalytics = ({ entries, title, description, breakdown }: PunchAnalyticsProps) => {
  const stats = useMemo(() => {
    const totalStudents = entries.reduce((sum, entry) => sum + entry.students, 0);
    const merged = entries.filter((entry) => entry.merged).length;
    return {
      classes: entries.length,
      totalStudents,
      avgStudents: entries.length ? Math.round(totalStudents / entries.length) : 0,
      merged,
    };
  }, [entries]);

  const classesPerMonth = useMemo(() => {
    const counts = new Map<string, number>();
    entries.forEach((entry) => {
      if (!entry.monthKey) return;
      counts.set(entry.monthKey, (counts.get(entry.monthKey) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, count]) => ({ month: monthLabel(key), classes: count }));
  }, [entries]);

  const studentTrend = useMemo(
    () =>
      entries
        .filter((entry) => entry.date)
        .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
        .slice(-30)
        .map((entry) => ({ date: entry.date?.slice(5) ?? "", students: entry.students })),
    [entries]
  );

  const topCenters = useMemo(() => {
    const counts = new Map<string, number>();
    entries.forEach((entry) => {
      if (!entry.center) return;
      counts.set(entry.center, (counts.get(entry.center) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name: name.length > 18 ? `${name.slice(0, 18)}…` : name, fullName: name, classes: count }));
  }, [entries]);

  const subjectMix = useMemo(() => {
    const counts = new Map<string, number>();
    entries.forEach((entry) => {
      counts.set(entry.subject, (counts.get(entry.subject) ?? 0) + 1);
    });
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [entries]);

  const recentEntries = useMemo(
    () =>
      [...entries]
        .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
        .slice(0, 8),
    [entries]
  );

  const teacherRows = useMemo(() => {
    if (!breakdown) return [];
    return Array.from(breakdown.entries())
      .map(([name, list]) => ({
        name,
        classes: list.length,
        students: list.reduce((sum, entry) => sum + entry.students, 0),
        merged: list.filter((entry) => entry.merged).length,
        lastDate: list.reduce((latest, entry) => ((entry.date ?? "") > latest ? entry.date ?? "" : latest), ""),
      }))
      .sort((a, b) => b.classes - a.classes);
  }, [breakdown]);

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
        <div className="flex items-center gap-2 text-primary">
          <CalendarDays className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-[0.3em]">Class records</span>
        </div>
        <CardTitle className="text-xl font-semibold text-slate-900">{title}</CardTitle>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatChip label="Classes logged" value={stats.classes.toLocaleString()} />
          <StatChip label="Students reached" value={stats.totalStudents.toLocaleString()} />
          <StatChip label="Avg students / class" value={String(stats.avgStudents)} />
          <StatChip label="Merged classes" value={String(stats.merged)} />
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
                  <Bar dataKey="classes" fill="var(--color-classes)" radius={[6, 6, 0, 0]} />
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

        {recentEntries.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ClipboardList className="h-4 w-4" /> Latest classes
            </p>
            <div className="overflow-x-auto rounded-xl border border-white/60">
              <Table>
                <TableHeader>
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
                    <TableRow key={`${entry.date}-${entry.center}-${index}`}>
                      <TableCell>{entry.date ?? "—"}</TableCell>
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
                    <TableHead className="text-right">Merged</TableHead>
                    <TableHead className="text-right">Last class</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teacherRows.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-right">{row.classes}</TableCell>
                      <TableCell className="text-right">{row.students}</TableCell>
                      <TableCell className="text-right">{row.merged}</TableCell>
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
