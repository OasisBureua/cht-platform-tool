import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Log in · CHM" };

export default function LoginPage() {
  return (
    <AuthShell
      heading="Welcome back"
      sub="Sign in to pick up where you left off."
      footer={{ prompt: "No account yet?", label: "Get started", href: "/join" }}
    >
      <AuthForm
        legend="Sign in to CHM"
        submitLabel="Sign in"
        fields={[
          {
            name: "email",
            label: "Work email",
            type: "email",
            placeholder: "name@hospital.org",
            autoComplete: "email",
          },
          {
            name: "password",
            label: "Password",
            type: "password",
            placeholder: "Your password",
            autoComplete: "current-password",
            aside: { label: "Forgot?", href: "/contact" },
          },
        ]}
      />
    </AuthShell>
  );
}
