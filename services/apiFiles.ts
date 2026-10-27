import api from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { AxiosHeaders, type AxiosRequestConfig, type RawAxiosHeaders } from 'axios';

export interface NativeUploadFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface PictureUploadFile extends NativeUploadFile {
  width: number;
  height: number;
}

function apiPath(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || path.includes('?') || path.includes('#')) {
    throw new Error('An API path without credentials, query, or fragment is required.');
  }
  return path;
}

function requireFile(file: NativeUploadFile, maxSize: number) {
  if (!/^(file|content):\/\//.test(file.uri) || !file.name ||
      !Number.isSafeInteger(file.size) || file.size <= 0 || file.size > maxSize) {
    throw new Error('Select a local file within the permitted size limit.');
  }
}

export function pictureForm(file: PictureUploadFile): FormData {
  requireFile(file, 5 * 1024 * 1024);
  if (!['image/jpeg', 'image/png'].includes(file.mimeType) ||
      !Number.isSafeInteger(file.width) || file.width <= 0 ||
      !Number.isSafeInteger(file.height) || file.height <= 0 || file.width * file.height > 16_000_000) {
    throw new Error('Select a JPEG or PNG picture with at most 16 million pixels.');
  }
  const form = new FormData();
  form.append('picture', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  return form;
}

export function documentForm(file: NativeUploadFile): FormData {
  requireFile(file, 10 * 1024 * 1024);
  if (file.mimeType !== 'application/pdf') throw new Error('Select a PDF document.');
  const form = new FormData();
  form.append('document', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  return form;
}

/** The feature service supplies its documented method/path and response type. */
export async function uploadApiFile<TResponse = unknown>(method: 'post' | 'put', path: string, form: FormData, config?: AxiosRequestConfig): Promise<TResponse> {
  const headers = new AxiosHeaders(config?.headers as RawAxiosHeaders | undefined);
  // false prevents Axios from inserting a default Content-Type. Native FormData
  // supplies the multipart boundary; callers must not manufacture one.
  headers.setContentType(false);
  const response = await api.request<TResponse>({ ...config, baseURL: api.defaults.baseURL, method, url: apiPath(path), data: form, headers });
  return response.data;
}

/** Return authorized PDF bytes for a native viewer/share flow; never a token URL. */
export async function downloadPrivatePdf(path: string, config?: AxiosRequestConfig) {
  if (!useAuthStore.getState().accessToken) throw new Error('Sign in before downloading a private document.');
  const headers = new AxiosHeaders(config?.headers as RawAxiosHeaders | undefined);
  headers.setAccept('application/pdf');
  const response = await api.get<ArrayBuffer>(apiPath(path), { ...config, baseURL: api.defaults.baseURL, headers, responseType: 'arraybuffer' });
  if (String(response.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase() !== 'application/pdf') {
    throw new Error('The server did not return a PDF document.');
  }
  return { data: response.data, fileName: 'quote.pdf' };
}
