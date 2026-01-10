import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TeamPage() {
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
          <CardTitle>Your Team</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Team performance tracking coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
