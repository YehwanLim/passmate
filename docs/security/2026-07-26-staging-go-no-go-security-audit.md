# PassMate 스테이징 GO/NO-GO 보안감사 보고서

- 작성일: 2026-07-26 (KST)
- 감사 대상: `codex/security-remediation` 보안 브랜치, Vercel Preview 배포, Supabase 스테이징 프로젝트
- 배포 확인: Vercel Preview `Ready`, 보안 브랜치 별칭 사용
- 소스 기준 revision: `4aaa317` (`chore: add safe cron auth diagnostics`)
- 데이터 원칙: 테스트 전용 A/B 계정과 가짜 지원서만 사용. 토큰, 이메일, 자소서 원문, 결제 원문은 기록하지 않음.
- 최종 판정: **NO-GO — 공개/제한 베타 출시는 보류.**

## 1. 경영 요약

이전 감사의 치명적 인증·IDOR·공개 Gemini 프록시·공개 DB 테스트 API·관리자 API 노출 문제는 코드와 실제 스테이징의 핵심 경로에서 상당 부분 해소됐다. 비로그인 요청은 사용자·분석·관리자 API에서 모두 JSON `401`로 차단됐고, A 사용자의 리포트를 B 사용자가 열면 리포트가 아닌 `Not found` 화면이 표시됐다. 일반 사용자와 임시 관리자 사용자의 관리자 접근도 실제로 분리됐으며, 테스트 종료 후 관리자 권한은 다시 `user`로 회수됐다.

그러나 현재 공개 베타를 승인할 수는 없다. B 계정의 정상 분석 요청이 Gemini 응답 지연으로 서버의 45초 모델 호출 제한을 넘어 `504`가 됐다. 이는 보안 우회가 아니라 핵심 기능의 신뢰성 문제지만, 결제·이용권·분석 상태가 얽힌 서비스에서는 출시 전 해소해야 하는 P1이다. 10건 실제 모델 동시 호출과 provider 429/500은 비용·이용권을 소모하지 않는 전용 서버 테스트 러너가 없어서 이번 세션에서 실행하지 않았다. 이들은 취약점이 재현됐다는 뜻이 아니라, 감사 완료 기준의 증적이 아직 부족하다는 뜻이다.

**확인된 P0 보안 노출은 이번 스테이징 검사에서 재현되지 않았다.** 다만 아래 미검증 P0 게이트와 P1 신뢰성 문제를 해소하기 전에는 GO로 바꾸지 않는다.

## 2. 대상·범위·제한사항

| 구분 | 포함한 범위 | 상태 |
|---|---|---|
| 배포본 | Vercel Preview 보안 브랜치 별칭, 서버리스 API, SPA rewrite, 보안 헤더 | 실제 확인 |
| 인증·소유권 | 비로그인/A/B/임시 관리자 계정, 프로젝트·리포트·관리자 경로 | 실제 확인(일부 UI 증적) |
| 분석 | 인증 분석의 성공 1회와 provider timeout 실패 1회 | 실제 확인 |
| DB·RLS | 스테이징 bootstrap/migration, RLS·브라우저 역할 권한 메타데이터 | 실제 확인 |
| AI 비용 통제 | 멱등성·예약 회귀 테스트, kill switch·rate limit 실제 요청 | 실제·자동 확인 |
| 결제·Groble | 베타 배포 제외 여부 | 실제 404 및 정적 검토 |
| 개인정보·삭제 | 브라우저 저장소/삭제·purge 코드, 보호된 Cron 실제 호출 | 실제·자동 확인 |

다음은 이번 감사에서 직접 실행하지 않았다: Supabase Data API를 통한 anon/A/B/admin JWT CRUD 매트릭스(스테이징 Data API는 비활성화), 저장형 XSS payload, 분석 동시 10건, provider 429/500, 실제 만료 계정의 30일 경과 purge, OAuth redirect allowlist의 Supabase 대시보드 원격 값, 로그·백업 보존 정책, 실제 Groble sandbox 서명 검증. 운영 환경과 실사용자 데이터는 범위 밖이다.

