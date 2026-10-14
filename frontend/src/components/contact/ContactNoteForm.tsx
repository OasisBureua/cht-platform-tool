import { useId, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { submitContact } from '../../api/contact';
import { ChmMark } from '../brand/ChmMark';
import { cn } from '../../lib/cn';

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

export interface ContactNoteFormProps {
  initialName?: string;
  initialEmail?: string;
  /** Buttons shown under the confirmation once the note has gone out. */
  sentActions?: ReactNode;
}

/** The "Send a note" form shared by public `/contact` and the Settings Contact tab. */
export function ContactNoteForm({ initialName = '', initialEmail = '', sentActions }: ContactNoteFormProps) {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<FieldName, string>>({
    name: initialName,
    email: initialEmail,
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

  if (sent) {
    return (
      <div role="status">
        <ChmMark className="size-8 text-amber" />
        <p className="eyebrow mt-6 text-muted2">Request received</p>
        <p className="display mt-4 text-display-s text-text">
          We will be in touch within two working days.
        </p>
        <p className="prose-lede mt-3 text-body-s text-muted2">
          Your note is in the same inbox the team reads, so a person picks it up rather than an
          autoresponder.
        </p>
        {sentActions ? <div className="mt-7 flex flex-wrap gap-3">{sentActions}</div> : null}
      </div>
    );
  }

  return (
    <>
      <h2 className="display text-body-l text-text">Send a note</h2>
      <form ref={formRef} noValidate onSubmit={handleSubmit} className="mt-6 space-y-5">
        {error && (
          <p role="alert" className="flex items-start gap-1.5 text-[0.8125rem] text-anchor">
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
            [f.hint ? hintId : null, fieldError ? errorId : null].filter(Boolean).join(' ') ||
            undefined;
          const isMessage = f.name === 'message';

          return (
            <div key={f.name}>
              <label htmlFor={id} className="block text-[0.875rem] font-medium text-text">
                {f.label}
                {f.optional ? <span className="ms-2 font-normal text-faint">Optional</span> : null}
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
                /* Colour is never the only signal: the message says what to do. */
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
  );
}
