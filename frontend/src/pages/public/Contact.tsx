import { ArrowRight } from 'lucide-react';
import { ContactNoteForm } from '../../components/contact/ContactNoteForm';
import { Button, Card, Reveal } from '../../components/ui';

/**
 * Who the platform reaches. Two columns per row: the audience, then what
 * reaching them actually means.
 */
const AUDIENCES = [
  { label: 'HCPs', blurb: 'Beyond conferences and CME, where they actually consume content.' },
  { label: 'Patients', blurb: 'Pre- or active treatment, searching for credible information.' },
  { label: 'Caregivers', blurb: 'Making decisions, seeking guidance, needing support.' },
] as const;

export default function Contact() {
  return (
    <div className="bg-background text-foreground">
      {/* ── Head, audiences and the note ──────────────────── */}
      <section aria-labelledby="contact-heading">
        <div className="rail grid gap-14 pb-16 pt-16 md:pt-20 lg:grid-cols-[1fr_26rem]">
          <div>
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
                Faculty enquiries, partnership questions, corrections and story pitches all land in
                the same inbox, and a person reads it.
              </p>
            </Reveal>

            <Reveal delay={180}>
              <h2 className="display mt-16 text-display-m text-text">Who we reach</h2>
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

          <Reveal delay={60} className="h-full">
            <Card className="flex h-full flex-col p-7">
              {/* The design navigates to /thanks; this app has no such route,
                  so the confirmation takes the card and the rest of the page
                  stays where it was. */}
              <ContactNoteForm
                sentActions={
                  <>
                    <Button to="/catalog">
                      Browse the library
                      <ArrowRight className="size-4" strokeWidth={1.75} />
                    </Button>
                    <Button to="/" variant="outline">
                      Back to the homepage
                    </Button>
                  </>
                }
              />
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
          <Button to="/kols" variant="outline">
            See the KOL network
            <ArrowRight className="size-4" strokeWidth={1.75} />
          </Button>
        </Reveal>
      </section>
    </div>
  );
}
