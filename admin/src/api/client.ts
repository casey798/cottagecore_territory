import { BASE_URL } from '@/constants/api';
import { useAuthStore } from '@/store/useAuthStore';
import type { ApiResponse } from '@/types';

class ApiClient {
  private getToken(): string | null {
    return useAuthStore.getState().token;
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

    if (response.status === 401 || response.status === 403) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
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
