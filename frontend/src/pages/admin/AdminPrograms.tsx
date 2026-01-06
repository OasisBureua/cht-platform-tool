import { Plus, MoreVertical } from 'lucide-react';

const MOCK_PROGRAMS = [
  {
    id: '123',
    title: 'Cardiometabolic Care Update',
    sponsor: 'Pfizer',
    status: 'Active',
    credits: '1.5 CME',
  },
  {
    id: '456',
    title: 'Oncology Treatment Pathways',
    sponsor: 'Novartis',
    status: 'Draft',
    credits: '1.0 CME',
  },
  {
    id: '789',
    title: 'Neurology Case Series',
    sponsor: 'Biogen',
    status: 'Active',
    credits: 'CME Eligible',
  },
];

export default function AdminPrograms() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Programs</h1>
          <p className="text-sm text-gray-600">
            Manage educational programs and webinars.
          </p>
        </div>

        <button className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black">
          <Plus className="h-4 w-4" />
          Create Program
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">
                Program
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">
                Sponsor
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">
                Status
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">
                Credits
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {MOCK_PROGRAMS.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {p.title}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {p.sponsor}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {p.credits}
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="text-gray-500 hover:text-gray-700">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === 'Active'
      ? 'bg-green-50 text-green-700 border-green-200'
      : 'bg-gray-100 text-gray-700 border-gray-200';

  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        styles,
      ].join(' ')}
    >
      {status}
    </span>
  );
}
