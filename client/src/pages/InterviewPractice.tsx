import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { ArrowLeft, Camera, CameraOff, Loader2, Mic } from "lucide-react";

import FeedbackView, { TranscriptList } from "@/components/interview/FeedbackView";
import InterviewerPresence from "@/components/interview/InterviewerPresence";
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
  getInterviewSession,
  newIdempotencyKey,
  requestInterviewFeedback,
  type InterviewMode,
  type InterviewSession,
} from "@/lib/interview/interviewApi";
import { startLiveSession, type LiveSessionHandle, type LiveState } from "@/lib/interview/liveSession";
import { rootMeanSquare } from "@/lib/interview/pcm";

type Phase = "loading" | "setup" | "live" | "after" | "error";

const API_ERROR_COPY: Record<string, string> = {
  INTERVIEW_CREDITS_EXHAUSTED: "쓸 수 있는 면접 이용권이 없어요.",
  INTERVIEW_IN_PROGRESS: "진행 중인 면접이 있어요. 끝낸 뒤 다시 시작해 주세요.",
  INTERVIEW_DISABLED: "지금은 면접 연습을 열 수 없어요.",
  INTERVIEW_SOURCE_UNAVAILABLE: "이 리포트에는 예상 질문이 없어 면접을 만들 수 없어요.",
  INTERVIEW_TOKEN_FAILED: "면접관을 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.",
  RATE_LIMITED: "잠시 뒤 다시 시도해 주세요.",
  NOT_FOUND: "리포트를 찾을 수 없어요.",
};

function errorCopy(error: unknown) {
  if (error instanceof InterviewApiError) return API_ERROR_COPY[error.code] ?? "문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.";
  return "문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.";
}

function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * AI 면접 연습 한 화면: 장비 점검·동의(setup) → 실시간 면접(live) → 피드백(after).
 * /my/interview-practice/start?analysisId=&mode= 로 들어와 세션을 만들면 주소만 /my/interview-practice/:id 로 바꾸고 같은 컴포넌트가 이어 간다.
 * 끝난 세션 주소로 다시 들어오면 피드백·대화 글을 보여 준다.
 */
