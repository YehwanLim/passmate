# Gemini Live 시험 도구 (1단계)

AI 면접 연습을 만들기 전에, 실시간 대화가 쓸 만한지 재는 독립 도구다. 앱·DB와 연결되지 않고 `fixture.js`의 가상 지원자만 쓴다.

## 비용과 안전장치

- 실제 모드는 Gemini 비용이 든다. 서버가 최악 단가로 누적액을 계산해 **1만 원을 넘길 세션은 입장권을 내주지 않는다**(`results/ledger.jsonl`).
- 이 계산은 추정이다. 실제 금액은 측정 전용 프로젝트의 Cloud Billing에서 확인한다.
- `--fake`는 가짜 서버로 비용 없이 페이지 동작만 확인한다. 품질·지연은 대변하지 않는다.
- 키는 `.env.probe`에 `LIVE_PROBE_API_KEY=...`로 둔다. 키와 입장권은 화면·콘솔·결과 파일에 남기지 않는다. `.env.probe`와 `results/`는 Git에서 제외된다.
- 대화 글은 `results/`에 남으므로 직접 말하는 시험에서 실제 개인정보를 말하지 않는다. 시험에는 본인 얼굴만 쓴다.

## 실행

```bash
# 비용 없는 동작 확인
node scripts/manual/live-probe/run-auto.mjs --fake --minutes 2

# 자동 시험(비용 발생): 합성 음성과 합성 그림 사용
node scripts/manual/live-probe/run-auto.mjs --scenario lock --minutes 2
node scripts/manual/live-probe/run-auto.mjs --scenario expire --minutes 4
node scripts/manual/live-probe/run-auto.mjs --scenario full --minutes 15 --video 1
# 사진 간격(ms, 1000 이상)과 침묵 판정(ms)을 바꿔 비용·끼어듦을 비교한다
node scripts/manual/live-probe/run-auto.mjs --scenario full --minutes 15 --frame-ms 5000 --silence-ms 1200

# 직접 말하는 시험(비용 발생): 서버를 켜고 크롬에서 http://127.0.0.1:5199/ 를 연다
node scripts/manual/live-probe/server.mjs
```

## 시험 항목

| 시험 | 보는 것 |
| --- | --- |
| `lock` | 입장권에 넣은 "바나나" 지시와 브라우저가 보낸 "사과" 지시 중 무엇이 적용되는지. 결과 파일의 면접관 발언을 본다 |
| `expire` | 입장권이 2분에 끝날 때 진행 중 연결이 끊기는지 |
| `full` | 15분 유지, 재연결, 지연, 쉼 중 끼어듦, 12분쯤 첫 답변 기억, 토큰 사용량 |
| 직접 말하기 | 체감 지연, 말을 끊는지, 스피커 에코, 꼬리 질문 품질. 화면 버튼으로 표시한다 |

## 통과 기준

`probe-core.js`의 `evaluateGate`: 15분 유지, 말이 끝나고 첫 음성까지 중간값 1.5초·느린 경우 3초, 쉼 10회 이상 중 80% 이상 안 끊김, 실제 청구액이 계산치의 3배 이하. 청구액은 사람이 Cloud Billing에서 확인해야 한다.

자동 시험은 합성 음성을 쓰고 실제 마이크 경로(AudioWorklet)를 지나지 않는다. 크롬 가짜 마이크가 이 환경에서 시작되지 않았기 때문이다. 실제 마이크는 직접 말하는 시험으로 확인한다.
