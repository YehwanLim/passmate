import { describe, expect, it } from "vitest";

import type { PromptTemplateRecord } from "../../../lib/admin-prompts";
import {
  createEditorFormFromRecord,
  getPrimaryPromptRecord,
  insertPromptDraftRecord,
  markActivePromptRecord,
} from "./PromptDetailPage";

function createPromptRecord(
  overrides: Partial<PromptTemplateRecord>
): PromptTemplateRecord {
  return {
    id: overrides.id ?? "prompt-1",
    promptType: overrides.promptType ?? "summary",
    version: overrides.version ?? "v1.0",
    name: overrides.name ?? "Summary Prompt",
    variant: overrides.variant ?? null,
    systemPrompt: overrides.systemPrompt ?? "System prompt",
    userTemplate: overrides.userTemplate ?? "{{resume}}",
    modelName: overrides.modelName ?? "gemini-2.5-flash-lite",
    modelProvider: overrides.modelProvider ?? "google",
    temperature: overrides.temperature ?? 0.4,
    maxTokens: overrides.maxTokens ?? 1200,
    isActive: overrides.isActive ?? false,
    isDefault: overrides.isDefault ?? false,
    description: overrides.description ?? "Prompt description",
    notes: Object.hasOwn(overrides, "notes")
      ? (overrides.notes ?? null)
      : "Prompt notes",
    updatedBy: overrides.updatedBy ?? "admin@example.com",
    createdAt: overrides.createdAt ?? "2026-07-11T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-07-11T00:00:00.000Z",
  };
}

describe("getPrimaryPromptRecord", () => {
  it("prefers the active record over the newest record", () => {
    const latestDraft = createPromptRecord({
      id: "draft",
      version: "v1.2",
      isActive: false,
    });
    const activeRecord = createPromptRecord({
      id: "active",
      version: "v1.1",
      isActive: true,
    });

    expect(getPrimaryPromptRecord([latestDraft, activeRecord])).toEqual(
      activeRecord
    );
  });
});

describe("createEditorFormFromRecord", () => {
  it("hydrates editor values from a selected record", () => {
    const record = createPromptRecord({
      temperature: 0.7,
      maxTokens: 900,
      notes: null,
    });

    expect(createEditorFormFromRecord(record, "Fallback Prompt")).toEqual({
      name: "Summary Prompt",
      systemPrompt: "System prompt",
      userTemplate: "{{resume}}",
      temperature: "0.7",
      maxTokens: "900",
      notes: "",
    });
  });

  it("falls back to the provided prompt name when no record exists", () => {
    expect(createEditorFormFromRecord(null, "Fallback Prompt")).toEqual({
      name: "Fallback Prompt",
      systemPrompt: "",
      userTemplate: "",
      temperature: "",
      maxTokens: "",
      notes: "",
    });
  });
});

describe("insertPromptDraftRecord", () => {
  it("places the newly saved draft first in the history list", () => {
    const existing = createPromptRecord({ id: "existing", version: "v1.0" });
    const draft = createPromptRecord({ id: "draft", version: "v1.1" });

    expect(insertPromptDraftRecord([existing], draft)).toEqual([
      draft,
      existing,
    ]);
  });
});

describe("markActivePromptRecord", () => {
  it("marks only the selected record as active", () => {
    const records = [
      createPromptRecord({ id: "v1", isActive: true }),
      createPromptRecord({ id: "v2", version: "v1.1", isActive: false }),
    ];

    expect(markActivePromptRecord(records, "v2")).toMatchObject([
      { id: "v1", isActive: false },
      { id: "v2", isActive: true },
    ]);
  });
});