> 참고: 감사 작업 폴더에는 계정 삭제 메뉴를 UI에서 제거하는 사용자 미커밋 변경 두 개가 존재한다. 이 변경은 현재 Vercel 배포본과 본 보고서의 소스 기준 revision에 포함하지 않았고, 덮어쓰거나 커밋하지 않았다.

## 3. 공격 표면 및 테스트 결과

| 표면 | 기대 통제 | 실제 증적 | 판정 |
|---|---|---|---|
| `GET /api/projects` | Bearer 인증 없으면 401 | 실제 Preview 요청 `401 application/json` | 통과 |
| `GET /api/analysis/:id` | Bearer 인증 없으면 401, 타인 객체는 비노출 | 비로그인 가짜 ID `401 application/json`; B가 A 리포트 URL을 열면 `Not found` UI | 통과(읽기) |
| `/api/admin/*` | 비로그인 401, 일반 사용자 403, 관리자만 허용 | 비로그인 `/api/admin/users` `401`; A는 접근 거부, 승격 B는 대시보드 표시, 권한 회수 뒤 B는 접근 거부 | 통과 |
| `POST /api/analyze` | 로그인·멱등성·이용권·rate limit·kill switch | A 성공·B provider timeout; kill switch 실제 503; 모델 미호출 상태에서 3회 후 4번째 429 | 부분 통과 / P1 |
| 이전 진단·프록시 API | 배포되지 않아야 함 | `/api/gemini`, `/api/test-gemini`, `/api/test-db`, `/api/test` 모두 실제 `404` | 통과 |
| 외부 출처 호출 | 공개 CORS 금지 | `Origin: https://evil.example` OPTIONS `/api/analyze` = `405`, `Access-Control-Allow-Origin` 없음 | 통과 |
| SPA fallback | API를 HTML로 삼키지 않아야 함 | 동적 API 경로는 JSON 401로 응답, SPA rewrite에서 `/api/` 제외 | 통과 |
| 브라우저 직접 DB 접근 | 앱 테이블은 기본 거부, Prisma 서버만 접근 | 16개 대상 테이블 존재·RLS 활성화, `anon`/`authenticated`의 SELECT·INSERT·UPDATE·DELETE 권한 0개, Data API 비활성화 | 통과(현재 경계) |
| 계정 삭제·purge | 소유권 확인·30일 유예·보호된 Cron | 비밀값 없음 401, 올바른 비밀값 200 `purged:0`; 대상 계정 0개에서 실행 | 부분 통과 |

## 4. 스테이징에서 확인한 주요 증적

### 인증·세션·권한

- A 계정은 Google OAuth 로그인 후 `My`에서 본인 분석 이력을 확인하고 저장된 리포트를 열었다.
- B 계정은 별도의 브라우저 세션에서 로그인했다. A 리포트의 `analysisId` URL을 B에게 전달해 열었을 때 리포트 원문은 노출되지 않고 `Not found` 화면이 표시됐다.
- A는 관리자 경로에서 접근 거부를 받았다.
- B의 `public.users.role`만 임시로 `admin`으로 변경했을 때 B는 관리자 대시보드를 볼 수 있었다. 즉시 `user`로 원복한 뒤 새로고침했을 때 다시 접근 거부됐다.
- 이전에 관측한 `401`은 다른 Vercel 배포 URL을 오간 뒤 유효한 브라우저 토큰이 없는 상태에서 발생했다. 같은 보안 브랜치 별칭에서 다시 로그인한 뒤 정상화됐지만, 이 일회성 세션 현상을 BOLA 허용/차단의 증거로 취급하지 않았다.

### 분석·비용 안전성

