import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WalletPage from "@/pages/settings/WalletPage";

test("tabs switch between deposit and withdraw views", async () => {
  const user = userEvent.setup();
  render(<WalletPage />);

  // default is deposit
  expect(screen.getByText(/payment method/i)).toBeInTheDocument();

  await user.click(screen.getByRole("tab", { name: /withdraw/i }));
  expect(screen.getByText(/destination/i)).toBeInTheDocument();

  await user.click(screen.getByRole("tab", { name: /deposit/i }));
  expect(screen.getByText(/payment method/i)).toBeInTheDocument();
});
