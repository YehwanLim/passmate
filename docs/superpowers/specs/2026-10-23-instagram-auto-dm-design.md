# 인스타 댓글 키워드 → 팔로우 확인 → 노션 자료 자동 DM 설계

- 날짜: 2026-10-23
- 상태: 설계 승인(채팅), 구현 전
- 관련: 노션 "자동 DM 배포용 / DM 자료" 표(collection://ba65767c-c77f-44aa-8d1d-230d19ad3b00)

## 목표

@hansionair 게시물에 키워드 댓글("금지어" 등)을 달면, 팔로우를 확인한 뒤 해당 노션 자료 링크를 DM으로 보낸다.
ManyChat 대신 메타 공식 API(Instagram API with Instagram Login)로 직접 만든다. 비용은 거의 0원이고 발송 기록은 우리 DB에 남는다.

검증 가능한 결과:

1. 본인 계정(앱 역할 보유)이 "공개·DM 연결" 상태 자료의 키워드로 댓글을 달면 첫 DM(팔로우 안내 + 버튼)이 온다.
2. 버튼을 누르면 팔로우 중일 때 자료 링크 DM이, 아닐 때 재안내 DM이 온다.
3. 같은 댓글 알림이 두 번 와도 DM은 한 번만 간다.
4. 앱 역할이 없는 다른 계정으로도 1~2가 되는지 확인한다(안 되면 앱 심사 신청이 다음 단계).

## 메타 제약 (공식 문서 기준)

- 댓글 답장 DM(Private Reply): `POST graph.instagram.com/<IG_ID>/messages`, `recipient.comment_id`. 댓글당 **1통**, 댓글 작성 후 **7일 안**.
- 상대가 답장·버튼을 누르면 그때부터 **24시간** 동안 추가 메시지 가능.
- 팔로우 여부 `GET graph.instagram.com/<IGSID>?fields=is_user_follow_business` 는 상대가 **먼저 DM에 반응(메시지·버튼)** 해야 조회된다. 댓글만으로는 동의가 성립하지 않는다.
- 권한: `instagram_business_basic`, `instagram_business_manage_comments`, `instagram_business_manage_messages`. 웹훅 필드: `comments`, `messages`, `messaging_postbacks`.
- 문서상 우리가 소유한 프로페셔널 계정에만 쓰면 Standard Access로 된다고 나오나, 앱 역할 없는 사용자의 댓글 알림·발송이 실제로 되는지는 연결 후 확인한다.
- 미확인: Private Reply 에 버튼(템플릿·퀵리플라이)을 붙일 수 있는지. 안 되면 "이 DM에 '팔로우 완료'라고 답장해 주세요" 글자 방식으로 대체한다.
- 전제: @hansionair 를 프로페셔널(크리에이터) 계정으로 전환(계정 주인 몫, 10-23 기준 개인 계정).

## 흐름

1. `comments` 웹훅 수신 → 서명 검증 → 내 계정 댓글이면 무시.
2. 댓글 텍스트를 정규화(앞뒤 공백·문장부호·이모지 제거, 영문 대소문자 무시)해 노션 표의 `DM 키워드`로 **댓글이 시작하거나 댓글의 한 낱말이 그 키워드로 시작**하면 그 행을 찾는다(10-24 변경: "PT 자료 주세요"도 됨, 여러 개 걸리면 가장 긴 키워드). 대상은 `상태 = 공개·DM 연결` 이고 `공개 링크` 가 있는 행만.
3. 없으면 끝. 있으면 `comment_id` 로 첫 DM(팔로우 안내 + `[팔로우했어요 ✅]` 버튼, payload 에 발송 기록 id)을 보내고 `GATE_SENT` 로 기록. 응답의 `recipient_id`(IGSID)를 저장.
4. `messaging_postbacks`(버튼) 또는 `messages`(글자 답장) 수신 → IGSID 로 7일 안의 최신 `GATE_SENT` 기록을 찾는다(버튼이면 payload 의 id 우선).
5. `is_user_follow_business` 조회 → true 면 자료 DM(이름 + 공개 링크) 보내고 `LINK_SENT`. false 면 재안내 + 같은 버튼, `followChecks += 1`. 5회를 넘으면 더 답하지 않는다.

자료별 문구(10-23 추가): 노션 행의 `첫 DM 문구`·`링크 DM 문구`(글자, 500자까지)를 쓰면 그 자료는 그 문구를 쓴다. 링크는 링크 문구 다음 줄에 자동으로 붙고, 비어 있으면 아래 기본 문구를 쓴다.

DM 문구 초안(계정 주인 검수 필요):

- 첫 DM: "안녕하세요! 한시예요 🙌 댓글 고마워요. '{자료 이름}' 바로 보내 드릴게요. @hansionair 팔로우하고 아래 버튼만 눌러 주세요!" / 버튼 "팔로우했어요 ✅"
- 자료 DM: "📩 {자료 이름}\n{공개 링크}\n저장해 두고 필요할 때 꺼내 보세요!"
- 재안내: "아직 팔로우가 안 보여요 🥲 @hansionair 팔로우하고 다시 눌러 주세요!"

## 구조

- **라우팅**: Vercel Hobby 12함수 한도가 꽉 차 있어 새 함수를 만들지 않는다. `bodyParser: false` 로 원문을 읽는 `api/entitlements.js` 에 `?instagramWebhook=1` 분기를 얹는다.
  - `vercel.json` rewrite: `/api/webhooks/instagram` → `/api/entitlements?instagramWebhook=1`
  - `vite.config.ts` `apiRoute()` 에도 같은 매핑(함정 1).
- **코드**: `lib/instagram-dm/` 아래 단위별 파일.
  - `webhook.js`: GET 확인(`hub.verify_token`), POST 서명(`X-Hub-Signature-256`, 앱 시크릿 HMAC-SHA256) 검증, 이벤트 분배. 의존성 주입 팩토리.
  - `graph-client.js`: 인스타 API 호출(댓글 답장 DM, 일반 DM, 팔로우 조회, 토큰 갱신). `fetch` 주입.
  - `notion-resources.js`: DM 자료 표 조회(Notion API `data_sources/{id}/query`), 키워드 정규화·매칭, 5분 메모리 캐시.
  - `delivery.js`: 흐름 1~5의 상태 전이와 DB 기록.
  - `messages.js`: DM 문구.
- **DB (Prisma, 새 표 2개)**
  - `InstagramDmDelivery` (`instagram_dm_deliveries`): `id`, `commentId`(unique), `mediaId`, `igsid`(index), `keyword`, `notionPageId`, `resourceTitle`, `resourceUrl`, `status`(`SENDING` | `GATE_SENT` | `LINK_SENT` | `FAILED` — SENDING 은 보내는 중, 일시 오류면 행을 지워 재전송 때 다시 시도), `followChecks`, `failureCode`, `linkSentAt`, `createdAt`, `updatedAt`.
  - `InstagramCredential` (`instagram_credentials`): 단일 행. `accountId`, `accessToken`, `expiresAt`, `refreshedAt`.
- **토큰**: 60일 장기 토큰. 기존 일일 크론(`api/cron/purge-deleted-users.js`, 03:00)에 "갱신 후 30일 지났으면 `ig_refresh_token`" 단계를 추가한다. 최초 발급은 `scripts/` 의 로그인 스크립트(스레드 `threads.sh` 와 같은 방식)가 DB에 넣는다.
- **환경변수(서버 전용)**: `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`, `INSTAGRAM_DM_ENABLED`, `NOTION_DM_TOKEN`, `NOTION_DM_DATA_SOURCE_ID`. `.env.example` 에 플레이스홀더 추가.

## 오류 처리

- 같은 `commentId` 재수신 → 유니크 제약으로 무시(DM 1회).
- 7일 경과·메타 거절 → `FAILED` + 오류 코드만 기록, 재시도하지 않는다.
- 노션·인스타 일시 오류 → 5xx 로 응답해 메타 재전송에 맡긴다. 처리는 짧게(타임아웃 10초 이내).
- `INSTAGRAM_DM_ENABLED` 가 꺼져 있으면 알림만 200 으로 받고 발송하지 않는다.
- 로그·감사 이벤트에 댓글 본문, 사용자명, IGSID, 토큰을 남기지 않는다. 상태·키워드·오류 코드만.

## 테스트

`tests/helpers/http.js` 의 `createResponse()` 와 주입 가짜로 실제 메타·노션 호출 없이:

- 서명 맞음/틀림/없음, GET 확인 토큰 맞음/틀림
- 키워드 일치/불일치/정규화(공백·문장부호·대소문자), 내 계정 댓글 무시, 상태가 공개 아님
- 같은 댓글 중복 수신
- 버튼·글자 답장 → 팔로우 true/false, 5회 초과
- 스위치 꺼짐
- 노션 응답 파싱, 토큰 갱신 시점 판단
- `scripts/vercel-function-limit.test.js` 가 계속 통과(함수 수 그대로)

## 계정 주인이 할 일

1. 인스타 크리에이터 계정 전환
2. 메타 개발자 앱에 Instagram API 사용 사례 추가, 웹훅 주소·확인 토큰·필드 구독, 권한 설정
3. 노션 내부 연동 생성 후 DM 자료 페이지에 연결
4. Vercel 환경변수 입력
5. 운영 DB 마이그레이션 실행 지시
6. `/privacy` 에 인스타 DM 기록 문장 추가 검수

## 이번 범위 밖

게시물별 다른 자료, 관리자 화면 발송 기록, 댓글 공개 답글, 앱 심사 신청(필요해지면 별도).
