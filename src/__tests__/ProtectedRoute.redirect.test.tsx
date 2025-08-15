import { describe, it, expect, jest } from "@jest/globals";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "@/components/core/ProtectedRoute";

jest.mock("@/lib/auth-client", () => {
  return {
    authClient: {
      useSession: () => ({ data: null, isPending: false }),
    },
  };
});

function Dummy() {
  return <div>Secret</div>;
}

function Login() {
  return <div>LoginPage</div>;
}

describe("ProtectedRoute redirect", () => {
  it("redirects to /login when no session", () => {
    const ui = render(
      <MemoryRouter initialEntries={["/secret"]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/secret"
            element={
              <ProtectedRoute>
                <Dummy />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(ui.getByText("LoginPage")).toBeInTheDocument();
  });
});
