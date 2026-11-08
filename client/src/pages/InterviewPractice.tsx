import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { ArrowLeft, Camera, CameraOff, Loader2, Mic } from "lucide-react";

import FeedbackView, { TranscriptList } from "@/components/interview/FeedbackView";
import InterviewCall, { type CallSubtitle, type InterviewerActivity } from "@/components/interview/InterviewCall";
import SiteHeader from "@/components/SiteHeader";
import {
  INTERVIEW_CONSENT_COPY,
  INTERVIEW_DEVICE_COPY,
  INTERVIEW_FEEDBACK_COPY,
  INTERVIEW_LIVE_COPY,
  INTERVIEW_MODE_COPY,
  INTERVIEW_TITLE,
} from "@/copy/interviewCopy";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getAuthorizationHeader } from "@/lib/apiAuth";
import { detectInAppBrowser } from "@/lib/inAppBrowser";
import {
  InterviewApiError,
  createInterviewSession,
  endInterviewSession,
  getInterviewSession,
  newIdempotencyKey,
  requestInterviewFeedback,
  type InterviewMode,
  type InterviewSession,
} from "@/lib/interview/interviewApi";
import { loadInterviewDirectDraft } from "@/lib/interview/directDraft";
import { startLiveSession, type LiveSessionHandle, type LiveState } from "@/lib/interview/liveSession";
import { rootMeanSquare } from "@/lib/interview/pcm";
import { pickInterviewer } from "@shared/interviewPersona.js";

type Phase = "loading" | "setup" | "live" | "after" | "error";

const API_ERROR_COPY: Record<string, string> = {
  INTERVIEW_CREDITS_EXHAUSTED: "쓸 수 있는 면접 이용권이 없어요.",
  INTERVIEW_IN_PROGRESS: "진행 중인 면접이 있어요. 끝낸 뒤 다시 시작해 주세요.",
  INTERVIEW_DISABLED: "지금은 모의 면접을 열 수 없어요.",
  INTERVIEW_SOURCE_UNAVAILABLE: "면접에 쓸 자소서나 예상 질문을 찾지 못했어요.",
  INTERVIEW_COVER_LETTER_TOO_SHORT: "자소서를 200자 이상 붙여 넣어 주세요.",
  INTERVIEW_TOKEN_FAILED: "면접관을 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.",
  INTERVIEW_CAPACITY: "오늘은 모의 면접이 꽉 찼어요. 내일 다시 시도해 주세요. 이용권은 쓰이지 않았어요.",
  INTERVIEW_FEEDBACK_EXHAUSTED: "피드백 생성을 세 번 시도해 더는 만들 수 없어요.",
  INTERVIEW_TRANSCRIPT_EMPTY: "기록된 답변이 없어 피드백을 만들 수 없어요.",
  INTERVIEW_CONSENT_REQUIRED: "안내 문구가 바뀌었어요. 새로고침한 뒤 다시 동의해 주세요.",
  INTERVIEW_NOT_OPEN: "이미 끝난 면접이에요.",
  INTERVIEW_EXPIRED: "면접 시간이 지났어요.",
  INTERVIEW_TOKEN_LIMIT: "연결을 너무 여러 번 다시 시도했어요. 이 면접은 여기서 끝나요.",
  PAYLOAD_TOO_LARGE: "보내려는 사진이 너무 커요.",
  SETUP_TIMEOUT: "면접관이 응답하지 않아 연결을 끊었어요. 잠시 뒤 다시 시도해 주세요.",
  SETUP_REJECTED: "면접관 연결이 거절됐어요. 잠시 뒤 다시 시도해 주세요.",
  SOCKET_OPEN_FAILED: "면접관에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.",
  RATE_LIMITED: "잠시 뒤 다시 시도해 주세요.",
  NOT_FOUND: "리포트를 찾을 수 없어요.",
};
function liveErrorCopy(code: string) {
  return API_ERROR_COPY[code] ?? "면접관 연결에 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.";
}
const FEEDBACK_MAX_ATTEMPTS = 3;

