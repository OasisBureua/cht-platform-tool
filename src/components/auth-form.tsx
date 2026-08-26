"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { ArrowRight } from "./icons";

type Field = {
  name: string;
  label: string;
  type: "text" | "email" | "password";
  placeholder: string;
  autoComplete: string;
  /** Rendered at the end of the label row, e.g. a "Forgot?" link. */
  aside?: { label: string; href: string };
};

/**
 * The sign-in and create-account forms. Validation runs on submit, not
 * on keystroke: submit stays enabled so the control never hides what
 * needs fixing, and the first invalid field takes focus with its error
 * wired through aria-describedby.
 */
export function AuthForm({
  fields,
  submitLabel,
  legend,
}: {
  fields: Field[];
  submitLabel: string;
  legend: string;
}) {
  const uid = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  const validate = (data: FormData) => {
    const next: Record<string, string> = {};
    for (const f of fields) {
      const value = String(data.get(f.name) ?? "").trim();
      if (!value) {
        next[f.name] = `Enter your ${f.label.toLowerCase()}`;
      } else if (f.type === "email" && !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(value)) {
        next[f.name] = "Use an address like name@hospital.org";
      } else if (f.type === "password" && value.length < 8) {
        next[f.name] = "Use at least 8 characters";
      }
    }
    return next;
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next = validate(new FormData(e.currentTarget));
    setErrors(next);
    const firstBad = fields.find((f) => next[f.name]);
    if (firstBad) {
      formRef.current?.querySelector<HTMLInputElement>(`[name="${firstBad.name}"]`)?.focus();
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <p role="status" className="card mt-8 p-5 text-body-m text-dim">
        This is a prototype, so nothing was submitted. The real form posts to the CHM
        platform.
      </p>
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="mt-8">
      <fieldset className="space-y-5">
        <legend className="sr-only">{legend}</legend>

        {fields.map((f) => {
          const id = `${uid}-${f.name}`;
          const errId = `${id}-error`;
          const bad = errors[f.name];
          return (
            <div key={f.name}>
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor={id} className="text-body-s text-dim">
                  {f.label}
                </label>
                {f.aside ? (
                  <Link
                    href={f.aside.href}
                    className="press -my-1 rounded-[6px] py-1 text-body-s text-anchor hover:brightness-110"
                  >
                    {f.aside.label}
                  </Link>
                ) : null}
              </div>
              <input
                id={id}
                name={f.name}
                type={f.type}
                inputMode={f.type === "email" ? "email" : undefined}
                autoComplete={f.autoComplete}
                placeholder={f.placeholder}
                aria-invalid={bad ? true : undefined}
                aria-describedby={bad ? errId : undefined}
                className={`mt-2 h-12 w-full rounded-[6px] bg-surface px-4 text-base text-text shadow-[var(--shadow-card)] outline-none placeholder:text-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-anchor sm:text-body-m ${
                  bad ? "ring-2 ring-error" : ""
                }`}
              />
              {bad ? (
                <p id={errId} className="mt-2 text-body-s text-error">
                  {bad}
                </p>
              ) : null}
            </div>
          );
        })}
      </fieldset>

      <button
        type="submit"
        className="press mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[6px] bg-inverse text-body-m font-medium text-ground hover:brightness-[0.92]"
      >
        {submitLabel}
        <ArrowRight className="size-4" strokeWidth={1.75} />
      </button>
    </form>
  );
}
