import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, Loader2, Mail } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { publicRegistrationApi } from '../../api/publicRegistration';
import { getApiErrorMessage } from '../../api/client';
import { executeRecaptcha, recaptchaConfigured } from '../../lib/recaptcha';

/**
 * Public registration page (no login): name and email, then we email a
 * personal link to the program's registration survey.
 */
export default function PublicRegistration() {
  const { programId = '' } = useParams<{ programId: string }>();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');

  const { data: program, isLoading, isError } = useQuery({
    queryKey: ['public-registration', programId],
    queryFn: () => publicRegistrationApi.getProgram(programId),
    enabled: !!programId,
    retry: false,
  });

  const register = useMutation({
    mutationFn: async () => {
      const recaptchaToken = recaptchaConfigured() ? await executeRecaptcha('public_registration') : undefined;
      return publicRegistrationApi.register(programId, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        recaptchaToken,
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError || !program) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">Registration is not open</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This registration link is not active. Please check the link or contact the person who shared it.
        </p>
      </div>
    );
  }

  const canSubmit = firstName.trim() && lastName.trim() && email.trim() && !register.isPending;

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-400">Registration</p>
      <h1 className="mt-2 text-balance text-2xl font-bold tracking-tight text-foreground md:text-3xl">{program.title}</h1>
      {program.description ? (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{program.description}</p>
      ) : null}

      {register.isSuccess ? (
        <div className="mt-8 rounded-card border border-border bg-card p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
            <div>
              <p className="font-semibold text-foreground">Check your email</p>
              <p className="mt-1 text-sm text-muted-foreground">
                We sent a link to <strong className="text-foreground">{email.trim()}</strong>. Open it to complete the
                registration survey.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <form
          className="mt-8 space-y-4 rounded-card border border-border bg-card p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) register.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-foreground">
              First name
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                maxLength={100}
                required
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm font-medium text-foreground">
              Last name
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                maxLength={100}
                required
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-foreground">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              maxLength={254}
              required
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            />
          </label>
          {register.isError ? (
            <p className="text-sm font-medium text-destructive">
              {getApiErrorMessage(register.error, 'Registration failed. Please try again.')}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {register.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Register
          </button>
          <p className="text-xs text-muted-foreground">
            We will email you a link to a short registration survey. No account needed.
          </p>
        </form>
      )}
    </div>
  );
}
