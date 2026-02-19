import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchGoogleSheetData } from "@/lib/googleSheets";
import { fetchTeacherPunchData, TeacherPunchEntry } from "@/lib/teacherPunches";
import { TeacherData } from "@/pages/TeacherPortal";
import { Loader2, ArrowLeft, Mail, FileText, AlertCircle, CheckCircle2, Settings } from "lucide-react";
import emailjs from "@emailjs/browser";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STUDENT_RATE_RULES = [
  { label: "0–30 students", max: 30, rate: 300 },
  { label: "31–50 students", max: 50, rate: 400 },
  { label: "51+ students", max: Infinity, rate: 500 },
];

const formatMonthLabel = (monthKey: string): string => {
  const [year, month] = monthKey.split("-");
  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const monthIndex = parseInt(month, 10) - 1;
  return `${monthNames[monthIndex]} ${year}`;
};

const getRateForStudents = (studentCount: number): number => {
  if (studentCount <= 30) return 300;
  if (studentCount <= 50) return 400;
  return 500;
};

const AdminInvoices = () => {
  const [teachers, setTeachers] = useState<TeacherData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [punchEntries, setPunchEntries] = useState<TeacherPunchEntry[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const [teacherEmails, setTeacherEmails] = useState<Record<string, string>>({});
  const [fillAllEmail, setFillAllEmail] = useState<string>("");
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [emailConfig, setEmailConfig] = useState({
    serviceId: localStorage.getItem("emailjs_service_id") || "",
    templateId: localStorage.getItem("emailjs_template_id") || "",
    publicKey: localStorage.getItem("emailjs_public_key") || "",
  });
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0, status: "" });

  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      try {
        const [qualityData, punchData] = await Promise.all([
          fetchGoogleSheetData(),
          fetchTeacherPunchData(),
        ]);
        setTeachers(qualityData.filter((t) => t.hasAssignedTeacher));
        setPunchEntries(punchData);
      } catch (error) {
        console.error("Failed to load invoice data", error);
        toast({
          title: "Error",
          description: "Failed to load teacher or attendance data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [toast]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    punchEntries.forEach((entry) => {
      if (entry.monthKey) {
        months.add(entry.monthKey);
      }
    });
    return Array.from(months).sort().reverse();
  }, [punchEntries]);

  useEffect(() => {
    if (availableMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  const teacherSubjectLookup = useMemo(() => {
    const lookup = new Map<string, string>();
    teachers.forEach((teacher) => {
      lookup.set(teacher.name, teacher.subject);
    });
    return lookup;
  }, [teachers]);

  const qualityByTeacherMonth = useMemo(() => {
    const map = new Map<string, { sum: number; count: number }>();
    teachers.forEach((teacher) => {
      teacher.sessions.forEach((session) => {
        if (!session.monthKey) return;
        const key = `${teacher.name}__${session.monthKey}`;
        const existing = map.get(key) ?? { sum: 0, count: 0 };
        existing.sum += session.score;
        existing.count += 1;
        map.set(key, existing);
      });
    });
    return map;
  }, [teachers]);

  type InvoiceRow = {
    id: string;
    name: string;
    subject: string;
    classes: number;
    mergedClasses: number;
    effectiveClasses: number;
    quality: number;
    payout: number;
    totalStudents: number;
  };

  const invoiceData = useMemo<InvoiceRow[]>(() => {
    if (!selectedMonth) return [];

    const grouped = new Map<string, InvoiceRow>();

    punchEntries.forEach((entry) => {
      if (entry.monthKey !== selectedMonth) return;

      const teacherName = entry.teacher || "Unassigned";
      const existing = grouped.get(teacherName) ?? {
        id: teacherName,
        name: teacherName,
        subject: entry.subject || teacherSubjectLookup.get(teacherName) || "Unspecified",
        classes: 0,
        mergedClasses: 0,
        effectiveClasses: 0,
        quality: 0,
        payout: 0,
        totalStudents: 0,
      };

      existing.classes += 1;
      if (entry.merged) {
        existing.mergedClasses += 1;
      }
      existing.totalStudents += entry.students || 0;

      grouped.set(teacherName, existing);
    });

    const rows: InvoiceRow[] = Array.from(grouped.values()).map((teacher) => {
      const qualityRecord = qualityByTeacherMonth.get(`${teacher.name}__${selectedMonth}`);
      const avgQuality = qualityRecord && qualityRecord.count > 0 ? Math.round(qualityRecord.sum / qualityRecord.count) : 0;
      const effectiveClasses = Math.max(teacher.classes - teacher.mergedClasses, 0);
      const payout = effectiveClasses * avgQuality;

      return {
        ...teacher,
        quality: avgQuality,
        effectiveClasses,
        payout,
      };
    });

    return rows.sort((a, b) => b.payout - a.payout);
  }, [punchEntries, selectedMonth, teacherSubjectLookup, qualityByTeacherMonth]);

  const totalPayout = useMemo(() => {
    return invoiceData.reduce((sum, t) => sum + t.payout, 0);
  }, [invoiceData]);

  const handleEmailChange = (teacherId: string, email: string) => {
    setTeacherEmails((prev) => ({ ...prev, [teacherId]: email }));
  };

  const handleFillAllEmails = () => {
    if (!fillAllEmail) return;
    const filled: Record<string, string> = {};
    invoiceData.forEach((t) => {
      filled[t.id] = fillAllEmail;
    });
    setTeacherEmails(filled);
  };

  const getValidEmailCount = () => {
    return invoiceData.filter((t) => teacherEmails[t.id]?.includes("@")).length;
  };

  const saveEmailConfig = () => {
    localStorage.setItem("emailjs_service_id", emailConfig.serviceId);
    localStorage.setItem("emailjs_template_id", emailConfig.templateId);
    localStorage.setItem("emailjs_public_key", emailConfig.publicKey);
    setShowConfigDialog(false);
    toast({ title: "Config Saved", description: "EmailJS configuration saved successfully" });
  };

  const isEmailConfigValid = () => {
    return emailConfig.serviceId && emailConfig.templateId && emailConfig.publicKey;
  };

  const handleSendInvoices = async () => {
    if (!isEmailConfigValid()) {
      toast({
        title: "Configuration Required",
        description: "Please configure EmailJS settings first",
        variant: "destructive",
      });
      setShowConfirmDialog(false);
      setShowConfigDialog(true);
      return;
    }

    setSending(true);
    const teachersToSend = invoiceData.filter((t) => teacherEmails[t.id]?.includes("@"));
    setSendProgress({ current: 0, total: teachersToSend.length, status: "Starting..." });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < teachersToSend.length; i++) {
      const teacher = teachersToSend[i];
      const email = teacherEmails[teacher.id];
      setSendProgress({ current: i + 1, total: teachersToSend.length, status: `Sending to ${teacher.name}...` });

      try {
        await emailjs.send(
          emailConfig.serviceId,
          emailConfig.templateId,
          {
            to_email: email,
            to_name: teacher.name,
            month: formatMonthLabel(selectedMonth),
            classes: teacher.classes,
            payout: `₹${teacher.payout.toLocaleString()}`,
            subject: teacher.subject,
          },
          emailConfig.publicKey
        );
        successCount++;
      } catch (error) {
        console.error(`Failed to send to ${teacher.name}:`, error);
        failCount++;
      }

      // Small delay between emails to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    setSending(false);
    setShowConfirmDialog(false);
    setSendProgress({ current: 0, total: 0, status: "" });

    toast({
      title: failCount === 0 ? "Invoices Sent" : "Partially Sent",
      description: `Sent ${successCount} invoices${failCount > 0 ? `, ${failCount} failed` : ""} for ${formatMonthLabel(selectedMonth)}`,
      variant: failCount > 0 ? "destructive" : "default",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-600" />
          <p className="mt-2 text-gray-600">Loading teacher data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-900 text-white">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/teachers")}
              className="text-white hover:bg-white/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Invoice Management</h1>
              <p className="text-purple-200 text-sm">Generate and send monthly invoices to teachers</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowConfigDialog(true)}
              className="text-white hover:bg-white/10"
              title="EmailJS Settings"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Panel - Configuration */}
          <div className="space-y-6">
            {/* Month Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Select Month</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMonths.map((month) => (
                      <SelectItem key={month} value={month}>
                        {formatMonthLabel(month)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Rate Structure */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Rate Structure</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-gray-700">
                <p>Per-class payout is determined by total students present in that punch entry:</p>
                <ul className="space-y-1">
                  {STUDENT_RATE_RULES.map((rule) => (
                    <li key={rule.label} className="flex justify-between border rounded-md px-3 py-2">
                      <span>{rule.label}</span>
                      <span className="font-semibold">₹{rule.rate}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-gray-500">
                  Counts are sourced from the teacher punch sheet (primary + secondary students).
                </p>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Teachers</span>
                    <span className="font-semibold">{invoiceData.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Classes</span>
                    <span className="font-semibold">
                      {invoiceData.reduce((sum, t) => sum + t.classes, 0)}
                    </span>
                  </div>
                  <div className="border-t pt-3 flex justify-between">
                    <span className="text-gray-700 font-medium">Total Payout</span>
                    <span className="font-bold text-purple-700 text-lg">
                      ₹{totalPayout.toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Send Button */}
            <Button
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              size="lg"
              onClick={() => setShowConfirmDialog(true)}
              disabled={getValidEmailCount() === 0}
            >
              <Mail className="h-5 w-5 mr-2" />
              Send Invoices ({getValidEmailCount()}/{invoiceData.length})
            </Button>
          </div>

          {/* Right Panel - Invoice Preview */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Invoice Preview - {selectedMonth ? formatMonthLabel(selectedMonth) : ""}
                </CardTitle>
                {/* Fill All Emails */}
                <div className="flex items-center gap-2 mt-3">
                  <Input
                    type="email"
                    placeholder="Enter your test email"
                    value={fillAllEmail}
                    onChange={(e) => setFillAllEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    onClick={handleFillAllEmails}
                    disabled={!fillAllEmail}
                    className="whitespace-nowrap"
                  >
                    Fill All
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Enter your email above and click "Fill All" to test with your email</p>
              </CardHeader>
              <CardContent>
                {invoiceData.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <AlertCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No teachers found for this month</p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Teacher</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead className="text-center">Classes</TableHead>
                          <TableHead className="text-center">Merged</TableHead>
                          <TableHead className="text-center">Quality</TableHead>
                          <TableHead className="text-right">Salary</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoiceData.map((teacher, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <div className="font-medium">{teacher.name}</div>
                              <div className="text-xs text-gray-500">{teacher.subject}</div>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="email"
                                placeholder="email@example.com"
                                value={teacherEmails[teacher.id] || ""}
                                onChange={(e) => handleEmailChange(teacher.id, e.target.value)}
                                className="w-48 h-8 text-sm"
                              />
                            </TableCell>
                            <TableCell className="text-center">{teacher.classes}</TableCell>
                            <TableCell className="text-center">{teacher.mergedClasses}</TableCell>
                            <TableCell className="text-center">{teacher.quality}</TableCell>
                            <TableCell className="text-right font-medium">
                              ₹{teacher.payout.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Send Invoices</DialogTitle>
            <DialogDescription>
              You are about to send invoices to {invoiceData.length} teachers for{" "}
              {selectedMonth ? formatMonthLabel(selectedMonth) : ""}.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 my-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">This action will send {getValidEmailCount()} emails:</p>
                <ul className="list-disc ml-4 mt-1 space-y-1 max-h-32 overflow-y-auto">
                  {invoiceData
                    .filter((t) => teacherEmails[t.id]?.includes("@"))
                    .map((t) => (
                      <li key={t.id}>
                        {t.name} → {teacherEmails[t.id]} (₹{t.payout.toLocaleString()})
                      </li>
                    ))}
                </ul>
                <p className="mt-2 font-medium">Total payout: ₹{totalPayout.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} disabled={sending}>
              Cancel
            </Button>
            <Button
              onClick={handleSendInvoices}
              disabled={sending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {sendProgress.status || `Sending ${sendProgress.current}/${sendProgress.total}...`}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirm & Send
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EmailJS Configuration Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>EmailJS Configuration</DialogTitle>
            <DialogDescription>
              Configure your EmailJS credentials to send invoices via email.
              Get these from{" "}
              <a
                href="https://www.emailjs.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 underline"
              >
                emailjs.com
              </a>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="serviceId">Service ID</Label>
              <Input
                id="serviceId"
                placeholder="service_xxxxxxx"
                value={emailConfig.serviceId}
                onChange={(e) => setEmailConfig((prev) => ({ ...prev, serviceId: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="templateId">Template ID</Label>
              <Input
                id="templateId"
                placeholder="template_xxxxxxx"
                value={emailConfig.templateId}
                onChange={(e) => setEmailConfig((prev) => ({ ...prev, templateId: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="publicKey">Public Key</Label>
              <Input
                id="publicKey"
                placeholder="your_public_key"
                value={emailConfig.publicKey}
                onChange={(e) => setEmailConfig((prev) => ({ ...prev, publicKey: e.target.value }))}
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <p className="font-medium mb-1">Template Variables:</p>
              <p className="text-xs">
                Your template should use: <code>to_email</code>, <code>to_name</code>, <code>month</code>,{" "}
                <code>classes</code>, <code>payout</code>, <code>subject</code>
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveEmailConfig} className="bg-purple-600 hover:bg-purple-700">
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminInvoices;
