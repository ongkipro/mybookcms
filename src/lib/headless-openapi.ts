const errorResponse = (description: string) => ({
  description,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorEnvelope" },
    },
  },
});

const authenticatedErrors = {
  "401": { $ref: "#/components/responses/Unauthorized" },
  "403": { $ref: "#/components/responses/Forbidden" },
  "429": { $ref: "#/components/responses/RateLimited" },
  "503": { $ref: "#/components/responses/Unavailable" },
};

export const headlessOpenApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "MyBookCMS Headless API",
    version: "1.0.0",
    description: "Authenticated Malaysia storefront catalog, shipping quote, checkout, and order status API.",
  },
  servers: [{ url: "/api/v1", description: "Current MyBookCMS install" }],
  security: [{ appKeyAuth: [] }, { bearerAuth: [] }],
  tags: [
    { name: "Storefront" },
    { name: "Catalog" },
    { name: "Shipping" },
    { name: "Checkout" },
    { name: "Orders" },
    { name: "Contract" },
  ],
  paths: {
    "/storefront": {
      get: {
        operationId: "getStorefront",
        tags: ["Storefront"],
        summary: "Read storefront configuration and published content",
        "x-required-scope": "storefront:read",
        "x-api-operation": "storefrontRead",
        responses: {
          "200": {
            description: "Published storefront configuration",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/StorefrontEnvelope" },
              },
            },
          },
          "409": errorResponse("Storefront setup is incomplete"),
          "500": errorResponse("Storefront could not be loaded"),
          ...authenticatedErrors,
        },
      },
    },
    "/products": {
      get: {
        operationId: "listProducts",
        tags: ["Catalog"],
        summary: "List active products and variants",
        "x-required-scope": "catalog:read",
        "x-api-operation": "catalogList",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
          { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "category", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Catalog page",
            content: { "application/json": { schema: { $ref: "#/components/schemas/CatalogEnvelope" } } },
          },
          "500": errorResponse("Catalog could not be loaded"),
          ...authenticatedErrors,
        },
      },
    },
    "/products/{slug}": {
      get: {
        operationId: "getProduct",
        tags: ["Catalog"],
        summary: "Read one active product",
        "x-required-scope": "catalog:read",
        "x-api-operation": "catalogDetail",
        parameters: [
          { name: "slug", in: "path", required: true, schema: { type: "string", minLength: 1 } },
        ],
        responses: {
          "200": { description: "Product detail", content: { "application/json": { schema: { $ref: "#/components/schemas/ProductDetailEnvelope" } } } },
          "400": errorResponse("Product identity is missing"),
          "404": errorResponse("Product was not found"),
          "500": errorResponse("Product could not be loaded"),
          ...authenticatedErrors,
        },
      },
    },
    "/geo/districts": {
      get: {
        operationId: "searchDistricts",
        tags: ["Shipping"],
        summary: "Search the local Malaysia city, state, and postcode directory",
        "x-required-scope": "shipping:read",
        "x-api-operation": "districtSearch",
        parameters: [
          { name: "q", in: "query", required: true, schema: { type: "string", minLength: 3, maxLength: 80 } },
        ],
        responses: {
          "200": { description: "Malaysia location matches", content: { "application/json": { schema: { $ref: "#/components/schemas/DistrictSearchEnvelope" } } } },
          "500": errorResponse("Location search failed"),
          ...authenticatedErrors,
        },
      },
    },
    "/geo/shipping-rates": {
      get: {
        operationId: "quoteShippingByQuery",
        tags: ["Shipping"],
        summary: "Quote eligible shipping services using query parameters",
        "x-required-scope": "shipping:read",
        "x-api-operation": "shippingQuote",
        parameters: [
          { name: "postcode", in: "query", required: true, schema: { type: "string", pattern: "^[0-9]{5}$" } },
          { name: "variant_id", in: "query", schema: { type: "string" } },
          { name: "quantity", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
        ],
        responses: {
          "200": { description: "Eligible rates", content: { "application/json": { schema: { $ref: "#/components/schemas/ShippingQuoteEnvelope" } } } },
          "422": errorResponse("Postcode or weight rule is unavailable"),
          "404": errorResponse("Variant was not found"),
          "500": errorResponse("Quote failed"),
          ...authenticatedErrors,
        },
      },
      post: {
        operationId: "quoteShipping",
        tags: ["Shipping"],
        summary: "Quote eligible shipping services",
        "x-required-scope": "shipping:read",
        "x-api-operation": "shippingQuote",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ShippingQuoteRequest" } } },
        },
        responses: {
          "200": { description: "Eligible rates", content: { "application/json": { schema: { $ref: "#/components/schemas/ShippingQuoteEnvelope" } } } },
          "422": errorResponse("Postcode or weight rule is unavailable"),
          "404": errorResponse("Variant was not found"),
          "500": errorResponse("Quote failed"),
          ...authenticatedErrors,
        },
      },
    },
    "/checkout": {
      post: {
        operationId: "createCheckout",
        tags: ["Checkout"],
        summary: "Create an order from a server-quoted shipping service",
        "x-required-scope": "checkout:write",
        "x-api-operation": "checkoutCreate",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CheckoutRequest" } } },
        },
        responses: {
          "201": { description: "Order created", content: { "application/json": { schema: { $ref: "#/components/schemas/CheckoutEnvelope" } } } },
          "400": errorResponse("Request JSON is invalid"),
          "409": errorResponse("Submission token was already used"),
          "422": errorResponse("Checkout input or shipping selection is invalid"),
          "502": errorResponse("DOKU Checkout could not be initiated"),
          "500": errorResponse("Checkout failed"),
          ...authenticatedErrors,
        },
      },
    },
    "/orders/status": {
      post: {
        operationId: "getOrderStatus",
        tags: ["Orders"],
        summary: "Read order and payment status using the checkout-issued status token",
        "x-required-scope": "orders:read",
        "x-api-operation": "orderStatusRead",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/OrderStatusRequest" } } },
        },
        responses: {
          "200": { description: "Current order status", content: { "application/json": { schema: { $ref: "#/components/schemas/OrderStatusEnvelope" } } } },
          "400": errorResponse("Order identity or status token is missing"),
          "404": errorResponse("Order identity and token did not resolve"),
          "500": errorResponse("Order status could not be loaded"),
          ...authenticatedErrors,
        },
      },
    },
    "/openapi.json": {
      get: {
        operationId: "getOpenApiDocument",
        tags: ["Contract"],
        summary: "Read this OpenAPI document",
        "x-required-scope": "storefront:read",
        "x-api-operation": "openApiRead",
        responses: {
          "200": { description: "OpenAPI 3.1 document", content: { "application/json": { schema: { type: "object" } } } },
          ...authenticatedErrors,
        },
      },
    },
  },
  components: {
    securitySchemes: {
      appKeyAuth: { type: "apiKey", in: "header", name: "X-App-Key" },
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "API key" },
    },
    responses: {
      Unauthorized: errorResponse("API key is missing, invalid, or revoked"),
      Forbidden: errorResponse("API key scope or browser origin is not allowed"),
      RateLimited: errorResponse("Per-minute rate limit or daily quota is exhausted"),
      Unavailable: errorResponse("Required API policy or data store is unavailable"),
    },
    schemas: {
      ErrorEnvelope: {
        type: "object",
        additionalProperties: false,
        required: ["success", "timestamp", "error"],
        properties: {
          success: { const: false },
          timestamp: { type: "string", format: "date-time" },
          error: {
            type: "object",
            required: ["message", "code"],
            properties: {
              message: { type: "string" },
              code: { type: "string" },
            },
            additionalProperties: true,
          },
        },
      },
      StorefrontEnvelope: {
        type: "object",
        required: ["success", "timestamp", "storefront", "content", "payment"],
        properties: {
          success: { const: true },
          timestamp: { type: "string", format: "date-time" },
          storefront: { type: "object" },
          content: { type: "object" },
          // Described rather than left as a bare object: a consumer that
          // hard-codes the method list gets it wrong the moment an operator
          // enables DOKU, which is exactly what happened before A-231.
          payment: {
            type: "object",
            required: ["cod_enabled", "supported_methods"],
            properties: {
              cod_enabled: { type: "boolean" },
              supported_methods: {
                type: "array",
                items: { type: "string", enum: ["cod", "manual_transfer", "doku"] },
              },
              doku_channels: {
                type: "array",
                description:
                  "Allowlisted Malaysia channel labels for the enabled DOKU configuration. Empty when DOKU is not enabled. Carries no credential, environment, or configuration revision.",
                items: {
                  type: "object",
                  required: ["code", "label"],
                  properties: {
                    code: { type: "string" },
                    label: { type: "string" },
                  },
                },
              },
              doku_requires_email: { type: "boolean" },
            },
          },
        },
      },
      ProductVariant: {
        type: "object",
        required: ["id", "label", "price", "compare_price"],
        properties: {
          id: { type: ["string", "integer"] },
          label: { type: "string" },
          price: { type: "number" },
          compare_price: { type: "number" },
        },
      },
      ProductSummary: {
        type: "object",
        required: ["id", "slug", "name", "price", "variants", "form"],
        properties: {
          id: { type: ["string", "integer"] },
          slug: { type: "string" },
          name: { type: "string" },
          category: { type: "string" },
          headline: { type: "string" },
          subheadline: { type: "string" },
          price: { type: "number" },
          compare_price: { type: "number" },
          image: { type: "string" },
          hero_image: { type: "string" },
          rating_value: { type: "number" },
          review_count: { type: "integer" },
          sold_count: { type: "integer" },
          variants: { type: "array", items: { $ref: "#/components/schemas/ProductVariant" } },
          form: { $ref: "#/components/schemas/CheckoutForm" },
          urls: {
            type: "object",
            description: "Backward-compatible non-mode aliases for v1 clients.",
            required: ["product", "form_render"],
            properties: {
              product: { type: "string" },
              form_render: { type: "string", description: "Alias of form.render_url." },
            },
            additionalProperties: false,
          },
        },
      },
      CatalogEnvelope: {
        type: "object",
        required: ["success", "timestamp", "total", "limit", "offset", "has_more", "products"],
        properties: {
          success: { const: true },
          timestamp: { type: "string", format: "date-time" },
          total: { type: "integer" },
          limit: { type: "integer" },
          offset: { type: "integer" },
          has_more: { type: "boolean" },
          products: { type: "array", items: { $ref: "#/components/schemas/ProductSummary" } },
        },
      },
      ProductDetail: {
        allOf: [
          { $ref: "#/components/schemas/ProductSummary" },
          {
            type: "object",
            required: ["description", "benefits", "key_points", "ideal_for", "offer_text", "cta_text", "reviews", "forms"],
            properties: {
              tag: { type: "string" },
              seo_title: { type: "string" },
              seo_description: { type: "string" },
              description: { type: "string" },
              benefits: { type: "array", items: { type: "string" } },
              key_points: { type: "array", items: { type: "string" } },
              ideal_for: { type: "array", items: { type: "string" } },
              offer_text: { type: "string" },
              cta_text: { type: "string" },
              reviews: {
                type: "array",
                items: {
                  type: "object",
                  required: ["name", "location", "avatar", "verified", "date", "comment", "rating"],
                  properties: {
                    name: { type: "string" },
                    location: { type: "string" },
                    avatar: { type: "string" },
                    verified: { type: "boolean" },
                    date: { type: "string" },
                    comment: { type: "string" },
                    rating: { type: "number" },
                  },
                },
              },
              forms: {
                type: "object",
                description: "Backward-compatible full-checkout alias for v1 clients.",
                required: ["full_url"],
                properties: {
                  full_url: { type: "string", description: "Alias of form.render_url." },
                },
                additionalProperties: false,
              },
            },
          },
        ],
      },
      CheckoutForm: {
        type: "object",
        required: ["render_url", "embed_url"],
        properties: {
          render_url: { type: "string" },
          embed_url: { type: "string" },
        },
        additionalProperties: false,
      },
      RelatedProduct: {
        type: "object",
        required: ["id", "slug", "name", "price", "compare_price", "image"],
        properties: {
          id: { type: ["string", "integer"] },
          slug: { type: "string" },
          name: { type: "string" },
          price: { type: "number" },
          compare_price: { type: "number" },
          image: { type: "string" },
        },
      },
      ProductDetailEnvelope: {
        type: "object",
        required: ["success", "timestamp", "product", "related_products"],
        properties: {
          success: { const: true },
          timestamp: { type: "string", format: "date-time" },
          product: { $ref: "#/components/schemas/ProductDetail" },
          related_products: { type: "array", items: { $ref: "#/components/schemas/RelatedProduct" } },
        },
      },
      District: {
        type: "object",
        required: ["id", "district", "city", "province", "postcode", "label"],
        properties: {
          id: { type: "integer" },
          district: { type: "string" },
          city: { type: "string" },
          province: { type: "string" },
          postcode: { type: "string", pattern: "^[0-9]{5}$" },
          zone_code: { type: "string" },
          zone_name: { type: "string" },
          label: { type: "string" },
        },
      },
      DistrictSearchEnvelope: {
        type: "object",
        required: ["success", "timestamp", "query", "locations", "postcodes"],
        properties: {
          success: { const: true },
          timestamp: { type: "string", format: "date-time" },
          query: { type: "string" },
          locations: { type: "array", items: { $ref: "#/components/schemas/District" } },
          postcodes: { type: "array", items: { $ref: "#/components/schemas/District" } },
        },
      },
      ShippingQuoteRequest: {
        type: "object",
        required: ["postcode", "variant_id", "quantity"],
        properties: {
          postcode: { type: "string", pattern: "^[0-9]{5}$" },
          variant_id: { type: ["string", "integer"] },
          quantity: { type: "integer", minimum: 1 },
        },
      },
      ShippingRate: {
        type: "object",
        required: ["rate_rule_id", "name", "amount_sen"],
        properties: {
          rate_rule_id: { type: "integer" },
          name: { type: "string" },
          amount_sen: { type: "integer", minimum: 0 },
        },
      },
      ShippingQuoteEnvelope: {
        type: "object",
        required: ["success", "timestamp", "postcode", "currency", "zone_code", "rates"],
        properties: {
          success: { const: true },
          timestamp: { type: "string", format: "date-time" },
          postcode: { type: "string" },
          currency: { const: "MYR" },
          zone_code: { type: "string" },
          rates: { type: "array", items: { $ref: "#/components/schemas/ShippingRate" } },
        },
      },
      CheckoutRequest: {
        type: "object",
        required: ["customer_name", "customer_phone", "address", "district", "province", "postal_code", "payment_method", "variant_id", "quantity", "submit_token"],
        allOf: [{
          if: {
            properties: { payment_method: { const: "doku" } },
            required: ["payment_method"],
          },
          then: { required: ["customer_email", "doku_channel"] },
        }],
        properties: {
          customer_name: { type: "string", minLength: 2, maxLength: 100, description: "Unicode letters, spaces, apostrophes, full stops, and hyphens only." },
          customer_phone: { type: "string" },
          customer_email: { type: "string", format: "email", maxLength: 160 },
          address: { type: "string", minLength: 10, maxLength: 500, description: "Complete delivery address containing a street or area name." },
          city: { type: "string", maxLength: 120 },
          district: { type: "string", minLength: 2, maxLength: 120 },
          province: { type: "string", minLength: 2, maxLength: 120 },
          postal_code: { type: "string", pattern: "^[0-9]{5}$" },
          payment_method: { type: "string", enum: ["cod", "manual_transfer", "doku"] },
          doku_channel: {
            type: "string",
            enum: ["INTERNET_BANKING_FPX", "EWALLET_TNG", "EWALLET_GRABPAY", "EWALLET_SHOPEEPAY", "CREDIT_CARD"],
            description: "Required when payment_method is doku. Must be advertised by GET /api/v1/storefront for this install.",
          },
          seller_bank_account_id: { type: "integer", minimum: 1 },
          variant_id: { type: ["string", "integer"] },
          quantity: { type: "integer", minimum: 1, maximum: 100 },
          submit_token: { type: "string", minLength: 16, maxLength: 120 },
          website: { type: "string", maxLength: 0 },
        },
      },
      CheckoutOrder: {
        type: "object",
        required: ["id", "order_number", "public_status_token", "total_amount", "shipping_amount", "currency"],
        properties: {
          id: { type: ["integer", "string"] },
          order_number: { type: "string" },
          public_status_token: { type: "string" },
          total_amount: { type: "number" },
          shipping_amount: { type: "number" },
          currency: { const: "MYR" },
          seller_bank_name: { type: ["string", "null"] },
          seller_account_holder: { type: ["string", "null"] },
          seller_account_number: { type: ["string", "null"] },
        },
      },
      CheckoutEnvelope: {
        type: "object",
        required: ["success", "timestamp", "order"],
        properties: {
          success: { const: true },
          timestamp: { type: "string", format: "date-time" },
          order: { $ref: "#/components/schemas/CheckoutOrder" },
          payment: { $ref: "#/components/schemas/DokuCheckoutPayment" },
        },
      },
      DokuCheckoutPayment: {
        type: "object",
        additionalProperties: false,
        required: ["provider", "checkout_url", "expires_at", "status", "state"],
        properties: {
          provider: { const: "doku" },
          checkout_url: { type: "string", format: "uri", pattern: "^https://[^/]*doku\\.com/" },
          expires_at: { type: "string", format: "date-time" },
          status: { type: "string" },
          state: { type: "string" },
        },
      },
      OrderStatusRequest: {
        type: "object",
        additionalProperties: false,
        required: ["order_number", "status_token"],
        properties: {
          order_number: { type: "string", minLength: 1 },
          status_token: { type: "string", minLength: 1 },
        },
      },
      PaymentStatus: {
        type: ["object", "null"],
        properties: {
          bank_code: { type: "string" },
          status: { type: "string" },
          amount: { type: "number" },
          total_amount: { type: "number" },
          account_number: { type: ["string", "null"] },
          account_holder: { type: ["string", "null"] },
          bank_name: { type: ["string", "null"] },
          manual_transfer: { type: "boolean" },
        },
      },
      OrderStatus: {
        type: "object",
        required: ["is_paid", "order_number", "payment_method", "payment_status", "status", "total_amount", "product_value_myr", "content_ids", "content_name", "payment"],
        properties: {
          is_paid: { type: "boolean" },
          order_number: { type: "string" },
          payment_method: { type: "string" },
          payment_status: { type: "string" },
          status: { type: "string" },
          total_amount: { type: "number" },
          product_value_myr: { type: "number", minimum: 0 },
          content_ids: {
            type: "array",
            items: { type: "string", pattern: "^p[1-9][0-9]*-v[1-9][0-9]*$" },
          },
          content_name: { type: "string" },
          payment: { $ref: "#/components/schemas/PaymentStatus" },
        },
      },
      OrderStatusEnvelope: {
        type: "object",
        required: ["success", "timestamp", "order"],
        properties: {
          success: { const: true },
          timestamp: { type: "string", format: "date-time" },
          order: { $ref: "#/components/schemas/OrderStatus" },
        },
      },
    },
  },
} as const;
