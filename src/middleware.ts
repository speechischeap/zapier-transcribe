import type { AfterResponseMiddleware, BeforeRequestMiddleware, HttpResponse } from 'zapier-platform-core';

// Every Speech is Cheap endpoint takes the API key as a bearer token:
const addBearerToken: BeforeRequestMiddleware = (request, z, bundle) => {
  if (bundle.authData?.token) {
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
  if (response.status < 400 || response.request.skipThrowForStatus) {
    return response;
  }

  throw new z.errors.Error(apiErrorMessage(response), 'ApiError', response.status);
};

export const befores = [addBearerToken];
export const afters = [throwApiErrors];
