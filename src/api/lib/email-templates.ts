export type Locale = "en" | "zh";

type EmailTemplate = {
  subject: string;
  text: string;
  html: string;
};

type TemplateArgs = {
  brandName: string;
  actionUrl: string;
  supportUrl: string;
  preferencesUrl: string;
  locale: Locale;
};

const copy = {
  en: {
    footer: "You’re receiving this because you requested an account action at CloudGPUs.io.",
    manage: "Manage email preferences",
    help: "Help center",
    ignore: "If you didn’t request this, you can safely ignore this email.",
    verify: {
      subject: "Verify your CloudGPUs.io email",
      title: "Verify your email",
      body: "Click the button below to verify your email address.",
      cta: "Verify email",
      note: "This link expires in 24 hours.",
    },
    reset: {
      subject: "Reset your CloudGPUs.io password",
      title: "Reset your password",
      body: "Click the button below to reset your password.",
      cta: "Reset password",
      note: "This link expires in 1 hour.",
    },
    magic: {
      subject: "Your CloudGPUs.io magic login link",
      title: "Magic login",
      body: "Use the link below to sign in without a password.",
      cta: "Sign in",
      note: "This link expires in 24 hours.",
    },
  },
  zh: {
    footer: "你收到这封邮件是因为你在 CloudGPUs.io 发起了账户相关操作。",
    manage: "管理邮件偏好",
    help: "帮助中心",
    ignore: "如果不是你本人操作，请忽略此邮件。",
    verify: {
      subject: "验证你的 CloudGPUs.io 邮箱",
      title: "验证邮箱",
      body: "点击下方按钮完成邮箱验证。",
      cta: "验证邮箱",
      note: "该链接 24 小时内有效。",
    },
    reset: {
      subject: "重置 CloudGPUs.io 密码",
      title: "重置密码",
      body: "点击下方按钮重置密码。",
      cta: "重置密码",
      note: "该链接 1 小时内有效。",
    },
    magic: {
      subject: "你的 CloudGPUs.io 一键登录链接",
      title: "一键登录",
      body: "使用以下链接免密登录。",
      cta: "登录",
      note: "该链接 24 小时内有效。",
    },
  },
};

export function resolveLocale(acceptLanguage?: string | string[] | null): Locale {
  const raw = Array.isArray(acceptLanguage) ? acceptLanguage.join(",") : (acceptLanguage ?? "");
  return raw.toLowerCase().includes("zh") ? "zh" : "en";
}

function renderHtml(args: TemplateArgs, content: typeof copy.en.verify): string {
  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background:#f5f6f8; padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px;border:1px solid #e6e8ec;">
      <h1 style="margin:0 0 12px;font-size:22px;">${content.title}</h1>
      <p style="margin:0 0 16px;color:#333;line-height:1.6;">${content.body}</p>
      <p style="margin:0 0 24px;">
        <a href="${args.actionUrl}" style="display:inline-block;background:#0b1220;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">${content.cta}</a>
      </p>
      <p style="margin:0 0 16px;color:#666;font-size:14px;">${content.note}</p>
      <p style="margin:0 0 24px;color:#666;font-size:14px;">${copy[args.locale].ignore}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
      <p style="margin:0 0 6px;color:#666;font-size:13px;">${copy[args.locale].footer}</p>
      <p style="margin:0; font-size:13px;">
        <a href="${args.preferencesUrl}" style="color:#0b5fff; text-decoration:none;">${copy[args.locale].manage}</a>
        ·
        <a href="${args.supportUrl}" style="color:#0b5fff; text-decoration:none;">${copy[args.locale].help}</a>
      </p>
    </div>
  </div>
  `.trim();
}

function renderText(args: TemplateArgs, content: typeof copy.en.verify): string {
  return [
    `${content.title} - ${args.brandName}`,
    "",
    content.body,
    args.actionUrl,
    "",
    content.note,
    "",
    copy[args.locale].ignore,
    "",
    copy[args.locale].footer,
    `${copy[args.locale].manage}: ${args.preferencesUrl}`,
    `${copy[args.locale].help}: ${args.supportUrl}`,
  ].join("\n");
}

export function buildAuthEmail(
  type: "verify" | "reset" | "magic",
  args: TemplateArgs,
): EmailTemplate {
  const content = copy[args.locale][type];
  return {
    subject: content.subject,
    text: renderText(args, content),
    html: renderHtml(args, content),
  };
}