function errorCopy(error: unknown) {
  if (error instanceof InterviewApiError) return API_ERROR_COPY[error.code] ?? "문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.";
  return "문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.";
}

function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * AI 모의 면접 한 화면: 장비 점검·동의(setup) → 실시간 면접(live) → 피드백(after).
 * /my/interview-practice/start?analysisId=&mode= (리포트로 시작) 또는 ?source=direct&mode= (소개 화면에서 회사·직무·자소서를 넣고 시작)로 들어와 세션을 만들면 주소만 /my/interview-practice/:id 로 바꾸고 같은 컴포넌트가 이어 간다.
 * 끝난 세션 주소로 다시 들어오면 피드백·대화 글을 보여 준다.
 */
export default function InterviewPractice() {
  const params = useParams<{ sessionId: string }>();
  const search = useSearch();
  const [, navigate] = useLocation();
  const { isLoading: authLoading, isAuthenticated } = useRequireAuth({ redirectPath: `${window.location.pathname}${window.location.search}` });
  const query = new URLSearchParams(search);
  const isStart = params.sessionId === "start";
  const analysisId = query.get("analysisId");
  // 리포트 없이 시작: 소개 화면이 sessionStorage 에 넣어 둔 입력을 읽는다. 처음 그릴 때 한 번만 읽는다.
  const isDirect = isStart && !analysisId && query.get("source") === "direct";
  const [directDraft] = useState(() => (isDirect ? loadInterviewDirectDraft() : null));
  const mode: InterviewMode = query.get("mode") === "SHORT" ? "SHORT" : "FULL";

  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(true);
  const [consented, setConsented] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [live, setLive] = useState<LiveState | null>(null);
  const [feedbackRequesting, setFeedbackRequesting] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  // ref 만 바꾸면 다시 그려지지 않아 마이크 막대·시작 버튼이 스트림 도착을 모른다. 그리기용으로 state 를 같이 둔다.
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const handleRef = useRef<LiveSessionHandle | null>(null);
  const photosRef = useRef<string[]>([]);
  const idempotencyKeyRef = useRef(newIdempotencyKey());
  const startedSessionIdRef = useRef<string | null>(null);
  const inApp = detectInAppBrowser();
  const mediaSupported = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

  // ── 장비 미리보기 ──
  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setPreviewStream(null);
  }, []);

  const requestDevices = useCallback(async (withCamera: boolean) => {
    stopStream();
    setDeviceError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: withCamera ? { width: 640, height: 360, facingMode: "user" } : false,
      });
      streamRef.current = stream;
      setPreviewStream(stream);
      if (previewVideoRef.current) previewVideoRef.current.srcObject = withCamera ? stream : null;
    } catch (cause) {
      const name = cause instanceof Error ? cause.name : "";
      setDeviceError(name === "NotAllowedError" ? INTERVIEW_DEVICE_COPY.denied : INTERVIEW_DEVICE_COPY.unsupported);
    }
  }, [stopStream]);

  // 마이크 레벨 표시(미리보기용). 면접 중에는 liveSession 이 따로 잰다.
  useEffect(() => {
    if (phase !== "setup" || !previewStream) return;
    const context = new AudioContext();
    // 사용자 동작 없이 만든 AudioContext 는 멈춘 채 시작할 수 있어 깨운다.
    void context.resume();
    const source = context.createMediaStreamSource(previewStream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const buffer = new Float32Array(analyser.fftSize);
    const timer = setInterval(() => {
      analyser.getFloatTimeDomainData(buffer);
      setMicLevel(rootMeanSquare(buffer));
    }, 100);
    return () => {
      clearInterval(timer);
      void context.close();
    };
  }, [phase, previewStream]);

  // ── 세션 불러오기 ──
  useEffect(() => {
    // 로그인 전에는 아무것도 하지 않는다(useRequireAuth 가 로그인으로 보낸다). 안 그러면 로그인 화면으로 가기 전에 카메라 권한 창이 뜬다.
    if (authLoading || !isAuthenticated) return;
    if (isStart) {
      if (!analysisId && !directDraft) {
        navigate("/my/interview-practice");
        return;
      }
      setPhase("setup");
      if (mediaSupported && !inApp) void requestDevices(true);
      return;
    }
    // 시작 때 주소를 /start → /:id 로 바꾸면 wouter 가 이 효과를 다시 돌린다. 이미 들고 있는 세션이면 다시 불러오지 않는다
    // (불러오면 장비 점검 화면으로 되돌아가 마이크를 끊고, 다시 시작하면 면접관이 둘이 된다).
    if (startedSessionIdRef.current === params.sessionId) return;
    let alive = true;
    (async () => {
      try {
        const loaded = await getInterviewSession(params.sessionId);
        if (!alive) return;
        setSession(loaded);
        setPhase(loaded.status === "CREATED" ? "setup" : "after");
        if (loaded.status === "CREATED" && mediaSupported && !inApp) void requestDevices(true);
      } catch (cause) {
        if (!alive) return;
        setError(errorCopy(cause));
        setPhase("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [authLoading, isAuthenticated, isStart, analysisId, directDraft, params.sessionId, navigate, requestDevices, mediaSupported, inApp]);

  useEffect(() => () => {
    stopStream();
    void handleRef.current?.stop("closed");
  }, [stopStream]);

  // ── 피드백 상태 폴링 ──
  useEffect(() => {
    if (phase !== "after" || !session || !["PENDING", "CALLING"].includes(session.feedbackStatus)) return;
    const timer = setInterval(async () => {
      try {
        setSession(await getInterviewSession(session.id));
      } catch {
        // 다음 틱에 다시 읽는다.
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [phase, session]);

  const requestFeedback = useCallback(async (target: InterviewSession, photos: string[]) => {
    setFeedbackRequesting(true);
    setError(null);
    try {
      await requestInterviewFeedback(target.id, photos);
      setSession(await getInterviewSession(target.id));
    } catch (cause) {
      setError(errorCopy(cause));
    } finally {
      setFeedbackRequesting(false);
    }
  }, []);

  // 다시 들어왔더니 ACTIVE 로 남아 있는 세션(탭이 죽음 등). 서버에 끝을 알리고 피드백을 만든다. 사진 표본은 없으므로 사진 없이.
  const endStrandedSession = useCallback(async (target: InterviewSession) => {
    setStarting(true);
    setError(null);
    try {
      const { session: ended } = await endInterviewSession(target.id, "closed", null);
      setSession(ended);
      if (["ENDED", "INTERRUPTED"].includes(ended.status) && ended.feedbackStatus === "NONE") await requestFeedback(ended, []);
    } catch (cause) {
      setError(errorCopy(cause));
    } finally {
      setStarting(false);
    }
  }, [requestFeedback]);

  // ── 시작 ──
  const start = async () => {
    if (!streamRef.current) return;
    setStarting(true);
    setError(null);
    try {
      let current = session;
      if (!current) {
        if (analysisId) {
          current = await createInterviewSession({ analysisId, mode, idempotencyKey: idempotencyKeyRef.current });
        } else if (directDraft) {
          current = await createInterviewSession({ direct: directDraft, mode, idempotencyKey: idempotencyKeyRef.current });
        } else {
          throw new InterviewApiError("NOT_FOUND", 404);
        }
        setSession(current);
        startedSessionIdRef.current = current.id;
        window.history.replaceState(null, "", `/my/interview-practice/${current.id}`);
      }
      const authHeader = await getAuthorizationHeader();
      setPhase("live");
      // 미리보기 비디오를 면접 화면 비디오로 옮긴다.
      const stream = streamRef.current;
      requestAnimationFrame(() => {
        if (liveVideoRef.current && cameraOn) liveVideoRef.current.srcObject = stream;
      });
      handleRef.current = await startLiveSession({
        sessionId: current.id,
        mode: current.mode,
        micStream: stream,
        // 요소가 아니라 ref 를 넘긴다. 통화 화면은 이 줄이 돌 때 아직 그려지지 않았다.
        videoRef: cameraOn ? liveVideoRef : null,
        authHeader,
        onChange: (state) => {
          setLive(state);
          if (state.phase === "ended" || state.phase === "failed") {
            photosRef.current = handleRef.current?.photos() ?? [];
            stopStream();
            // 시작조차 못 한 이유(하루 상한·연결 거절 등)는 끝난 화면에서 알려 준다.
            if (state.error) setError(liveErrorCopy(state.error));
            void (async () => {
              try {
                const ended = await getInterviewSession(current!.id);
                setSession(ended);
                setPhase("after");
                if (["ENDED", "INTERRUPTED"].includes(ended.status) && ended.feedbackStatus === "NONE") {
                  await requestFeedback(ended, photosRef.current);
                }
              } catch (cause) {
                setError(errorCopy(cause));
                setPhase("after");
              }
            })();
          }
        },
      });
    } catch (cause) {
      setError(errorCopy(cause));
      setPhase("setup");
    } finally {
      setStarting(false);
    }
  };

  const endNow = async () => {
    if (!window.confirm(INTERVIEW_LIVE_COPY.endConfirm)) return;
    await handleRef.current?.stop("user-stop");
  };

  const interviewerActivity: InterviewerActivity =
    live?.phase === "connecting" ? "connecting"
      : live?.phase === "reconnecting" ? "reconnecting"
        : live?.modelSpeaking ? "speaking"
          : live?.candidateSpeaking ? "listening" : "thinking";
  // 자막: 쓰는 중인 말이 있으면 그것, 없으면 마지막 발언 하나.
  const lastTurn = live?.turns.length ? live.turns[live.turns.length - 1] : null;
  const callSubtitle: CallSubtitle = live?.draftText && live.draftSpeaker
    ? { speaker: live.draftSpeaker, text: live.draftText, draft: true }
    : lastTurn ? { speaker: lastTurn.speaker, text: lastTurn.text, draft: false } : null;
  const effectiveMode = session?.mode ?? mode;
  const modeCopy = INTERVIEW_MODE_COPY[effectiveMode];
  const reportId = session ? session.analysisId : analysisId;
  // 리포트 없이 시작한 면접은 소개 화면(새 면접 입력·지난 면접)으로 돌아간다.
  const backPath = reportId ? `/report-new?analysisId=${encodeURIComponent(reportId)}` : "/my/interview-practice";
  const headerCompany = session?.company ?? directDraft?.company ?? null;
  const headerJobRole = session?.jobRole ?? directDraft?.jobRole ?? null;

  return (
    <div className="min-h-screen bg-stage pb-24 text-ink">
      <SiteHeader variant="light" />
      <main className="container max-w-3xl pt-8">
        {phase !== "live" && (
          <button type="button" onClick={() => navigate(backPath)} className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-ink-4 transition-colors hover:text-ink-2">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {reportId ? "리포트로" : INTERVIEW_TITLE}
          </button>
        )}
        <h1 className="text-[28px] font-bold tracking-[-0.03em]">{INTERVIEW_TITLE}</h1>
        <p className="mt-1.5 text-[15px] text-ink-4">
          {headerCompany || headerJobRole ? `${headerCompany ?? ""} ${headerJobRole ?? ""}`.trim() : modeCopy.label} · {modeCopy.minutes}분
        </p>

        {phase === "loading" && (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-ink-4" aria-hidden="true" /></div>
        )}

        {phase === "error" && <p role="alert" className="mt-8 rounded-2xl bg-surface px-6 py-5 text-[15px] text-danger">{error}</p>}

        {phase === "setup" && (
          <div className="mt-8 space-y-6">
            <section className="rounded-3xl bg-surface px-6 py-7 md:px-8">
              <h2 className="text-[18px] font-bold">{INTERVIEW_DEVICE_COPY.heading}</h2>
              {inApp ? (
                <p role="alert" className="mt-3 text-[15px] text-danger">{INTERVIEW_DEVICE_COPY.inApp}</p>
              ) : !mediaSupported ? (
                <p role="alert" className="mt-3 text-[15px] text-danger">{INTERVIEW_DEVICE_COPY.unsupported}</p>
              ) : (
                <>
                  <div className="mt-4 grid gap-4 md:grid-cols-[240px_1fr]">
                    <div className="relative aspect-video overflow-hidden rounded-2xl bg-ink">
                      <video ref={previewVideoRef} autoPlay muted playsInline className={`h-full w-full object-cover ${cameraOn ? "" : "hidden"}`} />
                      {!cameraOn && <div className="flex h-full items-center justify-center text-white/60"><CameraOff className="h-7 w-7" aria-hidden="true" /></div>}
                    </div>
                    <div className="space-y-4 text-[15px]">
                      <div>
                        <p className="flex items-center gap-2 font-semibold"><Camera className="h-4 w-4" aria-hidden="true" />{INTERVIEW_DEVICE_COPY.camera}</p>
                        <button
                          type="button"
                          onClick={() => { const next = !cameraOn; setCameraOn(next); void requestDevices(next); }}
                          className="mt-1.5 text-[14px] font-semibold text-brand underline-offset-4 hover:underline"
                        >
                          {cameraOn ? INTERVIEW_DEVICE_COPY.cameraOff : "카메라 켜기"}
                        </button>
                        <p className="mt-1 text-[13px] text-ink-4">{INTERVIEW_DEVICE_COPY.cameraOffHint}</p>
                      </div>
                      <div>
                        <p className="flex items-center gap-2 font-semibold"><Mic className="h-4 w-4" aria-hidden="true" />{INTERVIEW_DEVICE_COPY.mic}</p>
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-fill" role="meter" aria-label="마이크 소리 크기" aria-valuenow={Math.round(Math.min(1, micLevel * 6) * 100)} aria-valuemin={0} aria-valuemax={100}>
                          <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${Math.min(100, micLevel * 600)}%` }} />
                        </div>
                        <p className="mt-1 text-[13px] text-ink-4">{INTERVIEW_DEVICE_COPY.micHint}</p>
                      </div>
                      <p className="text-[13px] text-ink-4">{INTERVIEW_DEVICE_COPY.earphones}</p>
                    </div>
                  </div>
                  {deviceError && <p role="alert" className="mt-4 text-[14px] text-danger">{deviceError}</p>}
                </>
              )}
            </section>

            <section className="rounded-3xl bg-surface px-6 py-7 md:px-8">
              <h2 className="text-[18px] font-bold">{INTERVIEW_CONSENT_COPY.heading}</h2>
              <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-ink-3">
                {INTERVIEW_CONSENT_COPY.items.map((item) => (
                  <li key={item} className="flex gap-2"><span aria-hidden="true">·</span><span className="text-pretty">{item}</span></li>
                ))}
              </ul>
              <label className="mt-5 flex items-start gap-3 text-[15px] font-semibold">
                <input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} className="mt-1 h-4 w-4 accent-brand" />
                <span>{INTERVIEW_CONSENT_COPY.checkbox}</span>
              </label>
            </section>

            {error && <p role="alert" className="text-[14px] text-danger">{error}</p>}
            <button
              type="button"
              disabled={!consented || starting || !previewStream || Boolean(inApp) || !mediaSupported}
              onClick={() => void start()}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-brand px-6 text-[15px] font-bold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            >
              {starting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {modeCopy.label} 시작
            </button>
          </div>
        )}

        {phase === "live" && (
          <InterviewCall
            activity={interviewerActivity}
            photoSrc={pickInterviewer(session?.id).photo}
            videoRef={liveVideoRef}
            cameraOn={cameraOn}
            micLevel={live?.micLevel ?? 0}
            candidateSpeaking={live?.candidateSpeaking ?? false}
            elapsedMs={live?.elapsedMs ?? 0}
            totalMinutes={modeCopy.minutes}
            reconnects={live?.reconnects ?? 0}
            ending={live?.phase === "ending"}
            onEnd={() => void endNow()}
            subtitle={callSubtitle}
          />
        )}

        {phase === "after" && session && (
          <div className="mt-8 space-y-6">
            {session.status === "CANCELLED" && (
              <div className="rounded-2xl bg-surface px-6 py-5 text-[15px] text-ink-3">
                {error && <p role="alert" className="mb-2 text-danger">{error}</p>}
                <p>{INTERVIEW_FEEDBACK_COPY.refunded}</p>
              </div>
            )}
            {session.status === "ACTIVE" ? (
              <div className="rounded-3xl bg-surface px-6 py-7">
                <p className="text-[17px] font-bold">{INTERVIEW_FEEDBACK_COPY.active}</p>
                <p className="mt-1.5 text-[14px] text-ink-4">{INTERVIEW_FEEDBACK_COPY.activeHint}</p>
                {error && <p role="alert" className="mt-3 text-[14px] text-danger">{error}</p>}
                <button
                  type="button"
                  disabled={starting}
                  onClick={() => void endStrandedSession(session)}
                  className="mt-4 inline-flex h-11 items-center gap-2 rounded-[10px] bg-brand px-5 text-[14px] font-bold text-white hover:bg-brand-hover disabled:opacity-40"
                >
                  {starting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {INTERVIEW_FEEDBACK_COPY.endActive}
                </button>
              </div>
            ) : ["PENDING", "CALLING"].includes(session.feedbackStatus) || feedbackRequesting ? (
              <div className="rounded-3xl bg-surface px-6 py-10 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-ink-4" aria-hidden="true" />
                <p className="mt-4 text-[17px] font-bold">{INTERVIEW_FEEDBACK_COPY.pending}</p>
                <p className="mt-1.5 text-[14px] text-ink-4">{INTERVIEW_FEEDBACK_COPY.pendingHint}</p>
              </div>
            ) : session.feedbackStatus === "SUCCEEDED" && session.feedback ? (
              <FeedbackView feedback={session.feedback} turns={session.turns ?? []} hadVideo={session.feedbackHadVideo} />
            ) : (
              <>
                {session.feedbackStatus === "FAILED" && session.feedbackAttempts >= FEEDBACK_MAX_ATTEMPTS && (
                  <p className="rounded-2xl bg-surface px-6 py-5 text-[15px] text-ink-3">{INTERVIEW_FEEDBACK_COPY.exhausted}</p>
                )}
                {session.feedbackStatus === "FAILED" && session.feedbackAttempts < FEEDBACK_MAX_ATTEMPTS && (
                  <div className="rounded-3xl bg-surface px-6 py-7">
                    <p className="text-[17px] font-bold">{INTERVIEW_FEEDBACK_COPY.failed}</p>
                    <p className="mt-1.5 text-[14px] text-ink-4">{INTERVIEW_FEEDBACK_COPY.failedHint}</p>
                    {error && <p role="alert" className="mt-3 text-[14px] text-danger">{error}</p>}
                    <button
                      type="button"
                      onClick={() => void requestFeedback(session, photosRef.current)}
                      className="mt-4 inline-flex h-11 items-center rounded-[10px] bg-brand-soft px-5 text-[14px] font-bold text-brand-ink hover:bg-[#dbe9ff]"
                    >
                      {INTERVIEW_FEEDBACK_COPY.retry}
                    </button>
                  </div>
                )}
                {session.status !== "CANCELLED" && session.feedbackStatus === "NONE" && (
                  <div className="rounded-3xl bg-surface px-6 py-7">
                    <p className="text-[17px] font-bold">{INTERVIEW_FEEDBACK_COPY.notRequested}</p>
                    <p className="mt-1.5 text-[14px] text-ink-4">{INTERVIEW_FEEDBACK_COPY.notRequestedHint}</p>
                    {error && <p role="alert" className="mt-3 text-[14px] text-danger">{error}</p>}
                    <button
                      type="button"
                      onClick={() => void requestFeedback(session, photosRef.current)}
                      className="mt-4 inline-flex h-11 items-center rounded-[10px] bg-brand-soft px-5 text-[14px] font-bold text-brand-ink hover:bg-[#dbe9ff]"
                    >
                      {INTERVIEW_FEEDBACK_COPY.request}
                    </button>
                  </div>
                )}
                <TranscriptList turns={session.turns ?? []} />
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
