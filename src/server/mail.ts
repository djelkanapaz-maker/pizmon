import 'server-only';
import nodemailer from 'nodemailer';

export const mailConfigured = () => !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

/** Sends from the company Gmail (app password over SMTP). Returns false when not configured or on failure. */
export async function sendMail(msg: { to: string; subject: string; text: string; html: string; replyTo?: string }) {
  if (!mailConfigured()) return false;
  try {
    const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
    await t.sendMail({ from: `"${process.env.MAIL_FROM_NAME ?? 'ATISUTO'}" <${process.env.GMAIL_USER}>`, ...msg });
    return true;
  } catch { return false; }
}

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
