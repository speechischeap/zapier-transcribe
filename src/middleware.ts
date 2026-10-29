import type { AfterResponseMiddleware, BeforeRequestMiddleware, HttpResponse } from 'zapier-platform-core';

const isSpeechIsCheap = (url: string | undefined): boolean => {
  try {
    const { hostname } = new URL(url ?? '');

    return hostname === 'speechischeap.com' || hostname.endsWith('.speechischeap.com');
  } catch {
    return false;
  }
};

// Every Speech is Cheap endpoint takes the API key as a bearer token. Other hosts, such as the
// Zapier URL an Input File arrives on, must never receive it:
const addBearerToken: BeforeRequestMiddleware = (request, z, bundle) => {
  if (bundle.authData?.token && isSpeechIsCheap(request.url)) {
    request.headers = { ...request.headers, Authorization: `Bearer ${bundle.authData.token}` };
  }

  return request;
};

// The Jobs API answers errors in plain text and the upload host in JSON. Reads the message from
// either, so users see it instead of the JSON dump zapier-platform-core builds for a non-2xx response.
export const apiErrorMessage = (response: HttpResponse): string => {
  let message = response.content?.trim() ?? '';

  try {
    const body = JSON.parse(message);

    message = body.error || body.message || message;
  } catch {
    // Plain text is the normal case.
  }

  return message || `Speech is Cheap answered ${response.status} to ${response.request.method} ${response.request.url}`;
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
