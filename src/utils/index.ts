import type { AxiosResponse } from 'axios';
import type { Response } from '../diary/interfaces/response';
import RequestFailedError from '../errors/request-not-successful';

export * from './links';
export * from './parsers';
export * from './url';
export * from './date';
export * from './remote-date';

export function notNil<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

/**
 * @param response Axios response
 * @throws ResponseNotSuccessfulError
 * @returns Response data
 */
export function handleResponse<T>(response: AxiosResponse<Response<T>>): T {
  if (!response.data.success) throw new RequestFailedError(response);
  return response.data.data;
}

export function nullIfEmpty(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  return value;
}

export function parseNotNullOrEmpty(value: string | null | undefined): number | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  return parseFloat(value);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function getContentType(headers: unknown): string | undefined {
  if (!isRecord(headers)) return undefined;
  const parsedHeaders: Record<string, string | undefined> = Object.fromEntries(
    Object.entries(headers)
      .map<[string, unknown]>(([key, value]) => [key.toLowerCase(), value])
      .filter(([value]) => isString(value)) as [string, string][],
  );
  const header = parsedHeaders['content-type'];
  if (header === undefined) return undefined;
  return header.split(';')[0];
}
