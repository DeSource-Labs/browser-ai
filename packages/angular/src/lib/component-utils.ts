export const errorText = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);
