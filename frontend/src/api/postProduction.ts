import apiClient from './client';

/**
 * Post-production endpoints: transcripts written from the audio (AWS
 * Transcribe), AI suggestions for a clip's look (Bedrock), and error
 * logging from the clipper.
 */

export type TranscriptCue = { start: number; end: number; text: string; speaker?: string };
export type TranscriptStatus = 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface PostProductionTranscript {
  id: string;
  sourceKey: string;
  title: string;
  status: TranscriptStatus;
  error?: string | null;
  cues: TranscriptCue[] | null;
  /** True once someone has corrected the machine transcript. */
  edited: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PostProductionModel {
  id: string;
  label: string;
  note?: string;
}

export interface PostProductionCapabilities {
  transcription: boolean;
  ai: boolean;
  models: PostProductionModel[];
  defaultModelId: string | null;
}

export interface ClipLookSuggestion {
  titles: string[];
  emphasis: string[];
  callouts: { at: number; text: string; label?: string }[];
  punchIns: { start: number; end: number }[];
}

export const postProductionApi = {
  capabilities: async (): Promise<PostProductionCapabilities> => {
    const { data } = await apiClient.get('/admin/post-production/capabilities');
    return data;
  },

  /** The latest transcript made for this recording, corrections included. */
  findTranscript: async (sourceKey: string): Promise<PostProductionTranscript | null> => {
    const { data } = await apiClient.get('/admin/post-production/transcripts', { params: { sourceKey } });
    return data ?? null;
  },

  getTranscript: async (id: string): Promise<PostProductionTranscript> => {
    const { data } = await apiClient.get(`/admin/post-production/transcripts/${encodeURIComponent(id)}`);
    return data;
  },

  /** Starts a transcript from audio pulled out of a local or Dropbox file. */
  transcribeAudio: async (audio: Blob, opts: { sourceKey: string; title: string; fileName: string }): Promise<PostProductionTranscript> => {
    const form = new FormData();
    form.append('audio', audio, opts.fileName);
    form.append('sourceKey', opts.sourceKey);
    form.append('title', opts.title);
    const { data } = await apiClient.post('/admin/post-production/transcripts/upload', form, { timeout: 10 * 60_000 });
    return data;
  },

  /** Starts a transcript straight from a Zoom recording in storage. */
  transcribeZoom: async (opts: { sessionId: string; fileId: string; sourceKey: string; title: string }): Promise<PostProductionTranscript> => {
    const { data } = await apiClient.post('/admin/post-production/transcripts/zoom', opts);
    return data;
  },

  saveTranscript: async (id: string, cues: TranscriptCue[]): Promise<PostProductionTranscript> => {
    const { data } = await apiClient.put(`/admin/post-production/transcripts/${encodeURIComponent(id)}`, { cues });
    return data;
  },

  suggestLook: async (body: { modelId?: string; title: string; style: string; start: number; end: number; cues: TranscriptCue[] }): Promise<ClipLookSuggestion> => {
    const { data } = await apiClient.post('/admin/post-production/look', body, { timeout: 120_000 });
    return data;
  },

  log: async (entry: { level: 'error' | 'warn' | 'info'; event: string; message: string; context?: Record<string, unknown> }): Promise<void> => {
    await apiClient.post('/admin/post-production/logs', entry);
  },
};
