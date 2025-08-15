import React from "react";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PaymentsPage from "@/pages/settings/PaymentsPage";

function getTbody(container: HTMLElement) {
  const tbody = container.querySelector("tbody");
  if (!tbody) throw new Error("tbody not found");
  return tbody as HTMLElement;
}

test("renders all payments and actions buttons", () => {
  const { container } = render(<PaymentsPage />);
  const tbody = getTbody(container);
  const rows = within(tbody).getAllByRole("row");
  expect(rows.length).toBeGreaterThanOrEqual(3);
  const actionButtons = screen.getAllByRole("button", { name: /actions for/i });
  expect(actionButtons.length).toBe(3);
});

test("search filters payments by text", async () => {
  const user = userEvent.setup();
  const { container } = render(<PaymentsPage />);
  const input = screen.getByPlaceholderText(/search payments/i);

  await user.clear(input);
  await user.type(input, "tip");

  const tbody = getTbody(container);
  const rows = within(tbody).getAllByRole("row");
  expect(rows.length).toBe(1);
  expect(screen.getByText(/tip/i)).toBeInTheDocument();
  expect(screen.queryByText(/payout/i)).not.toBeInTheDocument();
});

test("status filter shows only pending when initialStatus is pending", () => {
  const { container } = render(<PaymentsPage initialStatus="pending" />);
  const tbody = getTbody(container);
  const rows = within(tbody).getAllByRole("row");
  expect(rows.length).toBe(1);
  expect(within(tbody).getByText(/pending/i)).toBeInTheDocument();
});

test("actions dropdown opens and shows items", async () => {
  const user = userEvent.setup();
  render(<PaymentsPage />);
  const firstAction = screen.getByRole("button", { name: /actions for 1/i });
  await user.click(firstAction);
  expect(screen.getByText(/view/i)).toBeInTheDocument();
  expect(screen.getByText(/download receipt/i)).toBeInTheDocument();
  expect(screen.getByText(/refund/i)).toBeInTheDocument();
});
