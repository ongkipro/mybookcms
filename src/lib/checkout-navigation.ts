export const CHECKOUT_REDIRECT_MESSAGE = "mybook:checkout-redirect";

function getParentOrigin() {
  try {
    return document.referrer ? new URL(document.referrer).origin : "";
  } catch {
    return "";
  }
}

export function isSafeDokuCheckoutUrl(value: string) {
  try {
    const target = new URL(value);
    return target.protocol === "https:" &&
      !target.username &&
      !target.password &&
      (target.hostname === "doku.com" || target.hostname.endsWith(".doku.com"));
  } catch {
    return false;
  }
}

function navigateTopLevel(target: string) {
  if (window.parent !== window) {
    const parentOrigin = getParentOrigin();
    if (parentOrigin) {
      window.parent.postMessage({ type: CHECKOUT_REDIRECT_MESSAGE, url: target }, parentOrigin);
    }
    try {
      if (window.top) {
        window.top.location.assign(target);
        return;
      }
    } catch {
      // A sandboxed or cross-origin iframe delegates to the origin-checked widget.
    }
  }
  window.location.assign(target);
}

export function navigateToDokuCheckout(destination: string) {
  if (!isSafeDokuCheckoutUrl(destination)) return false;
  navigateTopLevel(new URL(destination).toString());
  return true;
}


export function navigateAfterCheckout(destination: string) {
  const targetUrl = new URL(destination, window.location.href);
  const isCheckoutCompletion =
    targetUrl.pathname === "/thanks" || targetUrl.pathname === "/payment";

  if (isCheckoutCompletion) {
    targetUrl.search = "";
  }

  const target = targetUrl.toString();

  if (typeof window !== "undefined") navigateTopLevel(target);
}
