import apiClient from './client';

export interface SubmitContactPayload {
  email: string;
  firstName: string;
  lastName: string;
  message?: string;
  organization?: string;
  role?: string;
}

export async function submitContact(payload: SubmitContactPayload): Promise<{ received: boolean }> {
  const { data } = await apiClient.post<{ received: boolean }>('/contact', payload);
  return data;
}
