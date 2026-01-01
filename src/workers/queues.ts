export const QUEUES = {
  pricingFetch: "pricing-fetch",
  pricingAggregate: "pricing-aggregate",
  alerts: "alerts",
  apiSync: "api-sync",
  providerUpdate: "provider-update",
  notifySlack: "slack",
  notifyEmail: "email",
  notifyWebhook: "webhook",
  maintenance: "maintenance",
  cleanup: "cleanup",
  browserScrape: "browser-scrape",
  screenshot: "screenshot",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
