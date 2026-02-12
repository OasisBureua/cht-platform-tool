import apiClient from './client';

export interface CatalogItem {
  id: string;
  title: string;
  thumbnailUrl: string;
  videoNames: string[];
  videoCount: number;
  playUrl?: string;
}

export const catalogApi = {
  getItems: async (): Promise<CatalogItem[]> => {
    const { data } = await apiClient.get<CatalogItem[]>('/catalog');
    return data;
  },
};
