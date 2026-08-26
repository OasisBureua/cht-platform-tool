import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Get started · CHM" };

export default function JoinPage() {
  return (
    <AuthShell
      heading="Free for clinicians"
      sub="Every session, every format, one email a week. It stays free."
      footer={{ prompt: "Already have an account?", label: "Log in", href: "/login" }}
    >
      <AuthForm
        legend="Create a CHM account"
        submitLabel="Create account"
        fields={[
          {
            name: "name",
            label: "Full name",
            type: "text",
            placeholder: "Dr. Jane Okafor",
            autoComplete: "name",
          },
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
            placeholder: "At least 8 characters",
            autoComplete: "new-password",
          },
        ]}
      />

      <p className="mt-6 text-center text-body-s text-faint">
        Working in industry instead?{" "}
        <Link href="/partner" className="press rounded-[6px] text-anchor hover:brightness-110">
          See how CHM partners with pharma
        </Link>
      </p>
    </AuthShell>
  );
}
