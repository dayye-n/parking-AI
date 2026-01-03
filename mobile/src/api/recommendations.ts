import apiClient from './client';

export interface Recommendation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distance_meters_drive: number;
  duration_drive_seconds: number;
  duration_drive_in_traffic_seconds: number;
  walk_minutes: number;
  price_per_hour: number;
  congestion_score: number;
  score: number;
  reasons: string[];
  google_maps_directions_url: string;
}

export interface RecommendationsRequest {
  origin_lat: number;
  origin_lng: number;
  destination_place_id: string;
  results?: number;
  radius_m?: number;
  sort?: 'best' | 'distance' | 'price' | 'rating' | 'congestion';
}

export interface RecommendationsResponse {
  recommendations: Recommendation[];
  destination_name: string;
  destination_address: string;
}

export const recommendationsApi = {
  getRecommendations: async (request: RecommendationsRequest): Promise<RecommendationsResponse> => {
    const response = await apiClient.post<RecommendationsResponse>('/recommendations', request);
    return response.data;
  },
};

