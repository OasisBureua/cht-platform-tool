import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowRight, Mail } from 'lucide-react';
import { submitContact } from '../../api/contact';
import { Button, Card, Chip, Field, SectionHead } from '../../components/ui';
import { cn } from '../../lib/cn';

/** What a useful first message carries. Rendered as an indexed list. */
const INCLUDE = [
  'What page or feature you’re referencing',
  'Your goal (demo, pilot, production)',
  'Any compliance or review constraints',
] as const;

export default function Contact() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    organization: '',
    role: '',
    message: '',
  });
  const messageId = useId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await submitContact({
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        message: form.message || undefined,
        organization: form.organization || undefined,
        role: form.role || undefined,
      });
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background text-foreground">
      {/* ── Head ──────────────────────────────────────────── */}
      <section aria-labelledby="contact-heading">
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-16 sm:px-6 md:pb-16 md:pt-24 lg:px-8">
          <Reveal>
            <p className="text-label uppercase text-muted-foreground">Contact</p>
          </Reveal>
          <Reveal delay={60}>
            <h1
              id="contact-heading"
              className="mt-3 max-w-[14ch] text-balance text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.028em] text-foreground sm:text-[3rem]"
            >
              Let’s connect
            </h1>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-5 max-w-[54ch] text-pretty text-lg leading-relaxed text-muted-foreground">
              Questions, partnership inquiries, or product feedback: send a note and we’ll follow up.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── The form ──────────────────────────────────────── */}
      <section aria-label="Send a note">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
          <Reveal>
            <SectionHead index="01 / Message" title="Send a note" />
          </Reveal>

          <Reveal delay={60}>
            {sent ? (
              <Card className="mt-10 max-w-2xl">
                <p className="text-xl font-semibold tracking-tight text-foreground">Message sent</p>
                <p className="mt-2 max-w-[54ch] text-muted-foreground">
                  Thanks. We’ll follow up shortly. For now, you can continue browsing the catalogue.
                </p>
                <Button to="/catalog" size="lg" className="mt-6">
                  Browse Catalogue <ArrowRight className="h-4 w-4" />
                </Button>
              </Card>
            ) : (
              /* Fields carry their own surface: bg-card plus shadow on the
                 page ground, so the form needs no box drawn around it. */
              <form className="mt-10 max-w-2xl space-y-5" onSubmit={handleSubmit}>
                {error && (
                  <p
                    role="alert"
                    className="rounded-[6px] bg-destructive/10 px-4 py-3 text-sm text-destructive"
                  >
                    {error}
                  </p>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="First name"
                    placeholder="Jane"
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    required
                  />
                  <Field
                    label="Last name"
                    placeholder="Doe"
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    required
                  />
                </div>

                <Field
                  label="Email"
                  placeholder="you@company.com"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />

                {/* "Optional" moves out of the label text and onto the end of
                    the label row, so every label is just the field's name. */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="Organization"
                    aside={<Chip>Optional</Chip>}
                    placeholder="Hospital / Clinic / Company"
                    value={form.organization}
                    onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))}
                  />
                  <Field
                    label="Role"
                    aside={<Chip>Optional</Chip>}
                    placeholder="Physician / Admin / Partner"
                    value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  />
                </div>

                <div>
                  <label htmlFor={messageId} className="text-sm text-muted-foreground">
                    Message
                  </label>
                  <textarea
                    id={messageId}
                    rows={5}
                    placeholder="Tell us what you’re looking for..."
                    className={cn(
                      'mt-2 w-full rounded-[6px] bg-card px-4 py-3 text-base text-foreground shadow-card',
                      'outline-none placeholder:text-muted-foreground/70 sm:text-sm',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    )}
                    required
                    value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  />
                </div>

                <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                  <Button type="submit" size="lg" disabled={loading}>
                    {loading ? 'Sending…' : 'Send message'}
                  </Button>
                  <Button to="/about" variant="outline" size="lg">
                    Learn more
                  </Button>
                </div>
              </form>
            )}
          </Reveal>
        </div>
      </section>

      {/* ── Direct ────────────────────────────────────────── */}
      <section aria-label="Direct">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
          <Reveal>
            <SectionHead
              index="02 / Email"
              title="Direct"
              action={
                <Button to="/catalog" variant="outline">
                  Explore catalogue <ArrowRight className="h-4 w-4" />
                </Button>
              }
            />
          </Reveal>
          <Reveal delay={60}>
            <Card className="mt-10 flex max-w-2xl items-center gap-4">
              <span
                aria-hidden
                className="grid size-11 shrink-0 place-items-center rounded-[6px] bg-muted text-brand-600"
              >
                <Mail className="h-5 w-5" />
              </span>
              <span className="min-w-0 break-words font-mono text-base text-foreground">
                info@communityhealth.media
              </span>
            </Card>
          </Reveal>
        </div>
      </section>

      {/* ── What to include ───────────────────────────────── */}
      <section aria-label="What to include">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
          <Reveal>
            <SectionHead index="03 / Checklist" title="What to include" />
          </Reveal>
          <ol className="mt-10 grid gap-3 md:grid-cols-3">
            {INCLUDE.map((line, i) => (
              <li key={line}>
                <Reveal delay={60 + i * 60} className="h-full">
                  <Card className="flex h-full items-start gap-4">
                    <span className="shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 text-pretty text-foreground">{line}</span>
                  </Card>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}

/**
 * Entry motion: opacity plus a 2px lift, staggered by delay. It flips on
 * mount rather than on intersection, so nothing below the fold can be left
 * stranded invisible, and under reduced motion the hidden state is never
 * applied in the first place.
 */
function Reveal({
  delay = 0,
  className,
  children,
}: {
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        'transition-[opacity,transform] duration-500 ease-[cubic-bezier(0,0,0.2,1)] motion-reduce:transition-none',
        shown ? 'opacity-100' : 'motion-safe:translate-y-[2px] motion-safe:opacity-0',
        className,
      )}
    >
      {children}
    </div>
  );
}