export default function InterviewPractice() {
  const params = useParams<{ sessionId: string }>();
  const search = useSearch();
  const [, navigate] = useLocation();
  const { isLoading: authLoading } = useRequireAuth({ redirectPath: `${window.location.pathname}${window.location.search}` });
  const query = new URLSearchParams(search);
  const isStart = params.sessionId === "start";
  const analysisId = query.get("analysisId");
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
    if (authLoading) return;
    if (isStart) {
      if (!analysisId) {
        navigate("/my");
        return;
      }
      setPhase("setup");
      if (mediaSupported && !inApp) void requestDevices(true);
      return;
    }
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
  }, [authLoading, isStart, analysisId, params.sessionId, navigate, requestDevices, mediaSupported, inApp]);

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
    try {
      await requestInterviewFeedback(target.id, photos);
      setSession(await getInterviewSession(target.id));
    } catch (cause) {
      setError(errorCopy(cause));
    } finally {
      setFeedbackRequesting(false);
    }
  }, []);

  // ── 시작 ──
  const start = async () => {
    if (!streamRef.current) return;
    setStarting(true);
    setError(null);
    try {
      let current = session;
      if (!current) {
        if (!analysisId) throw new InterviewApiError("NOT_FOUND", 404);
        current = await createInterviewSession({ analysisId, mode, idempotencyKey: idempotencyKeyRef.current });
        setSession(current);
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
        videoElement: cameraOn ? liveVideoRef.current : null,
        authHeader,
        onChange: (state) => {
          setLive(state);
          if (state.phase === "ended" || state.phase === "failed") {
            photosRef.current = handleRef.current?.photos() ?? [];
            stopStream();
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

  const effectiveMode = session?.mode ?? mode;
  const modeCopy = INTERVIEW_MODE_COPY[effectiveMode];
  const backPath = session?.analysisId || analysisId ? `/report-new?analysisId=${encodeURIComponent(session?.analysisId ?? analysisId ?? "")}` : "/my";

  return (
    <div className="min-h-screen bg-stage pb-24 text-ink">
      <SiteHeader variant="light" />
      <main className="container max-w-3xl pt-8">
        {phase !== "live" && (
          <button type="button" onClick={() => navigate(backPath)} className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-ink-4 transition-colors hover:text-ink-2">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            리포트로
          </button>
        )}
        <h1 className="text-[28px] font-bold tracking-[-0.03em]">{INTERVIEW_TITLE}</h1>
        <p className="mt-1.5 text-[15px] text-ink-4">
          {session?.company || session?.jobRole ? `${session.company ?? ""} ${session.jobRole ?? ""}`.trim() : modeCopy.label} · {modeCopy.minutes}분
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
          <div className="mt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <InterviewerPresence
                speaking={live?.modelSpeaking ?? false}
                status={
                  live?.phase === "connecting" ? INTERVIEW_LIVE_COPY.connecting
                    : live?.phase === "reconnecting" ? INTERVIEW_LIVE_COPY.reconnecting
                      : live?.modelSpeaking ? INTERVIEW_LIVE_COPY.speaking
                        : live?.candidateSpeaking ? INTERVIEW_LIVE_COPY.listening : INTERVIEW_LIVE_COPY.thinking
                }
              />
              <div className="relative aspect-video overflow-hidden rounded-3xl bg-ink md:aspect-auto md:min-h-[220px]">
                <video ref={liveVideoRef} autoPlay muted playsInline className={`h-full w-full object-cover ${cameraOn ? "" : "hidden"}`} />
                {!cameraOn && <div className="flex h-full items-center justify-center text-white/60"><CameraOff className="h-7 w-7" aria-hidden="true" /></div>}
                <span className="absolute bottom-3 left-3 rounded-full bg-black/50 px-2.5 py-1 text-[12px] font-semibold text-white">{INTERVIEW_LIVE_COPY.you}</span>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-surface px-5 py-3.5">
              <p className="text-[15px] tabular-nums text-ink-3" aria-live="off">
                {formatClock(live?.elapsedMs ?? 0)} / {modeCopy.minutes}:00
                {live && live.reconnects > 0 && <span className="ml-2 text-[13px] text-ink-5">재연결 {live.reconnects}회</span>}
              </p>
              <button
                type="button"
                onClick={() => void endNow()}
                disabled={live?.phase === "ending"}
                className="inline-flex h-10 items-center rounded-[10px] bg-fill px-4 text-[14px] font-bold text-ink-2 transition-colors hover:bg-line disabled:opacity-50"
              >
                {live?.phase === "ending" ? "정리 중" : INTERVIEW_LIVE_COPY.end}
              </button>
            </div>
            {live && (live.turns.length > 0 || live.draftText) && (
              <div className="rounded-2xl bg-surface px-5 py-4 text-[14px] leading-relaxed text-ink-3" aria-live="polite">
                {live.turns.slice(-2).map((turn) => (
                  <p key={turn.seq}><span className="font-semibold text-ink-2">{turn.speaker === "CANDIDATE" ? "나" : "면접관"}</span> {turn.text}</p>
                ))}
                {live.draftText && <p className="text-ink-4"><span className="font-semibold">{live.draftSpeaker === "CANDIDATE" ? "나" : "면접관"}</span> {live.draftText}</p>}
              </div>
            )}
          </div>
        )}

        {phase === "after" && session && (
          <div className="mt-8 space-y-6">
            {session.status === "CANCELLED" && (
              <p className="rounded-2xl bg-surface px-6 py-5 text-[15px] text-ink-3">{INTERVIEW_FEEDBACK_COPY.refunded}</p>
            )}
            {["PENDING", "CALLING"].includes(session.feedbackStatus) || feedbackRequesting ? (
              <div className="rounded-3xl bg-surface px-6 py-10 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-ink-4" aria-hidden="true" />
                <p className="mt-4 text-[17px] font-bold">{INTERVIEW_FEEDBACK_COPY.pending}</p>
                <p className="mt-1.5 text-[14px] text-ink-4">{INTERVIEW_FEEDBACK_COPY.pendingHint}</p>
              </div>
            ) : session.feedbackStatus === "SUCCEEDED" && session.feedback ? (
              <FeedbackView feedback={session.feedback} turns={session.turns ?? []} hadVideo={session.feedbackHadVideo} />
            ) : (
              <>
                {session.feedbackStatus === "FAILED" && (
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
                {session.status !== "CANCELLED" && session.feedbackStatus === "NONE" && error && <p role="alert" className="text-[14px] text-danger">{error}</p>}
                <TranscriptList turns={session.turns ?? []} />
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
