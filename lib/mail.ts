import "server-only";
import { spawn } from "node:child_process";

/*
 * Sends plain-text email through the hosting server's own sendmail, which cPanel
 * provides. No outside email service or extra package is needed.
 */
const SENDMAIL = process.env.SENDMAIL_PATH || "/usr/sbin/sendmail";
const FROM = process.env.MAIL_FROM || "NXTDOX <no-reply@nextdox.app>";

const clean = (value: string) => value.replace(/[\r\n]+/g, " ").trim();

export function sendMail({ to, subject, text }: { to: string; subject: string; text: string }): Promise<void> {
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to)) return Promise.reject(new Error("Invalid recipient."));
  const message = [
    `From: ${clean(FROM)}`,
    `To: ${clean(to)}`,
    `Subject: ${clean(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    text,
    "",
  ].join("\r\n");
  return new Promise((resolve, reject) => {
    const child = spawn(SENDMAIL, ["-t", "-i"], { stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve() : reject(new Error(`sendmail exited ${code}: ${stderr.slice(0, 200)}`)));
    child.stdin.end(message);
  });
}
