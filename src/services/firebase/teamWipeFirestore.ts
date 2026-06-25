import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirestoreDb } from '../../config/firebase';

function teamStatePath(bossUid: string): string {
  return `users/${bossUid}/system/team`;
}

export async function setTeamWipeMarker(bossUid: string): Promise<number> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');

  const wipedAt = Date.now();
  await setDoc(
    doc(db, teamStatePath(bossUid)),
    {
      wipedAt,
      wipedAtServer: serverTimestamp(),
    },
    { merge: true },
  );
  return wipedAt;
}

export async function getTeamWipeMarker(bossUid: string): Promise<number | null> {
  const db = getFirestoreDb();
  if (!db) return null;

  const snap = await getDoc(doc(db, teamStatePath(bossUid)));
  if (!snap.exists()) return null;

  const data = snap.data() as { wipedAt?: number };
  return typeof data.wipedAt === 'number' && data.wipedAt > 0 ? data.wipedAt : null;
}
