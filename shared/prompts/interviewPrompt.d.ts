// 클라이언트(liveSession.ts)가 브라우저에서 보내는 시작·마무리 글을 같은 정의처에서 가져가기 위한 타입 선언.
export const INTERVIEW_PROMPT_VERSION: string;
export const INTERVIEW_WRAP_UP_TEXT: string;
export const INTERVIEW_KICKOFF_TEXT: string;
export const FEEDBACK_DELIVERY_CATEGORIES: readonly ["GAZE", "POSTURE", "FRAMING"];
export function buildInterviewerInstruction(input: {
  company?: string | null;
  jobRole?: string | null;
  coverLetter: string;
  questions: Array<{ question: string; followUps: string[] }>;
  gaps: string[];
  postingBlock?: string;
  mode: "FULL" | "SHORT";
}): string;
export function buildFeedbackPrompt(input: {
  company?: string | null;
  jobRole?: string | null;
  transcript: Array<{ seq: number; speaker: string; text: string; interrupted?: boolean }>;
  photoCount: number;
  questions: Array<{ question: string }>;
}): string;
