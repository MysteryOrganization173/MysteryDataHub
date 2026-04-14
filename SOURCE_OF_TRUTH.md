## Backend Source Of Truth

The production backend runtime starts from `Backend/src/server.js`.

These files are the live integration anchors for launch work:

- `Backend/src/controllers/payment.controller.js`
- `Backend/src/services/fulfillment.service.js`
- `Backend/src/services/catalog.service.js`
- `Backend/src/services/agent-accounting.service.js`
- `Backend/src/middleware/auth.middleware.js`
- `Backend/src/controllers/agent.controller.js`
- `Backend/src/controllers/admin.controller.js`

Keep changes additive around those files.

Do not replace the existing Paystack, webhook, order verification, or Success Biz Hub fulfillment path with a parallel flow.

Legacy files that are not the primary runtime:

- `Backend/server.js`
- `Frontend/script.js`

The active customer flow is driven by:

- `Frontend/index.html`
- `Frontend/catalog-runtime.js`
- `Frontend/success.html`
- `Frontend/track-order.html`

The active agent/admin flow is driven by:

- `Frontend/agent-api.js`
- `Frontend/agent-portal.html`
- `Frontend/agent-portal.js`
- `Frontend/admin.html`
