export const errorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);
