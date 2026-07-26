import { surveyAnswersToRows } from '../../utils/admin-survey-display';

export function SurveyAnswersTable(props: {
  answers: unknown;
  questionsSchema?: unknown;
  compact?: boolean;
}) {
  const { answers, questionsSchema, compact } = props;
  const rows = surveyAnswersToRows(answers, questionsSchema);
  if (rows.length === 0) {
    return <span className="text-gray-500">—</span>;
  }
  return (
    <table
      className={[
        'w-full border border-gray-100 rounded-lg overflow-hidden',
        compact ? 'text-xs' : 'text-sm',
      ].join(' ')}
    >
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-b border-gray-50 last:border-0">
            <td className="py-1.5 px-2 font-medium text-gray-700 align-top w-2/5">{row.label}</td>
            <td className="py-1.5 px-2 text-gray-600">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
