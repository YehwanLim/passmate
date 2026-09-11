// 핸들러 단위 테스트용 최소 응답 객체. Vercel/Express 응답의 status/json/setHeader/end 만 흉내 낸다.
export function createResponse() {
  return {
    body: undefined,
    headers: {},
    statusCode: 200,
    end() {
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
  };
}
