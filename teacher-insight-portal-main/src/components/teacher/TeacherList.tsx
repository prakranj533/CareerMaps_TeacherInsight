import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TeacherData } from "@/pages/TeacherPortal";
import { Progress } from "@/components/ui/progress";
import { Trophy, TrendingUp, TrendingDown } from "lucide-react";

interface TeacherListProps {
  teachers: TeacherData[];
}

export const TeacherList = ({ teachers }: TeacherListProps) => {
  // Sort teachers by average score for ranking
  const sortedTeachers = [...teachers].sort((a, b) => b.avgScore - a.avgScore);
  
  const getPerformanceBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-chart-3 text-white">Excellent</Badge>;
    if (score >= 65) return <Badge className="bg-chart-2 text-white">Good</Badge>;
    if (score >= 50) return <Badge className="bg-orange-500 text-white">Average</Badge>;
    return <Badge variant="destructive">Needs Improvement</Badge>;
  };
  
  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (index === 1) return <Trophy className="h-5 w-5 text-gray-400" />;
    if (index === 2) return <Trophy className="h-5 w-5 text-amber-600" />;
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Teacher Rankings & Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">Rank</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead className="text-center">Classes</TableHead>
                <TableHead className="text-center">Overall Score</TableHead>
                <TableHead className="text-center">Engagement</TableHead>
                <TableHead className="text-center">Teaching Quality</TableHead>
                <TableHead className="text-center">Content</TableHead>
                <TableHead className="text-center">Platform Use</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTeachers.map((teacher, index) => (
                <TableRow key={index} className={index < 3 ? "bg-muted/50" : ""}>
                  <TableCell className="text-center font-bold">
                    <div className="flex items-center justify-center gap-2">
                      {getRankIcon(index)}
                      <span>#{index + 1}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{teacher.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{teacher.subject}</Badge>
                  </TableCell>
                  <TableCell className="text-center">{teacher.classes}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-lg font-bold text-primary">{teacher.avgScore}</span>
                      <Progress value={teacher.avgScore} className="w-20 h-2" />
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-sm font-medium">{teacher.avgEngagement}%</span>
                      <Progress value={teacher.avgEngagement} className="w-16 h-2" />
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-sm font-medium">{teacher.avgInstructorPerformance}%</span>
                      <Progress value={teacher.avgInstructorPerformance} className="w-16 h-2" />
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-sm font-medium">{teacher.avgContentStructure}%</span>
                      <Progress value={teacher.avgContentStructure} className="w-16 h-2" />
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-sm font-medium">{teacher.avgPlatformUsage}%</span>
                      <Progress value={teacher.avgPlatformUsage} className="w-16 h-2" />
                    </div>
                  </TableCell>
                  <TableCell>{getPerformanceBadge(teacher.avgScore)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
