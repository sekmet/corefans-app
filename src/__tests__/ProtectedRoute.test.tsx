import { describe, it, expect, jest } from "@jest/globals";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "@/components/core/ProtectedRoute";

jest.mock("@/lib/auth-client", () => {
  return {
    authClient: {
      useSession: () => ({ data: { user: { id: "u1" } }, isPending: false }),
    },
  };
});

function Dummy() {
  return <div>Secret</div>;
}

describe("ProtectedRoute", () => {
  it("renders children when session exists", () => {
    const ui = render(
      <MemoryRouter initialEntries={["/secret"]}>
        <Routes>
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
    expect(ui.getByText("Secret")).toBeInTheDocument();
  });
});
