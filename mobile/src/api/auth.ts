import apiClient from './client';

export interface RegisterData {
  email: string;
  password: string;
  full_name?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserResponse {
  id: number;
  email: string;
  full_name: string | null;
  created_at: string;
}

export const authApi = {
  register: async (data: RegisterData): Promise<UserResponse> => {
    const response = await apiClient.post('/auth/register', data);
    return response.data;
  },

  login: async (data: LoginData): Promise<TokenResponse> => {
    // OAuth2PasswordRequestForm expects form-urlencoded data
    const params = new URLSearchParams();
    params.append('username', data.email);
    params.append('password', data.password);
    
    // Use axios directly with form-urlencoded
    const response = await apiClient.post(
      '/auth/login',
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    return response.data;
  },

  getMe: async (): Promise<UserResponse> => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },
};

