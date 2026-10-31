import type { AfterResponseMiddleware, BeforeRequestMiddleware, HttpResponse } from 'zapier-platform-core';

// The hosts that take the API key. Everything else, such as the Zapier URL an Input File arrives on,
// must never receive it, and neither must a plain-HTTP request:
const API_KEY_HOSTS = new Set(['api.speechischeap.com', 'upload.speechischeap.com']);

const takesApiKey = (url: string | undefined): boolean => {
  try {
    const { hostname, protocol } = new URL(url ?? '');

    return protocol === 'https:' && API_KEY_HOSTS.has(hostname);
  } catch {
    return false;
  }
};

const addBearerToken: BeforeRequestMiddleware = (request, z, bundle) => {
  if (bundle.authData?.token && takesApiKey(request.url)) {
    request.headers = { ...request.headers, Authorization: `Bearer ${bundle.authData.token}` };
  }

  return request;
};

// Long enough for documented API messages, including long pre-signed URLs; anything longer is cut short.
const MAX_MESSAGE_LENGTH = 1000;

const readMessage = (raw: string): string => {
  try {
    const body = JSON.parse(raw);
    const candidate = body?.error ?? body?.message;

    // A JSON body without a usable message falls back to the status line:
    return typeof candidate === 'string' ? candidate.trim() : '';
  } catch {
    // Plain text is the normal case. A proxy's HTML error page shows its title, if any:
    if (/^\s*<(!doctype|html|head|body)\b/i.test(raw)) {
      return raw.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? '';
    }

    return raw;
  }
};

// The Jobs API answers errors in plain text and the upload host in JSON. Reads the message from
// either, so users see it instead of the JSON dump zapier-platform-core builds for a non-2xx response.
export const apiErrorMessage = (response: HttpResponse): string => {
  let raw = '';

  try {
    raw = String(response.content ?? '').trim();
  } catch {
    // Streamed responses have no content to read.
  }

  const message = readMessage(raw);

  if (!message) {
    return `Speech is Cheap answered ${response.status} to ${response.request.method} ${response.request.url}`;
  }

  return message.length > MAX_MESSAGE_LENGTH ? `${message.slice(0, MAX_MESSAGE_LENGTH - 1)}…` : message;
};

const throwApiErrors: AfterResponseMiddleware = (response, z) => {
  // Streamed (`raw`) responses have no body to read here; their callers check the status:
  if (response.status < 400 || response.request.skipThrowForStatus || response.request.raw) {
    return response;
  }

  throw new z.errors.Error(apiErrorMessage(response), 'ApiError', response.status);
};

export const befores = [addBearerToken];
export const afters = [throwApiErrors];
