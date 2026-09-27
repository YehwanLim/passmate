// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { TrafficSourcesTable } from "./TrafficSourcesTable";

describe("TrafficSourcesTable", () => {
  afterEach(() => cleanup());

  it("유입원 표 아래에 인앱 브라우저 방문자와 로그인 화면 오류 건수를 한 줄로 보여 준다", () => {
    render(
      <TrafficSourcesTable
        data={[{ source: "threads", visitors: 12 }]}
        days={7}
        isLoading={false}
        loginHealth={{
          inAppVisitors: 5,
          events: { login_prompt_in_app: 4, google_button_unavailable: 1, google_signin_failed: 2, kakao_start_failed: 0 },
        }}
      />,
    );

    expect(screen.getByText("threads")).toBeTruthy();
    const line = screen.getByText(/인앱 브라우저 방문자/).textContent ?? "";
    expect(line).toContain("5명");
    expect(line).toContain("로그인 화면 노출 4");
    expect(line).toContain("Google 오류 3");
    expect(line).toContain("카카오 오류 0");
  });

  it("로그인 건강 데이터가 아직 없으면 그 줄을 그리지 않는다", () => {
    render(<TrafficSourcesTable data={[]} days={7} isLoading={false} loginHealth={null} />);

    expect(screen.queryByText(/인앱 브라우저 방문자/)).toBeNull();
  });
});
