import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mail transport selection and dispatch (decision #7 in
 * factory/work/user-accounts-auth/PLAN.md). `node:fs/promises` and
 * `resend` are mocked so this test never touches the real filesystem or
 * network, and RESEND_API_KEY is asserted to never appear in any logged
 * output (mailer.ts must never log it).
 */

const mkdirMock = vi.fn().mockResolvedValue(undefined);
const writeFileMock = vi.fn().mockResolvedValue(undefined);

vi.mock("node:fs/promises", () => {
  const fns = {
    mkdir: (...args: unknown[]) => mkdirMock(...args),
    writeFile: (...args: unknown[]) => writeFileMock(...args),
  };
  return { ...fns, default: fns };
});

const sendMock = vi.fn();
const ResendConstructorMock = vi.fn().mockImplementation(function (this: {
  emails: { send: typeof sendMock };
}) {
  this.emails = { send: sendMock };
});

vi.mock("resend", () => ({
  Resend: ResendConstructorMock,
}));

const TEST_ENV = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/test_db",
  DIRECT_URL: "postgresql://user:pass@localhost:5432/test_db",
  APP_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "a".repeat(32),
  NODE_ENV: "test",
} as const;

const FAKE_API_KEY = "re_test_super_secret_key_do_not_log";

const message = {
  to: "user@example.com",
  subject: "Test subject",
  html: "<p>hello</p>",
  text: "hello",
};

let consoleLogSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetModules();
  mkdirMock.mockClear();
  writeFileMock.mockClear();
  sendMock.mockReset().mockResolvedValue({ data: { id: "1" }, error: null });
  ResendConstructorMock.mockClear();
  for (const [key, value] of Object.entries(TEST_ENV)) {
    vi.stubEnv(key, value);
  }
  consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  consoleLogSpy.mockRestore();
  consoleErrorSpy.mockRestore();
});

describe("resolveMailTransport", () => {
  it("defaults to console when neither MAIL_TRANSPORT nor RESEND_API_KEY is set", async () => {
    const { resolveMailTransport } = await import("../mailer");
    expect(resolveMailTransport()).toBe("console");
  });

  it("uses resend when RESEND_API_KEY is set and no explicit override", async () => {
    vi.stubEnv("RESEND_API_KEY", FAKE_API_KEY);
    const { resolveMailTransport } = await import("../mailer");
    expect(resolveMailTransport()).toBe("resend");
  });

  it("an explicit MAIL_TRANSPORT override wins over RESEND_API_KEY presence", async () => {
    vi.stubEnv("RESEND_API_KEY", FAKE_API_KEY);
    vi.stubEnv("MAIL_TRANSPORT", "console");
    const { resolveMailTransport } = await import("../mailer");
    expect(resolveMailTransport()).toBe("console");
  });

  it("an explicit MAIL_TRANSPORT=file override is honored with no key set", async () => {
    vi.stubEnv("MAIL_TRANSPORT", "file");
    const { resolveMailTransport } = await import("../mailer");
    expect(resolveMailTransport()).toBe("file");
  });
});

describe("sendMail — console transport", () => {
  it("does not throw when no Resend key is configured", async () => {
    const { sendMail } = await import("../mailer");
    await expect(sendMail(message)).resolves.toBeUndefined();
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it("logs the recipient, subject, and body text", async () => {
    const { sendMail } = await import("../mailer");
    await sendMail(message);
    const loggedOutput = consoleLogSpy.mock.calls
      .map((call: unknown[]) => call.join(" "))
      .join("\n");
    expect(loggedOutput).toContain(message.to);
    expect(loggedOutput).toContain(message.subject);
    expect(loggedOutput).toContain(message.text);
  });
});

describe("sendMail — file transport", () => {
  it("writes a readable JSON message to the outbox directory", async () => {
    vi.stubEnv("MAIL_TRANSPORT", "file");
    const { sendMail } = await import("../mailer");
    await sendMail(message);

    expect(mkdirMock).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    expect(writeFileMock).toHaveBeenCalledTimes(1);

    const [, contents] = writeFileMock.mock.calls[0] as [string, string, string];
    const written = JSON.parse(contents);
    expect(written).toMatchObject(message);
    expect(written.sentAt).toEqual(expect.any(String));
  });
});

describe("sendMail — resend transport", () => {
  it("sends via the Resend SDK with the configured from address", async () => {
    vi.stubEnv("RESEND_API_KEY", FAKE_API_KEY);
    vi.stubEnv("EMAIL_FROM", "no-reply@example.com");
    const { sendMail } = await import("../mailer");
    await sendMail(message);

    expect(ResendConstructorMock).toHaveBeenCalledWith(FAKE_API_KEY);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "no-reply@example.com",
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    );
  });

  it("throws when Resend returns an error, without leaking the API key", async () => {
    vi.stubEnv("RESEND_API_KEY", FAKE_API_KEY);
    sendMock.mockResolvedValue({ data: null, error: { message: "invalid recipient" } });
    const { sendMail } = await import("../mailer");

    await expect(sendMail(message)).rejects.toThrow(/invalid recipient/);
  });

  it("never logs the Resend API key, on success or failure", async () => {
    vi.stubEnv("RESEND_API_KEY", FAKE_API_KEY);
    const { sendMail } = await import("../mailer");
    await sendMail(message);

    sendMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    await sendMail(message).catch(() => undefined);

    const allLoggedOutput = [...consoleLogSpy.mock.calls, ...consoleErrorSpy.mock.calls]
      .flat()
      .map((value) => String(value))
      .join("\n");
    expect(allLoggedOutput).not.toContain(FAKE_API_KEY);
  });
});

describe("templates", () => {
  it("verifyEmailTemplate includes the action URL in html and text", async () => {
    const { verifyEmailTemplate } = await import("../templates");
    const template = verifyEmailTemplate({
      name: "Ada",
      url: "https://example.com/verify?token=abc",
    });
    expect(template.html).toContain("https://example.com/verify?token=abc");
    expect(template.text).toContain("https://example.com/verify?token=abc");
  });

  it("resetPasswordTemplate includes the action URL and expiry wording", async () => {
    const { resetPasswordTemplate } = await import("../templates");
    const template = resetPasswordTemplate({
      name: "Ada",
      url: "https://example.com/reset?token=abc",
      expiresInMinutes: 60,
    });
    expect(template.html).toContain("https://example.com/reset?token=abc");
    expect(template.text).toContain("https://example.com/reset?token=abc");
    expect(template.html).toContain("60 minutes");
  });

  it("accountDeletedTemplate escapes a user-controlled name", async () => {
    const { accountDeletedTemplate } = await import("../templates");
    const template = accountDeletedTemplate({ name: "<script>alert(1)</script>" });
    expect(template.html).not.toContain("<script>alert(1)</script>");
    expect(template.html).toContain("&lt;script&gt;");
  });
});
