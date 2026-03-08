import { BASE_URL } from '@/constants/api';
import { useAuthStore } from '@/store/useAuthStore';
import type { ApiResponse } from '@/types';

class ApiClient {
  private getToken(): string | null {
    return useAuthStore.getState().token;
  }

  private async handleUnauthorized(): Promise<string | null> {
    return useAuthStore.getState().refreshSession();
  }

  async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (
      !(options.body instanceof FormData) &&
      !headers['Content-Type']
    ) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      const newToken = await this.handleUnauthorized();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        const retryResponse = await fetch(`${BASE_URL}${path}`, {
          ...options,
          headers,
        });
        if (!retryResponse.ok) {
          const errorData = await retryResponse.json();
          throw new Error(errorData.error?.message || 'Request failed');
        }
        return retryResponse.json();
      }
      useAuthStore.getState().logout();
      throw new Error('Session expired. Please log in again.');
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Request failed');
    }

    return response.json();
  }

  get<T>(path: string) {
    return this.request<T>(path, { method: 'GET' });
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  put<T>(path: string, body: unknown) {
    return this.request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
