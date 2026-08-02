import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteAccountForm } from "../delete-account-form";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const ACCOUNT_EMAIL = "ada@example.com";

describe("DeleteAccountForm", () => {
  it("keeps the confirm button disabled until the exact email is typed", async () => {
    const user = userEvent.setup();
    render(<DeleteAccountForm accountEmail={ACCOUNT_EMAIL} />);

    const button = screen.getByRole("button", { name: /permanently delete my account/i });
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText(/type/i), "ada@example.co");
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText(/type/i), "m");
    expect(button).toBeEnabled();
  });

  it("keeps the button disabled on a case mismatch", async () => {
    const user = userEvent.setup();
    render(<DeleteAccountForm accountEmail={ACCOUNT_EMAIL} />);

    await user.type(screen.getByLabelText(/type/i), "ADA@example.com");

    expect(screen.getByRole("button", { name: /permanently delete my account/i })).toBeDisabled();
  });

  it("keeps the button disabled on trailing whitespace", async () => {
    const user = userEvent.setup();
    render(<DeleteAccountForm accountEmail={ACCOUNT_EMAIL} />);

    await user.type(screen.getByLabelText(/type/i), "ada@example.com ");

    expect(screen.getByRole("button", { name: /permanently delete my account/i })).toBeDisabled();
  });

  it("submits the delete request once the exact email is typed and the button is clicked", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<DeleteAccountForm accountEmail={ACCOUNT_EMAIL} />);

    await user.type(screen.getByLabelText(/type/i), ACCOUNT_EMAIL);
    await user.click(screen.getByRole("button", { name: /permanently delete my account/i }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(pushMock).toHaveBeenCalledWith("/account-deleted");

    vi.unstubAllGlobals();
  });
});
