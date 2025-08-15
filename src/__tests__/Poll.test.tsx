/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import Poll from "@/components/core/Poll";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    ...render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>),
    qc,
  };
}

const POST_ID = "post-123";

type FakeResponse = { ok: boolean; status: number; json: () => Promise<any> };

function res(ok: boolean, status: number, body: any): FakeResponse {
  return { ok, status, json: async () => body } as FakeResponse;
}

describe("Poll component", () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders nothing when poll not found (404)", async () => {
    (global as any).fetch.mockResolvedValueOnce(res(false, 404, { error: "Not found" }));

    const { container } = renderWithQuery(<Poll postId={POST_ID} />);

    // Initially shows skeleton, then disappears entirely on 404
    await waitFor(() => {
      expect((global as any).fetch).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it("shows options when poll is active and user has not voted", async () => {
    (global as any).fetch.mockResolvedValueOnce(
      res(true, 200, {
        ok: true,
        postId: POST_ID,
        question: "Your favorite color?",
        multipleChoice: false,
        expiresAt: null,
        expired: false,
        selectedOptionId: null,
        totalVotes: 0,
        options: [
          { optionId: 1, text: "Red", votes: 0 },
          { optionId: 2, text: "Blue", votes: 0 },
        ],
      })
    );

    renderWithQuery(<Poll postId={POST_ID} />);

    expect(await screen.findByText(/your favorite color\?/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /vote for red/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /vote for blue/i })).toBeInTheDocument();
  });

  it("submits a vote and displays results", async () => {
    // First GET (initial)
    (global as any).fetch.mockResolvedValueOnce(
      res(true, 200, {
        ok: true,
        postId: POST_ID,
        question: "Pick one",
        multipleChoice: false,
        expiresAt: null,
        expired: false,
        selectedOptionId: null,
        totalVotes: 0,
        options: [
          { optionId: 10, text: "A", votes: 0 },
          { optionId: 20, text: "B", votes: 0 },
        ],
      })
    );

    // POST /vote
    (global as any).fetch.mockResolvedValueOnce(
      res(true, 200, {
        ok: true,
        postId: POST_ID,
        selectedOptionId: 10,
        totalVotes: 1,
        results: [
          { optionId: 10, text: "A", votes: 1 },
          { optionId: 20, text: "B", votes: 0 },
        ],
      })
    );

    // Second GET (after invalidation)
    (global as any).fetch.mockResolvedValueOnce(
      res(true, 200, {
        ok: true,
        postId: POST_ID,
        question: "Pick one",
        multipleChoice: false,
        expiresAt: null,
        expired: false,
        selectedOptionId: 10,
        totalVotes: 1,
        options: [
          { optionId: 10, text: "A", votes: 1 },
          { optionId: 20, text: "B", votes: 0 },
        ],
      })
    );

    const user = userEvent.setup();
    renderWithQuery(<Poll postId={POST_ID} />);

    const btnA = await screen.findByRole("button", { name: /vote for a/i });
    await user.click(btnA);

    // After vote, results should render with percentage label
    await screen.findByText(/1 votes?/i);
    // Percentage might be displayed as 100%
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });
});
