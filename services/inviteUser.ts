// services/inviteUser.ts
import firebase from "firebase/compat/app";
import "firebase/compat/functions";

export type InviteUserInput = {
  email: string;
  password: string;
  role: "admin" | "coach";
  organizationId: string;
};

export type InviteUserOutput = {
  success: boolean;
  message: string;
};

export async function inviteUserCall(input: InviteUserInput): Promise<InviteUserOutput> {
  // Samma region som din backend-funktion
  const functions = firebase.app().functions("us-central1");
  const callable = functions.httpsCallable("flexInviteUser");
  const res = await callable(input);
  return res.data as InviteUserOutput;
}