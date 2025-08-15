import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SettingsLayout from "@/pages/settings/SettingsLayout";

function renderWithRoute(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/settings" element={<SettingsLayout />}> 
          <Route path="profile" element={<div>Profile Page</div>} />
          <Route path="account" element={<div>Account Page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

test("highlights active nav item (Profile) and renders outlet", () => {
  renderWithRoute("/settings/profile");

  const profileLink = screen.getByRole("link", { name: /profile/i });
  expect(profileLink).toBeInTheDocument();
  // Active NavLink gets bg-muted and font-medium on the link
  expect(profileLink).toHaveClass("bg-muted");
  // And the inner span gets the indigo highlight classes
  const span = profileLink.querySelector("span");
  expect(span?.className).toEqual(expect.stringContaining("text-indigo-600"));
  expect(span?.className).toEqual(expect.stringContaining("font-semibold"));

  // Outlet content for the route
  expect(screen.getByText(/profile page/i)).toBeInTheDocument();
});

test("switching route would highlight different item (Account)", () => {
  renderWithRoute("/settings/account");

  const accountLink = screen.getByRole("link", { name: /account/i });
  expect(accountLink).toHaveClass("bg-muted");
});
