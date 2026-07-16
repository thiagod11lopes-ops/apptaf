/** No-op sanitize — mantido para imports legados. */
export function sanitizeForFirestore<T>(data: T): T {
  return data;
}
