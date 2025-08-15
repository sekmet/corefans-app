import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VerificationPage from "@/pages/settings/VerificationPage";

test("progress updates and steps advance on valid input", async () => {
  const user = userEvent.setup();
  render(<VerificationPage />);

  // Step 1: email
  const email = screen.getByLabelText(/email/i);
  await user.type(email, "user@example.com");
  expect(screen.getByText(/33%/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /next/i }));

  // Step 2: phone appears
  expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
});
