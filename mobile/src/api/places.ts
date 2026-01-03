import apiClient from './client';

export interface AutocompleteSuggestion {
  description: string;
  place_id: string;
}

export interface AutocompleteResponse {
  suggestions: AutocompleteSuggestion[];
}

export interface PlaceDetails {
  place_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export const placesApi = {
  autocomplete: async (query: string, city?: string): Promise<AutocompleteSuggestion[]> => {
    const params = new URLSearchParams({ q: query });
    if (city) {
      params.append('city', city);
    }
    const response = await apiClient.get<AutocompleteResponse>(`/places/autocomplete?${params.toString()}`);
    return response.data.suggestions;
  },

  getDetails: async (placeId: string): Promise<PlaceDetails> => {
    const response = await apiClient.get<PlaceDetails>(`/places/details?place_id=${placeId}`);
    return response.data;
  },
};

