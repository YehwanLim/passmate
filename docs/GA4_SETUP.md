# PassMate — Google Analytics 4 (GA4) 연동 가이드

PassMate 서비스의 핵심 사용자 행동을 GA4로 추적하기 위한 설정 가이드입니다.

---

## 1. GA4 Measurement ID 설정

### GA4 Measurement ID 발급 방법

1. [Google Analytics](https://analytics.google.com) 접속
2. **관리(Admin)** → 좌측 메뉴 **데이터 스트림(Data streams)** 클릭
3. 사용 중인 웹 데이터 스트림 선택
4. **측정 ID(Measurement ID)** 복사 (`G-XXXXXXXXXX` 형식)

---

## 2. 환경변수 설정

프로젝트 루트의 `.env` 파일에 아래 값을 추가합니다.

```bash
# .env
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX   # 발급받은 실제 Measurement ID로 교체
```

> **⚠️ 중요:** `VITE_` prefix가 반드시 필요합니다. Vite는 `VITE_`로 시작하는 환경변수만 클라이언트에 노출합니다.

### Vercel 배포 시

1. Vercel 대시보드 → 해당 프로젝트 → **Settings → Environment Variables**
2. `VITE_GA_MEASUREMENT_ID` = `G-XXXXXXXXXX` 추가
3. **Production** 환경 체크 후 저장
4. 재배포(Redeploy)

---

## 3. 동작 방식

| 환경 | 동작 |
|------|------|
| **개발** (`npm run dev`) | GA4 스크립트 로드 안 함. 브라우저 콘솔에 `[GA4 Dev] 이벤트명` 로그 출력 |
| **프로덕션** (`npm run build`) | `VITE_GA_MEASUREMENT_ID`가 유효한 경우 gtag.js 자동 삽입 및 이벤트 전송 |

---

## 4. 추적 이벤트 목록

| 함수 | GA4 이벤트명 | 파라미터 | 호출 시점 |
|------|-------------|----------|----------|
| `trackSignUp()` | `sign_up` | `method: "google"` | 최초 Google 로그인(신규 가입) |
| `trackLogin()` | `login` | `method: "google"` | Google 로그인 성공 |
| `trackResumeUpload()` | `resume_upload` | `file_type: "text"`, `resume_length: number` | 분석 제출 시 |
| `trackAnalysisStart()` | `analysis_start` | `analysis_type: "cover_letter"`, `resume_length: number` | 분석 API 호출 직전 |
| `trackAnalysisComplete()` | `analysis_complete` | `analysis_type`, `duration_ms`, `success: true` | 분석 성공 후 |
| `trackAnalysisFailed()` | `analysis_failed` | `analysis_type`, `error_type`, `success: false` | 분석 실패 시 |
| `trackPurchase()` | `purchase` | `value: number`, `currency: "KRW"` | 결제 성공 후 (결제 기능 구현 시 연결) |

### `error_type` 값 목록 (`trackAnalysisFailed`)

| 값 | 설명 |
|----|------|
| `rate_limit` | 요청 횟수 초과 (429) |
| `context_irrelevant` | 자소서와 관련 없는 내용 |
| `parse_error` | JSON 파싱 실패 |
| `invalid_response` | API 응답 구조 불일치 |
| `fallback_detected` | Fallback(더미) 데이터 감지 |
| `timeout` | 120초 타임아웃 초과 |
| `server_error` | 기타 서버 오류 |

---

## 5. 개발 환경에서 이벤트 미리보기

GA4 스크립트는 Production 빌드에서만 로드됩니다.
개발 서버(`npm run dev`) 실행 중에는 브라우저 콘솔에서 이벤트를 확인할 수 있습니다.

```
// 브라우저 개발자 도구 → Console 탭에서 확인
[GA4 Dev] analysis_start { analysis_type: "cover_letter", resume_length: 1234 }
[GA4 Dev] analysis_complete { analysis_type: "cover_letter", duration_ms: 8432, success: true }
```

---

## 6. GA4 DebugView에서 테스트하는 방법

DebugView는 **실시간으로 이벤트를 시각적으로** 확인할 수 있는 GA4 전용 디버깅 도구입니다.

### 방법 1: Chrome 확장 프로그램 사용 (권장)

1. [Google Analytics Debugger](https://chrome.google.com/webstore/detail/google-analytics-debugger/jnkmfdileelhofjcijamephohjechhna) 크롬 확장 설치
2. 확장 프로그램 활성화 후 서비스 접속
3. GA4 대시보드 → **관리 → DebugView** 에서 이벤트 실시간 확인

### 방법 2: URL 파라미터 사용

프로덕션 URL에 `?debug_mode=1` 파라미터를 붙여 접속합니다.

```
https://your-domain.com/?debug_mode=1
```

> GA4 DebugView에서 디바이스가 자동 등록됩니다.

### DebugView 접근 경로

```
GA4 대시보드 → 관리(Admin) → DebugView
```

이벤트를 클릭하면 파라미터를 포함한 상세 정보를 확인할 수 있습니다.

---

## 7. 실시간 보고서에서 이벤트 확인 방법

실시간 보고서는 지금 이 순간의 이벤트를 확인할 때 사용합니다 (DebugView보다 최대 30초 지연).

1. GA4 대시보드 접속
2. 좌측 메뉴 → **보고서(Reports) → 실시간(Realtime)**
3. **이벤트 수(Event count)** 카드에서 최근 30분간 발생한 이벤트 목록 확인
4. 특정 이벤트 클릭 → 파라미터 상세 보기 가능

### 이벤트 보고서 (장기 데이터 확인)

```
보고서 → 참여도(Engagement) → 이벤트(Events)
```

여기서 `analysis_start`, `analysis_complete` 등의 이벤트별 발생 횟수, 사용자 수, 파라미터 분포를 확인할 수 있습니다.

---

## 8. 유지보수 — 새 이벤트 추가 방법

`client/src/lib/analytics.ts`에 함수를 추가합니다.

```typescript
// 예시: 리포트 공유 이벤트
export function trackReportShare(shareMethod: string): void {
  sendEvent("report_share", {
    share_method: shareMethod,
  });
}
```

추가 후 해당 컴포넌트에서 import하여 호출하면 됩니다.

```typescript
import { trackReportShare } from "@/lib/analytics";

// 버튼 클릭 시
trackReportShare("link_copy");
```
