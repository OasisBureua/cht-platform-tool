import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { submitContact } from '../../api/contact';
import { ChmMark } from '../../components/brand/ChmMark';
import { Button, Card, Reveal } from '../../components/ui';
import { cn } from '../../lib/cn';

/**
 * Who the platform reaches. Two columns per row: the audience, then what
 * reaching them actually means.
 */
const AUDIENCES = [
  { label: 'HCPs', blurb: 'Beyond conferences and CME, where they actually consume content.' },
  { label: 'Patients', blurb: 'Pre- or active treatment, searching for credible information.' },
  { label: 'Caregivers', blurb: 'Making decisions, seeking guidance, needing support.' },
] as const;

type FieldName = 'name' | 'email' | 'organisation' | 'message';

type FieldSpec = {
  name: FieldName;
  label: string;
  type?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'email' | 'numeric' | 'tel';
  hint?: string;
  optional?: boolean;
  validate?: (v: string) => string | null;
};

/**
 * Hints appear before the mistake and are phrased as what to do; the
 * error that follows says what to change, so colour is never the only
 * signal. The name is split into first and last on the way out, which is
 * why it asks for both up front rather than rejecting one word later.
 */
const FIELDS: FieldSpec[] = [
  {
    name: 'name',
    label: 'Name',
    autoComplete: 'name',
    hint: 'First and last, so the reply is addressed to a person.',
    validate: (v) => {
      const parts = v.trim().split(/\s+/).filter(Boolean);
      if (parts.length === 0) return 'Enter your name';
      if (parts.length < 2) return 'Enter a first and last name, for example Jane Doe';
      return null;
    },
  },
  {
    name: 'email',
    label: 'Work email',
    type: 'email',
    autoComplete: 'email',
    inputMode: 'email',
    hint: 'Use an address you read, because the reply comes back to it.',
    validate: (v) =>
      !v.trim()
        ? 'Enter your work email'
        : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
          ? null
          : 'Enter an email in the format name@hospital.org',
  },
  {
    name: 'organisation',
    label: 'Organisation',
    autoComplete: 'organization',
    optional: true,
  },
  {
    name: 'message',
    label: 'What is this about?',
    validate: (v) => (v.trim() ? null : 'Tell us what this is about, even in one line'),
  },
];

const INPUT_BASE =
  'mt-2 w-full rounded-[6px] bg-ground text-base text-text outline-none sm:text-[0.9375rem] ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/** The invalid state is a 1.5px anchor-coloured ring, not a tint. */
const ringFor = (invalid: boolean) =>
  invalid ? 'shadow-[0_0_0_1.5px_var(--color-anchor)]' : 'shadow-card';

