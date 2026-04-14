import { Link } from 'react-router-dom';

export default function Services() {
  return (
    <div className="bg-white">
      <section className="border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12 md:py-16">
          <div className="max-w-3xl space-y-4">
            <p className="text-sm font-semibold text-gray-600">Services</p>
            <h1 className="text-4xl md:text-5xl font-semibold text-gray-900 leading-tight">
              Full service healthcare communications
            </h1>
            <p className="text-sm md:text-base text-gray-600">
              We combine production expertise with targeted multi-channel campaigns to deliver
              high-impact healthcare content.
            </p>
            <Link
              to="/contact"
              className="inline-flex rounded-full bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-black transition-colors"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
