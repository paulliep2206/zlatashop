# Secure payment initiation

Status: Implemented

Parent: [001-virtual-products.md](001-virtual-products.md)

## Goal

Close existing cart-authorization and product-validation gaps before extending checkout.

## Current repository behavior

- The custom `/api/wayforpay/initiate` route accepts `cartID`, reads carts and products through the
  Local API without `overrideAccess: false`, and therefore currently bypasses collection access.
- The route re-prices products, but does not validate publication, `productType`, `stockStatus`, or
  sufficient `stock` before creating a WayForPay payment record.
- The installed ecommerce plugin supports guest-cart possession by placing the submitted `secret`
  in `req.context.cartSecret` (or `req.query.secret`) and enforcing cart access with
  `overrideAccess: false`. It generates a 40-character random hexadecimal secret when an unowned
  cart is created and returns it only in that creation response.
- This project does not currently enable the plugin's `allowGuestCarts` option, and the checkout
  initiation request does not submit a cart secret. The guest WayForPay end-to-end test is skipped.
  Consequently, authenticated physical checkout is the current executable path; guest physical
  checkout is documented in the README but is not currently enabled by the application.

## Authorization definitions

- A customer-owned cart has a non-null `customer`. Payment initiation is authorized only when the
  request's authenticated customer ID equals that relationship. A cart secret does not authorize a
  different customer to use a customer-owned cart. An admin session does not bypass this public
  endpoint rule.
- A guest cart has no `customer`. Possession means the request supplies the exact secret generated
  by the ecommerce plugin for that cart. The server passes that value only through
  `req.context.cartSecret` and reads the cart with `overrideAccess: false`; neither a cart ID, email,
  submitted customer ID, nor an authenticated session is possession proof.
- Missing carts, customer-owned carts requested by a non-owner, and guest carts requested without
  the matching secret all return the same `404` response body and create no payment. The response
  and logs do not disclose whether a cart or secret exists.

## Requirements

- Authenticated customers can initiate payment only for their own carts.
- Introduce guest physical checkout using the authorization definition above. Enable the plugin's
  guest-cart support, persist the plugin-generated secret in the checkout client, and submit it at
  payment initiation. A cart ID alone is insufficient.
- Virtual carts use the same server-verified guest cart-secret possession model in v1; authentication
  is not required and does not replace the cart secret.
- Add authoritative server-side rollout controls that default to rejecting virtual-only and mixed
  carts at payment initiation. The controls are enabled separately only by the rollout steps in
  001c and 001d; client UI state is never authoritative.
- Immediately before payment creation, the server re-reads and validates cart ownership, products,
  quantities, publication, availability, and prices.
- Product classification is derived from the current product record: `virtual` is virtual;
  `simple` and `configurable` are physical. A physical-only cart contains no virtual item, a
  virtual-only cart contains only virtual items, and a mixed cart contains both. Missing or unknown
  types are rejected.
- For existing physical products, preserve the storefront availability rule: the purchased product
  must not have `stockStatus: "out_stock"` and must have a positive `stock` quantity sufficient for
  the cart quantity.
- Use the ecommerce plugin's existing guest-cart secret as the possession proof for physical guest
  checkout. Pass it through request context and enforce cart access with `overrideAccess: false`;
  never accept a cart ID by itself as proof.
- User-scoped Local API calls enforce access control; privileged access is explicit.
- A checkout price is the server-side `specialPrice` when it is a number, otherwise the server-side
  `price`. It must be finite, strictly positive, and exactly convertible to positive integer minor
  units. Cart quantities must be positive safe integers.
- Generic denials create no WayForPay payment record.

## Acceptance criteria

- Given an authenticated customer's cart, when that customer initiates a valid physical payment,
  then one payment record is created from server-read products and prices.
- Given another customer's cart, a guest cart without its matching secret, or a guessed cart ID,
  when initiation is attempted, then the same generic denial is returned and no payment is created.
- Given a physical guest cart and its matching plugin-generated cart secret, when initiation is
  otherwise valid, then checkout succeeds using the existing physical contact, shipping, and Nova
  Poshta snapshots.
- Given a valid physical-only cart, when initiation is attempted without a valid customer email,
  first name, last name, phone, shipping address, or Nova Poshta selection, then no payment is
  created; when those fields and authorization are valid, existing physical WayForPay widget and
  payment snapshot behavior is preserved.
- Given a purchased or empty cart, invalid quantity or price, or a missing, unpublished, or
  unavailable physical product, when initiation is attempted, then no payment is created.
- Given client-supplied ownership, product type, price, publication, or availability values, when
  they disagree with server records, then the server values determine the result.
- Given either virtual rollout gate is disabled, when a corresponding cart is submitted, then the
  server rejects it before payment creation even when the guest supplies the correct cart secret.

## Out of scope

E-book storage, entitlement, download UI, and shipping changes.

## Rollout

No private-asset or entitlement dependency. Deploy and verify this security correction first with
both virtual gates disabled. The authorization, physical product validation, and disabled-by-default
gates have no schema dependency and can be deployed independently of `001a`–`001d`. Guest physical
checkout and its authorization regression coverage are part of this deployment.
