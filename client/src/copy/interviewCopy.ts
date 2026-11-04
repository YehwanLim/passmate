// AI 면접 연습 화면 문구. 사람과 하는 멘토링 모의면접(/mentoring)과 다른 기능이라 "모의면접"이라는 말은 쓰지 않는다.
import type { InterviewMode } from "@/lib/interview/interviewApi";

export const INTERVIEW_TITLE = "AI 면접 연습";

export const INTERVIEW_MODE_COPY: Record<InterviewMode, { label: string; minutes: number; description: string }> = {
  FULL: { label: "실전 15분", minutes: 15, description: "리포트의 예상 질문으로 면접관이 묻고, 답에 따라 꼬리 질문이 이어져요." },
  SHORT: { label: "짧은 연습 5분", minutes: 5, description: "질문 세 개로 가볍게 몸을 풀어요. 피드백은 같은 구성으로 받아요." },
};

export const INTERVIEW_CONSENT_COPY = {
  heading: "시작하기 전에 확인해 주세요",
  items: [
    "면접 중 마이크 소리와 카메라 사진(약 10초에 1장)이 Google의 AI(Gemini)로 전송되어 면접 진행과 피드백에 쓰여요.",
    "음성·영상·사진 파일은 저장하지 않아요. 자동 받아쓰기로 만든 대화 글과 피드백만 남아요.",
    "자동 받아쓰기라 실제 말과 다를 수 있어요. 피드백은 참고로만 봐 주세요.",
    "시작하면 이용권 1회가 쓰여요. 2분 안에 그만두고 답변이 2번 미만이면 돌려드려요(한 달에 2번까지).",
  ],
  checkbox: "위 내용을 확인했고 전송에 동의해요",
};

export const INTERVIEW_DEVICE_COPY = {
  heading: "장비를 확인해요",
  camera: "카메라",
  cameraOff: "카메라 없이 하기",
  cameraOffHint: "카메라를 끄면 면접은 그대로 진행되고 시선·자세 피드백만 빠져요.",
  mic: "마이크",
  micHint: "말해 보세요. 막대가 움직이면 돼요.",
  earphones: "이어폰을 쓰면 면접관 목소리가 마이크로 들어가 끊기는 일을 막을 수 있어요.",
  inApp: "앱 안의 브라우저에서는 카메라·마이크가 막혀 있어요. 크롬이나 사파리에서 열어 주세요.",
  unsupported: "이 브라우저에서는 카메라·마이크를 쓸 수 없어요. 최신 크롬을 권해요.",
  denied: "카메라·마이크 권한이 거부됐어요. 주소창 왼쪽 아이콘에서 허용한 뒤 다시 시도해 주세요.",
};

export const INTERVIEW_LIVE_COPY = {
  connecting: "면접관을 연결하고 있어요",
  reconnecting: "연결을 다시 잇고 있어요. 잠깐만요",
  interviewer: "AI 면접관",
  you: "나",
  end: "면접 끝내기",
  endConfirm: "지금 끝낼까요? 끝내면 바로 피드백을 만들어요.",
  listening: "듣고 있어요",
  speaking: "말하는 중",
  thinking: "생각 중",
};

/** 면접관 자리 상태 글. 키는 components/interview/InterviewerPresence 의 InterviewerActivity 와 같다. */
export const INTERVIEWER_STATUS_COPY = {
  connecting: INTERVIEW_LIVE_COPY.connecting,
  reconnecting: INTERVIEW_LIVE_COPY.reconnecting,
  speaking: INTERVIEW_LIVE_COPY.speaking,
  listening: INTERVIEW_LIVE_COPY.listening,
  thinking: INTERVIEW_LIVE_COPY.thinking,
} as const;

export const INTERVIEW_FEEDBACK_COPY = {
  pending: "면접을 되돌아보고 있어요",
  pendingHint: "1~3분 걸려요. 이 화면을 닫아도 계속 만들어져요.",
  failed: "피드백을 만들지 못했어요",
  failedHint: "대화 글은 남아 있어요. 다시 시도해 주세요.",
  exhausted: "피드백 생성에 세 번 실패해 이용권을 돌려드렸어요. 대화 글은 아래에서 볼 수 있어요.",
  refunded: "2분 안에 끝나 이용권을 돌려드렸어요.",
  transcriptHeading: "대화 글",
  transcriptHint: "자동 받아쓰기라 실제 말과 다를 수 있어요.",
  deliveryHeading: "카메라에 보인 것",
  deliveryUnavailable: "카메라 없이 진행해 시선·자세 피드백은 없어요.",
  nextAttempt: "다시 답한다면",
  retry: "피드백 다시 만들기",
};

export const INTERVIEW_CARD_COPY = {
  label: "리포트를 읽은 면접관과",
  heading: "이 질문들, 실제 면접처럼 답해 볼까요?",
  description: "카메라와 마이크를 켜면 내 자소서를 읽은 AI 면접관이 실시간으로 물어요. 말로 답하면 꼬리 질문이 이어지고, 끝나면 답변·시선·자세 피드백을 받아요.",
  remaining: (count: number) => `이용권 ${count}회 남음`,
  none: "지금은 쓸 수 있는 면접 이용권이 없어요.",
  disabled: "준비 중인 기능이에요.",
  history: "지난 면접 보기",
};

export const DELIVERY_CATEGORY_LABEL: Record<"GAZE" | "POSTURE" | "FRAMING", string> = {
  GAZE: "시선",
  POSTURE: "자세",
  FRAMING: "화면 구도",
};