- A의 실제 분석은 약 49.8초의 화면 경과 후 성공하고, 서버에 저장된 리포트가 열렸다.
- B의 정상 분석은 서버 안전 로그에서 `TIMEOUT`으로 기록되고 `504`로 종료됐다. 민감 입력·토큰·이메일·AI 원문은 로그에 기록되지 않았다.
- 분석 API의 인증 선행, 멱등키 충돌/진행 중 요청, 예약 확정·취소는 자동 회귀 테스트에서 확인했다.
- `analysisEnabled=false`에서 B의 실제 요청은 Gemini 호출·이용권 예약 전에 503 안내로 차단됐다. 다시 활성화한 뒤 같은 무해 테스트 요청을 네 번 보냈을 때 처음 세 번은 503, 네 번째는 429 요청 제한으로 차단됐다.
- 동시 10건과 provider 429/500의 실제 호출은 비용·이용권을 쓰지 않는 전용 서버 테스트 러너가 없어 미수행이다.

### 배포·헤더·CORS

실제 Preview 응답에서 다음을 확인했다.

- CSP: `default-src 'self'`, `frame-ancestors 'none'`, 제한된 `script-src`·`connect-src`
- HSTS: `max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- 카메라·마이크·위치·결제·USB를 비활성화한 Permissions-Policy
- 외부 출처 OPTIONS가 405이며 공개 `Access-Control-Allow-Origin: *` 없음

브라우저 콘솔의 Vercel Live Feedback inline-script 및 jsDelivr source-map CSP 경고는 이 엄격한 정책이 미리보기 도구/소스맵 요청을 막은 결과다. 앱의 인증·리포트 API 실패 원인은 아니며, CSP를 완화하거나 `unsafe-inline`을 추가해서 해결하면 안 된다.

## 5. 발견 사항과 조치 백로그

### P0 — 출시 전 필수 게이트

| ID | 발견/잔여 위험 | 영향 | 수정·재검증 조건 |
|---|---|---|---|
| P0-GATE-02 | IDOR의 읽기 경로는 A/B로 확인했으나 프로젝트 삭제·피드백 쓰기의 A/B 라이브 매트릭스는 미실행이다. | 타인 데이터 수정·삭제 회귀를 배포 전 놓칠 수 있음 | A 본인 2xx, B의 A 대상 404, 비로그인 401을 프로젝트 DELETE·분석 상세·피드백 POST에 실제로 확인한다. |

### P1 — 공개 베타 전에 해결

| ID | 발견 | 영향 | 권고 조치 | 검증 조건 |
|---|---|---|---|---|
| P1-01 | Gemini 정상 요청이 모델 호출 45초 제한을 넘어 `504`가 됐다. A는 성공했지만 B는 실패했다. | 핵심 기능이 간헐적으로 실패하고 이용권/지원 흐름의 신뢰를 떨어뜨림 | 임의 timeout 증대만 반복하지 말고, 출력량 축소·provider별 deadline·비동기 durable job/상태 조회·명확한 재시도 UX 중 하나를 설계한다. 결제/예약 상태는 provider 결과가 불명확할 때 보수적으로 유지한다. | 동일 입력군 10회 이상에서 성공률·P95 지연 SLO를 정하고, timeout/429/500에서 분석·예약·토큰 사용이 정확히 한 번만 처리되는지 확인한다. |
| P1-02 | kill switch와 사용자 3회/15분 rate limit은 실제 모델 미호출 요청에서 확인됐다. 동시 10건·같은 멱등키의 실서버 경쟁·provider 429/500은 미실행이다. | 동시 요청 시 비용 중복 또는 비상 중단 실패를 놓칠 수 있음 | 테스트 전용 서버 runner 또는 격리된 provider fixture로 키 중복·동시 10건·429/500을 실행한다. | 외부 모델 호출 수, `AnalysisRequest`, reservation, token usage가 각 시나리오에서 기대값과 일치한다. |
| P1-03 | Cron 인증 거부(401)와 올바른 비밀값의 성공 응답(`purged:0`)은 실제 확인됐다. 실제 만료 계정 cascade 파기·로그/백업 보관 정책은 미확인이다. | 삭제 약속과 실제 파기 시점 불일치 | 별도 만료 테스트 계정으로 purge를 실행하고, 로그/백업 보관 정책을 문서화한다. | 만료 계정만 cascade 파기, 감사 이벤트에는 민감 원문 없음이 증명된다. |
| P1-04 | Vercel 설치 로그에 의존성 취약점 요약이 남아 있고, production dependency audit은 레지스트리 metadata 전송 승인 전 미실행이다. | 공급망 취약점의 현재 우선순위를 확정할 수 없음 | 승인된 환경에서 production-only audit을 실행하고 직접 의존성부터 호환성 테스트 후 업데이트한다. `npm audit fix --force`는 사용하지 않는다. | high/critical의 런타임 도달성·완화·담당자를 기록하고 CI 게이트를 정한다. |

### P2 — 후속 개선

| ID | 발견 | 권고 조치 |
|---|---|---|
| P2-01 | Vercel Preview 도구와 source-map 요청이 CSP 경고를 만들어 디버깅을 혼동시킨다. | 운영 CSP는 유지하고, 미리보기 피드백 도구를 비활성화하거나 허용 목록 외 진단 요청을 개발자 문서에 설명한다. |
| P2-02 | 생산 빌드의 JS 청크가 약 1.75 MB(gzip 약 463 KB)로 Vite 경고 기준을 넘는다. | 관리자 화면·차트의 lazy loading과 chunk 분할을 검토한다. |
| P2-03 | 개인정보 처리방침, 외부 로그·백업 보관 기간, OAuth redirect allowlist의 실제 원격 설정은 이 저장소만으로 검증할 수 없다. | 베타 공개 전 사용자 고지와 운영 설정 검토 체크리스트를 마련한다. |

## 6. 2026-07-11 보고서 항목 갱신

| 이전 항목 | 상태 | 근거/남은 일 |
|---|---|---|
| BLOCK-01 미인증 데이터 조회·IDOR | 해결 | 비로그인 401, A/B 리포트 교차 접근 비노출, 소유권 회귀 테스트. 쓰기/삭제 라이브 매트릭스는 P0-GATE-02. |
| BLOCK-02 공개 Gemini·비용 남용 | 부분 해결 | 공개 프록시/진단 API 404, 로그인·멱등성·rate limit·kill switch 구현. kill switch와 3회/15분 rate limit은 실제 확인했고, 동시성·provider 오류와 P1-01 안정성이 남음. |
| BLOCK-03 공개 GET DB 테스트 API | 해결 | `/api/test-db`, `/api/test`, `/api/test-gemini` 실제 404. |
| BLOCK-04 클라이언트 `userId` 피드백 가장 | 부분 해결 | 서버 인증·분석 소유권·본문 검증 회귀 테스트 통과. 실제 A/B 피드백 POST는 미실행. |
| BLOCK-05 RLS·클라이언트 관리자 신뢰 | 해결(현재 경계) | 모든 대상 테이블 RLS 활성화, `anon`/`authenticated` CRUD 권한 0, Data API 비활성화, 서버 관리자 API와 A/B 관리자 분리 확인. JWT CRUD 자동화는 후속 회귀 강화 항목이다. |
| BETA-01 분석 영구 저장 부재 | 해결 | A 분석 성공 후 저장된 리포트를 `My`에서 실제 열었음. |
| BETA-02 목 데이터 fallback | 해결 | 인증 오류는 오류/빈 상태로 처리하고 샘플 데이터가 표시되지 않도록 회귀 테스트됨. |
| BETA-03 UI만 삭제 | 부분 해결 | 소유권 DELETE API와 회귀 테스트는 있음. 라이브 삭제 정합성은 미확인. |
| BETA-04 브라우저 민감 데이터 장기 저장 | 해결(코드 기준) | 자소서·리포트·익명 ID·피드백 캐시를 제거하고 OAuth 세션만 예외로 남김. DevTools 저장소 검사는 미수행. |
| BETA-05 타입 검사 실패 | 해결 | `npm run check` 성공. |
| BETA-06 헤더·관측·비상 제어 부재 | 부분 해결 | 실제 헤더·안전 로그, kill switch, rate limit을 확인. 동시성 경보와 provider 운영 지표는 남음. |
| BETA-07 개인정보·삭제 정책 부재 | 부분 해결 | 30일 유예 삭제 코드·보호된 일일 Cron과 인증 성공 `purged:0` 확인. 외부 고지·실 purge·백업 정책은 남음. |
| POST-01 번들 성능 | 미해결 | 500 KB 경고 초과. |
| POST-02 의존성 보안 부채 | 미해결 | 승인된 production audit 및 업그레이드 검증 필요. |

## 7. 검증 명령·증적 요약

2026-07-26에 실사용자 비밀값을 사용하지 않고 다음을 새로 실행했다.

| 항목 | 결과 |
|---|---|
| `pnpm exec vitest run` | 52개 파일, 214개 테스트 통과 |
| `npm run check` | 성공 |
| `npm run build` (필수 변수가 없을 때) | 의도적으로 실패 — 배포 전 환경변수 검증 장치 작동 |
| `npm run build` (안전한 더미 값) | 성공, 대형 chunk 경고만 존재 |
| Vercel Preview inspect | `Ready` |
| 비로그인 API | `/api/projects`, `/api/analysis/nonexistent-security-audit-id`, `/api/admin/users` 모두 `401 application/json` |
| 제거 API | `/api/gemini`, `/api/test-gemini`, `/api/test-db`, `/api/test` 모두 `404` |
| 악성 Origin OPTIONS | `/api/analyze` `405`; 공개 CORS 허용 헤더 없음 |
| 보안 헤더 | CSP/HSTS/nosniff/referrer/permissions/frame 차단 실제 확인 |
| 원격 RLS 권한 메타데이터 | 16개 대상 테이블 존재·RLS 활성화, `anon`/`authenticated` CRUD 권한 0, Data API 비활성화 |
| kill switch·rate limit | kill switch 실제 503, 모델 미호출 요청 3회 후 4번째 실제 429 |
| 보호된 purge Cron | 비밀값 없음 401, 올바른 비밀값 200 `{"purged":0}`; 파기 예정 계정 0 |

테스트 실행 중 보인 인증 실패·Cron 실패 로그는 각각 의도된 음성 테스트 케이스의 안전 로그다. 테스트 자체는 모두 통과했다.

## 8. 출시 결정과 재검증 순서

### 현재 결정: NO-GO

공개 또는 제한 베타로의 출시를 승인하지 않는다. 근거는 **P1-01 핵심 분석 신뢰성 실패**, **P0-GATE-02의 쓰기·삭제 A/B 증적 부족**, 그리고 P1-02의 실서버 동시성·provider 오류 검증 부족이다. 이는 지금 확인된 IDOR·관리자 우회 취약점이 있다는 의미가 아니라, 민감한 자소서 데이터를 받는 서비스의 출시 게이트를 충족하지 못했다는 의미다.

### GO 전 최소 순서

1. P1-01의 분석 timeout 설계를 결정·구현하고, 오류/성공 상태·이용권 정합성 테스트를 통과시킨다.
2. A/B 쓰기·삭제 권한 매트릭스를 스테이징에서 실행해 보고서에 붙인다. RLS 메타데이터는 확인됐으므로 JWT CRUD 자동화는 CI 강화 항목으로 추가한다.
3. 테스트 전용 서버 runner 또는 격리된 provider fixture에서 동시 10건·중복 키·429/500을 검증한다. kill switch·rate limit·Cron 인증은 실제 검증 완료다.
4. production-only dependency audit, 개인정보 고지·로그/백업 보관 정책·OAuth allowlist를 확인한다.
5. 위 결과가 모두 통과하면 Vercel Preview 새 revision으로 재배포하고, 같은 API 매트릭스를 다시 실행한 후 GO/NO-GO를 갱신한다.
