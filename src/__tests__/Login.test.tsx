/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Login from "@/pages/Login";

// Mocks
const signInEmailMock = jest.fn() as any;

jest.mock("@/lib/auth-client", () => {
  return {
    authClient: {
      signIn: { email: (...args: any[]) => signInEmailMock(...args) },
      siwe: { nonce: jest.fn(), verify: jest.fn() },
      useSession: () => ({ data: null, isPending: false, refetch: jest.fn() }),
    },
  };
});

jest.mock("wagmi", () => ({
  useConnect: () => ({ connectAsync: jest.fn() }),
  useDisconnect: () => ({ disconnect: jest.fn() }),
  useAccount: () => ({ address: "0xabc", isConnected: false }),
  useSignMessage: () => ({ signMessageAsync: jest.fn() }),
}));

jest.mock("@wagmi/connectors", () => ({
  injected: () => ({ id: "injected" }),
}));

// Mock wagmi chain export to avoid importing ESM-only packages in tests
jest.mock("@/lib/wagmi", () => ({
  coreTestnet2: { id: 11155111 },
}));

jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: jest.fn() }) }));

function ProfileDummy() {
  return <div>Profile</div>;
}

function renderLogin(initialPath = "/login") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/profile" element={<ProfileDummy />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  signInEmailMock.mockReset();
});

describe("Login page", () => {
  it("shows validation errors for empty fields", async () => {
    renderLogin();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByText(/invalid email/i)).toBeTruthy();
    expect(await screen.findByText(/at least 8/i)).toBeTruthy();
  });

  it("submits email/password and navigates to /profile on success", async () => {
    signInEmailMock.mockResolvedValueOnce({ error: null });

    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/you@example.com/i), "you@example.com");
    await user.type(screen.getByPlaceholderText(/••••••••/), "supersecret");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(signInEmailMock).toHaveBeenCalledTimes(1);
    expect(signInEmailMock.mock.calls[0][0]).toEqual({
      email: "you@example.com",
      password: "supersecret",
    });

    // Navigates to /profile and renders ProfileDummy
    expect(await screen.findByText("Profile")).toBeTruthy();
  });
});
