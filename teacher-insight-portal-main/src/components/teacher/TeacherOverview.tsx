import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TeacherData } from "@/pages/TeacherPortal";
import { ArrowUpRight, Award, BarChart3, BookOpen, Sparkles, Users } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface TeacherOverviewProps {
  teachers: TeacherData[];
  totalClasses: number;
}

export const TeacherOverview = ({ teachers, totalClasses }: TeacherOverviewProps) => {
  const totalTeachers = teachers.length;
  const subjectCoverage = new Set(teachers.map((t) => t.subject)).size;
  const avgScore = averageMetric(teachers, (t) => t.avgScore);
  const avgEngagement = averageMetric(teachers, (t) => t.avgEngagement);
  const avgTeaching = averageMetric(teachers, (t) => t.avgInstructorPerformance);
  const avgPlatform = averageMetric(teachers, (t) => t.avgPlatformUsage);
  const classesPerTeacher = totalTeachers > 0 ? (totalClasses / totalTeachers).toFixed(1) : "0";
  const topTeacher = [...teachers].sort((a, b) => b.avgScore - a.avgScore)[0];
  const engagementDelta = Math.max(avgEngagement - 50, 0);

  const metricCards = [
    {
      title: "Avg Engagement",
      value: `${avgEngagement}%`,
      progress: avgEngagement,
      description: "Interaction pulse across recent sessions",
      accent: "from-sky-500/20 to-sky-500/5",
    },
    {
      title: "Teaching Quality",
      value: `${avgTeaching}%`,
      progress: avgTeaching,
      description: "Instructor clarity & classroom control",
      accent: "from-purple-500/20 to-purple-500/5",
    },
    {
      title: "Content Readiness",
      value: `${averageMetric(teachers, (t) => t.avgContentStructure)}%`,
      progress: averageMetric(teachers, (t) => t.avgContentStructure),
      description: "Structure & sequencing of lesson plans",
      accent: "from-amber-500/20 to-amber-500/5",
    },
    {
      title: "Platform Utilization",
      value: `${avgPlatform}%`,
      progress: avgPlatform,
      description: "Adoption of digital tools per class",
      accent: "from-emerald-500/20 to-emerald-500/5",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-white via-indigo-50 to-sky-50 shadow-xl lg:col-span-2">
          <div className="absolute right-10 top-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <CardHeader className="relative z-10 pb-6">
            <div className="flex items-center gap-3 text-primary">
              <Sparkles className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wide">Live Teaching Snapshot</span>
            </div>
            <CardTitle className="text-3xl font-bold text-slate-900">{totalClasses.toLocaleString()}</CardTitle>
            <p className="text-sm text-slate-600">Sessions reviewed in this reporting window.</p>
          </CardHeader>
          <CardContent className="relative z-10">
            <p className="mb-4 text-sm text-slate-500">Here’s how the week is shaping up:</p>
            <div className="grid gap-6 md:grid-cols-3">
              <MetricChip icon={Users} label="Active Teachers" value={totalTeachers} meta={`Covering ${subjectCoverage} subjects right now.`} />
              <MetricChip icon={BookOpen} label="Average Lesson Score" value={`${avgScore}%`} meta="Weighted toward the most recent classes." />
              <MetricChip
                icon={BarChart3}
                label="Engagement Delta"
                value={`${engagementDelta} pts`}
                meta={`Running ${engagementDelta} pts above our classroom quality baseline.`}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none bg-white/90 shadow-lg">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900">Top Performing Mentor</CardTitle>
            <p className="text-sm text-muted-foreground">Highest composite score across all KPIs</p>
          </CardHeader>
          <CardContent>
            {topTeacher ? (
              <div className="space-y-4">
                <div>
                  <p className="text-2xl font-bold text-slate-900">{topTeacher.name}</p>
                  <p className="text-sm text-muted-foreground">{topTeacher.subject}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <DetailStat label="Overall" value={`${topTeacher.avgScore}%`} />
                  <DetailStat label="Engagement" value={`${topTeacher.avgEngagement}%`} />
                  <DetailStat label="Teaching" value={`${topTeacher.avgInstructorPerformance}%`} />
                  <DetailStat label="Content" value={`${topTeacher.avgContentStructure}%`} />
                </div>
                <div className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                  <p>Managing {topTeacher.classes} live classes · {topTeacher.sessions.length} audits captured</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Add teachers to unlock live benchmarking.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((card) => (
          <Card key={card.title} className="border-none bg-white/90 shadow-sm">
            <CardContent className="space-y-3 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.title}</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-slate-900">{card.value}</p>
                  <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                </div>
              </div>
              <Progress value={card.progress} className="h-2" />
              <p className="text-xs text-muted-foreground">{card.description}</p>
              <div className={`h-1 w-full rounded-full bg-gradient-to-r ${card.accent}`} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

function averageMetric(teachers: TeacherData[], selector: (teacher: TeacherData) => number): number {
  if (!teachers.length) return 0;
  const total = teachers.reduce((sum, teacher) => sum + selector(teacher), 0);
  return Math.round(total / teachers.length);
}

interface MetricChipProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  meta: string;
}

const MetricChip = ({ icon: Icon, label, value, meta }: MetricChipProps) => (
  <div className="rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm">
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
      <Icon className="h-4 w-4 text-primary" />
      {label}
    </div>
    <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    <p className="text-xs text-muted-foreground">{meta}</p>
  </div>
);

interface DetailStatProps {
  label: string;
  value: string;
}

const DetailStat = ({ label, value }: DetailStatProps) => (
  <div className="rounded-xl bg-muted/40 p-3">
    <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
    <p className="text-lg font-semibold text-slate-900">{value}</p>
  </div>
);
