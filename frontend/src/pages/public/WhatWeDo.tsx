import { useMemo, useRef, useState, type ReactNode } from 'react';
import { submitContact } from '../../api/contact';
import { ChmMark } from '../../components/brand/ChmMark';
import { Button, Card, Field, Reveal, SectionHead } from '../../components/ui';
import { cn } from '../../lib/cn';
import { useKolDirectory } from '../../hooks/useKolDirectory';

/**
 * Transplanted from chm-composio's `/partner`. The headings, the section
 * order and every sentence are that page's; none of the old What We Do
 * copy survives.
 *
 * Two slots take real platform data instead of the design's fixtures:
 * the faculty figure in the results band reads the public KOL directory,
 * and the walkthrough form posts to the same `/contact` endpoint the
 * Contact page uses, rather than routing to a static thank-you page.
 */

const STEPS = [
  {
    n: '01',
    title: 'One conversation',
    body: 'Two faculty who already disagree sit down for ninety minutes on a question your brand has a stake in. No slides, no script approval, no talking points.',
  },
  {
    n: '02',
    title: 'Four channels',
    body: 'That session becomes long-form video, a podcast episode, an editorial explainer and a set of short clips. One recording day, four distribution surfaces.',
  },
  {
    n: '03',
    title: 'Placed in the track',
    body: 'Everything lands inside the disease state where your audience already browses, next to the sessions they came for.',
  },
  {
    n: '04',
    title: 'Measured on completion',
    body: 'Not impressions. Completion rate, post-test pass rate and repeat visits by faculty, reported monthly.',
  },
] as const;

const FORMATS = [
  ['Long-form video', '18 to 30 min', 'The full case discussion, chaptered.'],
  ['Podcast episode', '25 to 40 min', 'Audio cut, syndicated across the four CHM shows.'],
  ['Editorial explainer', '5 to 8 min read', 'Written by faculty, not by a medical writer.'],
  ['Short clips', '45 to 90 sec', 'Cut for social and for in-feed placement.'],
] as const;

const DISEASE_STATES = ['Breast', 'Lung', 'GI', 'GU', 'Hematology', 'Gynecologic'] as const;

export default function WhatWeDo() {
  return (
    <div className="bg-background">
      {/* ── Masthead ─────────────────────────────────────────
          Permanently dark: everything in here is fixed white or
          the fixed on-deep amber, never a page-following token. */}
      <section aria-labelledby="partner-heading" className="relative overflow-hidden bg-cta-deep">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-[260px] right-[-140px] h-[700px] w-[700px] rounded-[6px] bg-signature/[0.16] blur-[75px]"
        />
        <div className="rail relative flex flex-wrap items-center justify-between gap-10 py-16">
          <div>
            <p className="eyebrow text-amber-on-deep">For pharma partners</p>
            <h1
              id="partner-heading"
              className="display display-tight mt-4 max-w-[48rem] text-[2.5rem] text-white md:text-[3.125rem]"
            >
              Whole-brand education starts with the audience.
            </h1>
            <p className="mt-6 max-w-[540px] text-[1.0625rem] leading-relaxed text-white/75">
              CHM does not sell impressions against a banner. We sell the completed session, the
              faculty relationship behind it, and the four channels one recording produces.
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Button
                href="#walkthrough"
                className="bg-amber-on-deep text-on-bright shadow-none hover:bg-amber-on-deep hover:brightness-[0.96]"
              >
                Book a walkthrough
              </Button>
              <Button
                to="/catalog"
                variant="outline"
                className="bg-white/10 text-white shadow-none hover:bg-white/[0.18] hover:shadow-none"
              >
                Browse the library
              </Button>
            </div>
          </div>
          <ChmMark className="hidden h-[118px] w-[120px] text-amber-on-deep lg:block" />
        </div>
      </section>

      {/* ── How the content engine works ─────────────────── */}
      <Band id="how" label="How the content engine works">
        <Reveal>
          <SectionHead
            title="How the content engine works"
            sub="One conversation, every channel."
          />
        </Reveal>
        <ul className="mt-8 grid gap-[13px] md:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.n} delay={i * 60} className="h-full">
              <Card className="h-full p-7">
                <p className="display display-tight text-[1.75rem] tabular-nums text-amber">{s.n}</p>
                <h3 className="display display-tight mt-4 text-display-s text-text">{s.title}</h3>
                <p className="prose-lede mt-3 text-body-s text-muted2">{s.body}</p>
              </Card>
            </Reveal>
          ))}
        </ul>
      </Band>

      {/* ── What one recording produces ──────────────────── */}
      <Band label="What one recording produces">
        <Reveal>
          <SectionHead title="What one recording produces" />
        </Reveal>
        <Reveal delay={60}>
          <Card className="mt-7 overflow-hidden p-0">
            {FORMATS.map(([name, len, note], i) => (
              <div
                key={name}
                className={cn(
                  'grid gap-3 px-7 py-6 md:grid-cols-[220px_160px_1fr]',
                  i > 0 && 'border-t border-hairline',
                )}
              >
                <p className="display text-body-l text-text">{name}</p>
                <p className="meta text-anchor">{len}</p>
                <p className="text-body-s text-muted2">{note}</p>
              </div>
            ))}
          </Card>
        </Reveal>
      </Band>

      <Results />

      {/* ── Book a walkthrough ───────────────────────────── */}
      <section id="walkthrough" aria-labelledby="walkthrough-heading">
        <div className="rail pb-16">
          <Card className="grid gap-10 p-10 lg:grid-cols-[1fr_26.25rem] lg:items-start">
            <div>
              <p className="eyebrow text-muted2">Book a walkthrough</p>
              <h2
                id="walkthrough-heading"
                className="display display-tight mt-3 text-[1.875rem] text-text"
              >
                Thirty minutes, and we show you the back end.
              </h2>
              <p className="prose-lede mt-4 max-w-[440px] text-body-m text-muted2">
                Completion curves by session, faculty reach by channel, and the placement map for
                your disease state. No deck.
              </p>
            </div>

            <WalkthroughForm />
          </Card>
        </div>
      </section>
    </div>
  );
}

