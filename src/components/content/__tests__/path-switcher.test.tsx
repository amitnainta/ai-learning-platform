import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PathSwitcher } from "../path-switcher";

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

const ROLES = [
  { role: "TECHNICAL_BUILDER" as const, label: "Technical Builder" },
  { role: "EXECUTIVE_NON_TECHNICAL" as const, label: "Executive / Non-Technical" },
];

describe("PathSwitcher", () => {
  it("labels both the role and level selects", () => {
    render(
      <PathSwitcher
        roles={ROLES}
        currentRole="TECHNICAL_BUILDER"
        currentLevel="ZERO_KNOWLEDGE"
        isSignedIn={false}
      />,
    );

    expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/level/i)).toBeInTheDocument();
  });

  it("signed-in: submitting PATCHes /api/account/profile with the selected role and level, then navigates", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(
      <PathSwitcher
        roles={ROLES}
        currentRole="TECHNICAL_BUILDER"
        currentLevel="ZERO_KNOWLEDGE"
        isSignedIn
      />,
    );

    await user.selectOptions(screen.getByLabelText(/role/i), "EXECUTIVE_NON_TECHNICAL");
    await user.selectOptions(screen.getByLabelText(/level/i), "ADVANCED");
    await user.click(screen.getByRole("button", { name: /switch path/i }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account/profile",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ roleArchetype: "EXECUTIVE_NON_TECHNICAL", level: "ADVANCED" }),
      }),
    );
    expect(pushMock).toHaveBeenCalledWith("/paths/executive-non-technical/advanced");

    vi.unstubAllGlobals();
  });

  it("anonymous: submitting navigates without calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(
      <PathSwitcher
        roles={ROLES}
        currentRole="TECHNICAL_BUILDER"
        currentLevel="ZERO_KNOWLEDGE"
        isSignedIn={false}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/level/i), "INTERMEDIATE");
    await user.click(screen.getByRole("button", { name: /switch path/i }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith("/paths/technical-builder/intermediate");

    vi.unstubAllGlobals();
  });

  it("disables the submit button while the request is pending", async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(
      <PathSwitcher
        roles={ROLES}
        currentRole="TECHNICAL_BUILDER"
        currentLevel="ZERO_KNOWLEDGE"
        isSignedIn
      />,
    );

    const button = screen.getByRole("button", { name: /switch path/i });
    await user.click(button);

    expect(button).toBeDisabled();
    resolveFetch({ ok: true, json: async () => ({ success: true }) });

    vi.unstubAllGlobals();
  });
});
