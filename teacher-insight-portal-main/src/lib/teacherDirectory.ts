import { collection, doc, serverTimestamp, setDoc, updateDoc, deleteDoc, type Firestore, type QuerySnapshot, type DocumentData } from "firebase/firestore";

export interface TeacherClaim {
  email: string;
  teacherName: string;
  status: "pending" | "approved";
}

export const TEACHER_DIRECTORY_COLLECTION = "teacherDirectory";

export const normalizeTeacherKey = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]/g, "");

export const parseTeacherClaims = (snapshot: QuerySnapshot<DocumentData>): TeacherClaim[] =>
  snapshot.docs
    .map((document) => document.data())
    .filter(
      (data): data is { email: string; teacherName: string; status?: string } =>
        typeof data?.email === "string" && typeof data?.teacherName === "string"
    )
    .map((data) => ({
      email: data.email.toLowerCase(),
      teacherName: data.teacherName,
      // Claims created before the approval flow have no status field — treat them as approved.
      status: data.status === "pending" ? "pending" : "approved",
    }));

export const claimTeacherName = (firestore: Firestore, teacherName: string, email: string) =>
  setDoc(doc(firestore, TEACHER_DIRECTORY_COLLECTION, normalizeTeacherKey(teacherName)), {
    email: email.toLowerCase(),
    teacherName,
    status: "pending",
    claimedAt: serverTimestamp(),
  });

export const approveTeacherName = (firestore: Firestore, teacherName: string) =>
  updateDoc(doc(firestore, TEACHER_DIRECTORY_COLLECTION, normalizeTeacherKey(teacherName)), {
    status: "approved",
  });

export const releaseTeacherName = (firestore: Firestore, teacherName: string) =>
  deleteDoc(doc(firestore, TEACHER_DIRECTORY_COLLECTION, normalizeTeacherKey(teacherName)));
