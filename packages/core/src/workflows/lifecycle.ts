/** Link initialization to an operation without aborting the reusable session afterward. */
export const createWorkflowSession = async <Session extends { destroy(): void }>(
  signal: AbortSignal,
  create: (creationSignal: AbortSignal) => Promise<Session>
): Promise<Session> => {
  signal.throwIfAborted();
  const creation = new AbortController();
  const abort = () => creation.abort(signal.reason);
  signal.addEventListener('abort', abort, { once: true });
  try {
    const instance = await create(creation.signal);
    if (signal.aborted) {
      instance.destroy();
      signal.throwIfAborted();
    }
    return instance;
  } finally {
    signal.removeEventListener('abort', abort);
  }
};
