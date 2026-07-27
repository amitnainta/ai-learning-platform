import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignUpForm } from "../sign-up-form";

const signUpEmailMock = vi.fn().mockResolvedValue({ error: null });
const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    signUp: { email: (...args: unknown[]) => signUpEmailMock(...args) },
  },
}));

async function fillValidFieldsExceptAck(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Name"), "Ada Lovelace");
  await user.type(screen.getByLabelText("Email"), "ada@example.com");
  await user.type(screen.getByLabelText("Password"), "correct-horse-battery");
}

describe("SignUpForm", () => {
  it("every input has an associated label", () => {
    render(<SignUpForm />);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText(/I confirm I am 16 years of age or older/)).toBeInTheDocument();
  });

  it("blocks submission without the minimum-age acknowledgment and shows the error", async () => {
    const user = userEvent.setup();
    render(<SignUpForm />);

    await fillValidFieldsExceptAck(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByText(/confirm you meet the minimum age requirement/i),
    ).toBeInTheDocument();
    expect(signUpEmailMock).not.toHaveBeenCalled();
  });

  it("announces a short-password error via the aria-live region", async () => {
    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.type(screen.getByLabelText("Name"), "Ada Lovelace");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "short1234");
    await user.click(screen.getByLabelText(/I confirm I am 16 years of age or older/));
    await user.click(screen.getByRole("button", { name: /create account/i }));

    const error = await screen.findByText(/password must be at least 12 characters/i);
    expect(error).toHaveAttribute("aria-live", "polite");
    expect(signUpEmailMock).not.toHaveBeenCalled();
  });

  it("submits when every field is valid and the age acknowledgment is checked", async () => {
    const user = userEvent.setup();
    render(<SignUpForm />);

    await fillValidFieldsExceptAck(user);
    await user.click(screen.getByLabelText(/I confirm I am 16 years of age or older/));
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(signUpEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Ada Lovelace",
        email: "ada@example.com",
        password: "correct-horse-battery",
      }),
    );
  });
});
