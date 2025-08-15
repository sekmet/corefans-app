import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReferralsPage from "@/pages/settings/ReferralsPage";

// Mock hooks to avoid importing auth client (uses import.meta.env)
jest.mock("@/pages/settings/hooks", () => ({
  useUserDisplay: () => ({ name: "Tester", handle: "@tester", avatarUrl: undefined }),
}));

function getTbody(container: HTMLElement) {
  const tbody = container.querySelector("tbody");
  if (!tbody) throw new Error("tbody not found");
  return tbody as HTMLElement;
}

test("renders analytics cards and referral rows", () => {
  const { container } = render(<ReferralsPage />);
  expect(screen.getByText(/clicks/i)).toBeInTheDocument();
  expect(screen.getByText(/sign-ups/i)).toBeInTheDocument();
  expect(screen.getByText(/conversions/i)).toBeInTheDocument();
  // 'Earnings' appears in a card and table header; ensure at least one present
  expect(screen.getAllByText(/earnings/i).length).toBeGreaterThanOrEqual(1);

  const tbody = getTbody(container);
  const rows = within(tbody).getAllByRole("row");
  expect(rows.length).toBeGreaterThanOrEqual(3);
});

test("search filters referrals by status or name", async () => {
  const user = userEvent.setup();
  const { container } = render(<ReferralsPage />);

  const input = screen.getByPlaceholderText(/search referrals by name, @username or status/i);
  await user.clear(input);
  await user.type(input, "converted");

  const tbody = getTbody(container);
  const rows = within(tbody).getAllByRole("row");
  expect(rows.length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText(/converted/i)).toBeInTheDocument();
});
