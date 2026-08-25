export const CHECKOUT_REDIRECT_MESSAGE = "mybook:checkout-redirect";

function getParentOrigin() {
  try {
    return document.referrer ? new URL(document.referrer).origin : "";
  } catch {
    return "";
  }
}


export function navigateAfterCheckout(destination: string) {
  const targetUrl = new URL(destination, window.location.href);
  const isCheckoutCompletion =
    targetUrl.pathname === "/thanks" || targetUrl.pathname === "/payment";

  if (isCheckoutCompletion) {
    targetUrl.search = "";
  }

  const target = targetUrl.toString();

  if (typeof window !== "undefined" && window.parent !== window) {
    const parentOrigin = getParentOrigin();
    if (parentOrigin) {
      window.parent.postMessage(
        {
          type: CHECKOUT_REDIRECT_MESSAGE,
          url: target,
        },
        parentOrigin,
      );
    }

    try {
      if (window.top) {
        window.top.location.assign(target);
        return;
      }
    } catch {
      // A sandboxed or cross-origin iframe must fall back to frame navigation if top window navigation is blocked.
    }
    window.location.assign(target);
    return;
  }

  if (typeof window !== "undefined") {
    window.location.assign(target);
  }
}
