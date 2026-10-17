import { collection, doc, serverTimestamp, setDoc, deleteDoc, type Firestore, type QuerySnapshot, type DocumentData } from "firebase/firestore";

export interface TeacherClaim {
  email: string;
  teacherName: string;
}

export const TEACHER_DIRECTORY_COLLECTION = "teacherDirectory";

export const normalizeTeacherKey = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]/g, "");

export const parseTeacherClaims = (snapshot: QuerySnapshot<DocumentData>): TeacherClaim[] =>
  snapshot.docs
    .map((document) => document.data())
    .filter(
      (data): data is { email: string; teacherName: string } =>
        typeof data?.email === "string" && typeof data?.teacherName === "string"
    )
    .map((data) => ({ email: data.email.toLowerCase(), teacherName: data.teacherName }));

export const claimTeacherName = (firestore: Firestore, teacherName: string, email: string) =>
  setDoc(doc(firestore, TEACHER_DIRECTORY_COLLECTION, normalizeTeacherKey(teacherName)), {
    email: email.toLowerCase(),
    teacherName,
    claimedAt: serverTimestamp(),
  });

export const releaseTeacherName = (firestore: Firestore, teacherName: string) =>
  deleteDoc(doc(firestore, TEACHER_DIRECTORY_COLLECTION, normalizeTeacherKey(teacherName)));
