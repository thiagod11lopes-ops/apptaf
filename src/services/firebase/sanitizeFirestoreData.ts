/** Firestore rejeita campos com valor `undefined`; IndexedDB aceita. */
export function sanitizeForFirestore<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}
