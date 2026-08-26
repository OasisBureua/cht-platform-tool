import { redirect } from "next/navigation";

/** Kept as a redirect: /login is the one sign-in screen. */
export default function SignInPage() {
  redirect("/login");
}
