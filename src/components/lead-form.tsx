"use client";

import { useRouter } from "next/navigation";
import { Form, emailField } from "./form";

export function WalkthroughForm() {
 const router = useRouter();
 return (
 <Form
 submitLabel="Request the walkthrough"
 pendingLabel="Sending your request"
 onDone={() => router.push("/thanks?from=walkthrough")}
 fields={[
 { name: "name", label: "Name", autoComplete: "name" },
 emailField,
 { name: "company", label: "Company", autoComplete: "organization" },
 {
 name: "disease",
 label: "Disease state of interest",
 options: ["Breast", "Lung", "GI", "GU", "Hematology", "Gynecologic"],
 },
 ]}
 />
 );
}

export function SignInForm() {
 const router = useRouter();
 return (
 <Form
 submitLabel="Send me a sign-in link"
 pendingLabel="Sending your link"
 onDone={() => router.push("/thanks?from=sign-in")}
 fields={[
 emailField,
 {
 name: "npi",
 label: "NPI number",
 optional: true,
 inputMode: "numeric",
 hint: "Adding it now means credits are ready to claim on your first session.",
 validate: (v) =>
 !v.trim() || /^\d{10}$/.test(v.trim())
 ? null
 : "Enter the 10 digits of your NPI, or leave this empty",
 },
 ]}
 />
 );
}
