import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SubscriptionsPage from "@/pages/settings/SubscriptionsPage";

function getTbody(container: HTMLElement) {
  const tbody = container.querySelector("tbody");
  if (!tbody) throw new Error("tbody not found");
  return tbody as HTMLElement;
}

test("renders stats and table rows", () => {
  const { container } = render(<SubscriptionsPage />);
  // Stats cards
  expect(screen.getAllByText(/total/i).length).toBeGreaterThanOrEqual(1);
  expect(screen.getAllByText(/active/i).length).toBeGreaterThanOrEqual(1);
  expect(screen.getAllByText(/canceled/i).length).toBeGreaterThanOrEqual(1);
  expect(screen.getAllByText(/mrr/i).length).toBeGreaterThanOrEqual(1);

  const tbody = getTbody(container);
  const rows = within(tbody).getAllByRole("row");
  expect(rows.length).toBeGreaterThanOrEqual(3);
});

test("filters by search query", async () => {
  const user = userEvent.setup();
  const { container } = render(<SubscriptionsPage />);

  const input = screen.getByPlaceholderText(/search by plan or status/i);
  await user.clear(input);
  await user.type(input, "Pro");

  const tbody = getTbody(container);
  const rows = within(tbody).getAllByRole("row");
  expect(rows.length).toBe(1);
  expect(screen.getByText(/pro/i)).toBeInTheDocument();
});

test("renders actions button for first row", () => {
  render(<SubscriptionsPage />);
  const actionBtn = screen.getAllByRole("button", { name: /actions/i })[0];
  expect(actionBtn).toBeInTheDocument();
});
