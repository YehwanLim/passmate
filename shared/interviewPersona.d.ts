export type InterviewerPersona = { readonly id: number; readonly photo: string; readonly voice: string };
export const INTERVIEWER_PERSONAS: readonly InterviewerPersona[];
export function pickInterviewer(sessionId: string | null | undefined, personas?: readonly InterviewerPersona[]): InterviewerPersona;
