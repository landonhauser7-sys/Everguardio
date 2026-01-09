import { auth } from "@/lib/auth";
import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TeamPage() {
  const session = await auth();
  const teamName = session?.user?.teamName;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-8 w-8" />
          Team
        </h1>
        <p className="text-muted-foreground">
          View your team members and performance
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{teamName || "Your Team"}</CardTitle>
        </CardHeader>
        <CardContent>
          {teamName ? (
            <p className="text-muted-foreground">
              You are a member of <strong>{teamName}</strong>. Team performance tracking coming soon.
            </p>
          ) : (
            <p className="text-muted-foreground">
              You are not currently assigned to a team. Contact your admin to be assigned.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