/**
 * The results band. Permanently dark, so it takes fixed white and the
 * fixed on-deep amber rather than the page tokens.
 *
 * The faculty figure is the one number here the platform actually holds:
 * it is the public KOL directory's own total, and falls back to the
 * design's figure only while the query is in flight.
 */
function Results() {
  const directory = useKolDirectory({ surface: 'public' });

  const stats = useMemo(
    () =>
      [
        ['92%', 'session completion', 'Against a CME category average nearer 40%.'],
        ['2.4M', 'annual views', 'Across video, podcast and editorial.'],
        [
          directory.total > 0 ? String(directory.total) : '140+',
          'KOL faculty',
          'Practicing clinicians with their own audiences.',
        ],
      ] as const,
    [directory.total],
  );

  return (
    <section aria-label="What the engine returns">
      <div className="rail pb-14">
        <Reveal>
          <div className="grid gap-8 rounded-[24px] bg-cta-deep p-10 md:grid-cols-3">
            {stats.map(([n, l, note]) => (
              <div key={l}>
                <p className="display display-tight text-[2.625rem] tabular-nums text-amber-on-deep">
                  {n}
                </p>
                <p className="meta mt-2 text-white/70">{l}</p>
                <p className="mt-3 text-body-s leading-normal text-white/75">{note}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** Full-bleed band; the inner rail carries the page margins. */
function Band({ children, label, id }: { children: ReactNode; label: string; id?: string }) {
  return (
    <section id={id} aria-label={label}>
      <div className="rail py-14">{children}</div>
    </section>
  );
}

type FormState = { name: string; email: string; company: string; disease: string };
type FormErrors = Partial<Record<keyof FormState, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The walkthrough request. The design's version validates on submit,
 * moves focus to the first field that failed, and then navigates to a
 * static thank-you route. This platform has no such route and does have
 * a real endpoint, so the same four fields post to `/contact` and the
 * panel confirms in place.
 */
function WalkthroughForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    company: '',
    disease: DISEASE_STATES[0],
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const set = (key: keyof FormState) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const next: FormErrors = {};
    if (!form.name.trim()) next.name = 'Enter your name';
    if (!form.email.trim()) next.email = 'Enter your work email';
    else if (!EMAIL.test(form.email.trim()))
      next.email = 'Enter an email in the format name@hospital.org';
    if (!form.company.trim()) next.company = 'Enter your company';

    setErrors(next);

    // The first field that failed takes focus, so the message is not
    // only announced but arrived at.
    const firstBad = (['name', 'email', 'company'] as const).find((k) => next[k]);
    if (firstBad) {
      formRef.current?.querySelector<HTMLElement>(`[name="${firstBad}"]`)?.focus();
      return;
    }

    setPending(true);
    setFailed(null);
    try {
      // One name field, two API fields: a single-word name goes in both
      // rather than posting an empty last name.
      const [first, ...rest] = form.name.trim().split(/\s+/);
      await submitContact({
        firstName: first,
        lastName: rest.join(' ') || first,
        email: form.email.trim(),
        organization: form.company.trim(),
        role: 'Pharma partner',
        message: `Walkthrough request. Disease state of interest: ${form.disease}.`,
      });
      setSent(true);
    } catch (err: unknown) {
      setFailed(
        err instanceof Error ? err.message : 'That did not send. Try again in a moment.',
      );
    } finally {
      setPending(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-[6px] bg-surface p-7 shadow-card">
        <p className="display text-body-l text-text">Request received</p>
        <p className="prose-lede mt-2 text-body-m text-muted2">
          Someone will write back to set the thirty minutes, usually the same day.
        </p>
        <Button to="/catalog" variant="outline" className="mt-6">
          Browse the library
        </Button>
      </div>
    );
  }

  return (
    <form ref={formRef} noValidate onSubmit={handleSubmit} className="space-y-5">
      {failed && (
        <p role="alert" className="rounded-[6px] bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {failed}
        </p>
      )}

      <Field
        label="Name"
        name="name"
        autoComplete="name"
        value={form.name}
        error={errors.name}
        onChange={(e) => set('name')(e.target.value)}
      />

      <Field
        label="Work email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        hint="Use the address your institution issued, so we can verify you are a clinician."
        value={form.email}
        error={errors.email}
        onChange={(e) => set('email')(e.target.value)}
      />

      <Field
        label="Company"
        name="company"
        autoComplete="organization"
        value={form.company}
        error={errors.company}
        onChange={(e) => set('company')(e.target.value)}
      />

      <div>
        <label htmlFor="walkthrough-disease" className="text-sm text-muted-foreground">
          Disease state of interest
        </label>
        <select
          id="walkthrough-disease"
          name="disease"
          value={form.disease}
          onChange={(e) => set('disease')(e.target.value)}
          className="mt-2 h-12 w-full rounded-[6px] bg-card px-4 text-base text-foreground shadow-card outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:text-sm"
        >
          {DISEASE_STATES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Sending your request' : 'Request the walkthrough'}
      </Button>
    </form>
  );
}
