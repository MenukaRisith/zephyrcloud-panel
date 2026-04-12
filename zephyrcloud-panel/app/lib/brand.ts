export const BRAND_NAME = "GetAeon";
export const PANEL_NAME = `${BRAND_NAME} Panel`;
export const PANEL_HOST = "app.getaeon.co";
export const PANEL_URL = `https://${PANEL_HOST}`;
export const PANEL_DESCRIPTION =
  "Manage your websites, domains, and workspace access from one place.";

function isIpv4Address(value: string) {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value.trim());
}

export function pageTitle(page?: string) {
  return page ? `${page} | ${PANEL_NAME}` : PANEL_NAME;
}

export function resolveDnsTarget(request?: Request) {
  const configuredTarget = (process.env.PUBLIC_DNS_TARGET ?? "").trim();
  const configuredPanelUrl = (process.env.PUBLIC_PANEL_URL ?? PANEL_URL).trim();

  let fallbackTarget = PANEL_HOST;
  try {
    fallbackTarget = new URL(configuredPanelUrl).hostname || PANEL_HOST;
  } catch {
    if (request) {
      try {
        fallbackTarget = new URL(request.url).hostname || PANEL_HOST;
      } catch {
        fallbackTarget = PANEL_HOST;
      }
    }
  }

  const target = configuredTarget || fallbackTarget;

  return {
    value: target,
    recordType: isIpv4Address(target) ? "A" : "CNAME",
    isConfigured: configuredTarget.length > 0,
  };
}
