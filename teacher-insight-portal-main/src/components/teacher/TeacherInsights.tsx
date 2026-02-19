import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TeacherData } from "@/pages/TeacherPortal";
import { AlertCircle, TrendingUp, Star, Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface TeacherInsightsProps {
  teachers: TeacherData[];
}

export const TeacherInsights = ({ teachers }: TeacherInsightsProps) => {
  // Calculate insights for each teacher
  const teacherInsights = teachers.map((teacher) => {
    const metrics = [
      { name: "Engagement", value: teacher.avgEngagement },
      { name: "Teaching Quality", value: teacher.avgInstructorPerformance },
      { name: "Content Structure", value: teacher.avgContentStructure },
      { name: "Platform Usage", value: teacher.avgPlatformUsage },
    ];

    const strengths = metrics
      .filter((m) => m.value >= 80)
      .sort((a, b) => b.value - a.value);

    const improvements = metrics
      .filter((m) => m.value < 70)
      .sort((a, b) => a.value - b.value);

    return {
      ...teacher,
      strengths,
      improvements,
      performanceLevel:
        teacher.avgScore >= 80
          ? "excellent"
          : teacher.avgScore >= 65
          ? "good"
          : teacher.avgScore >= 50
          ? "average"
          : "needs-improvement",
    };
  });

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {teacherInsights.map((teacher, index) => (
        <Card key={index} className="relative overflow-hidden">
          {teacher.performanceLevel === "excellent" && (
            <div className="absolute top-2 right-2">
              <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
            </div>
          )}
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>{teacher.name}</span>
              <span className="text-2xl font-bold text-primary">
                {teacher.avgScore}
              </span>
            </CardTitle>
            <p className="text-sm text-muted-foreground">{teacher.subject}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Performance</span>
                <span className="text-sm text-muted-foreground">
                  {teacher.classes} classes
                </span>
              </div>
              <Progress value={teacher.avgScore} className="h-3" />
            </div>

            {teacher.strengths.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-chart-3">
                  <TrendingUp className="h-4 w-4" />
                  <span>Strengths</span>
                </div>
                <div className="space-y-1">
                  {teacher.strengths.map((strength, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{strength.name}</span>
                      <span className="font-medium text-chart-3">{strength.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {teacher.improvements.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-orange-500">
                  <Target className="h-4 w-4" />
                  <span>Areas to Improve</span>
                </div>
                <div className="space-y-1">
                  {teacher.improvements.map((improvement, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{improvement.name}</span>
                      <span className="font-medium text-orange-500">
                        {improvement.value}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {teacher.improvements.length === 0 && teacher.strengths.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span>Continue improving across all areas</span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
