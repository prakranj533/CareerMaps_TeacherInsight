import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { PARTNER_TYPES } from "@/lib/demoPartners";

const Index = () => {
  const navigate = useNavigate();
  const [partner, setPartner] = useState("");

  const go = () => {
    if (partner === "cashpor") navigate("/teachers");
    else if (partner) navigate(`/partner/${partner}`);
  };

  return (
    <div
      className="relative min-h-screen bg-no-repeat bg-center"
      style={{ backgroundImage: "url('/careermap_teachersportal.png')", backgroundSize: "100% auto", backgroundColor: "#f4f6fb" }}
    >
      <div className="absolute inset-0 bg-black/10" />
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="mt-96 flex w-full max-w-sm flex-col items-stretch gap-3 rounded-3xl bg-white/90 p-6 shadow-2xl backdrop-blur">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-primary">
            Select your partner type
          </p>
          <Select value={partner} onValueChange={setPartner}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Cashpor, Schools, Colleges…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cashpor">Cashpor</SelectItem>
              {PARTNER_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="lg" onClick={go} disabled={!partner} className="rounded-full bg-primary/90 px-10 py-6 text-lg hover:bg-primary">
            {partner === "cashpor" ? "View Teacher Dashboard" : "View Partner Portal"}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
