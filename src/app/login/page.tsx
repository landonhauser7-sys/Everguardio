import { redirect } from "next/navigation";
import { getServerSession, authOptions } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

// Force dynamic to prevent caching issues
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Redirect if already logged in
  const session = await getServerSession(authOptions);
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <LoginForm />
    </div>
  );
}
