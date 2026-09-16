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

function renderCombobox(Component: typeof CompanyCombobox, placeholder: string, value = "") {
  const onChange = vi.fn();
  render(
    <>
      <Component value={value} onChange={onChange} />
      <input aria-label="next field" />
    </>,
  );
  const input = screen.getByPlaceholderText(placeholder);
  return { input, next: screen.getByLabelText("next field"), onChange };
}

const listItems = () =>
  screen.getAllByRole("button").filter(button => button.getAttribute("aria-label") !== "입력 초기화");

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

  it("closes when focus leaves from a list item to an outside field", () => {
    const { input, next } = renderCombobox(Component, placeholder);
    fireEvent.focus(input);
    const firstItem = listItems()[0];
    fireEvent.blur(input, { relatedTarget: firstItem });
    expect(screen.getAllByRole("list").length).toBeGreaterThan(0);

    fireEvent.blur(firstItem, { relatedTarget: next });
    expect(screen.queryAllByRole("list")).toHaveLength(0);
  });

  it("stays open when blur targets an item inside the dropdown", () => {
    const { input } = renderCombobox(Component, placeholder);
    fireEvent.focus(input);
    const firstItem = listItems()[0];

    fireEvent.blur(input, { relatedTarget: firstItem });
    expect(screen.getAllByRole("list").length).toBeGreaterThan(0);
  });

  it("keeps list items and the clear button out of the tab order", () => {
    const { input } = renderCombobox(Component, placeholder, "기");
    fireEvent.focus(input);

    for (const button of screen.getAllByRole("button")) {
      expect(button.tabIndex).toBe(-1);
    }
  });

  it("ArrowDown highlights the first item and Enter selects it", () => {
    const { input, onChange } = renderCombobox(Component, placeholder);
    fireEvent.focus(input);
    const first = listItems()[0];
    const expected = first.textContent?.trim();

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(first.getAttribute("data-highlighted")).toBe("true");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(expected);
    expect(screen.queryAllByRole("list")).toHaveLength(0);
  });

  it("ArrowUp from no highlight wraps to the last item", () => {
    const { input } = renderCombobox(Component, placeholder);
    fireEvent.focus(input);
    const items = listItems();

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(items[items.length - 1].getAttribute("data-highlighted")).toBe("true");
  });

  it("Enter without a highlighted item changes nothing", () => {
    const { input, onChange } = renderCombobox(Component, placeholder);
    fireEvent.focus(input);

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getAllByRole("list").length).toBeGreaterThan(0);
  });

  it("ignores arrow keys while an IME composition is in progress", () => {
    const { input } = renderCombobox(Component, placeholder);
    fireEvent.focus(input);

    fireEvent.keyDown(input, { key: "ArrowDown", isComposing: true });
    expect(screen.queryByText((_, el) => el?.getAttribute("data-highlighted") === "true")).toBeNull();
  });
});
