import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Building2 } from "lucide-react";
import { PunchAnalytics } from "@/components/teacher/PunchAnalytics";
import { PARTNER_TYPES, demoPunchEntries, partnerInstitutions, type PartnerType } from "@/lib/demoPartners";

const PartnerPortal = () => {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const partnerType = PARTNER_TYPES.find((partner) => partner.value === type);
  const institutions = useMemo(
    () => (partnerType ? partnerInstitutions(partnerType.value as Exclude<PartnerType, "cashpor">) : []),
    [partnerType]
  );
  const [institution, setInstitution] = useState<string | null>(institutions[0] ?? null);

  const entries = useMemo(
    () => (partnerType && institution ? demoPunchEntries(partnerType.value as Exclude<PartnerType, "cashpor">, institution) : []),
    [partnerType, institution]
  );

  if (!partnerType) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Unknown partner type. <Button variant="link" onClick={() => navigate("/")}>Go back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.06),_transparent_55%)] p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate("/")} aria-label="Go back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{partnerType.label} Portal</h1>
            </div>
          </div>
          <Select value={institution ?? ""} onValueChange={setInstitution}>
            <SelectTrigger className="w-full sm:w-80">
              <SelectValue placeholder={`Select a ${partnerType.noun.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {institutions.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {institution && (
          <Card className="border-none bg-white/90 shadow-lg">
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <Building2 className="h-5 w-5" />
                <span className="text-xs font-semibold uppercase tracking-[0.3em]">{partnerType.noun}</span>
              </div>
              <CardTitle className="text-2xl font-semibold text-slate-900">{institution}</CardTitle>
            </CardHeader>
          </Card>
        )}

        {institution && (
          <PunchAnalytics
            entries={entries}
            title="Class records"
            description="Attendance and class data for this institution."
            detailed
          />
        )}
      </div>
    </div>
  );
};

export default PartnerPortal;
