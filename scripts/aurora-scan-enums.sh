#!/bin/bash
# Scan Aurora for missing enum types and varchar columns that should be enums.
# Usage: ./scripts/aurora-scan-enums.sh [platform|dev]

set -e

ENV=${1:-platform}
AWS_REGION=${AWS_REGION:-us-east-1}

case "$ENV" in
  platform) CLUSTER="cht-platform-cluster"; SERVICE="cht-platform-backend" ;;
  dev)      CLUSTER="cht-dev-cluster"; SERVICE="cht-dev-backend" ;;
  *) echo "Usage: ./aurora-scan-enums.sh [platform|dev]"; exit 1 ;;
esac

TASK_ARN=$(aws ecs list-tasks \
  --cluster "$CLUSTER" \
  --service-name "$SERVICE" \
  --desired-status RUNNING \
  --region "$AWS_REGION" \
  --query 'taskArns[0]' \
  --output text)

if [ -z "$TASK_ARN" ] || [ "$TASK_ARN" = "None" ]; then
  echo "❌ No running backend task"
  exit 1
fi

SCAN_JS=$(cat <<'NODE'
const { PrismaClient } = require('@prisma/client');

/** Prisma enums → table.column (from schema.prisma) */
const EXPECTED = [
  { enum: 'UserRole', table: 'User', column: 'role' },
  { enum: 'UserStatus', table: 'User', column: 'status' },
  { enum: 'UserRole', table: 'Session', column: 'role' },
  { enum: 'ProgramStatus', table: 'Program', column: 'status' },
  { enum: 'ProgramZoomSessionType', table: 'Program', column: 'zoomSessionType' },
  { enum: 'ProgramRegistrationStatus', table: 'ProgramRegistration', column: 'status' },
  { enum: 'PostEventAttendanceStatus', table: 'ProgramRegistration', column: 'postEventAttendanceStatus' },
  { enum: 'ProgramFormLinkKind', table: 'ProgramFormLink', column: 'kind' },
  { enum: 'FormJotformScope', table: 'FormJotformProgress', column: 'scope' },
  { enum: 'VideoPlatform', table: 'Video', column: 'platform' },
  { enum: 'SurveyType', table: 'Survey', column: 'type' },
  { enum: 'PaymentType', table: 'Payment', column: 'type' },
  { enum: 'PaymentStatus', table: 'Payment', column: 'status' },
];

const ALL_ENUMS = [...new Set(EXPECTED.map((e) => e.enum))];

(async () => {
  const p = new PrismaClient();
  try {
    const types = await p.$queryRaw`
      SELECT t.typname AS name,
             array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      LEFT JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE n.nspname = 'public' AND t.typtype = 'e'
      GROUP BY t.typname
      ORDER BY t.typname`;

    const present = new Set(types.map((t) => t.name));
    const missingTypes = ALL_ENUMS.filter((e) => !present.has(e));
    const extraTypes = types
      .map((t) => t.name)
      .filter((n) => !ALL_ENUMS.includes(n));

    const cols = await p.$queryRaw`
      SELECT table_name, column_name, udt_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, column_name`;

    const colMap = new Map(
      cols.map((c) => [`${c.table_name}.${c.column_name}`, c]),
    );

    const columnIssues = [];
    const columnOk = [];
    const missingColumns = [];

    for (const exp of EXPECTED) {
      const key = `${exp.table}.${exp.column}`;
      const col = colMap.get(key);
      if (!col) {
        missingColumns.push(exp);
        continue;
      }
      if (col.udt_name === exp.enum) {
        columnOk.push({ ...exp, udt_name: col.udt_name });
      } else {
        columnIssues.push({
          ...exp,
          actual: col.udt_name,
          data_type: col.data_type,
        });
      }
    }

    const report = {
      summary: {
        expectedEnumTypes: ALL_ENUMS.length,
        presentEnumTypes: ALL_ENUMS.length - missingTypes.length,
        missingEnumTypes: missingTypes.length,
        expectedEnumColumns: EXPECTED.length,
        okColumns: columnOk.length,
        wrongTypeColumns: columnIssues.length,
        missingColumns: missingColumns.length,
        healthy: missingTypes.length === 0 && columnIssues.length === 0 && missingColumns.length === 0,
      },
      missingEnumTypes: missingTypes,
      extraEnumTypesInDb: extraTypes,
      wrongTypeColumns: columnIssues,
      missingColumns,
      presentEnumTypes: types.map((t) => ({
        name: t.name,
        labels: t.labels,
      })),
    };

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await p.$disconnect();
  }
})().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
NODE
)

SCAN_B64=$(printf '%s' "$SCAN_JS" | base64 | tr -d '\n')

echo "🔍 Aurora enum scan ($ENV)"
echo "========================"
echo "Task: $TASK_ARN"
echo ""

aws ecs execute-command \
  --cluster "$CLUSTER" \
  --task "$TASK_ARN" \
  --container backend \
  --region "$AWS_REGION" \
  --interactive \
  --command "sh -c 'echo ${SCAN_B64} | base64 -d | node'"
