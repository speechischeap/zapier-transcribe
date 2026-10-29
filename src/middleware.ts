import type { AfterResponseMiddleware, BeforeRequestMiddleware } from 'zapier-platform-core';

// Every Speech is Cheap endpoint takes the API key as a bearer token:
const addBearerToken: BeforeRequestMiddleware = (request, z, bundle) => {
  if (bundle.authData?.token) {
    request.headers = { ...request.headers, Authorization: `Bearer ${bundle.authData.token}` };
  }

  return request;
};

// The Jobs API answers errors in plain text and the upload host in JSON. Show that message to
// the user instead of the JSON dump that zapier-platform-core builds for any non-2xx response.
const throwApiErrors: AfterResponseMiddleware = (response, z) => {
  if (response.status < 400 || response.request.skipThrowForStatus) {
    return response;
  }

  let message = response.content?.trim() ?? '';

  try {
    const body = JSON.parse(message);

    message = body.error || body.message || message;
  } catch {
    // Plain text is the normal case.
  }

  if (!message) {
    message = `Speech is Cheap answered ${response.status} to ${response.request.method} ${response.request.url}`;
  }

  throw new z.errors.Error(message, 'ApiError', response.status);
};

export const befores = [addBearerToken];
export const afters = [throwApiErrors];
