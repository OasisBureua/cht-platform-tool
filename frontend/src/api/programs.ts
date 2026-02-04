import apiClient from './client';
import { mockPrograms } from '../mocks/programs.mocks';
import { demoEnrollmentsStore } from '../mocks/enrollments.mocks';

const ENABLE_MOCK_FALLBACK = import.meta.env.DEV;

export interface Video {
  id: string;
  title: string;
  description?: string;
  platform: string;
  videoId: string;
  embedUrl: string;
  duration: number;
  order: number;
}

export interface Program {
  id: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  creditAmount: number;
  accreditationBody?: string;
  status: string;
  sponsorName: string;
  sponsorLogo?: string;
  honorariumAmount?: number;
  videos: Video[];
}

export interface Enrollment {
  id: string;
  userId: string;
  programId: string;
  overallProgress: number;
  completed: boolean;
  enrolledAt: string;
  completedAt?: string;
  program: {
    id: string;
    title: string;
    description: string;
    thumbnailUrl?: string;
    creditAmount: number;
    honorariumAmount?: number;
    videosCount: number;
  };
}

export const programsApi = {
  getAll: async (): Promise<Program[]> => {
    try {
      const { data } = await apiClient.get('/programs');
      return data;
    } catch (err) {
      if (ENABLE_MOCK_FALLBACK) {
        console.warn('[Programs] API failed — using mock programs');
        return mockPrograms;
      }
      throw err;
    }
  },

  getById: async (id: string): Promise<Program> => {
    try {
      const { data } = await apiClient.get(`/programs/${id}`);
      // if backend returns null/undefined for unknown id, treat as not found
      if (!data) throw new Error('Program not found');
      return data;
    } catch (err) {
      if (ENABLE_MOCK_FALLBACK) {
        const match = mockPrograms.find((p) => p.id === id);
        if (match) return match;
      }
      throw err;
    }
  },

  enroll: async (userId: string, programId: string) => {
  try {
    const { data } = await apiClient.post('/programs/enroll', { userId, programId });
    return data;
  } catch (err) {
    if (ENABLE_MOCK_FALLBACK) {
      console.warn('[Programs] enroll API failed — using demo enrollment');
      const program =
        mockPrograms.find((p) => p.id === programId) ??
        (await (async () => {
          // if mocks don't include it, fallback to getById (which may also mock)
          try {
            return await programsApi.getById(programId);
          } catch {
            return null;
          }
        })());

      if (!program) throw err;

      return demoEnrollmentsStore.add(userId, {
        id: program.id,
        title: program.title,
        description: program.description,
        thumbnailUrl: program.thumbnailUrl,
        creditAmount: program.creditAmount,
        honorariumAmount: program.honorariumAmount,
        videosCount: program.videos?.length ?? 0,
      });
    }
    throw err;
  }
},

  getEnrollments: async (userId: string): Promise<Enrollment[]> => {
  try {
    const { data } = await apiClient.get(`/programs/enrollments/${userId}`);
    return data;
  } catch (err) {
    if (ENABLE_MOCK_FALLBACK) {
      console.warn('[Programs] enrollments API failed — using demo enrollments');
      return demoEnrollmentsStore.getAll(userId);
    }
    throw err;
  }
},

  updateVideoProgress: async (
    userId: string,
    videoId: string,
    watchedSeconds: number,
    progress: number,
    completed: boolean
  ) => {
    const { data } = await apiClient.post('/programs/video-progress', {
      userId,
      videoId,
      watchedSeconds,
      progress,
      completed,
    });
    return data;
  },
};
