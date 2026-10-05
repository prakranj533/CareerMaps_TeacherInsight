import { useState, useEffect, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchGoogleSheetData } from "@/lib/googleSheets";
import { TeacherOverview } from "@/components/teacher/TeacherOverview";
import { TeacherList } from "@/components/teacher/TeacherList";
import { PerformanceAnalytics } from "@/components/teacher/PerformanceAnalytics";
import { TeacherInsights } from "@/components/teacher/TeacherInsights";
import { Loader2, ArrowLeft, Search, Filter, Download, RefreshCw, Plus, ListOrdered, BarChart2, Lightbulb, Info, Calendar, ClipboardList, LogIn, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp } from "lucide-react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { firebaseAuth, firestore, isFirebaseConfigured } from "@/lib/firebase";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  LineChart as ReLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart as RePieChart,
  Pie,
  Cell,
  BarChart as ReBarChart,
  Bar,
  Treemap as ReTreemap,
} from "recharts";

const TREEMAP_PALETTE = ["#6D28D9", "#0EA5E9", "#22C55E", "#F97316", "#FB7185", "#14B8A6", "#7C3AED", "#FACC15"];
const ADMIN_EMAIL = "prakranj@gmail.com";
const TEACHER_RULES_DOCUMENT = ["settings", "teacherRules"] as const;

interface TeacherRule {
  id: string;
  text: string;
}

const DEFAULT_TEACHER_RULES: TeacherRule[] = [
  { id: "1", text: "Teachers are paid ₹300 per class." },
  { id: "2", text: "Quality is measured for each class and shared in the Teacher Portal." },
  { id: "3", text: "Quality multiplication is applied when the number of classes is above 25." },
  { id: "4", text: "Class allocation is based on quality and hierarchy." },
  { id: "5", text: "The maximum number of classes is 60. Exceptions must be pre-approved." },
  {
    id: "6",
    text: "Senior teachers with centers under them receive a new-teacher development incentive of 10% of the earnings from a new teacher teaching at their center.",
  },
];

const parseTeacherRules = (value: unknown): TeacherRule[] =>
  Array.isArray(value) &&
  value.every(
    (rule) =>
      rule !== null &&
      typeof rule === "object" &&
      typeof rule.id === "string" &&
      typeof rule.text === "string"
  )
    ? value
    : DEFAULT_TEACHER_RULES;

export interface TeacherData {
  name: string;
  subject: string;
  classes: number;
  avgScore: number;
  avgEngagement: number;
  avgClassIssues: number;
  avgInstructorPerformance: number;
  avgContentStructure: number;
  avgPlatformUsage: number;
  hasAssignedTeacher: boolean;
  sessions: Array<{
    score: number;
    engagement: number;
    classIssues: number;
    instructorIssues: number;
    contentStructure: number;
    platformUsage: number;
    date?: string;
    monthKey?: string;
  }>;
}

