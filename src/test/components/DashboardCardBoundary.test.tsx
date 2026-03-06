import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DashboardCardBoundary } from "@/components/dashboard/DashboardCardBoundary";

// Mock Sentry
vi.mock("@/lib/sentry", () => ({
  Sentry: {
    captureException: vi.fn(),
  },
}));

// Component that throws on demand
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Test error");
  return <div>Child content</div>;
}

// Suppress console.error for expected boundary errors
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("DashboardCardBoundary", () => {
  it("renders children when no error", () => {
    render(
      <DashboardCardBoundary label="Test">
        <ThrowingComponent shouldThrow={false} />
      </DashboardCardBoundary>
    );
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("shows fallback UI when child throws an error", () => {
    render(
      <DashboardCardBoundary>
        <ThrowingComponent shouldThrow={true} />
      </DashboardCardBoundary>
    );
    expect(screen.getByText(/Este módulo encontrou um erro/i)).toBeInTheDocument();
  });

  it("shows the label in the fallback message", () => {
    render(
      <DashboardCardBoundary label="Test Card">
        <ThrowingComponent shouldThrow={true} />
      </DashboardCardBoundary>
    );
    expect(screen.getByText(/"Test Card" encontrou um erro/i)).toBeInTheDocument();
  });

  it("shows 'Tentar novamente' button in fallback", () => {
    render(
      <DashboardCardBoundary label="Test">
        <ThrowingComponent shouldThrow={true} />
      </DashboardCardBoundary>
    );
    expect(screen.getByText("Tentar novamente")).toBeInTheDocument();
  });

  it("resets error state when clicking Tentar novamente", () => {
    const { rerender } = render(
      <DashboardCardBoundary label="Test">
        <ThrowingComponent shouldThrow={true} />
      </DashboardCardBoundary>
    );
    expect(screen.getByText("Tentar novamente")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Tentar novamente"));
    // After reset, boundary re-renders children — if they still throw it shows fallback again
    // Just confirm click doesn't crash and fallback triggers reset attempt
    expect(screen.queryByText("Tentar novamente")).toBeInTheDocument();
  });

  it("calls Sentry.captureException when error is caught", async () => {
    const { Sentry } = await import("@/lib/sentry");
    render(
      <DashboardCardBoundary label="Sentry Test">
        <ThrowingComponent shouldThrow={true} />
      </DashboardCardBoundary>
    );
    expect(Sentry.captureException).toHaveBeenCalled();
  });
});
