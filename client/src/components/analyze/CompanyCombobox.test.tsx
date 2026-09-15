// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    ul: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <ul className={className}>{children}</ul>
    ),
    div: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div className={className}>{children}</div>
    ),
  },
}));

import CompanyCombobox from "./CompanyCombobox";
import JobRoleCombobox from "./JobRoleCombobox";

afterEach(cleanup);

function renderCombobox(Component: typeof CompanyCombobox, placeholder: string) {
  const onChange = vi.fn();
  render(
    <>
      <Component value="" onChange={onChange} />
      <input aria-label="next field" />
    </>,
  );
  const input = screen.getByPlaceholderText(placeholder);
  return { input, next: screen.getByLabelText("next field") };
}

describe.each([
  ["CompanyCombobox", CompanyCombobox, "회사명을 검색하거나 직접 입력하세요"],
  ["JobRoleCombobox", JobRoleCombobox, "직무를 검색하거나 직접 입력하세요"],
] as const)("%s dropdown", (_name, Component, placeholder) => {
  it("opens on focus and closes when focus moves to another field", () => {
    const { input, next } = renderCombobox(Component, placeholder);
    fireEvent.focus(input);
    expect(screen.getAllByRole("list").length).toBeGreaterThan(0);

    fireEvent.blur(input, { relatedTarget: next });
    expect(screen.queryAllByRole("list")).toHaveLength(0);
  });

  it("closes on Escape while the input keeps focus", () => {
    const { input } = renderCombobox(Component, placeholder);
    fireEvent.focus(input);
    expect(screen.getAllByRole("list").length).toBeGreaterThan(0);

    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryAllByRole("list")).toHaveLength(0);
  });

  it("stays open when blur targets an item inside the dropdown", () => {
    const { input } = renderCombobox(Component, placeholder);
    fireEvent.focus(input);
    const firstItem = screen.getAllByRole("button")[0];

    fireEvent.blur(input, { relatedTarget: firstItem });
    expect(screen.getAllByRole("list").length).toBeGreaterThan(0);
  });
});
