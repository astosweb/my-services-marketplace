import { Injectable, Logger } from "@nestjs/common";
import { env } from "../lib/env.js";
import { serviceUnavailable } from "../lib/errors.js";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendPasswordReset(recipient: string, token: string) {
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
      this.logger.warn("Password reset email is not configured");
      return;
    }

    const resetUrl = new URL(env.PASSWORD_RESET_URL);
    resetUrl.searchParams.set("token", token);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [recipient],
        subject: "Reset your Gobid password",
        text: `Use this link to reset your password: ${resetUrl.toString()}`,
      }),
      signal: AbortSignal.timeout(10_000),
    }).catch((error: unknown) => {
      this.logger.error({ error }, "Password reset email request failed");
      throw serviceUnavailable("Unable to send password reset email. Please try again later.");
    });

    if (!response.ok) {
      this.logger.error({ status: response.status }, "Password reset email was rejected");
      throw serviceUnavailable("Unable to send password reset email. Please try again later.");
    }
  }

  /** Best-effort transactional email for support events. Never throws to callers. */
  async sendSupportNotification(input: {
    recipient: string;
    subject: string;
    text: string;
  }) {
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
      this.logger.warn("Support email is not configured");
      return;
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: [input.recipient],
          subject: input.subject,
          text: input.text,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        this.logger.error({ status: response.status }, "Support email was rejected");
      }
    } catch (error: unknown) {
      this.logger.error({ error }, "Support email request failed");
    }
  }
}
