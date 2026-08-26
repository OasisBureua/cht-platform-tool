"use client";

import { useId, useRef, useState } from "react";

type FieldSpec = {
 name: string;
 label: string;
 type?: string;
 autoComplete?: string;
 inputMode?: "text" | "email" | "numeric" | "tel";
 hint?: string;
 optional?: boolean;
 validate?: (v: string) => string | null;
 options?: string[];
};

const required = (label: string) => (v: string) =>
 v.trim() ? null : `Enter your ${label.toLowerCase()}`;

/** Hints appear before the mistake and are phrased as what to do. */
export const emailField: FieldSpec = {
 name: "email",
 label: "Work email",
 type: "email",
 autoComplete: "email",
 inputMode: "email",
 hint: "Use the address your institution issued, so we can verify you are a clinician.",
 validate: (v) =>
 !v.trim()
 ? "Enter your work email"
 : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
 ? null
 : "Enter an email in the format name@hospital.org",
};

/**
 * Submit stays enabled: validation runs on submit, the first invalid
 * field takes focus, and each error is tied to its input with
 * aria-describedby so it announces where it happened.
 */
export function Form({
 fields,
 submitLabel,
 pendingLabel,
 onDone,
 children,
}: {
 fields: FieldSpec[];
 submitLabel: string;
 pendingLabel: string;
 onDone: () => void;
 children?: React.ReactNode;
}) {
 const baseId = useId();
 const formRef = useRef<HTMLFormElement>(null);
 const [errors, setErrors] = useState<Record<string, string>>({});
 const [pending, setPending] = useState(false);

 const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 const data = new FormData(e.currentTarget);
 const next: Record<string, string> = {};

 for (const f of fields) {
 if (f.options) continue;
 const value = String(data.get(f.name) ?? "");
 const check = f.validate ?? (f.optional ? () => null : required(f.label));
 const message = check(value);
 if (message) next[f.name] = message;
 }

 setErrors(next);

 const firstBad = fields.find((f) => next[f.name]);
 if (firstBad) {
 formRef.current
 ?.querySelector<HTMLElement>(`[name="${firstBad.name}"]`)
 ?.focus();
 return;
 }

 setPending(true);
 onDone();
 };

 return (
 <form ref={formRef} noValidate onSubmit={handleSubmit} className="space-y-5">
 {fields.map((f) => {
 const id = `${baseId}-${f.name}`;
 const errorId = `${id}-error`;
 const hintId = `${id}-hint`;
 const error = errors[f.name];
 const describedBy =
 [f.hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

 return (
 <div key={f.name}>
 <label htmlFor={id} className="block text-[0.875rem] font-medium text-text">
 {f.label}
 {f.optional ? (
 <span className="ms-2 font-normal text-faint">Optional</span>
 ) : null}
 </label>

 {f.hint ? (
 <p id={hintId} className="prose-lede mt-1 text-[0.8125rem] text-muted">
 {f.hint}
 </p>
 ) : null}

 {f.options ? (
 <select
 id={id}
 name={f.name}
 className="mt-2 h-12 w-full rounded-[6px] bg-ground px-4 text-base text-text shadow-[var(--shadow-card)] outline-none sm:text-[0.9375rem]"
 >
 {f.options.map((o) => (
 <option key={o}>{o}</option>
 ))}
 </select>
 ) : (
 <input
 id={id}
 name={f.name}
 type={f.type ?? "text"}
 inputMode={f.inputMode}
 autoComplete={f.autoComplete}
 aria-invalid={error ? true : undefined}
 aria-describedby={describedBy}
 className={`mt-2 h-12 w-full rounded-[6px] bg-ground px-4 text-base text-text outline-none sm:text-[0.9375rem] ${
 error
 ? "shadow-[0_0_0_1.5px_var(--color-teal-deep)]"
 : "shadow-[var(--shadow-card)]"
 }`}
 />
 )}

 {error ? (
 /* Colour is never the only signal: the message says what to do. */
 <p id={errorId} className="mt-2 flex items-start gap-1.5 text-[0.8125rem] text-anchor">
 <span aria-hidden className="mt-px font-semibold">
 !
 </span>
 {error}
 </p>
 ) : null}
 </div>
 );
 })}

 {children}

 <button
 type="submit"
 className="press h-12 w-full rounded-[6px] bg-cta text-[0.9375rem] font-semibold text-white hover:bg-cta-deep"
 >
 {pending ? pendingLabel : submitLabel}
 </button>
 </form>
 );
}
