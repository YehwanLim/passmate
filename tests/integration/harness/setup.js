// 통합 테스트는 실제 provider 를 절대 호출하지 않는다.
// fixture 가 네트워크를 가로채지만, 진짜 키가 프로세스에 남아 있으면
// 가로채기가 빠진 경로에서 실제 호출이 나갈 수 있다. 키 자체를 무력화한다.
process.env.GEMINI_API_KEY = "integration-fake-key";
process.env.OPENAI_API_KEY = "integration-fake-key";
process.env.OPEN_API_KEY = "integration-fake-key";
