/**
 * Mirrors Prisma enum `FormJotformScope` in schema.prisma. Use this module in application
 * code so TypeScript does not depend on `npx prisma generate` having been run for the enum export.
 */
export const FormJotformScope = {
  SURVEY: 'SURVEY',
  INTAKE: 'INTAKE',
} as const;

export type FormJotformScope =
  (typeof FormJotformScope)[keyof typeof FormJotformScope];
