import apiClient from './client';

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
    const { data } = await apiClient.get('/programs');
    return data;
  },

  getById: async (id: string): Promise<Program> => {
    const { data } = await apiClient.get(`/programs/${id}`);
    return data;
  },

  enroll: async (userId: string, programId: string) => {
    const { data } = await apiClient.post('/programs/enroll', {
      userId,
      programId,
    });
    return data;
  },

  getEnrollments: async (userId: string): Promise<Enrollment[]> => {
    const { data } = await apiClient.get(`/programs/enrollments/${userId}`);
    return data;
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
