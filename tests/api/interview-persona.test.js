import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { INTERVIEWER_PERSONAS, pickInterviewer } from "../../shared/interviewPersona.js";

describe("면접관 인물(사진 + 목소리)", () => {
  it("세션 id 가 같으면 같은 사람, 사진 파일은 실제로 있고 목소리가 정해져 있다", () => {
    const sessionId = "3fd7f2c4-40d5-4403-9901-9dceb2aa5ae1";
    expect(pickInterviewer(sessionId)).toBe(pickInterviewer(sessionId));
    expect(INTERVIEWER_PERSONAS.length).toBeGreaterThanOrEqual(2);
    for (const persona of INTERVIEWER_PERSONAS) {
      expect(existsSync(path.join(process.cwd(), "client/public", persona.photo))).toBe(true);
      expect(persona.voice).toMatch(/^[A-Z][a-z]+$/);
    }
    const chosen = new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => pickInterviewer(id).id));
    expect(chosen.size).toBeGreaterThan(1);
    expect(pickInterviewer(null)).toBe(INTERVIEWER_PERSONAS[0]);
  });
});
