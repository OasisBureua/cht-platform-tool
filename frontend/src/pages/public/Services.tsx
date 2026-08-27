import { Link } from 'react-router-dom';

export default function Services() {
  return (
    <div className="bg-card">
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12 md:py-16">
          <div className="max-w-3xl space-y-4">
            <p className="text-sm font-semibold text-muted-foreground">Services</p>
            <h1 className="text-4xl md:text-5xl font-semibold text-foreground leading-tight">
              Full service healthcare communications
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              We combine production expertise with targeted multi-channel campaigns to deliver
              healthcare content that reaches the right clinicians.
            </p>
            <Link
              to="/contact"
              className="inline-flex rounded-[6px] bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
