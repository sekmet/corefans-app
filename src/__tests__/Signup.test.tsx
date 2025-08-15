/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Signup from "@/pages/Signup";

// Mocks
const signUpEmailMock = jest.fn() as any;

jest.mock("@/lib/auth-client", () => {
  return {
    authClient: {
      signUp: { email: (...args: any[]) => signUpEmailMock(...args) },
      useSession: () => ({ data: null, isPending: false }),
    },
  };
});

jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: jest.fn() }) }));

function ProfileDummy() {
  return <div>Profile</div>;
}

function renderSignup(initialPath = "/signup") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/profile" element={<ProfileDummy />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  signUpEmailMock.mockReset();
});

describe("Signup page", () => {
  it("shows validation errors for empty fields", async () => {
    renderSignup();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/at least 2/i)).toBeTruthy();
    expect(await screen.findByText(/invalid email/i)).toBeTruthy();
    expect(await screen.findByText(/at least 8/i)).toBeTruthy();
  });

  it("submits name/email/password and navigates to /profile on success", async () => {
    signUpEmailMock.mockResolvedValueOnce({ error: null });

    renderSignup();
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/your name/i), "Alice");
    await user.type(screen.getByPlaceholderText(/you@example.com/i), "alice@example.com");
    await user.type(screen.getByPlaceholderText(/••••••••/), "supersecret");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(signUpEmailMock).toHaveBeenCalledTimes(1);
    expect(signUpEmailMock.mock.calls[0][0]).toEqual({
      name: "Alice",
      email: "alice@example.com",
      password: "supersecret",
    });

    // Navigates to /profile and renders ProfileDummy
    expect(await screen.findByText("Profile")).toBeTruthy();
  });
});
