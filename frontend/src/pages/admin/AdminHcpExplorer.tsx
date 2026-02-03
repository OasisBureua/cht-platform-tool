import { Search, Download } from 'lucide-react';

const HCP_PROFILES = [
  { id: '1', name: 'HCP NAME', info: 'HCP INFORMATION // Specialty // Location', specialty: 'Pediatrics', statusColor: 'green' },
  { id: '2', name: 'HCP NAME', info: 'HCP INFORMATION // Specialty // Location', specialty: 'Oncology', statusColor: 'pink' },
  { id: '3', name: 'HCP NAME', info: 'HCP INFORMATION // Specialty // Location', specialty: 'Cardiology', statusColor: 'yellow' },
];

const STATUS_COLORS: Record<string, string> = {
  green: 'bg-green-100 text-green-800',
  pink: 'bg-pink-100 text-pink-800',
  yellow: 'bg-amber-100 text-amber-800',
};

export default function AdminHcpExplorer() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">HCP Profile Explorer</h1>
        <p className="text-sm text-gray-600 mt-1">
          Explore and Manage Healthcare Professional Profiles and Engagement Data
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-gray-700" />
            <h2 className="text-lg font-bold text-gray-900">Profile Lookup</h2>
          </div>
          <button className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-900 inline-flex items-center gap-2 hover:bg-gray-50">
            <Download className="h-4 w-4" /> Export Data
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="search"
              placeholder="Search"
              className="w-full rounded-xl border border-gray-200 pl-11 pr-4 py-3 text-sm"
            />
          </div>
          <select className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-900 md:w-48">
            <option>All Specialties</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {HCP_PROFILES.map((hcp) => (
          <div key={hcp.id} className="bg-white rounded-2xl border border-gray-200 p-6 flex items-center gap-6">
            <div className="h-16 w-16 rounded-full bg-gray-200 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-gray-900">{hcp.name}</p>
              <p className="text-sm text-gray-600">{hcp.info}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm font-medium text-gray-700">{hcp.specialty}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLORS[hcp.statusColor] || 'bg-gray-100 text-gray-800'}`}>
                Status
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
