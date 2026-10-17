import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, Loader2, LogIn, LogOut, UserRound, SearchX } from "lucide-react";

const ScreenShell = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.08),_transparent_55%)] p-4">
    <div className="w-full max-w-md">{children}</div>
  </div>
);

interface TeacherSignInScreenProps {
  onSignIn: () => void;
  isAuthenticating: boolean;
}

export const TeacherSignInScreen = ({ onSignIn, isAuthenticating }: TeacherSignInScreenProps) => (
  <ScreenShell>
    <Card className="border-none bg-white/90 shadow-2xl">
      <CardHeader className="items-center space-y-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <GraduationCap className="h-7 w-7" />
        </div>
        <CardTitle className="text-2xl font-semibold text-slate-900">Teacher Portal</CardTitle>
        <p className="text-sm text-muted-foreground">
          Sign in with your Google account to see your own class quality numbers and how you rank among all teachers.
        </p>
      </CardHeader>
      <CardContent>
        <Button className="w-full" size="lg" onClick={onSignIn} disabled={isAuthenticating}>
          {isAuthenticating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
          Sign in with Google
        </Button>
      </CardContent>
    </Card>
  </ScreenShell>
);

interface TeacherClaimScreenProps {
  email: string;
  names: string[];
  suggestedName: string;
  isClaiming: boolean;
  onClaim: (teacherName: string) => void;
  onSignOut: () => void;
}

export const TeacherClaimScreen = ({ email, names, suggestedName, isClaiming, onClaim, onSignOut }: TeacherClaimScreenProps) => {
  const [selectedName, setSelectedName] = useState(suggestedName);

  return (
    <ScreenShell>
      <Card className="border-none bg-white/90 shadow-2xl">
        <CardHeader className="items-center space-y-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <UserRound className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-semibold text-slate-900">Link your profile</CardTitle>
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{email}</span>. Pick your name to see your dashboard — this only needs to be done once.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {names.length ? (
            <>
              <Select value={selectedName} onValueChange={setSelectedName}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select your name" />
                </SelectTrigger>
                <SelectContent>
                  {names.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button className="w-full" size="lg" onClick={() => onClaim(selectedName)} disabled={!selectedName || isClaiming}>
                {isClaiming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                This is me
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Names already linked to another account are hidden. Pick the wrong name? Ask the admin to reset it.
              </p>
            </>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              All teacher names are already linked to an account. Contact the admin if yours was claimed by mistake.
            </p>
          )}
          <Button variant="ghost" className="w-full" onClick={onSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Use a different account
          </Button>
        </CardContent>
      </Card>
    </ScreenShell>
  );
};

interface TeacherNoDataScreenProps {
  teacherName: string;
  email: string;
  onSignOut: () => void;
}

export const TeacherNoDataScreen = ({ teacherName, email, onSignOut }: TeacherNoDataScreenProps) => (
  <ScreenShell>
    <Card className="border-none bg-white/90 shadow-2xl">
      <CardHeader className="items-center space-y-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
          <SearchX className="h-7 w-7" />
        </div>
        <CardTitle className="text-2xl font-semibold text-slate-900">No data found</CardTitle>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{email}</span> is linked to <span className="font-medium text-foreground">{teacherName}</span>, but no audits exist under that name yet. Contact the admin if this looks wrong.
        </p>
      </CardHeader>
      <CardContent>
        <Button variant="outline" className="w-full" onClick={onSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </CardContent>
    </Card>
  </ScreenShell>
);