export default function Contact() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<FieldName, string>>({
    name: '',
    email: '',
    organisation: '',
    message: '',
  });
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const baseId = useId();

  const set = (name: FieldName, v: string) => setValues((f) => ({ ...f, [name]: v }));

  /**
   * Validation runs on submit, the first invalid field takes focus, and
   * each message is tied to its control with aria-describedby so it
   * announces where it happened. Only then does the note go out.
   */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const next: Partial<Record<FieldName, string>> = {};
    for (const f of FIELDS) {
      const value = values[f.name];
      const check =
        f.validate ??
        ((v: string) => (f.optional || v.trim() ? null : `Enter your ${f.label.toLowerCase()}`));
      const message = check(value);
      if (message) next[f.name] = message;
    }
    setErrors(next);

    const firstBad = FIELDS.find((f) => next[f.name]);
    if (firstBad) {
      formRef.current?.querySelector<HTMLElement>(`[name="${firstBad.name}"]`)?.focus();
      return;
    }

    setError(null);
    setLoading(true);
    try {
      // The wire wants the halves separately; the form asks once.
      const parts = values.name.trim().split(/\s+/);
      await submitContact({
        email: values.email.trim(),
        firstName: parts[0],
        lastName: parts.slice(1).join(' '),
        message: values.message.trim() || undefined,
        organization: values.organisation.trim() || undefined,
      });
      setSent(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'The note did not send. Check your connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background text-foreground">
      {/* ── Head ──────────────────────────────────────────── */}
      <section aria-labelledby="contact-heading" className="rail pt-16 pb-14 md:pt-20 md:pb-16">
        <Reveal>
          <p className="eyebrow text-muted2">Contact</p>
        </Reveal>
        <Reveal delay={60}>
          <h1
            id="contact-heading"
            className="display mt-6 max-w-[18ch] text-[2.5rem] leading-[1.04] tracking-[-0.03em] text-text md:text-display-l"
          >
            Talk to the team
          </h1>
        </Reveal>
        <Reveal delay={120}>
          <p className="prose-lede mt-6 max-w-[50ch] text-body-l text-muted2">
            Faculty enquiries, partnership questions, corrections and story pitches all land in the
            same inbox, and a person reads it.
          </p>
        </Reveal>
      </section>

      {/* ── Who we reach, and the note ────────────────────── */}
      <section>
        <div className="rail grid gap-14 py-16 lg:grid-cols-[1fr_26rem]">
          <div>
            <Reveal>
              <h2 className="display text-display-m text-text">Who we reach</h2>
            </Reveal>
            <ul className="mt-8 space-y-3">
              {AUDIENCES.map((a, i) => (
                <Reveal
                  as="li"
                  key={a.label}
                  delay={60 + i * 60}
                  className="grid gap-2 py-6 md:grid-cols-[10rem_1fr]"
                >
                  <p className="display text-body-l text-text">{a.label}</p>
                  <p className="prose-lede text-body-m text-muted2">{a.blurb}</p>
                </Reveal>
              ))}
            </ul>
          </div>

          <Reveal delay={60}>
            <Card className="h-fit p-7">
              {sent ? (
                /* The design navigates to /thanks; this app has no such
                   route, so the confirmation takes the card and the rest
                   of the page stays where it was. */
                <div role="status">
                  <ChmMark className="size-8 text-amber" />
                  <p className="eyebrow mt-6 text-muted2">Request received</p>
                  <p className="display mt-4 text-display-s text-text">
                    We will be in touch within two working days.
                  </p>
                  <p className="prose-lede mt-3 text-body-s text-muted2">
                    Your note is in the same inbox the team reads, so a person picks it up rather
                    than an autoresponder.
                  </p>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <Button to="/catalog">
                      Browse the library
                      <ArrowRight className="size-4" strokeWidth={1.75} />
                    </Button>
                    <Button to="/home" variant="outline">
                      Back to the homepage
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="display text-body-l text-text">Send a note</h2>
                  <form ref={formRef} noValidate onSubmit={handleSubmit} className="mt-6 space-y-5">
                    {error && (
                      <p
                        role="alert"
                        className="flex items-start gap-1.5 text-[0.8125rem] text-anchor"
                      >
                        <span aria-hidden className="mt-px font-semibold">
                          !
                        </span>
                        {error}
                      </p>
                    )}

                    {FIELDS.map((f) => {
                      const id = `${baseId}-${f.name}`;
                      const errorId = `${id}-error`;
                      const hintId = `${id}-hint`;
                      const fieldError = errors[f.name];
                      const describedBy =
                        [f.hint ? hintId : null, fieldError ? errorId : null]
                          .filter(Boolean)
                          .join(' ') || undefined;
                      const isMessage = f.name === 'message';

                      return (
                        <div key={f.name}>
                          <label
                            htmlFor={id}
                            className="block text-[0.875rem] font-medium text-text"
                          >
                            {f.label}
                            {f.optional ? (
                              <span className="ms-2 font-normal text-faint">Optional</span>
                            ) : null}
                          </label>

                          {f.hint ? (
                            <p id={hintId} className="prose-lede mt-1 text-[0.8125rem] text-muted2">
                              {f.hint}
                            </p>
                          ) : null}

                          {isMessage ? (
                            <textarea
                              id={id}
                              name={f.name}
                              rows={4}
                              value={values[f.name]}
                              onChange={(e) => set(f.name, e.target.value)}
                              aria-invalid={fieldError ? true : undefined}
                              aria-describedby={describedBy}
                              className={cn(INPUT_BASE, 'p-4', ringFor(Boolean(fieldError)))}
                            />
                          ) : (
                            <input
                              id={id}
                              name={f.name}
                              type={f.type ?? 'text'}
                              inputMode={f.inputMode}
                              autoComplete={f.autoComplete}
                              value={values[f.name]}
                              onChange={(e) => set(f.name, e.target.value)}
                              aria-invalid={fieldError ? true : undefined}
                              aria-describedby={describedBy}
                              className={cn(INPUT_BASE, 'h-12 px-4', ringFor(Boolean(fieldError)))}
                            />
                          )}

                          {fieldError ? (
                            /* Colour is never the only signal: the message
                               says what to do. */
                            <p
                              id={errorId}
                              className="mt-2 flex items-start gap-1.5 text-[0.8125rem] text-anchor"
                            >
                              <span aria-hidden className="mt-px font-semibold">
                                !
                              </span>
                              {fieldError}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}

                    <button
                      type="submit"
                      disabled={loading}
                      className="press h-12 w-full rounded-[6px] bg-cta text-[0.9375rem] font-semibold text-white hover:bg-cta-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50"
                    >
                      {loading ? 'Sending your note' : 'Send'}
                    </button>
                  </form>
                </>
              )}
            </Card>
          </Reveal>
        </div>
      </section>

      {/* ── Record with us ────────────────────────────────── */}
      <section>
        <Reveal className="rail flex flex-wrap items-center justify-between gap-8 py-16">
          <h2 className="display max-w-[24ch] text-display-m text-text">
            Practising, and want to record with us?
          </h2>
          <Button to="/kol-network" variant="outline">
            See the KOL network
            <ArrowRight className="size-4" strokeWidth={1.75} />
          </Button>
        </Reveal>
      </section>
    </div>
  );
}
