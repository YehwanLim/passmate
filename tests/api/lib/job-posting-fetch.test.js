import { describe, expect, it } from "vitest";

import { ApiError } from "../../../lib/api-handler.js";
import {
  assertSafeUrl,
  fetchPostingText,
  htmlToText,
  isPrivateAddress,
} from "../../../lib/job-posting-fetch.js";

const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];

function htmlResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", ...headers },
  });
}

async function expectApiError(promise, code, status) {
  const error = await promise.then(
    () => null,
    (caught) => caught,
  );
  expect(error).toBeInstanceOf(ApiError);
  expect(error.code).toBe(code);
  expect(error.statusCode).toBe(status);
}

describe("isPrivateAddress", () => {
  it.each([
    "0.0.0.0",
    "0.1.2.3",
    "10.0.0.1",
    "10.255.255.255",
    "127.0.0.1",
    "127.10.20.30",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.254",
    "192.168.1.1",
    "100.64.0.1",
    "100.127.255.255",
    "::",
    "::1",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "FE80::abcd",
    "::ffff:127.0.0.1",
    "::ffff:10.1.2.3",
    "::ffff:192.168.0.9",
    "::ffff:7f00:1",
    "::ffff:a9fe:a9fe",
  ])("treats %s as private", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each([
    "8.8.8.8",
    "93.184.216.34",
    "172.15.255.255",
    "172.32.0.1",
    "100.63.255.255",
    "100.128.0.1",
    "192.169.0.1",
    "2606:4700::1111",
    "::ffff:8.8.8.8",
    "::ffff:808:808",
  ])("treats %s as public", (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe("assertSafeUrl", () => {
  it("returns a URL for a public https host", async () => {
    const url = await assertSafeUrl("https://jobs.example.com/posting/1", { lookup: publicLookup });
    expect(url).toBeInstanceOf(URL);
    expect(url.hostname).toBe("jobs.example.com");
  });

  it.each([
    "not a url",
    "file:///etc/passwd",
    "ftp://jobs.example.com/x",
    "javascript:alert(1)",
    "https://user:pass@jobs.example.com/",
    "http://localhost/",
    "http://api.localhost/",
    "http://127.0.0.1/",
    "http://10.0.0.5:8080/",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/",
    "http://[fe80::1]/",
    "http://[::ffff:127.0.0.1]/",
  ])("rejects %s with INVALID_REQUEST", async (input) => {
    await expectApiError(assertSafeUrl(input, { lookup: publicLookup }), "INVALID_REQUEST", 400);
  });

  it("rejects a hostname that resolves to a private address", async () => {
    const lookup = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.7", family: 4 },
    ];
    await expectApiError(
      assertSafeUrl("https://evil.example.com/", { lookup }),
      "INVALID_REQUEST",
      400,
    );
  });

  it("rejects a hostname that fails to resolve", async () => {
    const lookup = async () => {
      throw new Error("ENOTFOUND");
    };
    await expectApiError(
      assertSafeUrl("https://missing.example.com/", { lookup }),
      "INVALID_REQUEST",
      400,
    );
  });
});

describe("htmlToText", () => {
  it("drops script, style, noscript, template, svg blocks and comments", () => {
    const html = `
      <html><head><style>.a{color:red}</style><script>alert("x")</script></head>
      <body><!-- hidden --><noscript>enable js</noscript><template><p>tpl</p></template>
      <svg><text>icon</text></svg><p>본문</p></body></html>`;
    expect(htmlToText(html)).toBe("본문");
  });

  it("turns block tags and br variants into newlines", () => {
    // 닫는 태그 + 여는 태그가 맞닿으면 줄바꿈 둘(빈 줄 하나)이 남고, 3개 이상은 2개로 접힌다.
    const html =
      "<h1>백엔드 개발자</h1><p>첫 줄<br>둘째 줄<br/>셋째 줄<br />넷째 줄</p><ul><li>자격 1</li><li>자격 2</li></ul><div>끝</div>";
    expect(htmlToText(html)).toBe(
      "백엔드 개발자\n\n첫 줄\n둘째 줄\n셋째 줄\n넷째 줄\n\n자격 1\n\n자격 2\n\n끝",
    );
  });

  it("emits a single newline for a lone block boundary", () => {
    expect(htmlToText("첫 줄<p>둘째 줄")).toBe("첫 줄\n둘째 줄");
    expect(htmlToText("첫 줄<hr>둘째 줄")).toBe("첫 줄\n둘째 줄");
  });

  it("decodes named and numeric entities", () => {
    expect(htmlToText("R&amp;D &lt;팀&gt; &quot;a&quot; &#39;b&#39; &apos;c&apos; x&nbsp;y &#52;&#x41;")).toBe(
      "R&D <팀> \"a\" 'b' 'c' x y 4A",
    );
  });

  it("collapses whitespace runs and trims", () => {
    const html = "<p>  a \t\t b  </p>\n\n\n\n<p>c</p>\n\n\n<p>d</p>";
    expect(htmlToText(html)).toBe("a b\n\nc\n\nd");
  });

  it("passes plain text through apart from whitespace normalization", () => {
    expect(htmlToText("  지원 자격:  3년 이상 \n\n\n경력  ")).toBe("지원 자격: 3년 이상\n\n경력");
  });
});

describe("fetchPostingText", () => {
  it("returns decoded text from a utf-8 html page", async () => {
    const fetchImpl = async () => htmlResponse("<h1>채용</h1><p>백엔드 &amp; 인프라</p>");
    const text = await fetchPostingText("https://jobs.example.com/1", { fetchImpl, lookup: publicLookup });
    expect(text).toBe("채용\n\n백엔드 & 인프라");
  });

  it("accepts text/plain", async () => {
    const fetchImpl = async () =>
      new Response("plain posting", { status: 200, headers: { "content-type": "text/plain" } });
    await expect(
      fetchPostingText("https://jobs.example.com/1", { fetchImpl, lookup: publicLookup }),
    ).resolves.toBe("plain posting");
  });

  it("sends a bot user agent with manual redirects", async () => {
    let seen;
    const fetchImpl = async (url, init) => {
      seen = { url: String(url), init };
      return htmlResponse("<p>ok</p>");
    };
    await fetchPostingText("https://jobs.example.com/1", { fetchImpl, lookup: publicLookup });
    expect(seen.url).toBe("https://jobs.example.com/1");
    expect(seen.init.redirect).toBe("manual");
    expect(seen.init.headers["User-Agent"]).toBe("Mozilla/5.0 (compatible; PreViewBot/1.0)");
    expect(seen.init.headers.Accept).toBe("text/html,text/plain;q=0.9,*/*;q=0.1");
    expect(seen.init.signal).toBeInstanceOf(AbortSignal);
  });

  it("follows one redirect with a relative location and returns the text", async () => {
    const calls = [];
    const fetchImpl = async (url) => {
      calls.push(String(url));
      if (calls.length === 1) {
        return new Response(null, { status: 302, headers: { location: "/final" } });
      }
      return htmlResponse("<p>도착</p>");
    };
    const text = await fetchPostingText("https://jobs.example.com/start", { fetchImpl, lookup: publicLookup });
    expect(text).toBe("도착");
    expect(calls).toEqual(["https://jobs.example.com/start", "https://jobs.example.com/final"]);
  });

  it("rejects a redirect to a private address", async () => {
    const fetchImpl = async () =>
      new Response(null, { status: 301, headers: { location: "http://169.254.169.254/latest" } });
    await expectApiError(
      fetchPostingText("https://jobs.example.com/1", { fetchImpl, lookup: publicLookup }),
      "INVALID_REQUEST",
      400,
    );
  });

  it("gives up after more than maxRedirects hops", async () => {
    let hops = 0;
    const fetchImpl = async () => {
      hops += 1;
      return new Response(null, { status: 307, headers: { location: `/hop-${hops}` } });
    };
    await expectApiError(
      fetchPostingText("https://jobs.example.com/1", { fetchImpl, lookup: publicLookup, maxRedirects: 3 }),
      "POSTING_URL_UNREADABLE",
      422,
    );
    expect(hops).toBe(4);
  });

  it("rejects a redirect without a location header", async () => {
    const fetchImpl = async () => new Response(null, { status: 302 });
    await expectApiError(
      fetchPostingText("https://jobs.example.com/1", { fetchImpl, lookup: publicLookup }),
      "POSTING_URL_UNREADABLE",
      422,
    );
  });

  it("rejects a 404", async () => {
    const fetchImpl = async () => htmlResponse("<p>없음</p>", { status: 404 });
    await expectApiError(
      fetchPostingText("https://jobs.example.com/1", { fetchImpl, lookup: publicLookup }),
      "POSTING_URL_UNREADABLE",
      422,
    );
  });

  it("rejects a non-text content type", async () => {
    const fetchImpl = async () =>
      new Response("%PDF-1.4", { status: 200, headers: { "content-type": "application/pdf" } });
    await expectApiError(
      fetchPostingText("https://jobs.example.com/1", { fetchImpl, lookup: publicLookup }),
      "POSTING_URL_UNREADABLE",
      422,
    );
  });

  it("rejects a body larger than maxBytes", async () => {
    const fetchImpl = async () => htmlResponse(`<p>${"가".repeat(200)}</p>`);
    await expectApiError(
      fetchPostingText("https://jobs.example.com/1", { fetchImpl, lookup: publicLookup, maxBytes: 100 }),
      "POSTING_URL_UNREADABLE",
      422,
    );
  });

  it("rejects when fetch throws", async () => {
    const fetchImpl = async () => {
      throw new TypeError("fetch failed");
    };
    await expectApiError(
      fetchPostingText("https://jobs.example.com/1", { fetchImpl, lookup: publicLookup }),
      "POSTING_URL_UNREADABLE",
      422,
    );
  });

  it("rejects when the request is aborted by the timeout", async () => {
    const fetchImpl = (url, init) =>
      new Promise((_, reject) => {
        init.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    await expectApiError(
      fetchPostingText("https://jobs.example.com/1", { fetchImpl, lookup: publicLookup, timeoutMs: 10 }),
      "POSTING_URL_UNREADABLE",
      422,
    );
  });

  it("decodes euc-kr when the response declares it", async () => {
    const eucKrBytes = new Uint8Array([0xc3, 0xa4, 0xbf, 0xeb]); // "채용"
    const fetchImpl = async () =>
      new Response(eucKrBytes, { status: 200, headers: { "content-type": "text/html; charset=euc-kr" } });
    await expect(
      fetchPostingText("https://jobs.example.com/1", { fetchImpl, lookup: publicLookup }),
    ).resolves.toBe("채용");
  });

  it("rejects an unsafe initial url before fetching", async () => {
    let called = false;
    const fetchImpl = async () => {
      called = true;
      return htmlResponse("<p>x</p>");
    };
    await expectApiError(
      fetchPostingText("http://127.0.0.1/", { fetchImpl, lookup: publicLookup }),
      "INVALID_REQUEST",
      400,
    );
    expect(called).toBe(false);
  });
});
