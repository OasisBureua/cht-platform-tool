import type { ReactNode } from 'react';

interface AuthFormCardProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}

export default function AuthFormCard({ title, subtitle, children }: AuthFormCardProps) {
  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12 bg-white">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
        <div className="border-b border-gray-200 px-6 py-8 text-center">
          <h1 className="text-xl font-semibold text-gray-900 md:text-2xl">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-gray-600">{subtitle}</p> : null}
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
