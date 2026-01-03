import apiClient from './client';

export interface ParkingSpot {
  id: number;
  user_id: number;
  title: string;
  location: string;
  status: string;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface CreateSpotData {
  title: string;
  location: string;
  status?: string;
  lat?: number;
  lng?: number;
  notes?: string;
}

export interface UpdateSpotData {
  title?: string;
  location?: string;
  status?: string;
  lat?: number;
  lng?: number;
  notes?: string;
}

export const parkingSpotsApi = {
  list: async (): Promise<ParkingSpot[]> => {
    const response = await apiClient.get('/parking-spots');
    return response.data;
  },

  get: async (id: number): Promise<ParkingSpot> => {
    const response = await apiClient.get(`/parking-spots/${id}`);
    return response.data;
  },

  create: async (data: CreateSpotData): Promise<ParkingSpot> => {
    const response = await apiClient.post('/parking-spots', data);
    return response.data;
  },

  update: async (id: number, data: UpdateSpotData): Promise<ParkingSpot> => {
    const response = await apiClient.put(`/parking-spots/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/parking-spots/${id}`);
  },
};