const TeacherPortal = () => {
  // State declarations at the top level
  const [teachers, setTeachers] = useState<TeacherData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [performanceFilter, setPerformanceFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [teacherRules, setTeacherRules] = useState<TeacherRule[]>(DEFAULT_TEACHER_RULES);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [draftRuleText, setDraftRuleText] = useState("");
  
  // All hooks must be called unconditionally at the top level
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!firebaseAuth) return;

    return onAuthStateChanged(firebaseAuth, (user) => {
      const email = user?.email?.toLowerCase();
      if (user && (email !== ADMIN_EMAIL || !user.emailVerified)) {
        setAdminEmail(null);
        void signOut(firebaseAuth);
        return;
      }
      setAdminEmail(user?.email ?? null);
    });
  }, []);

  useEffect(() => {
    if (!firestore) return;

    return onSnapshot(
      doc(firestore, ...TEACHER_RULES_DOCUMENT),
      (snapshot) => {
        setTeacherRules(snapshot.exists() ? parseTeacherRules(snapshot.data().rules) : DEFAULT_TEACHER_RULES);
      },
      (error) => {
        toast({
          title: "Unable to load shared rules",
          description: `Firestore error (${error.code}). Check that Firestore is enabled and its rules are deployed.`,
          variant: "destructive",
        });
      }
    );
  }, [toast]);

  const handleAdminSignIn = async () => {
    if (!firebaseAuth) return;

    setIsAuthenticating(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ login_hint: ADMIN_EMAIL, prompt: "select_account" });
    try {
      const result = await signInWithPopup(firebaseAuth, provider);
      if (result.user.email?.toLowerCase() !== ADMIN_EMAIL || !result.user.emailVerified) {
        await signOut(firebaseAuth);
        toast({
          title: "Admin access denied",
          description: "This Google account is not authorized to edit the rules.",
          variant: "destructive",
        });
      }
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error ? String(error.code) : "unknown";
      const description =
        code === "auth/operation-not-allowed"
          ? "Enable Google as a Firebase Authentication provider."
          : code === "auth/unauthorized-domain"
            ? "Add this site to Firebase Authentication's authorized domains."
            : code === "auth/popup-blocked"
              ? "Allow pop-ups for this site, then try again."
              : "Could not sign in with Google. Check Firebase Authentication settings.";
      toast({
        title: "Sign-in failed",
        description: `${description} (${code})`,
        variant: "destructive",
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleAdminSignOut = async () => {
    if (firebaseAuth) await signOut(firebaseAuth);
  };

  const startAddingRule = () => {
    if (!adminEmail) return;
    setEditingRuleId(null);
    setDraftRuleText("");
    setIsAddingRule(true);
  };

  const startEditingRule = (rule: TeacherRule) => {
    if (!adminEmail) return;
    setIsAddingRule(false);
    setEditingRuleId(rule.id);
    setDraftRuleText(rule.text);
  };

  const cancelRuleEdit = () => {
    setEditingRuleId(null);
    setIsAddingRule(false);
    setDraftRuleText("");
  };

  const saveRule = async () => {
    const text = draftRuleText.trim();
    if (!text || !adminEmail || !firestore) return;

    const updatedRules = isAddingRule
      ? [...teacherRules, { id: crypto.randomUUID(), text }]
      : teacherRules.map((rule) => (rule.id === editingRuleId ? { ...rule, text } : rule));

    try {
      await setDoc(doc(firestore, ...TEACHER_RULES_DOCUMENT), {
        rules: updatedRules,
        updatedAt: serverTimestamp(),
      });
      setTeacherRules(updatedRules);
      toast({ title: "Rules saved", description: "Your changes are now shared with everyone." });
      cancelRuleEdit();
    } catch {
      toast({
        title: "Unable to save rules",
        description: "Check your admin access and Firestore configuration, then try again.",
        variant: "destructive",
      });
    }
  };
  
  const assignedTeachers = useMemo(
    () => teachers.filter((teacher) => teacher.hasAssignedTeacher),
    [teachers]
  );

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    teachers.forEach((teacher) => {
      teacher.sessions.forEach((session) => {
        if (session.monthKey) {
          months.add(session.monthKey);
        }
      });
    });
    const sorted = Array.from(months).sort();
    return sorted.reverse();
  }, [teachers]);

  const currentTeachers = useMemo(() => {
    if (monthFilter === "all") {
      return assignedTeachers;
    }

    return assignedTeachers
      .map((teacher) => {
        const scopedSessions = teacher.sessions.filter((session) => session.monthKey === monthFilter);
        if (!scopedSessions.length) {
          return null;
        }

        const aggregates = scopedSessions.reduce(
          (acc, session) => {
            acc.score += session.score || 0;
            acc.engagement += session.engagement || 0;
            acc.classIssues += session.classIssues || 0;
            acc.instructorIssues += session.instructorIssues || 0;
            acc.contentStructure += session.contentStructure || 0;
            acc.platformUsage += session.platformUsage || 0;
            return acc;
          },
          {
            score: 0,
            engagement: 0,
            classIssues: 0,
            instructorIssues: 0,
            contentStructure: 0,
            platformUsage: 0,
          }
        );

        const sessionCount = scopedSessions.length;
        const average = <T extends number>(total: number, multiplier = 1) =>
          sessionCount ? Math.round((total / sessionCount) * multiplier) : 0;

        return {
          ...teacher,
          classes: sessionCount,
          avgScore: average(aggregates.score),
          avgEngagement: average(aggregates.engagement, 5),
          avgClassIssues: average(aggregates.classIssues, 5),
          avgInstructorPerformance: average(aggregates.instructorIssues, 5),
          avgContentStructure: average(aggregates.contentStructure, 5),
          avgPlatformUsage: average(aggregates.platformUsage, 5),
          sessions: scopedSessions,
        };
      })
      .filter((teacher): teacher is TeacherData => Boolean(teacher));
  }, [assignedTeachers, monthFilter]);

  const totalAudits = useMemo(
    () => currentTeachers.reduce((sum, teacher) => sum + teacher.sessions.length, 0),
    [currentTeachers]
  );

  const totalClasses = useMemo(
    () => currentTeachers.reduce((sum, teacher) => sum + teacher.classes, 0),
    [currentTeachers]
  );

  const topCohort = useMemo(() => {
    const sorted = [...currentTeachers].sort((a, b) => b.avgScore - a.avgScore);
    return sorted.slice(0, 8);
  }, [currentTeachers]);

  const performanceTrend = useMemo(
    () =>
      topCohort.map((teacher) => ({
        name: teacher.name.split(" ")[0] ?? teacher.name,
        fullName: teacher.name,
        score: Number(teacher.avgScore.toFixed(1)),
        engagement: Number(teacher.avgEngagement.toFixed(1)),
      })),
    [topCohort]
  );

  const treemapNodes = useMemo(
    () =>
      performanceTrend.map((entry, index) => ({
        name: entry.fullName,
        size: Math.max(entry.score, 1),
        score: entry.score,
        engagement: entry.engagement,
        fill: TREEMAP_PALETTE[index % TREEMAP_PALETTE.length],
      })),
    [performanceTrend]
  );

  const subjectMixData = useMemo(() => {
    const counts = currentTeachers.reduce<Record<string, number>>((acc, teacher) => {
      acc[teacher.subject] = (acc[teacher.subject] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [currentTeachers]);

  const performanceSplitData = useMemo(() => {
    const buckets = {
      excellent: 0,
      good: 0,
      needsImprovement: 0,
    };

    currentTeachers.forEach((teacher) => {
      if (teacher.avgScore >= 80) buckets.excellent += 1;
      else if (teacher.avgScore >= 60) buckets.good += 1;
      else buckets.needsImprovement += 1;
    });

    return [
      { label: "Excellent", value: buckets.excellent, color: "hsl(var(--chart-1))", range: "80-100" },
      { label: "Good", value: buckets.good, color: "hsl(var(--chart-2))", range: "60-79" },
      { label: "Focus", value: buckets.needsImprovement, color: "hsl(var(--chart-3))", range: "<60" },
    ];
  }, [currentTeachers]);

  const spotlightTeacher = useMemo(() => {
    if (!currentTeachers.length) return null;
    return [...currentTeachers].sort((a, b) => b.avgEngagement - a.avgEngagement)[0];
  }, [currentTeachers]);

  const globalAverages = useMemo(() => {
    if (!currentTeachers.length) {
      return { score: 0, engagement: 0, platform: 0 };
    }

    const totals = currentTeachers.reduce(
      (acc, teacher) => {
        acc.score += teacher.avgScore;
        acc.engagement += teacher.avgEngagement;
        acc.platform += teacher.avgPlatformUsage;
        return acc;
      },
      { score: 0, engagement: 0, platform: 0 }
    );

    return {
      score: Math.round(totals.score / currentTeachers.length),
      engagement: Math.round(totals.engagement / currentTeachers.length),
      platform: Math.round(totals.platform / currentTeachers.length),
    };
  }, [currentTeachers]);

  const highestAvgScore = useMemo(
    () => currentTeachers.reduce((max, teacher) => Math.max(max, Math.round(teacher.avgScore || 0)), 0),
    [currentTeachers]
  );

  const momentumEngagementDelta = useMemo(() => Math.max(globalAverages.engagement - 60, 0), [globalAverages.engagement]);

  const { filteredTeachers, subjects } = useMemo(() => {
    // Filter teachers based on search and filters
    const filtered = currentTeachers.filter(teacher => {
      const matchesSearch = teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         teacher.subject.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesSubject = subjectFilter === "all" || teacher.subject === subjectFilter;
      
      let matchesPerformance = true;
      if (performanceFilter !== "all") {
        const score = teacher.avgScore;
        if (performanceFilter === "excellent") matchesPerformance = score >= 80;
        else if (performanceFilter === "good") matchesPerformance = score >= 60 && score < 80;
        else if (performanceFilter === "needs_improvement") matchesPerformance = score < 60;
      }
      
      return matchesSearch && matchesSubject && matchesPerformance;
    });
    
    // Get unique subjects for filter dropdown
    const uniqueSubjects = new Set(currentTeachers.map(t => t.subject));
    const sortedSubjects = Array.from(uniqueSubjects).sort();
    
    return {
      filteredTeachers: filtered,
      subjects: sortedSubjects
    };
  }, [currentTeachers, searchTerm, subjectFilter, performanceFilter]);

  useEffect(() => {
    loadTeacherData();
  }, []);

  const loadTeacherData = async () => {
    try {
      setLoading(true);
      const data = await fetchGoogleSheetData();
      setTeachers(data);
    } catch (error) {
      toast({
        title: "Error loading data",
        description: "Failed to fetch teacher data from Google Sheets",
        variant: "destructive",
      });
      console.error("Error loading teacher data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading teacher data...</p>
        </div>
      </div>
    );
  }

  // Filtering and subjects are now handled in the useMemo above

  const handleExportData = () => {
    // Simple CSV export
    const headers = ['Name', 'Subject', 'Classes', 'Avg Score', 'Engagement', 'Performance'];
    const csvContent = [
      headers.join(','),
      ...filteredTeachers.map(t => [
        `"${t.name}"`,
        `"${t.subject}"`,
        t.classes,
        t.avgScore.toFixed(1),
        t.avgEngagement.toFixed(1),
        t.avgInstructorPerformance.toFixed(1)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `teacher-performance-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.06),_transparent_55%)] p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/")}
              className="hover:bg-primary hover:text-primary-foreground hidden sm:inline-flex"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">Teacher Portal</h1>
              <p className="text-muted-foreground text-sm sm:text-base mt-1">
                Comprehensive overview of all teachers and their performance metrics
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadTeacherData}
                    disabled={loading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Refresh</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh data from source</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleExportData}
                    disabled={teachers.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Export</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Export data as CSV</p>
                </TooltipContent>
              </Tooltip>
              
              <Button size="sm" className="hidden sm:flex">
                <Plus className="h-4 w-4 mr-2" />
                Add Teacher
              </Button>
            </TooltipProvider>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full space-y-6">
          <div className="flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="h-auto flex-wrap bg-muted/60">
              <TabsTrigger value="overview" className="px-4 sm:px-6">Overview</TabsTrigger>
              <TabsTrigger value="workspace" className="px-4 sm:px-6">Workspace</TabsTrigger>
              <TabsTrigger value="rankings" className="px-4 sm:px-6">Rankings</TabsTrigger>
              <TabsTrigger value="rules" className="flex items-center gap-2 px-4 sm:px-6">
                <ClipboardList className="h-4 w-4" />
                Rules Sheet
              </TabsTrigger>
            </TabsList>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Last refresh {new Date().toLocaleString()}
            </div>
          </div>

          <TabsContent value="overview">
            <Card className="border-none bg-gradient-to-br from-white via-sky-50 to-emerald-50 shadow-2xl">
            <CardHeader className="pb-0">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-primary/70">Quality Intelligence</p>
                  <CardTitle className="text-3xl font-semibold text-slate-900">
                    {globalAverages.score}% quality · {totalClasses.toLocaleString()} classes monitored
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {totalAudits.toLocaleString()} live audits · {currentTeachers.length} mentors · {subjectMixData.length} subjects
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 text-xs uppercase tracking-wide text-muted-foreground">
                  <span className="rounded-full border border-primary/30 bg-primary/5 px-4 py-1">
                    Engagement {globalAverages.engagement}%
                  </span>
                  <span className="rounded-full border border-emerald-300/60 bg-white/80 px-4 py-1">
                    Platform {globalAverages.platform}%
                  </span>
                  <span className="rounded-full border border-amber-300/60 bg-white/80 px-4 py-1">
                    Last sync {new Date().toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-8">
              <div className="grid gap-8 lg:grid-cols-[1.05fr_1.3fr_0.8fr]">
                {/* KPI Stack */}
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                    <KpiChip label="Avg Engagement" value={`${globalAverages.engagement}%`} meta="vs 72% target" tone="emerald" />
                    <KpiChip label="Platform Adoption" value={`${globalAverages.platform}%`} meta="tooling readiness" tone="cyan" />
                  </div>

                  <div className="space-y-3 rounded-2xl border border-white/60 bg-white/80 p-4">
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                      <span>Classes / Instructor</span>
                      <span>{currentTeachers.length ? (totalClasses / currentTeachers.length).toFixed(1) : "0"}</span>
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <ProgressRow label="Engagement" value={globalAverages.engagement} />
                      <ProgressRow label="Content" value={averageMetric(currentTeachers, (t) => t.avgContentStructure)} />
                      <ProgressRow label="Teaching" value={averageMetric(currentTeachers, (t) => t.avgInstructorPerformance)} />
                    </div>
                  </div>

                  {spotlightTeacher && (
                    <div className="rounded-2xl border border-emerald-100/70 bg-emerald-50/80 p-4">
                      <p className="text-xs uppercase tracking-wide text-emerald-700">Live spotlight</p>
                      <p className="mt-2 text-lg font-semibold text-emerald-900">{spotlightTeacher.name}</p>
                      <p className="text-sm text-emerald-800">{spotlightTeacher.subject}</p>
                      <div className="mt-4 flex items-center justify-between text-sm text-emerald-900">
                        <span>{spotlightTeacher.avgEngagement}% engagement</span>
                        <span>{spotlightTeacher.classes} classes</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Treemap */}
                <div className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-inner">
                  <div className="flex items-center justify-between pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Momentum</p>
                        {/* <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                          Treemap
                        </span> */}
                      </div>
                      <p className="text-lg font-semibold text-foreground">Score vs Engagement</p>
                      {/* <p className="text-sm text-muted-foreground">Tile size tracks average lesson score while color intensity reflects engagement. Larger, brighter blocks signal healthier cohorts.</p> */}
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>Top {performanceTrend.length} cohorts</p>
                      <p>Updated {new Date().toLocaleTimeString()}</p>
                    </div>
                  </div>
                  {treemapNodes.length ? (
                    <ChartContainer
                      config={{
                        value: { label: "Composite" },
                      }}
                      className="h-[260px] w-full"
                    >
                      <ReTreemap
                        data={treemapNodes}
                        dataKey="size"
                        aspectRatio={4 / 3}
                        stroke="var(--border)"
                        isAnimationActive
                        animationBegin={0}
                        animationDuration={900}
                        animationEasing="ease-out"
                        content={<TreemapTile />}
                      >
                        <ChartTooltip
                          cursor={false}
                          content={
                            <ChartTooltipContent
                              formatter={(value, _name, item) => {
                                const payload = item?.payload as TreemapNodeData | undefined;
                                return [`${value}% score · ${payload?.engagement ?? 0}% engagement`, payload?.name ?? "Cohort"];
                              }}
                              hideIndicator
                            />
                          }
                        />
                      </ReTreemap>
                    </ChartContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground">Add teachers to visualize quality trends.</p>
                  )}
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <MiniStat title="Highest avg" value={`${highestAvgScore}%`} subtitle="Best cohort lesson score" tone="emerald" />
                    <MiniStat title="Engagement lift" value={`${momentumEngagementDelta} pts`} subtitle="Above 60% benchmark" tone="sky" />
                  </div>
                </div>

                {/* Context column */}
                <div className="space-y-4 rounded-3xl border border-white/60 bg-white/75 p-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Subject mix</p>
                    {subjectMixData.length ? (
                      <ChartContainer config={{ mix: { label: "Subjects" } }} className="mx-auto h-[180px] w-full">
                        <RePieChart>
                          <Pie
                            data={subjectMixData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={45}
                            outerRadius={80}
                            paddingAngle={3}
                            stroke="transparent"
                          >
                            {subjectMixData.map((entry, index) => (
                              <Cell key={`subject-${entry.name}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                            ))}
                          </Pie>
                          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                        </RePieChart>
                      </ChartContainer>
                    ) : (
                      <p className="text-sm text-muted-foreground">No assigned subjects yet.</p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Performance bands</p>
                    {currentTeachers.length ? (
                      <ChartContainer config={{ value: { label: "Teachers" } }} className="h-[140px] w-full">
                        <ReBarChart data={performanceSplitData} margin={{ top: 10, bottom: 0, left: 0, right: 0 }}>
                          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                          <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                          <ChartTooltip cursor={{ fill: "hsl(var(--muted))" }} content={<ChartTooltipContent hideLabel />} />
                          <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                            {performanceSplitData.map((entry) => (
                              <Cell key={entry.label} fill={entry.color} />
                            ))}
                          </Bar>
                        </ReBarChart>
                      </ChartContainer>
                    ) : (
                      <p className="text-sm text-muted-foreground">No quality insights to show.</p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-900">
                    <p className="text-xs uppercase tracking-wide">Live alert</p>
                    {performanceSplitData[2]?.value ? (
                      <p className="mt-1">
                        {performanceSplitData[2].value} mentor(s) below 60%. Prioritize coaching this week.
                      </p>
                    ) : (
                      <p className="mt-1">All mentors are above the quality threshold.</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="workspace" className="space-y-6">
            {/* Overview Cards */}
            <TeacherOverview teachers={filteredTeachers} totalClasses={totalClasses} />
          </TabsContent>

          <TabsContent value="rules" className="space-y-6">
            <Card className="border-none bg-gradient-to-br from-white via-sky-50 to-emerald-50 shadow-lg">
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.3em] text-primary/70">Teacher guidelines</p>
                  <CardTitle className="text-3xl font-semibold text-slate-900">Rules Sheet</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Only the admin can edit. Rule updates are shared with everyone.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!isFirebaseConfigured ? (
                    <p className="text-sm text-muted-foreground">Admin login requires Firebase configuration.</p>
                  ) : adminEmail ? (
                    <>
                      <span className="text-sm text-muted-foreground">Signed in as {adminEmail}</span>
                      <Button variant="outline" onClick={handleAdminSignOut}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign out
                      </Button>
                      <Button onClick={startAddingRule} disabled={isAddingRule || editingRuleId !== null}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add rule
                      </Button>
                    </>
                  ) : (
                    <Button onClick={handleAdminSignIn} disabled={isAuthenticating}>
                      {isAuthenticating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                      Admin login
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {teacherRules.map((rule, index) => (
                  <section key={rule.id} className="rounded-2xl border border-white/80 bg-white/80 p-5 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                        Rule {String(index + 1).padStart(2, "0")}
                      </p>
                      {adminEmail && editingRuleId !== rule.id && (
                        <Button variant="outline" size="sm" onClick={() => startEditingRule(rule)} disabled={isAddingRule}>
                          Edit wording
                        </Button>
                      )}
                    </div>
                    {adminEmail && editingRuleId === rule.id ? (
                      <div className="space-y-3">
                        <Textarea
                          aria-label={`Edit rule ${index + 1}`}
                          autoFocus
                          rows={4}
                          value={draftRuleText}
                          onChange={(event) => setDraftRuleText(event.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={cancelRuleEdit}>Cancel</Button>
                          <Button size="sm" onClick={saveRule} disabled={!draftRuleText.trim()}>Save</Button>
                        </div>
                      </div>
                    ) : (
                      <p className="leading-relaxed text-slate-700">{rule.text}</p>
                    )}
                  </section>
                ))}
                {adminEmail && isAddingRule && (
                  <section className="rounded-2xl border border-primary/30 bg-white/90 p-5 shadow-sm">
                    <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">
                      Rule {String(teacherRules.length + 1).padStart(2, "0")}
                    </p>
                    <div className="space-y-3">
                      <Textarea
                        aria-label="New rule"
                        autoFocus
                        rows={4}
                        placeholder="Write a new teacher rule..."
                        value={draftRuleText}
                        onChange={(event) => setDraftRuleText(event.target.value)}
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={cancelRuleEdit}>Cancel</Button>
                        <Button size="sm" onClick={saveRule} disabled={!draftRuleText.trim()}>Save rule</Button>
                      </div>
                    </div>
                  </section>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rankings" className="space-y-6">
        <FilterControls
          searchTerm={searchTerm}
          onSearchChange={(value) => setSearchTerm(value)}
          subjectFilter={subjectFilter}
          onSubjectChange={setSubjectFilter}
          performanceFilter={performanceFilter}
          onPerformanceChange={setPerformanceFilter}
          monthFilter={monthFilter}
          onMonthChange={setMonthFilter}
          months={availableMonths}
          subjects={subjects}
          resultCount={filteredTeachers.length}
        />

            <Tabs defaultValue="list" className="w-full">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <TabsList className="grid w-full sm:w-auto grid-cols-3">
                  <TabsTrigger value="list" className="flex items-center gap-2">
                    <ListOrdered className="h-4 w-4" />
                    <span className="hidden sm:inline">Rankings</span>
                  </TabsTrigger>
                  <TabsTrigger value="analytics" className="flex items-center gap-2">
                    <BarChart2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Analytics</span>
                  </TabsTrigger>
                  <TabsTrigger value="insights" className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    <span className="hidden sm:inline">Insights</span>
                  </TabsTrigger>
                </TabsList>
                
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  <span>Last updated: {new Date().toLocaleString()}</span>
                </div>
              </div>
              
              <TabsContent value="list" className="space-y-4">
                <TeacherList teachers={filteredTeachers} />
              </TabsContent>
              
              <TabsContent value="analytics" className="space-y-4">
                <PerformanceAnalytics teachers={filteredTeachers} />
              </TabsContent>
              
              <TabsContent value="insights" className="space-y-4">
                <TeacherInsights teachers={filteredTeachers} />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

interface KpiChipProps {
  label: string;
  value: string;
  meta: string;
  tone: "emerald" | "cyan" | "sky";
}

const toneMap: Record<KpiChipProps["tone"], string> = {
  emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-900",
  cyan: "from-cyan-500/20 to-cyan-500/5 text-cyan-900",
  sky: "from-sky-500/20 to-sky-500/5 text-sky-900",
};

const KpiChip = ({ label, value, meta, tone }: KpiChipProps) => (
  <div className={`rounded-2xl border border-white/70 bg-gradient-to-br ${toneMap[tone]} p-4 shadow-sm`}> 
    <p className="text-xs uppercase tracking-wide text-slate-600">{label}</p>
    <p className="mt-2 text-2xl font-semibold">{value}</p>
    <p className="text-xs text-muted-foreground">{meta}</p>
  </div>
);

interface ProgressRowProps {
  label: string;
  value: number;
}

const ProgressRow = ({ label, value }: ProgressRowProps) => (
  <div>
    <div className="flex items-center justify-between text-xs">
      <span>{label}</span>
      <span>{Math.round(value)}%</span>
    </div>
    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-gradient-to-r from-primary/80 to-emerald-400" style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
    </div>
  </div>
);

interface MiniStatProps {
  title: string;
  value: string;
  subtitle: string;
  tone: "emerald" | "sky";
}

const miniToneMap: Record<MiniStatProps["tone"], { container: string; value: string }> = {
  emerald: {
    container: "border border-emerald-200 bg-emerald-50/70",
    value: "text-emerald-900",
  },
  sky: {
    container: "border border-sky-200 bg-sky-50/70",
    value: "text-sky-900",
  },
};

const MiniStat = ({ title, value, subtitle, tone }: MiniStatProps) => (
  <div className={`rounded-2xl p-3 ${miniToneMap[tone].container}`}>
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
    <p className={`text-xl font-semibold ${miniToneMap[tone].value}`}>{value}</p>
    <p className="text-xs text-muted-foreground">{subtitle}</p>
  </div>
);

function averageMetric(collection: TeacherData[], selector: (teacher: TeacherData) => number) {
  if (!collection.length) return 0;
  const total = collection.reduce((sum, teacher) => sum + selector(teacher), 0);
  return total / collection.length;
}

interface TreemapNodeData {
  name: string;
  size: number;
  score: number;
  engagement: number;
  fill: string;
}

type TreemapTileProps = Partial<TreemapNodeData> & {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

const TreemapTile = (tileProps: TreemapTileProps | any) => {
  const { x = 0, y = 0, width = 0, height = 0, fill = "#0EA5E9", name, score = 0 } = tileProps as TreemapTileProps;
  const safeName = (name ?? "Cohort").trim();
  const shortName = safeName ? safeName.split(" ")[0] : "Cohort";

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} rx={10} ry={10} opacity={0.95} />
      {width > 40 && height > 30 ? (
        <text x={x + 8} y={y + 18} fill="#fff" fontSize={12} fontWeight="600">
          {shortName}
        </text>
      ) : null}
      {width > 40 && height > 45 ? (
        <text x={x + 8} y={y + 34} fill="#f0fdf4" fontSize={10} opacity={0.9}>
          {score}%
        </text>
      ) : null}
    </g>
  );
};

interface FilterControlsProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  subjectFilter: string;
  onSubjectChange: (value: string) => void;
  performanceFilter: string;
  onPerformanceChange: (value: string) => void;
  monthFilter: string;
  onMonthChange: (value: string) => void;
  months: string[];
  subjects: string[];
  resultCount: number;
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-");
  if (!year || !month) return monthKey;

  const monthIndex = Number(month) - 1;
  if (Number.isNaN(monthIndex)) return monthKey;

  const date = new Date(Number(year), monthIndex);
  if (Number.isNaN(date.getTime())) return monthKey;

  const monthLabel = date.toLocaleString("en-US", { month: "short" }).toUpperCase();
  return `${monthLabel} ${year}`;
}

const FilterControls = ({
  searchTerm,
  onSearchChange,
  subjectFilter,
  onSubjectChange,
  performanceFilter,
  onPerformanceChange,
  monthFilter,
  onMonthChange,
  months,
  subjects,
  resultCount,
}: FilterControlsProps) => (
  <div className="bg-card p-4 rounded-lg border">
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search teachers or subjects..."
          className="pl-10"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <Select value={subjectFilter} onValueChange={onSubjectChange}>
        <SelectTrigger className="w-full">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span>{subjectFilter === "all" ? "All Subjects" : subjectFilter}</span>
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Subjects</SelectItem>
          {subjects.map((subject) => (
            <SelectItem key={subject} value={subject}>
              {subject}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={performanceFilter} onValueChange={onPerformanceChange}>
        <SelectTrigger className="w-full">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span>
              {performanceFilter === "all" && "All Performance"}
              {performanceFilter === "excellent" && "Excellent (80-100)"}
              {performanceFilter === "good" && "Good (60-79)"}
              {performanceFilter === "needs_improvement" && "Needs Improvement (<60)"}
            </span>
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Performance</SelectItem>
          <SelectItem value="excellent">Excellent (80-100)</SelectItem>
          <SelectItem value="good">Good (60-79)</SelectItem>
          <SelectItem value="needs_improvement">Needs Improvement (&lt;60)</SelectItem>
        </SelectContent>
      </Select>

      <Select value={monthFilter} onValueChange={onMonthChange}>
        <SelectTrigger className="w-full">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{monthFilter === "all" ? "All Months" : formatMonthLabel(monthFilter)}</span>
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Months</SelectItem>
          {months.map((month) => (
            <SelectItem key={month} value={month}>
              {formatMonthLabel(month)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="text-sm text-muted-foreground flex items-center justify-end">
        {resultCount} {resultCount === 1 ? "teacher" : "teachers"} found
      </div>
    </div>
  </div>
);

export default TeacherPortal;
