import { Search, User } from 'lucide-react';

export default function TopNav() {
  return (
    <header className="sticky top-0 z-10 bg-gray-50/80 backdrop-blur border-b border-gray-200">
      <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-8">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            placeholder="Search"
            className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200"
          />
        </div>

        <button className="p-2 rounded-full text-gray-600 hover:text-gray-900 hover:bg-white border border-transparent hover:border-gray-200">
          <User className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
