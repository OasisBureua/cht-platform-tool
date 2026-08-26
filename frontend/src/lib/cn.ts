import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * shadcn-style class combiner: clsx for conditionals + tailwind-merge so
 * caller overrides (e.g. `className="p-3"`) win over component defaults.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
