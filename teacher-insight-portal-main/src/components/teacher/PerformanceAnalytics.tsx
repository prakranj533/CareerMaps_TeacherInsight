import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TeacherData } from "@/pages/TeacherPortal";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface PerformanceAnalyticsProps {
  teachers: TeacherData[];
}

export const PerformanceAnalytics = ({ teachers }: PerformanceAnalyticsProps) => {
  const performanceData = teachers.map((teacher) => ({
    name: teacher.name,
    score: teacher.avgScore,
    engagement: teacher.avgEngagement,
    teaching: teacher.avgInstructorPerformance,
    content: teacher.avgContentStructure,
    platform: teacher.avgPlatformUsage,
  }));

  const subjectDistribution = teachers.reduce((acc, teacher) => {
    const subject = teacher.subject;
    acc[subject] = (acc[subject] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(subjectDistribution).map(([subject, count]) => ({
    name: subject,
    value: count,
  }));

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  const topPerformers = [...teachers]
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 5);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle>Comprehensive Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Bar dataKey="score" fill="hsl(var(--chart-1))" name="Overall Score" />
              <Bar dataKey="engagement" fill="hsl(var(--chart-2))" name="Engagement" />
              <Bar dataKey="teaching" fill="hsl(var(--chart-3))" name="Teaching Quality" />
              <Bar dataKey="content" fill="hsl(var(--chart-4))" name="Content Structure" />
              <Bar dataKey="platform" fill="hsl(var(--chart-5))" name="Platform Usage" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subject Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top 5 Performers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topPerformers.map((teacher, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium">{teacher.name}</p>
                    <p className="text-sm text-muted-foreground">{teacher.subject}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">{teacher.avgScore}%</p>
                  <p className="text-sm text-muted-foreground">{teacher.classes} classes</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
