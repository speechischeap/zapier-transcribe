// `z.errors.Error` serializes its message, code, and status as JSON; Zapier shows users the message.
export const messageOf = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : String(error);

  try {
    return JSON.parse(raw).message ?? raw;
  } catch {
    return raw;
  }
};

export const rejectionOf = async (promise: Promise<unknown>): Promise<Error> => {
  try {
    await promise;
  } catch (error) {
    return error as Error;
  }

  throw new Error('Expected the call to fail, but it succeeded');
};
