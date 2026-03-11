import { Mail } from 'lucide-react';

/**
 * Share buttons that use Community Health URLs (not YouTube).
 * Supports Facebook, X, LinkedIn, Reddit, Pinterest, and Email.
 */
export function ShareButtons({ title, url }: { title: string; url: string }) {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const shareLinks = [
    { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, className: 'bg-[#1877f2] hover:bg-[#166fe5] text-white' },
    { name: 'X', href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`, className: 'bg-black hover:bg-gray-800 text-white' },
    { name: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`, className: 'bg-[#0a66c2] hover:bg-[#004182] text-white' },
    { name: 'Reddit', href: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`, className: 'bg-[#ff4500] hover:bg-[#e03d00] text-white' },
    { name: 'Pinterest', href: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedTitle}`, className: 'bg-[#bd081c] hover:bg-[#a30718] text-white' },
  ];

  const emailHref = `mailto:?subject=${encodedTitle}&body=${encodedUrl}`;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Share</h2>
      <p className="text-sm text-gray-600 mb-2">Share this on Community Health</p>
      <div className="flex flex-wrap gap-2">
        {shareLinks.map((link) => (
          <a
            key={link.name}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold uppercase tracking-wide transition-colors ${link.className}`}
          >
            {link.name}
          </a>
        ))}
        <a
          href={emailHref}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Mail className="h-4 w-4" />
          Email
        </a>
      </div>
    </div>
  );
}
