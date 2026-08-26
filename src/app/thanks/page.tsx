import { Button, Eyebrow } from "@/components/ui";
import { Mark } from "@/components/mark";

export const metadata = { title: "Request received · CHM" };

const copy = {
 "sign-in": {
 eyebrow: "Check your inbox",
 title: "Your sign-in link is on its way.",
 body: "The link works once and expires in fifteen minutes. If it does not arrive, check the spam folder before requesting another.",
 action: { label: "Browse the library", href: "/latest" },
 },
 walkthrough: {
 eyebrow: "Request received",
 title: "We will be in touch within two working days.",
 body: "You will get a calendar link from the partnerships team, along with the placement map for the disease state you picked.",
 action: { label: "Read how the engine works", href: "/partner#how" },
 },
 default: {
 eyebrow: "You are on the list",
 title: "The first email lands Thursday.",
 body: "Every issue covers new faculty, the formats they recorded in, and what changed in the guidelines that week.",
 action: { label: "Start watching free", href: "/latest" },
 },
};

export default async function ThanksPage({
 searchParams,
}: {
 searchParams: Promise<{ from?: string }>;
}) {
 const { from } = await searchParams;
 const c = copy[from as keyof typeof copy] ?? copy.default;

 return (
 <section aria-labelledby="thanks-heading" className="shell grid place-items-center py-28 text-center">
 <Mark className="size-14 text-amber" />
 <Eyebrow className="mt-8">{c.eyebrow}</Eyebrow>
 <h1 id="thanks-heading" className="display mt-4 max-w-[35rem] text-[2.25rem] text-text">
 {c.title}
 </h1>
 <p className="prose-lede mt-4 max-w-[30rem] text-body-m leading-relaxed text-muted">
 {c.body}
 </p>
 <p className="meta mt-6 max-w-[30rem] text-faint">
 This is a prototype, so no email was sent.
 </p>
 <div className="mt-8 flex flex-wrap justify-center gap-4">
 <Button href={c.action.href}>{c.action.label}</Button>
 <Button href="/" variant="outline">
 Back to the homepage
 </Button>
 </div>
 </section>
 );
}
