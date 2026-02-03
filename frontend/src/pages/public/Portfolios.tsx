import { Link } from 'react-router-dom';

export default function Portfolios() {
  return (
    <div className="bg-white">
      <section className="border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-6 py-12 md:py-16">
          <div className="max-w-3xl space-y-4">
            <p className="text-sm font-semibold text-gray-600">Portfolios</p>
            <h1 className="text-4xl md:text-5xl font-semibold text-gray-900 leading-tight">
              Our work and case studies
            </h1>
            <p className="text-sm md:text-base text-gray-600">
              Explore our portfolio of healthcare campaigns and content across disease areas and
              media formats.
            </p>
            <Link
              to="/catalog"
              className="inline-flex rounded-full bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-black transition-colors"
            >
              View Content Library
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
