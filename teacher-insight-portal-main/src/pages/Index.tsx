import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { GraduationCap, ArrowRight } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div
      className="relative min-h-screen bg-no-repeat bg-center"
      style={{ backgroundImage: "url('/careermap_teachersportal.png')", backgroundSize: "100% auto", backgroundColor: "#f4f6fb" }}
    >
      <div className="absolute inset-0 bg-black/10" />
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <Button
          size="lg"
          onClick={() => navigate('/teachers')}
          className="mt-96 rounded-full bg-primary/90 px-10 py-6 text-lg shadow-2xl hover:bg-primary"
        >
          View Teacher Dashboard
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};

export default Index;
