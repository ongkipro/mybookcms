(() => {
  const tagName = "mybook-form-widget";
  if (window.customElements.get(tagName)) return;

  const scriptOrigin = (() => {
    try {
      return new URL(document.currentScript?.src || "", document.baseURI).origin;
    } catch {
      return "";
    }
  })();
  const snippetVersion = "3";

  class MyBookFormWidget extends HTMLElement {
    static observedAttributes = ["base-url", "product-id", "variant-id", "title"];

    #frame = null;
    #initializeTimer = 0;
    #onMessage = (event) => {
      if (!this.#frame || event.origin !== this.#baseOrigin() || event.source !== this.#frame.contentWindow || !event.data) return;
      if (event.data.type === "mybook:checkout-redirect") {
        const target = this.#checkoutTarget(event.data.url);
        if (target) window.location.assign(target);
        return;
      }
      if (event.data.type !== "mybook:embed-resize") return;
      const height = Number(event.data.height);
      if (!Number.isFinite(height)) return;
      const safeHeight = Math.max(480, Math.min(12000, height));
      this.#frame.style.height = `${safeHeight}px`;
      this.#frame.height = String(safeHeight);
    };

    connectedCallback() {
      this.style.display = "block";
      this.style.width = "100%";
      this.style.maxWidth = "100%";
      window.clearTimeout(this.#initializeTimer);
      this.#initializeTimer = window.setTimeout(() => this.isConnected && this.#initialize(), 0);
    }

    disconnectedCallback() {
      window.clearTimeout(this.#initializeTimer);
      window.removeEventListener("message", this.#onMessage);
    }

    attributeChangedCallback() {
      if (this.isConnected) this.#syncFrame();
    }

    #initialize() {
      const frames = [...this.querySelectorAll("iframe[data-mybook-form]")];
      this.#frame = frames.find((frame) => frame.id) || frames[0] || document.createElement("iframe");
      if (!this.#frame.isConnected) {
        this.#frame.dataset.mybookForm = "";
        this.append(this.#frame);
      }
      for (const frame of frames) if (frame !== this.#frame) frame.remove();
      Object.assign(this.#frame.style, { display: "block", width: "100%", maxWidth: "100%", minHeight: "720px", border: "0" });
      this.#frame.width = "100%";
      this.#frame.height ||= "1000";
      this.#frame.loading = "eager";
      this.#frame.referrerPolicy = "strict-origin-when-cross-origin";
      this.#frame.addEventListener("load", () => this.removeAttribute("aria-busy"), { once: true });
      this.setAttribute("aria-busy", "true");
      this.#syncFrame();
      window.addEventListener("message", this.#onMessage);
    }

    #baseOrigin() {
      try {
        return new URL(this.getAttribute("base-url")?.trim() || scriptOrigin, document.baseURI).origin;
      } catch {
        return "";
      }
    }

    #checkoutTarget(value) {
      try {
        const target = new URL(String(value || ""), this.#baseOrigin());
        return target.origin === this.#baseOrigin() && ["/payment", "/thanks"].includes(target.pathname) ? target.toString() : "";
      } catch {
        return "";
      }
    }

    #syncFrame() {
      if (!this.#frame) return;
      const origin = this.#baseOrigin();
      const productId = this.getAttribute("product-id")?.trim();
      const variantId = this.getAttribute("variant-id")?.trim();
      if (!origin || !productId) {
        this.#frame.removeAttribute("src");
        this.#frame.title = "Borang pesanan belum dikonfigurasi";
        this.removeAttribute("aria-busy");
        this.setAttribute("data-error", "invalid-configuration");
        return;
      }
      const url = new URL("/embed/form", origin);
      url.searchParams.set("product_id", productId);
      if (variantId) url.searchParams.set("variant_id", variantId);
      url.searchParams.set("v", snippetVersion);
      this.removeAttribute("data-error");
      this.#frame.title = this.getAttribute("title")?.trim() || "Borang pesanan produk";
      if (this.#frame.src !== url.toString()) this.#frame.src = url.toString();
    }
  }

  window.customElements.define(tagName, MyBookFormWidget);
})();
