import type { Enrollment } from '../api/programs';

const STORAGE_KEY = 'cht_demo_enrollments_v1';

function read(): Enrollment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Enrollment[];
  } catch {
    return [];
  }
}

function write(items: Enrollment[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export const demoEnrollmentsStore = {
  getAll(userId: string): Enrollment[] {
    return read().filter((e) => e.userId === userId);
  },

  add(userId: string, program: { id: string; title: string; description: string; thumbnailUrl?: string; creditAmount: number; honorariumAmount?: number; videosCount: number; }): Enrollment {
    const all = read();

    const exists = all.find((e) => e.userId === userId && e.programId === program.id);
    if (exists) return exists;

    const enrollment: Enrollment = {
      id: `enroll_${Date.now()}`,
      userId,
      programId: program.id,
      overallProgress: 0,
      completed: false,
      enrolledAt: new Date().toISOString(),
      program: {
        id: program.id,
        title: program.title,
        description: program.description,
        thumbnailUrl: program.thumbnailUrl,
        creditAmount: program.creditAmount,
        honorariumAmount: program.honorariumAmount,
        videosCount: program.videosCount,
      },
    };

    all.push(enrollment);
    write(all);
    return enrollment;
  },

  reset() {
    localStorage.removeItem(STORAGE_KEY);
  },
};
