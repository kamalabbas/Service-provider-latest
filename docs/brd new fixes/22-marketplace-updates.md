# 22 — Frontend integration for discovery, paid cards and price lists

Verified against the current compiled API on **7 November 2026**. Pair this with
[BRD 18 payments](21-payments.md), including V037 automatic inspection refunds.
These guides define the updated flows for the affected screens. The handbook's
file numbers are document order, so this BRD 19 frontend guide is file 22.

Use the configurable DEV API origin `https://dev-api-sp.auete.store`, the normal
Bearer JWT and shared `data` response envelope. Dates represent UTC instants.
The generated reference below supplies current endpoints, fields and examples.

## Screens, access and monetary units

| Screen/action | Endpoint | Member access |
|---|---|---|
| Nearby search | GET `/api/services/search` | Full access and `services.view`. |
| Global list | GET `/api/price-catalogue` | `price-catalogue.view` and active price-list benefit. |
| Current private list | GET `/api/provider-prices/current` | `prices.view`, eligible Tradeperson, completed profile and active business. |
| Submit/edit/restore custom price | POST `/api/provider-prices`, PUT `/{id}`, POST `/{id}/restore` | `prices.manage` plus ownership, eligibility, year and range checks. |
| Withdraw custom price | POST `/api/provider-prices/{id}/withdraw` | `prices.delete` and applicable owner/history rules. |
| Card fee, free units, requests and refunds | GET `/api/card-requests/allowances`, `/me`, `/refunds` | `card-requests.view`. |
| Start personal/employee/replacement card request | POST `/api/card-requests/checkout` | `card-requests.manage`; employee requests also require `employees.manage` and Tradeperson eligibility. |
| Cancel own pending card request | POST `/api/card-requests/{requestId}/cancel` | `card-requests.delete`. |
| Poll/resume card payment | GET `/api/payments/operations/{id}` | `payments.view`. |
| Settings, overrides, grants, another provider's private list and all-user card refunds | `/api/admin/marketplace/...` | SuperAdmin role. |
| Catalogue administration | `/api/admin/price-catalogue/...` | SuperAdmin or Tradeperson with the corresponding catalogue permission. |

Ordinary card/provider screens require full access. Billing operation reads
support the limited access described in BRD 18. `.view`, `.manage` and `.delete`
are independent permissions.

| Values | Representation | Display |
|---|---|---|
| Card/subscription/confirmation fees and refund `amountMinor` | Integer AUD cents | `1200` is AUD 12.00. |
| Catalogue `price`, Guide, Min/Max, provider custom prices and overrides | Decimal AUD | `120.5` is AUD 120.50. |
| Complimentary card/inspection units | Integer count in its own ledger | `2` means two uses of that feature. |
| Search radius | Kilometres | `50` is 50 km. |

## Search uses the server radius

Remove the radius input and query parameter. Send location plus optional
membership/occupation filters.

```http
GET /api/services/search?latitude=-33.8688&longitude=151.2093&occupationCode=electrical_services&page=1&pageSize=20
```

Coordinates-only search is supported. Both filters apply when supplied together.
Results remain distance ordered and paged. If location access is denied, offer
another location input. Responses contain `items`, `page`, `pageSize`, `hasMore`.
They do not contain a member-visible radius setting. Avoid a fixed "within
50 km" label because SuperAdmin can change that value.

SuperAdmin reads/updates GET/PUT `/api/admin/marketplace/settings`. Radius starts
at 50 km, must be at least 1 km and has no 500 km business cap. It is a finite
decimal value. New searches immediately use the saved radius.

Discoverable listings require the provider subscription from BRD 18. Their owner
can maintain eligible listings while unsubscribed. Search shows currently
discoverable services.

## Global price-list screen

Load GET `/api/price-catalogue` and GET `/api/price-catalogue/{itemId}` for
ordinary subscriber views. Both BRD 18 plans grant price-list access. Display
the returned decimal AUD `price`.

An illustrative item from a Global response is shown below.

```json
{
  "id": 501,
  "code": "ELECTRICAL_CHECK",
  "occupationCode": "electrical_services",
  "occupationName": "Electrical services",
  "name": "Electrical safety check",
  "description": "Standard safety check guidance.",
  "currencyCode": "AUD",
  "price": 103.33,
  "status": "published",
  "publishedAtUtc": "2026-11-07T09:00:00Z",
  "retiredAtUtc": null,
  "createdAtUtc": "2026-11-07T08:00:00Z",
  "updatedAtUtc": "2026-11-07T09:00:00Z"
}
```

Ordinary Global responses omit `guidePrice`, `minProviderPrice`,
`maxProviderPrice`, `providerAveragePrice`, `providerSubmissionCount` and
`globalOverride`, including for subscribed Tradepeople. Handle those fields as
absent. Pricing inputs come from authorized private/admin views.

The server calculates one contribution per eligible business/item. Eligibility
requires an active account, completed Tradeperson profile, active business and
matching active service. A provider subscription is not required to contribute.
The effective contribution is the latest active custom annual price, or current
Guide when none exists or the latest is withdrawn. Multiple matching listings
give the business one contribution.

The displayed price is the admin override when set, otherwise the calculated
average, otherwise Guide when there are no contributors. Guide changes update
default contributions immediately. Explicit custom prices retain their amounts.
Display the server calculation across all contributors, independent of pagination.

## Tradeperson's private price-list screen

Use GET `/api/provider-prices/current?page=1&pageSize=20` for the main private
screen. It returns published items matching active service occupations. Use
GET `/api/provider-prices/me` and submission/history routes for annual records
and authorized history of archived businesses.

```json
{
  "id": 501,
  "code": "ELECTRICAL_CHECK",
  "name": "Electrical safety check",
  "description": "Standard safety check guidance.",
  "occupationCode": "electrical_services",
  "occupationName": "Electrical services",
  "currencyCode": "AUD",
  "guidePrice": 100,
  "minProviderPrice": 80,
  "maxProviderPrice": 150,
  "effectivePrice": 100,
  "priceSource": "guide",
  "submissionId": null,
  "calendarYear": null,
  "withdrawnAtUtc": null
}
```

Row `id` is the catalogue item ID. `submissionId` is an annual custom-price
record ID. POST uses the item ID; edits/withdrawal/restore use the submission
ID. A withdrawn latest submission can still have an ID. Display `priceSource`
and `effectivePrice` when deciding whether the current amount is custom or Guide.

| Action | API/payload | Rule |
|---|---|---|
| Submit this year's price | POST `/api/provider-prices`, with `itemId`, `price` | Server chooses UTC year. One business/item/year record. |
| Edit current-year price | PUT `/api/provider-prices/{submissionId}`, with `price` | Published item, current range, eligible owner. |
| Withdraw | POST `/api/provider-prices/{submissionId}/withdraw`, no body | Latest withdrawal restores Guide. A latest older-year price can also be withdrawn. |
| Restore current-year record | POST `/api/provider-prices/{submissionId}/restore`, with `price` | Current published-item/range checks. |
| Submit in a later UTC year | POST another annual record | Previous amounts stay immutable. Latest prior custom price remains effective until replaced/withdrawn. |
| Suggest a catalogue item | POST `/api/provider-prices/item-requests` | Occupation, proposed name/description and optional suggested price. Existing review/publish flow. |

An existing custom amount can remain effective outside a newly narrowed range.
Display it, but validate new amounts/restores against current Min/Max. Retired
items block edits/restores and allow withdrawal. Authorized historical records
remain readable after archival/type changes. A Global override leaves private
effective prices intact.

SuperAdmin reads another Tradeperson's current list through
GET `/api/admin/marketplace/users/{userId}/price-list`.

## Global overrides and catalogue administration

SuperAdmin sets and clears through the same endpoint.

```http
PUT /api/admin/marketplace/global-prices/501/override
Content-Type: application/json
```

```json
{ "price": 110.00, "reason": "Reviewed current market guidance." }
```

```json
{ "price": null, "reason": "Return to the current calculated price." }
```

An override is a positive AUD amount with up to two decimals and may lie outside
provider Min/Max. On the SuperAdmin screen, show it separately from Guide and
calculated average. Clearing uses the then-current backend calculation.

Catalogue management is for SuperAdmin or permitted Tradepeople.
`price-catalogue-admin.view` permits management reads, `price-catalogue.manage`
permits create/edit/publish, and `price-catalogue.delete` permits retirement.
Min/Max/Guide are available in those authorized management screens.
Ordinary subscriber endpoints retain their reduced Global projection.

## Starting a paid or complimentary physical-card request

Read GET `/api/card-requests/allowances`. It returns `available`, `cardFeeMinor`,
`cardRequestsEnabled` and unit history in `allowances`. Show a pause when disabled,
including requests using a free unit. The configured all-inclusive fee covers
personal, employee and replacement requests.

An available card allowance automatically funds the next eligible request.
Card allowances and inspection confirmations have separate endpoints/balances.
Paid requests use BRD 18's Checkout lifecycle. A card request appears only after
verified payment or free-unit allocation.

```http
POST /api/card-requests/checkout
Content-Type: application/json
```

```json
{
  "requestId": "33333333-3333-4333-8333-333333333333",
  "streetAddress": "10 Example Street",
  "suburb": "Sydney",
  "regionCode": "NSW",
  "postalCode": "2000",
  "consentAccepted": true
}
```

| Kind | Additional input |
|---|---|
| First personal card | Omit employee/replacement fields. |
| First employee card | Set active owned `employeeId`. |
| Personal replacement | Set `previousCardId`, `replacementReason`. |
| Employee replacement | Set matching `employeeId`, `previousCardId`, `replacementReason`. |

Prefill postal address, or primary address where appropriate, and allow editing.
Submit all four delivery fields. The backend snapshots them. Replacements need
a previously received card and valid `expired`, `damaged` or `lost` reason.
Expiry replacement opens 30 days before expiry and remains available afterward.
Damaged/lost replacement applies to a current received card. Duplicate open
requests/Checkouts for the subject are rejected.

For loss, obtain explicit user confirmation, then POST
`/api/card-requests/cards/{cardId}/report-lost` with no body. It immediately
invalidates the old card. Then start replacement Checkout. The loss remains
recorded if payment fails/is abandoned. A damaged card stays valid until
replacement receipt or natural expiry.

| Operation outcome | Frontend behavior |
|---|---|
| `succeeded` and `cardRequestId` | Fetch request, show pending approval and refresh allowance balance. |
| `queued`, `processing`, `requires_action` | Poll `/api/payments/operations/{id}` and follow returned Checkout URL. |
| `succeeded`, `refundRequired: true`, no request ID | Explain failed creation after payment and automatic full refund. |
| `failed`, `review_required` | Preserve UUID and show recovery state. |

A free unit requires no saved payment method. Charging requires explicit
`consentAccepted: true`. Polling needs `payments.view`, and cancelling an unpaid
Checkout needs `payments.delete`, in addition to the card feature's permissions.

Former POST `/api/card-requests/personal`, `/employee`, `/personal/replacement`
and `/employee/replacement` routes have been removed. Use the unified funded
Checkout endpoint for new member requests.

## Approval, issuance, delivery and refunds

Requests use `pending`, `accepted`, `rejected`, `cancelled`. Show approval
separately from physical fulfillment. SuperAdmin issues a card after accepting
the request; that card has its own dispatch/receipt state.

| Step | Endpoint |
|---|---|
| Owner lists/reads requests | GET `/api/card-requests/me`, `/{requestId}`. |
| Edit address | PUT `/api/card-requests/{requestId}/delivery-address`, before dispatch. |
| Admin accepts/rejects | POST `/api/admin/card-requests/{requestId}/decision`, with `action` and rejection `reason`. |
| Admin issues | POST `/api/admin/card-requests/{requestId}/issue`, no body. |
| Admin dispatches | POST `/api/admin/cards/{cardId}/action`, with `action: "dispatch"`, optional `carrier`, `trackingReference`. Backend records dispatch time. |
| Owner/provider confirms receipt | POST `/api/cards/{cardId}/receive`, no body, with `cards.manage`. |
| Owner cancels pending | POST `/api/card-requests/{requestId}/cancel`, no body. |
| Admin cancels before first dispatch | POST `/api/admin/card-requests/{requestId}/cancel`, with `reason`. |

Use request `fundingSource`, `paidAmountMinor`, `refundStatus`, and
`firstDispatchedAtUtc` for the payment UI. Sources are `paid`, `allowance`,
`admin_waiver`, historical `legacy`. First dispatch closes ordinary cancellation,
including after later delivery problems. Admin cancellation of an issued,
undispatched request also voids its card.

| Outcome | Paid | Free allowance | Admin waiver |
|---|---|---|---|
| Owner cancels pending | Automatic full original-payment refund. | Same unit returned. | Preserve waiver history. |
| Admin rejects/cancels before dispatch | Same full refund. | Same unit returned. | Preserve waiver history. |
| Lifecycle event cancels before dispatch | Same full refund. | Same unit returned. | Preserve waiver history. |
| Successful charge, request creation fails | Automatic full refund. | No charge collected. | No charge collected. |
| Delivery problem after dispatch | Admin performs free resend/reissue under the original request. | Same correction. | Same correction. |

Deactivation, type changes and employee/business archival can trigger automatic
pre-dispatch cancellation. An earlier refund processing does not block a new,
eligible request with its own funding.

Read GET `/api/card-requests/refunds` for own card refunds and
GET `/api/admin/marketplace/card-refunds` for admin history. Fields include
`amountMinor`, `cardRequestId`, `operationId`, `status`, `reason`. The request
ID can be null after failed creation. Separate financial processing/failure
from request approval. SuperAdmin recovery uses BRD 18 operation tools.

## SuperAdmin settings, grants and one-off waivers

Load GET `/api/admin/marketplace/settings` before editing. PUT sends all mutable
settings because omitted values can reset fields.

```json
{
  "searchRadiusKm": 50,
  "cardRequestsEnabled": true,
  "cardFeeMinor": 1200,
  "reason": "Enable card requests after fee review."
}
```

New member requests start paused until explicit fee setup and enablement. The
fee is at least 50 cents. Settings/overrides/grants require an audit reason and
SuperAdmin, independently of catalogue permissions.

Grant free card units through POST `/api/admin/marketplace/card-allowances/grant`
with `requestId`, `userId`, `count` from 1 to 1000, and `reason`. Units are
account-bound, non-expiring and usable for personal or eligible employee requests.
GET `/api/admin/marketplace/users/{userId}/card-allowances` reads the account.
POST `/api/admin/marketplace/users/{userId}/card-allowances/{id}/revoke` with
`reason` reverses an unused grant. Retain UUID/input on grant retries.

SuperAdmin creates a one-off free request through
POST `/api/admin/card-requests/users/{ownerUserId}`, with `auditReason` and
optional employee/replacement fields. It bypasses member payment/pause gates.
It consumes no allowance and creates none on cancellation. Save its delivery
address through the admin delivery-address endpoint before fulfillment.
Subject and replacement state rules still apply.

## Provider eligibility, notifications and acceptance

Only ordinary Tradepeople manage businesses, offer services, manage employees,
submit provider prices and request employee cards. Builder, Developer,
Individual and Public & Government Sector members request services and can
request their personal cards. Their profile/KYC fields still vary by type.

SuperAdmin must first change an ineligible target owner to Tradeperson before
creating new provider records for them. Preserve authorized historical records
and grandfathered work. Type changes can revoke sessions and require profile
completion, so follow the existing onboarding/access-level flow after sign-in.

Consume SignalR `notificationReceived` and refetch the following queries.

| Event | Refetch |
|---|---|
| `marketplace.changed`, `data.area: "discovery"` | Current location/filter search. |
| `marketplace.changed`, `data.area: "catalogue"` | Visible Global/private/admin prices, optionally scoped by `itemId`. |
| `payment.*` | Applicable operation, allowance/billing balance, transactions and refunds. |
| `card-request.*`, `card.*` | Requests, physical cards, delivery and refunds. |

Event payloads carry references/invalidation hints. Read prices through their
authorized projections. Refetch on reconnect/focus because eligibility and
averages can change while disconnected. BRD 18 describes error/retry handling.
Refresh state after a 400 conflict or 403 eligibility failure and explain it.

Acceptance should cover search without radius, admin radius changes, omission
of restricted Global fields, Guide/custom private prices, annual withdrawal and
restore, override/clear, cent/decimal formatting, paid/free card requests,
all replacement reasons, loss followed by abandoned payment, automatic refunds,
first-dispatch cutoff, free delivery corrections, admin waivers, request pauses,
missing permissions and target-owner type checks.

The generated reference below includes the current contracts for these flows.

<!-- GENERATED API REFERENCE: START -->

## Detailed API reference

Generated from the current compiled API. Read the workflow above and [shared conventions](00-integration-basics.md) first.

All success examples below are illustrative shapes, not captured production data. Replace example IDs, dates, credentials and catalogue codes with values returned by your environment.

All normal controller successes use HTTP 200. Errors can also be 400/401/403/404/429/500/503; see the shared error contract. A binary PDF download is documented separately from JSON.

### Endpoint summary

| Method and path | Access |
|---|---|
| [GET /api/admin/card-requests/{requestId}](#get-api-admin-card-requests-requestid) | Bearer JWT; Role: SuperAdmin; full access required |
| [POST /api/admin/card-requests/{requestId}/cancel](#post-api-admin-card-requests-requestid-cancel) | Bearer JWT; Role: SuperAdmin; full access required |
| [POST /api/admin/card-requests/{requestId}/decision](#post-api-admin-card-requests-requestid-decision) | Bearer JWT; Role: SuperAdmin; full access required |
| [PUT /api/admin/card-requests/{requestId}/delivery-address](#put-api-admin-card-requests-requestid-delivery-address) | Bearer JWT; Role: SuperAdmin; full access required |
| [POST /api/admin/card-requests/{requestId}/issue](#post-api-admin-card-requests-requestid-issue) | Bearer JWT; Role: SuperAdmin; full access required |
| [POST /api/admin/card-requests/users/{ownerUserId}](#post-api-admin-card-requests-users-owneruserid) | Bearer JWT; Role: SuperAdmin; full access required |
| [POST /api/admin/cards/{cardId}/action](#post-api-admin-cards-cardid-action) | Bearer JWT; Role: SuperAdmin; full access required |
| [POST /api/admin/marketplace/card-allowances/grant](#post-api-admin-marketplace-card-allowances-grant) | Bearer JWT; Role: SuperAdmin; full access required |
| [GET /api/admin/marketplace/card-refunds](#get-api-admin-marketplace-card-refunds) | Bearer JWT; Role: SuperAdmin; full access required |
| [PUT /api/admin/marketplace/global-prices/{itemId}/override](#put-api-admin-marketplace-global-prices-itemid-override) | Bearer JWT; Role: SuperAdmin; full access required |
| [GET /api/admin/marketplace/settings](#get-api-admin-marketplace-settings) | Bearer JWT; Role: SuperAdmin; full access required |
| [PUT /api/admin/marketplace/settings](#put-api-admin-marketplace-settings) | Bearer JWT; Role: SuperAdmin; full access required |
| [GET /api/admin/marketplace/users/{userId}/card-allowances](#get-api-admin-marketplace-users-userid-card-allowances) | Bearer JWT; Role: SuperAdmin; full access required |
| [POST /api/admin/marketplace/users/{userId}/card-allowances/{id}/revoke](#post-api-admin-marketplace-users-userid-card-allowances-id-revoke) | Bearer JWT; Role: SuperAdmin; full access required |
| [GET /api/admin/marketplace/users/{userId}/price-list](#get-api-admin-marketplace-users-userid-price-list) | Bearer JWT; Role: SuperAdmin; full access required |
| [GET /api/admin/price-catalogue](#get-api-admin-price-catalogue) | Bearer JWT; `price-catalogue-admin.view`; full access required |
| [POST /api/admin/price-catalogue](#post-api-admin-price-catalogue) | Bearer JWT; `price-catalogue.manage`; full access required |
| [GET /api/admin/price-catalogue/{itemId}](#get-api-admin-price-catalogue-itemid) | Bearer JWT; `price-catalogue-admin.view`; full access required |
| [PUT /api/admin/price-catalogue/{itemId}](#put-api-admin-price-catalogue-itemid) | Bearer JWT; `price-catalogue.manage`; full access required |
| [GET /api/admin/price-catalogue/{itemId}/history](#get-api-admin-price-catalogue-itemid-history) | Bearer JWT; `price-catalogue-admin.view`; full access required |
| [POST /api/admin/price-catalogue/{itemId}/publish](#post-api-admin-price-catalogue-itemid-publish) | Bearer JWT; `price-catalogue.manage`; full access required |
| [POST /api/admin/price-catalogue/{itemId}/retire](#post-api-admin-price-catalogue-itemid-retire) | Bearer JWT; `price-catalogue.delete`; full access required |
| [GET /api/card-requests/{requestId}](#get-api-card-requests-requestid) | Bearer JWT; `card-requests.view`; full access required |
| [POST /api/card-requests/{requestId}/cancel](#post-api-card-requests-requestid-cancel) | Bearer JWT; `card-requests.delete`; full access required |
| [PUT /api/card-requests/{requestId}/delivery-address](#put-api-card-requests-requestid-delivery-address) | Bearer JWT; `card-requests.manage`; full access required |
| [GET /api/card-requests/allowances](#get-api-card-requests-allowances) | Bearer JWT; `card-requests.view`; full access required |
| [POST /api/card-requests/cards/{cardId}/report-lost](#post-api-card-requests-cards-cardid-report-lost) | Bearer JWT; `card-requests.manage`; full access required |
| [POST /api/card-requests/checkout](#post-api-card-requests-checkout) | Bearer JWT; `card-requests.manage`; full access required |
| [GET /api/card-requests/me](#get-api-card-requests-me) | Bearer JWT; `card-requests.view`; full access required |
| [GET /api/card-requests/refunds](#get-api-card-requests-refunds) | Bearer JWT; `card-requests.view`; full access required |
| [GET /api/cards/{cardId}](#get-api-cards-cardid) | Bearer JWT; `cards.view`; full access required |
| [POST /api/cards/{cardId}/receive](#post-api-cards-cardid-receive) | Bearer JWT; `cards.manage`; full access required |
| [GET /api/price-catalogue](#get-api-price-catalogue) | Bearer JWT; `price-catalogue.view`; full access required |
| [GET /api/price-catalogue/{itemId}](#get-api-price-catalogue-itemid) | Bearer JWT; `price-catalogue.view`; full access required |
| [POST /api/provider-prices](#post-api-provider-prices) | Bearer JWT; `prices.manage`; full access required |
| [GET /api/provider-prices/{id}](#get-api-provider-prices-id) | Bearer JWT; `prices.view`; full access required |
| [PUT /api/provider-prices/{id}](#put-api-provider-prices-id) | Bearer JWT; `prices.manage`; full access required |
| [GET /api/provider-prices/{id}/history](#get-api-provider-prices-id-history) | Bearer JWT; `prices.view`; full access required |
| [POST /api/provider-prices/{id}/restore](#post-api-provider-prices-id-restore) | Bearer JWT; `prices.manage`; full access required |
| [POST /api/provider-prices/{id}/withdraw](#post-api-provider-prices-id-withdraw) | Bearer JWT; `prices.delete`; full access required |
| [GET /api/provider-prices/available-items](#get-api-provider-prices-available-items) | Bearer JWT; `prices.view`; full access required |
| [GET /api/provider-prices/current](#get-api-provider-prices-current) | Bearer JWT; `prices.view`; full access required |
| [POST /api/provider-prices/item-requests](#post-api-provider-prices-item-requests) | Bearer JWT; `prices.manage`; full access required |
| [GET /api/provider-prices/me](#get-api-provider-prices-me) | Bearer JWT; `prices.view`; full access required |
| [GET /api/services/search](#get-api-services-search) | Bearer JWT; `services.view`; full access required |

Authorization requirements are cumulative. Role/permission checks also have the ownership, state and eligibility rules described above. SuperAdmin bypasses permission policies; use explicit admin routes to target other accounts. Query parameter names are case-insensitive; the tables retain API Explorer spelling.

<a id="get-api-admin-card-requests-requestid"></a>
### `GET /api/admin/card-requests/{requestId}`

**Access:** Bearer JWT; Role: SuperAdmin; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `requestId` | path | integer (int64) | yes | — |

**Request body:** none.

**Success:** HTTP 200; [CardRequestResponseApiResponse](#model-cardrequestresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "fundingSource": "paid",
    "paidAmountMinor": 1200,
    "refundStatus": null,
    "firstDispatchedAtUtc": null,
    "id": 101,
    "ownerUserId": 101,
    "subjectType": "personal",
    "employeeId": null,
    "businessId": null,
    "subjectName": "example",
    "membershipId": "T100000",
    "employeeOccupationCode": null,
    "employeeOccupationName": null,
    "previousCardId": null,
    "replacementReason": null,
    "deliveryAddress": null,
    "legacyApproval": false,
    "fulfillmentClosedAtUtc": null,
    "cardId": null,
    "status": "pending",
    "decisionReason": null,
    "decidedByUserId": null,
    "decidedAtUtc": null,
    "createdAtUtc": "2026-10-18T12:00:00Z",
    "updatedAtUtc": "2026-10-18T12:00:00Z",
    "history": [
      {
        "actorUserId": null,
        "action": "requested",
        "previousStatus": null,
        "status": "pending",
        "note": null,
        "createdAtUtc": "2026-10-18T12:00:00Z"
      }
    ]
  }
}
```

</details>

<a id="post-api-admin-card-requests-requestid-cancel"></a>
### `POST /api/admin/card-requests/{requestId}/cancel`

**Access:** Bearer JWT; Role: SuperAdmin; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `requestId` | path | integer (int64) | yes | — |

**Request:** `application/json`; [AdminCancelCardRequest](#model-admincancelcardrequest).

```json
{
  "reason": "Reviewed and confirmed by the administrator."
}
```

**Success:** HTTP 200; [CardRequestResponseApiResponse](#model-cardrequestresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "fundingSource": "paid",
    "paidAmountMinor": 1200,
    "refundStatus": null,
    "firstDispatchedAtUtc": null,
    "id": 101,
    "ownerUserId": 101,
    "subjectType": "personal",
    "employeeId": null,
    "businessId": null,
    "subjectName": "example",
    "membershipId": "T100000",
    "employeeOccupationCode": null,
    "employeeOccupationName": null,
    "previousCardId": null,
    "replacementReason": null,
    "deliveryAddress": null,
    "legacyApproval": false,
    "fulfillmentClosedAtUtc": null,
    "cardId": null,
    "status": "cancelled",
    "decisionReason": null,
    "decidedByUserId": null,
    "decidedAtUtc": null,
    "createdAtUtc": "2026-10-18T12:00:00Z",
    "updatedAtUtc": "2026-10-18T12:00:00Z",
    "history": [
      {
        "actorUserId": null,
        "action": "cancel",
        "previousStatus": null,
        "status": "cancelled",
        "note": null,
        "createdAtUtc": "2026-10-18T12:00:00Z"
      }
    ]
  }
}
```

</details>

<a id="post-api-admin-card-requests-requestid-decision"></a>
### `POST /api/admin/card-requests/{requestId}/decision`

**Access:** Bearer JWT; Role: SuperAdmin; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `requestId` | path | integer (int64) | yes | — |

**Request:** `application/json`; [AdminCardDecisionRequest](#model-admincarddecisionrequest).

```json
{
  "action": "accept"
}
```

**Success:** HTTP 200; [CardRequestResponseApiResponse](#model-cardrequestresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "fundingSource": "paid",
    "paidAmountMinor": 1200,
    "refundStatus": null,
    "firstDispatchedAtUtc": null,
    "id": 101,
    "ownerUserId": 101,
    "subjectType": "personal",
    "employeeId": null,
    "businessId": null,
    "subjectName": "example",
    "membershipId": "T100000",
    "employeeOccupationCode": null,
    "employeeOccupationName": null,
    "previousCardId": null,
    "replacementReason": null,
    "deliveryAddress": null,
    "legacyApproval": false,
    "fulfillmentClosedAtUtc": null,
    "cardId": null,
    "status": "accepted",
    "decisionReason": null,
    "decidedByUserId": 101,
    "decidedAtUtc": "2026-10-18T12:00:00Z",
    "createdAtUtc": "2026-10-18T12:00:00Z",
    "updatedAtUtc": "2026-10-18T12:00:00Z",
    "history": [
      {
        "actorUserId": null,
        "action": "decide",
        "previousStatus": null,
        "status": "accepted",
        "note": null,
        "createdAtUtc": "2026-10-18T12:00:00Z"
      }
    ]
  }
}
```

</details>

<a id="put-api-admin-card-requests-requestid-delivery-address"></a>
### `PUT /api/admin/card-requests/{requestId}/delivery-address`

**Access:** Bearer JWT; Role: SuperAdmin; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `requestId` | path | integer (int64) | yes | — |

**Request:** `application/json`; [CardDeliveryAddressRequest](#model-carddeliveryaddressrequest).

```json
{
  "streetAddress": "10 Example Street",
  "suburb": "Sydney",
  "regionCode": "NSW",
  "postalCode": "2000"
}
```

**Success:** HTTP 200; [CardRequestResponseApiResponse](#model-cardrequestresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "fundingSource": "paid",
    "paidAmountMinor": 1200,
    "refundStatus": null,
    "firstDispatchedAtUtc": null,
    "id": 101,
    "ownerUserId": 101,
    "subjectType": "personal",
    "employeeId": null,
    "businessId": null,
    "subjectName": "example",
    "membershipId": "T100000",
    "employeeOccupationCode": null,
    "employeeOccupationName": null,
    "previousCardId": null,
    "replacementReason": null,
    "deliveryAddress": null,
    "legacyApproval": false,
    "fulfillmentClosedAtUtc": null,
    "cardId": null,
    "status": "pending",
    "decisionReason": null,
    "decidedByUserId": null,
    "decidedAtUtc": null,
    "createdAtUtc": "2026-10-18T12:00:00Z",
    "updatedAtUtc": "2026-10-18T12:00:00Z",
    "history": [
      {
        "actorUserId": null,
        "action": "setdeliveryaddress",
        "previousStatus": null,
        "status": "pending",
        "note": null,
        "createdAtUtc": "2026-10-18T12:00:00Z"
      }
    ]
  }
}
```

</details>

<a id="post-api-admin-card-requests-requestid-issue"></a>
### `POST /api/admin/card-requests/{requestId}/issue`

**Access:** Bearer JWT; Role: SuperAdmin; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `requestId` | path | integer (int64) | yes | — |

**Request body:** none.

**Success:** HTTP 200; [CardResponseApiResponse](#model-cardresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "id": 101,
    "cardNumber": "example",
    "requestId": 101,
    "ownerUserId": 101,
    "subjectType": "personal",
    "employeeId": null,
    "businessId": null,
    "previousCardId": null,
    "subjectName": "example",
    "membershipId": "T100000",
    "employeeOccupationCode": null,
    "employeeOccupationName": null,
    "businessName": null,
    "providerMembershipId": null,
    "deliveryAddress": {
      "streetAddress": "10 Example Street",
      "suburb": "Sydney",
      "regionCode": "NSW",
      "postalCode": "2000"
    },
    "validityYears": 1,
    "issuedAtUtc": "2026-10-18T10:00:00Z",
    "expiresAtUtc": "2027-10-18T10:00:00Z",
    "status": "issued",
    "isValid": false,
    "dispatchedAtUtc": null,
    "carrier": null,
    "trackingReference": null,
    "receivedAtUtc": null,
    "invalidatedAtUtc": null,
    "invalidationReason": null,
    "history": [
      {
        "actorUserId": null,
        "action": "issue",
        "previousStatus": null,
        "status": "issued",
        "note": null,
        "createdAtUtc": "2026-10-18T12:00:00Z"
      }
    ]
  }
}
```

</details>

<a id="post-api-admin-card-requests-users-owneruserid"></a>
### `POST /api/admin/card-requests/users/{ownerUserId}`

**Access:** Bearer JWT; Role: SuperAdmin; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `ownerUserId` | path | integer (int64) | yes | — |

**Request:** `application/json`; [AdminCreateCardRequest](#model-admincreatecardrequest).

```json
{
  "auditReason": "example"
}
```

**Success:** HTTP 200; [CardRequestResponseApiResponse](#model-cardrequestresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "fundingSource": "paid",
    "paidAmountMinor": 1200,
    "refundStatus": null,
    "firstDispatchedAtUtc": null,
    "id": 101,
    "ownerUserId": 101,
    "subjectType": "personal",
    "employeeId": null,
    "businessId": null,
    "subjectName": "example",
    "membershipId": "T100000",
    "employeeOccupationCode": null,
    "employeeOccupationName": null,
    "previousCardId": null,
    "replacementReason": null,
    "deliveryAddress": null,
    "legacyApproval": false,
    "fulfillmentClosedAtUtc": null,
    "cardId": null,
    "status": "pending",
    "decisionReason": null,
    "decidedByUserId": null,
    "decidedAtUtc": null,
    "createdAtUtc": "2026-10-18T12:00:00Z",
    "updatedAtUtc": "2026-10-18T12:00:00Z",
    "history": [
      {
        "actorUserId": null,
        "action": "createforuser",
        "previousStatus": null,
        "status": "pending",
        "note": null,
        "createdAtUtc": "2026-10-18T12:00:00Z"
      }
    ]
  }
}
```

</details>

<a id="post-api-admin-cards-cardid-action"></a>
### `POST /api/admin/cards/{cardId}/action`

**Access:** Bearer JWT; Role: SuperAdmin; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `cardId` | path | integer (int64) | yes | — |

**Request:** `application/json`; [AdminCardActionRequest](#model-admincardactionrequest).

```json
{
  "action": "dispatch",
  "carrier": "Example carrier",
  "trackingReference": "EXAMPLE-001"
}
```

**Success:** HTTP 200; [CardResponseApiResponse](#model-cardresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "id": 101,
    "cardNumber": "example",
    "requestId": 101,
    "ownerUserId": 101,
    "subjectType": "personal",
    "employeeId": null,
    "businessId": null,
    "previousCardId": null,
    "subjectName": "example",
    "membershipId": "T100000",
    "employeeOccupationCode": null,
    "employeeOccupationName": null,
    "businessName": null,
    "providerMembershipId": null,
    "deliveryAddress": {
      "streetAddress": "10 Example Street",
      "suburb": "Sydney",
      "regionCode": "NSW",
      "postalCode": "2000"
    },
    "validityYears": 1,
    "issuedAtUtc": "2026-10-18T10:00:00Z",
    "expiresAtUtc": "2027-10-18T10:00:00Z",
    "status": "dispatched",
    "isValid": false,
    "dispatchedAtUtc": "2026-10-18T11:00:00Z",
    "carrier": "Example carrier",
    "trackingReference": "EXAMPLE-001",
    "receivedAtUtc": null,
    "invalidatedAtUtc": null,
    "invalidationReason": null,
    "history": [
      {
        "actorUserId": null,
        "action": "change",
        "previousStatus": null,
        "status": "dispatched",
        "note": null,
        "createdAtUtc": "2026-10-18T12:00:00Z"
      }
    ]
  }
}
```

</details>

<a id="post-api-admin-marketplace-card-allowances-grant"></a>
### `POST /api/admin/marketplace/card-allowances/grant`

**Access:** Bearer JWT; Role: SuperAdmin; full access required.

**Request:** `application/json`; [GrantConfirmationsRequest](#model-grantconfirmationsrequest).

```json
{
  "requestId": "11111111-1111-4111-8111-111111111111",
  "userId": 101,
  "count": 2,
  "reason": "Reviewed and confirmed by the administrator."
}
```

**Success:** HTTP 200; [CardAllowanceResponseApiResponse](#model-cardallowanceresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "available": 2,
    "cardFeeMinor": 1200,
    "cardRequestsEnabled": true,
    "allowances": [
      {
        "id": 101,
        "status": "available",
        "createdAtUtc": "2026-10-18T12:00:00Z"
      },
      {
        "id": 102,
        "status": "available",
        "createdAtUtc": "2026-10-18T12:00:00Z"
      }
    ]
  }
}
```

</details>

<a id="get-api-admin-marketplace-card-refunds"></a>
### `GET /api/admin/marketplace/card-refunds`

**Access:** Bearer JWT; Role: SuperAdmin; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `UserId` | query | integer (int64) | no | minimum: 1; maximum: 9.223372036854776e+18; range 1–9.223372036854776E+18 |
| `Page` | query | integer (int32) | no | default: `1`; minimum: 1; maximum: 1000; range 1–1000 |
| `PageSize` | query | integer (int32) | no | default: `20`; minimum: 1; maximum: 100; range 1–100 |

**Request body:** none.

**Success:** HTTP 200; [CardPaymentRefundResponsePagedResponseApiResponse](#model-cardpaymentrefundresponsepagedresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "items": [
      {
        "id": 101,
        "userId": 101,
        "cardRequestId": null,
        "amountMinor": 1200,
        "operationId": "11111111-1111-4111-8111-111111111111",
        "status": "processing",
        "reason": "Card request cancelled",
        "createdAtUtc": "2026-10-18T12:00:00Z",
        "updatedAtUtc": "2026-10-18T12:00:00Z"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "hasMore": false
  }
}
```

</details>

<a id="put-api-admin-marketplace-global-prices-itemid-override"></a>
### `PUT /api/admin/marketplace/global-prices/{itemId}/override`

**Access:** Bearer JWT; Role: SuperAdmin; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `itemId` | path | integer (int64) | yes | — |

**Request:** `application/json`; [GlobalPriceOverrideRequest](#model-globalpriceoverriderequest).

```json
{
  "price": 110.0,
  "reason": "Reviewed and confirmed by the administrator."
}
```

**Success:** HTTP 200; [PriceCatalogueItemResponseApiResponse](#model-pricecatalogueitemresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "id": 101,
    "code": "ELECTRICAL_CHECK",
    "occupationCode": "electrical_services",
    "occupationName": "example",
    "name": "Example item",
    "description": null,
    "currencyCode": "AUD",
    "guidePrice": 100.0,
    "minProviderPrice": 80.0,
    "maxProviderPrice": 150.0,
    "providerAveragePrice": 103.33,
    "providerSubmissionCount": 3,
    "price": 110.0,
    "globalOverride": 110.0,
    "status": "published",
    "publishedAtUtc": "2026-10-18T12:00:00Z",
    "retiredAtUtc": null,
    "createdAtUtc": "2026-10-18T12:00:00Z",
    "updatedAtUtc": "2026-10-18T12:00:00Z"
  }
}
```

</details>

<a id="get-api-admin-marketplace-settings"></a>
### `GET /api/admin/marketplace/settings`

**Access:** Bearer JWT; Role: SuperAdmin; full access required.

**Request body:** none.

**Success:** HTTP 200; [MarketplaceSettingsResponseApiResponse](#model-marketplacesettingsresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "searchRadiusKm": 50,
    "cardRequestsEnabled": true,
    "cardFeeMinor": 1200,
    "updatedAtUtc": "2026-10-18T12:00:00Z"
  }
}
```

</details>

<a id="put-api-admin-marketplace-settings"></a>
### `PUT /api/admin/marketplace/settings`

**Access:** Bearer JWT; Role: SuperAdmin; full access required.

**Request:** `application/json`; [MarketplaceSettingsRequest](#model-marketplacesettingsrequest).

```json
{
  "searchRadiusKm": 50,
  "cardRequestsEnabled": true,
  "cardFeeMinor": 1200,
  "reason": "Reviewed and confirmed by the administrator."
}
```

**Success:** HTTP 200; [MarketplaceSettingsResponseApiResponse](#model-marketplacesettingsresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "searchRadiusKm": 50,
    "cardRequestsEnabled": true,
    "cardFeeMinor": 1200,
    "updatedAtUtc": "2026-10-18T12:00:00Z"
  }
}
```

</details>

<a id="get-api-admin-marketplace-users-userid-card-allowances"></a>
### `GET /api/admin/marketplace/users/{userId}/card-allowances`

**Access:** Bearer JWT; Role: SuperAdmin; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `userId` | path | integer (int64) | yes | — |

**Request body:** none.

**Success:** HTTP 200; [CardAllowanceResponseApiResponse](#model-cardallowanceresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "available": 1,
    "cardFeeMinor": 1200,
    "cardRequestsEnabled": true,
    "allowances": [
      {
        "id": 101,
        "status": "available",
        "createdAtUtc": "2026-10-18T12:00:00Z"
      }
    ]
  }
}
```

</details>

<a id="post-api-admin-marketplace-users-userid-card-allowances-id-revoke"></a>
### `POST /api/admin/marketplace/users/{userId}/card-allowances/{id}/revoke`

**Access:** Bearer JWT; Role: SuperAdmin; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `userId` | path | integer (int64) | yes | — |
| `id` | path | integer (int64) | yes | — |

**Request:** `application/json`; [PaymentReasonRequest](#model-paymentreasonrequest).

```json
{
  "reason": "Reviewed and confirmed by the administrator."
}
```

**Success:** HTTP 200; [CardAllowanceResponseApiResponse](#model-cardallowanceresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "available": 1,
    "cardFeeMinor": 1200,
    "cardRequestsEnabled": true,
    "allowances": [
      {
        "id": 101,
        "status": "available",
        "createdAtUtc": "2026-10-18T12:00:00Z"
      }
    ]
  }
}
```

</details>

<a id="get-api-admin-marketplace-users-userid-price-list"></a>
### `GET /api/admin/marketplace/users/{userId}/price-list`

**Access:** Bearer JWT; Role: SuperAdmin; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `userId` | path | integer (int64) | yes | — |
| `Page` | query | integer (int32) | no | default: `1`; minimum: 1; maximum: 1000; range 1–1000 |
| `PageSize` | query | integer (int32) | no | default: `20`; minimum: 1; maximum: 100; range 1–100 |

**Request body:** none.

**Success:** HTTP 200; [ProviderCurrentPriceResponsePagedResponseApiResponse](#model-providercurrentpriceresponsepagedresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "items": [
      {
        "id": 101,
        "code": "ELECTRICAL_CHECK",
        "name": "Example item",
        "description": null,
        "occupationCode": "electrical_services",
        "occupationName": "example",
        "currencyCode": "AUD",
        "guidePrice": 100.0,
        "minProviderPrice": 80.0,
        "maxProviderPrice": 150.0,
        "effectivePrice": 100.0,
        "priceSource": "guide",
        "submissionId": null,
        "calendarYear": null,
        "withdrawnAtUtc": null
      }
    ],
    "page": 1,
    "pageSize": 20,
    "hasMore": false
  }
}
```

</details>

<a id="get-api-admin-price-catalogue"></a>
### `GET /api/admin/price-catalogue`

**Access:** Bearer JWT; `price-catalogue-admin.view`; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `Status` | query | string | no | pattern: `^(pending\|published\|retired)$`; pattern: ^(pending\|published\|retired)$ |
| `OccupationCode` | query | string | no | max length: 80; max length 80 |
| `Search` | query | string | no | max length: 100; max length 100 |
| `Page` | query | integer (int32) | no | default: `1`; minimum: 1; maximum: 1000; range 1–1000 |
| `PageSize` | query | integer (int32) | no | default: `20`; minimum: 1; maximum: 100; range 1–100 |

**Request body:** none.

**Success:** HTTP 200; [PriceCatalogueListResponseApiResponse](#model-pricecataloguelistresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "items": [
      {
        "id": 101,
        "code": "ELECTRICAL_CHECK",
        "occupationCode": "electrical_services",
        "occupationName": "example",
        "name": "Example item",
        "description": null,
        "currencyCode": "AUD",
        "guidePrice": 100.0,
        "minProviderPrice": 80.0,
        "maxProviderPrice": 150.0,
        "providerAveragePrice": 103.33,
        "providerSubmissionCount": 3,
        "price": 103.33,
        "globalOverride": null,
        "status": "published",
        "publishedAtUtc": "2026-10-18T12:00:00Z",
        "retiredAtUtc": null,
        "createdAtUtc": "2026-10-18T12:00:00Z",
        "updatedAtUtc": "2026-10-18T12:00:00Z"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "hasMore": false
  }
}
```

</details>

<a id="post-api-admin-price-catalogue"></a>
### `POST /api/admin/price-catalogue`

**Access:** Bearer JWT; `price-catalogue.manage`; full access required.

**Request:** `application/json`; [CreatePriceCatalogueItemRequest](#model-createpricecatalogueitemrequest).

```json
{
  "code": "ELECTRICAL_CHECK",
  "occupationCode": "electrical_services",
  "name": "Example item",
  "guidePrice": 150.0,
  "minProviderPrice": 100.0,
  "maxProviderPrice": 200.0
}
```

**Success:** HTTP 200; [PriceCatalogueItemResponseApiResponse](#model-pricecatalogueitemresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "id": 101,
    "code": "ELECTRICAL_CHECK",
    "occupationCode": "electrical_services",
    "occupationName": "example",
    "name": "Example item",
    "description": null,
    "currencyCode": "AUD",
    "guidePrice": 100.0,
    "minProviderPrice": 80.0,
    "maxProviderPrice": 150.0,
    "providerAveragePrice": 103.33,
    "providerSubmissionCount": 3,
    "price": 103.33,
    "globalOverride": null,
    "status": "pending",
    "publishedAtUtc": null,
    "retiredAtUtc": null,
    "createdAtUtc": "2026-10-18T12:00:00Z",
    "updatedAtUtc": "2026-10-18T12:00:00Z"
  }
}
```

</details>

<a id="get-api-admin-price-catalogue-itemid"></a>
### `GET /api/admin/price-catalogue/{itemId}`

**Access:** Bearer JWT; `price-catalogue-admin.view`; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `itemId` | path | integer (int64) | yes | — |

**Request body:** none.

**Success:** HTTP 200; [PriceCatalogueItemResponseApiResponse](#model-pricecatalogueitemresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "id": 101,
    "code": "ELECTRICAL_CHECK",
    "occupationCode": "electrical_services",
    "occupationName": "example",
    "name": "Example item",
    "description": null,
    "currencyCode": "AUD",
    "guidePrice": 100.0,
    "minProviderPrice": 80.0,
    "maxProviderPrice": 150.0,
    "providerAveragePrice": 103.33,
    "providerSubmissionCount": 3,
    "price": 103.33,
    "globalOverride": null,
    "status": "published",
    "publishedAtUtc": "2026-10-18T12:00:00Z",
    "retiredAtUtc": null,
    "createdAtUtc": "2026-10-18T12:00:00Z",
    "updatedAtUtc": "2026-10-18T12:00:00Z"
  }
}
```

</details>

<a id="put-api-admin-price-catalogue-itemid"></a>
### `PUT /api/admin/price-catalogue/{itemId}`

**Access:** Bearer JWT; `price-catalogue.manage`; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `itemId` | path | integer (int64) | yes | — |

**Request:** `application/json`; [UpdatePriceCatalogueItemRequest](#model-updatepricecatalogueitemrequest).

```json
{
  "name": "Example item",
  "guidePrice": 150.0,
  "minProviderPrice": 100.0,
  "maxProviderPrice": 200.0
}
```

**Success:** HTTP 200; [PriceCatalogueItemResponseApiResponse](#model-pricecatalogueitemresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "id": 101,
    "code": "ELECTRICAL_CHECK",
    "occupationCode": "electrical_services",
    "occupationName": "example",
    "name": "Example item",
    "description": null,
    "currencyCode": "AUD",
    "guidePrice": 100.0,
    "minProviderPrice": 80.0,
    "maxProviderPrice": 150.0,
    "providerAveragePrice": 103.33,
    "providerSubmissionCount": 3,
    "price": 103.33,
    "globalOverride": null,
    "status": "published",
    "publishedAtUtc": "2026-10-18T12:00:00Z",
    "retiredAtUtc": null,
    "createdAtUtc": "2026-10-18T12:00:00Z",
    "updatedAtUtc": "2026-10-18T12:00:00Z"
  }
}
```

</details>

<a id="get-api-admin-price-catalogue-itemid-history"></a>
### `GET /api/admin/price-catalogue/{itemId}/history`

**Access:** Bearer JWT; `price-catalogue-admin.view`; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `itemId` | path | integer (int64) | yes | — |
| `Page` | query | integer (int32) | no | default: `1`; minimum: 1; maximum: 1000; range 1–1000 |
| `PageSize` | query | integer (int32) | no | default: `20`; minimum: 1; maximum: 100; range 1–100 |

**Request body:** none.

**Success:** HTTP 200; [PriceCatalogueEventListResponseApiResponse](#model-pricecatalogueeventlistresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "items": [
      {
        "id": 101,
        "itemId": 101,
        "actorUserId": 101,
        "action": "example",
        "before": null,
        "after": {},
        "createdAtUtc": "2026-10-18T12:00:00Z"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "hasMore": false
  }
}
```

</details>

<a id="post-api-admin-price-catalogue-itemid-publish"></a>
### `POST /api/admin/price-catalogue/{itemId}/publish`

**Access:** Bearer JWT; `price-catalogue.manage`; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `itemId` | path | integer (int64) | yes | — |

**Request body:** none.

**Success:** HTTP 200; [PriceCatalogueItemResponseApiResponse](#model-pricecatalogueitemresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "id": 101,
    "code": "ELECTRICAL_CHECK",
    "occupationCode": "electrical_services",
    "occupationName": "example",
    "name": "Example item",
    "description": null,
    "currencyCode": "AUD",
    "guidePrice": 100.0,
    "minProviderPrice": 80.0,
    "maxProviderPrice": 150.0,
    "providerAveragePrice": 103.33,
    "providerSubmissionCount": 3,
    "price": 103.33,
    "globalOverride": null,
    "status": "published",
    "publishedAtUtc": "2026-10-18T12:00:00Z",
    "retiredAtUtc": null,
    "createdAtUtc": "2026-10-18T12:00:00Z",
    "updatedAtUtc": "2026-10-18T12:00:00Z"
  }
}
```

</details>

<a id="post-api-admin-price-catalogue-itemid-retire"></a>
### `POST /api/admin/price-catalogue/{itemId}/retire`

**Access:** Bearer JWT; `price-catalogue.delete`; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `itemId` | path | integer (int64) | yes | — |

**Request body:** none.

**Success:** HTTP 200; [PriceCatalogueItemResponseApiResponse](#model-pricecatalogueitemresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "id": 101,
    "code": "ELECTRICAL_CHECK",
    "occupationCode": "electrical_services",
    "occupationName": "example",
    "name": "Example item",
    "description": null,
    "currencyCode": "AUD",
    "guidePrice": 100.0,
    "minProviderPrice": 80.0,
    "maxProviderPrice": 150.0,
    "providerAveragePrice": 103.33,
    "providerSubmissionCount": 3,
    "price": 103.33,
    "globalOverride": null,
    "status": "retired",
    "publishedAtUtc": "2026-10-18T12:00:00Z",
    "retiredAtUtc": "2026-10-18T12:00:00Z",
    "createdAtUtc": "2026-10-18T12:00:00Z",
    "updatedAtUtc": "2026-10-18T12:00:00Z"
  }
}
```

</details>

<a id="get-api-card-requests-requestid"></a>
### `GET /api/card-requests/{requestId}`

**Access:** Bearer JWT; `card-requests.view`; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `requestId` | path | integer (int64) | yes | — |

**Request body:** none.

**Success:** HTTP 200; [CardRequestResponseApiResponse](#model-cardrequestresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "fundingSource": "paid",
    "paidAmountMinor": 1200,
    "refundStatus": null,
    "firstDispatchedAtUtc": null,
    "id": 101,
    "ownerUserId": 101,
    "subjectType": "personal",
    "employeeId": null,
    "businessId": null,
    "subjectName": "example",
    "membershipId": "T100000",
    "employeeOccupationCode": null,
    "employeeOccupationName": null,
    "previousCardId": null,
    "replacementReason": null,
    "deliveryAddress": null,
    "legacyApproval": false,
    "fulfillmentClosedAtUtc": null,
    "cardId": null,
    "status": "pending",
    "decisionReason": null,
    "decidedByUserId": null,
    "decidedAtUtc": null,
    "createdAtUtc": "2026-10-18T12:00:00Z",
    "updatedAtUtc": "2026-10-18T12:00:00Z",
    "history": [
      {
        "actorUserId": null,
        "action": "requested",
        "previousStatus": null,
        "status": "pending",
        "note": null,
        "createdAtUtc": "2026-10-18T12:00:00Z"
      }
    ]
  }
}
```

</details>

<a id="post-api-card-requests-requestid-cancel"></a>
### `POST /api/card-requests/{requestId}/cancel`

**Access:** Bearer JWT; `card-requests.delete`; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `requestId` | path | integer (int64) | yes | — |

**Request body:** none.

**Success:** HTTP 200; [CardRequestResponseApiResponse](#model-cardrequestresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "fundingSource": "paid",
    "paidAmountMinor": 1200,
    "refundStatus": null,
    "firstDispatchedAtUtc": null,
    "id": 101,
    "ownerUserId": 101,
    "subjectType": "personal",
    "employeeId": null,
    "businessId": null,
    "subjectName": "example",
    "membershipId": "T100000",
    "employeeOccupationCode": null,
    "employeeOccupationName": null,
    "previousCardId": null,
    "replacementReason": null,
    "deliveryAddress": null,
    "legacyApproval": false,
    "fulfillmentClosedAtUtc": null,
    "cardId": null,
    "status": "cancelled",
    "decisionReason": null,
    "decidedByUserId": null,
    "decidedAtUtc": null,
    "createdAtUtc": "2026-10-18T12:00:00Z",
    "updatedAtUtc": "2026-10-18T12:00:00Z",
    "history": [
      {
        "actorUserId": null,
        "action": "cancel",
        "previousStatus": null,
        "status": "cancelled",
        "note": null,
        "createdAtUtc": "2026-10-18T12:00:00Z"
      }
    ]
  }
}
```

</details>

<a id="put-api-card-requests-requestid-delivery-address"></a>
### `PUT /api/card-requests/{requestId}/delivery-address`

**Access:** Bearer JWT; `card-requests.manage`; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `requestId` | path | integer (int64) | yes | — |

**Request:** `application/json`; [CardDeliveryAddressRequest](#model-carddeliveryaddressrequest).

```json
{
  "streetAddress": "10 Example Street",
  "suburb": "Sydney",
  "regionCode": "NSW",
  "postalCode": "2000"
}
```

**Success:** HTTP 200; [CardRequestResponseApiResponse](#model-cardrequestresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "fundingSource": "paid",
    "paidAmountMinor": 1200,
    "refundStatus": null,
    "firstDispatchedAtUtc": null,
    "id": 101,
    "ownerUserId": 101,
    "subjectType": "personal",
    "employeeId": null,
    "businessId": null,
    "subjectName": "example",
    "membershipId": "T100000",
    "employeeOccupationCode": null,
    "employeeOccupationName": null,
    "previousCardId": null,
    "replacementReason": null,
    "deliveryAddress": null,
    "legacyApproval": false,
    "fulfillmentClosedAtUtc": null,
    "cardId": null,
    "status": "pending",
    "decisionReason": null,
    "decidedByUserId": null,
    "decidedAtUtc": null,
    "createdAtUtc": "2026-10-18T12:00:00Z",
    "updatedAtUtc": "2026-10-18T12:00:00Z",
    "history": [
      {
        "actorUserId": null,
        "action": "setdeliveryaddress",
        "previousStatus": null,
        "status": "pending",
        "note": null,
        "createdAtUtc": "2026-10-18T12:00:00Z"
      }
    ]
  }
}
```

</details>

<a id="get-api-card-requests-allowances"></a>
### `GET /api/card-requests/allowances`

**Access:** Bearer JWT; `card-requests.view`; full access required.

**Request body:** none.

**Success:** HTTP 200; [CardAllowanceResponseApiResponse](#model-cardallowanceresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "available": 1,
    "cardFeeMinor": 1200,
    "cardRequestsEnabled": true,
    "allowances": [
      {
        "id": 101,
        "status": "available",
        "createdAtUtc": "2026-10-18T12:00:00Z"
      }
    ]
  }
}
```

</details>

<a id="post-api-card-requests-cards-cardid-report-lost"></a>
### `POST /api/card-requests/cards/{cardId}/report-lost`

**Access:** Bearer JWT; `card-requests.manage`; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `cardId` | path | integer (int64) | yes | — |

**Request body:** none.

**Success:** HTTP 200; [BooleanApiResponse](#model-booleanapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": true
}
```

</details>

<a id="post-api-card-requests-checkout"></a>
### `POST /api/card-requests/checkout`

**Access:** Bearer JWT; `card-requests.manage`; full access required.

**Request:** `application/json`; [CardPaymentRequest](#model-cardpaymentrequest).

```json
{
  "requestId": "11111111-1111-4111-8111-111111111111",
  "consentAccepted": true,
  "streetAddress": "10 Example Street",
  "suburb": "Sydney",
  "regionCode": "NSW",
  "postalCode": "2000"
}
```

**Success:** HTTP 200; [PaymentOperationResponseApiResponse](#model-paymentoperationresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "id": "11111111-1111-4111-8111-111111111111",
    "kind": "card_checkout",
    "status": "queued",
    "checkoutUrl": null,
    "inspectionId": null,
    "cardRequestId": null,
    "refundRequired": false,
    "errorCode": null,
    "createdAtUtc": "2026-10-18T12:00:00Z",
    "updatedAtUtc": "2026-10-18T12:00:00Z"
  }
}
```

</details>

<a id="get-api-card-requests-me"></a>
### `GET /api/card-requests/me`

**Access:** Bearer JWT; `card-requests.view`; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `Status` | query | string | no | — |
| `SubjectType` | query | string | no | — |
| `Page` | query | integer (int32) | no | default: `1`; minimum: 1; maximum: 1000; range 1–1000 |
| `PageSize` | query | integer (int32) | no | default: `20`; minimum: 1; maximum: 100; range 1–100 |

**Request body:** none.

**Success:** HTTP 200; [CardRequestListResponseApiResponse](#model-cardrequestlistresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "items": [
      {
        "fundingSource": "paid",
        "paidAmountMinor": 1200,
        "refundStatus": null,
        "firstDispatchedAtUtc": null,
        "id": 101,
        "ownerUserId": 101,
        "subjectType": "personal",
        "employeeId": null,
        "businessId": null,
        "subjectName": "example",
        "membershipId": "T100000",
        "employeeOccupationCode": null,
        "employeeOccupationName": null,
        "previousCardId": null,
        "replacementReason": null,
        "deliveryAddress": null,
        "legacyApproval": false,
        "fulfillmentClosedAtUtc": null,
        "cardId": null,
        "status": "pending",
        "decisionReason": null,
        "decidedByUserId": null,
        "decidedAtUtc": null,
        "createdAtUtc": "2026-10-18T12:00:00Z",
        "updatedAtUtc": "2026-10-18T12:00:00Z",
        "history": [
          {
            "actorUserId": null,
            "action": "requested",
            "previousStatus": null,
            "status": "pending",
            "note": null,
            "createdAtUtc": "2026-10-18T12:00:00Z"
          }
        ]
      }
    ],
    "page": 1,
    "pageSize": 20,
    "hasMore": false
  }
}
```

</details>

<a id="get-api-card-requests-refunds"></a>
### `GET /api/card-requests/refunds`

**Access:** Bearer JWT; `card-requests.view`; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `UserId` | query | integer (int64) | no | minimum: 1; maximum: 9.223372036854776e+18; range 1–9.223372036854776E+18 |
| `Page` | query | integer (int32) | no | default: `1`; minimum: 1; maximum: 1000; range 1–1000 |
| `PageSize` | query | integer (int32) | no | default: `20`; minimum: 1; maximum: 100; range 1–100 |

**Request body:** none.

**Success:** HTTP 200; [CardPaymentRefundResponsePagedResponseApiResponse](#model-cardpaymentrefundresponsepagedresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "items": [
      {
        "id": 101,
        "userId": 101,
        "cardRequestId": null,
        "amountMinor": 1200,
        "operationId": "11111111-1111-4111-8111-111111111111",
        "status": "processing",
        "reason": "Card request cancelled",
        "createdAtUtc": "2026-10-18T12:00:00Z",
        "updatedAtUtc": "2026-10-18T12:00:00Z"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "hasMore": false
  }
}
```

</details>

<a id="get-api-cards-cardid"></a>
### `GET /api/cards/{cardId}`

**Access:** Bearer JWT; `cards.view`; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `cardId` | path | integer (int64) | yes | — |

**Request body:** none.

**Success:** HTTP 200; [CardResponseApiResponse](#model-cardresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "id": 101,
    "cardNumber": "example",
    "requestId": 101,
    "ownerUserId": 101,
    "subjectType": "personal",
    "employeeId": null,
    "businessId": null,
    "previousCardId": null,
    "subjectName": "example",
    "membershipId": "T100000",
    "employeeOccupationCode": null,
    "employeeOccupationName": null,
    "businessName": null,
    "providerMembershipId": null,
    "deliveryAddress": {
      "streetAddress": "10 Example Street",
      "suburb": "Sydney",
      "regionCode": "NSW",
      "postalCode": "2000"
    },
    "validityYears": 1,
    "issuedAtUtc": "2026-10-18T10:00:00Z",
    "expiresAtUtc": "2027-10-18T10:00:00Z",
    "status": "received",
    "isValid": true,
    "dispatchedAtUtc": "2026-10-18T11:00:00Z",
    "carrier": null,
    "trackingReference": null,
    "receivedAtUtc": "2026-10-18T12:00:00Z",
    "invalidatedAtUtc": null,
    "invalidationReason": null,
    "history": [
      {
        "actorUserId": null,
        "action": "issued",
        "previousStatus": null,
        "status": "issued",
        "note": null,
        "createdAtUtc": "2026-10-18T12:00:00Z"
      }
    ]
  }
}
```

</details>

<a id="post-api-cards-cardid-receive"></a>
### `POST /api/cards/{cardId}/receive`

**Access:** Bearer JWT; `cards.manage`; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `cardId` | path | integer (int64) | yes | — |

**Request body:** none.

**Success:** HTTP 200; [CardResponseApiResponse](#model-cardresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "id": 101,
    "cardNumber": "example",
    "requestId": 101,
    "ownerUserId": 101,
    "subjectType": "personal",
    "employeeId": null,
    "businessId": null,
    "previousCardId": null,
    "subjectName": "example",
    "membershipId": "T100000",
    "employeeOccupationCode": null,
    "employeeOccupationName": null,
    "businessName": null,
    "providerMembershipId": null,
    "deliveryAddress": {
      "streetAddress": "10 Example Street",
      "suburb": "Sydney",
      "regionCode": "NSW",
      "postalCode": "2000"
    },
    "validityYears": 1,
    "issuedAtUtc": "2026-10-18T10:00:00Z",
    "expiresAtUtc": "2027-10-18T10:00:00Z",
    "status": "received",
    "isValid": true,
    "dispatchedAtUtc": "2026-10-18T11:00:00Z",
    "carrier": null,
    "trackingReference": null,
    "receivedAtUtc": "2026-10-18T12:00:00Z",
    "invalidatedAtUtc": null,
    "invalidationReason": null,
    "history": [
      {
        "actorUserId": null,
        "action": "receive",
        "previousStatus": null,
        "status": "received",
        "note": null,
        "createdAtUtc": "2026-10-18T12:00:00Z"
      }
    ]
  }
}
```

</details>

<a id="get-api-price-catalogue"></a>
### `GET /api/price-catalogue`

**Access:** Bearer JWT; `price-catalogue.view`; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `OccupationCode` | query | string | no | max length: 80; max length 80 |
| `Search` | query | string | no | max length: 100; max length 100 |
| `Page` | query | integer (int32) | no | default: `1`; minimum: 1; maximum: 1000; range 1–1000 |
| `PageSize` | query | integer (int32) | no | default: `20`; minimum: 1; maximum: 100; range 1–100 |

**Request body:** none.

**Success:** HTTP 200; [PriceCatalogueListResponseApiResponse](#model-pricecataloguelistresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "items": [
      {
        "id": 101,
        "code": "ELECTRICAL_CHECK",
        "occupationCode": "electrical_services",
        "occupationName": "example",
        "name": "Example item",
        "description": null,
        "currencyCode": "AUD",
        "price": 103.33,
        "status": "published",
        "publishedAtUtc": "2026-10-18T12:00:00Z",
        "retiredAtUtc": null,
        "createdAtUtc": "2026-10-18T12:00:00Z",
        "updatedAtUtc": "2026-10-18T12:00:00Z"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "hasMore": false
  }
}
```

</details>

<a id="get-api-price-catalogue-itemid"></a>
### `GET /api/price-catalogue/{itemId}`

**Access:** Bearer JWT; `price-catalogue.view`; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `itemId` | path | integer (int64) | yes | — |

**Request body:** none.

**Success:** HTTP 200; [PriceCatalogueItemResponseApiResponse](#model-pricecatalogueitemresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "id": 101,
    "code": "ELECTRICAL_CHECK",
    "occupationCode": "electrical_services",
    "occupationName": "example",
    "name": "Example item",
    "description": null,
    "currencyCode": "AUD",
    "price": 103.33,
    "status": "published",
    "publishedAtUtc": "2026-10-18T12:00:00Z",
    "retiredAtUtc": null,
    "createdAtUtc": "2026-10-18T12:00:00Z",
    "updatedAtUtc": "2026-10-18T12:00:00Z"
  }
}
```

</details>

<a id="post-api-provider-prices"></a>
### `POST /api/provider-prices`

**Access:** Bearer JWT; `prices.manage`; full access required.

**Request:** `application/json`; [SubmitProviderPriceRequest](#model-submitproviderpricerequest).

```json
{
  "itemId": 1,
  "price": 150.0
}
```

**Success:** HTTP 200; [ProviderPriceResponseApiResponse](#model-providerpriceresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "id": 101,
    "businessId": 101,
    "businessName": "Example Electrical",
    "businessArchivedAtUtc": null,
    "providerUserId": 101,
    "itemId": 101,
    "itemCode": "ELECTRICAL_CHECK",
    "itemName": "example",
    "itemStatus": "published",
    "occupationCode": "electrical_services",
    "currencyCode": "AUD",
    "calendarYear": 2026,
    "price": 150.0,
    "withdrawnAtUtc": null,
    "createdAtUtc": "2026-10-18T12:00:00Z",
    "updatedAtUtc": "2026-10-18T12:00:00Z"
  }
}
```

</details>

<a id="get-api-provider-prices-id"></a>
### `GET /api/provider-prices/{id}`

**Access:** Bearer JWT; `prices.view`; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `id` | path | integer (int64) | yes | — |

**Request body:** none.

**Success:** HTTP 200; [ProviderPriceResponseApiResponse](#model-providerpriceresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "id": 101,
    "businessId": 101,
    "businessName": "Example Electrical",
    "businessArchivedAtUtc": null,
    "providerUserId": 101,
    "itemId": 101,
    "itemCode": "ELECTRICAL_CHECK",
    "itemName": "example",
    "itemStatus": "published",
    "occupationCode": "electrical_services",
    "currencyCode": "AUD",
    "calendarYear": 2026,
    "price": 150.0,
    "withdrawnAtUtc": null,
    "createdAtUtc": "2026-10-18T12:00:00Z",
    "updatedAtUtc": "2026-10-18T12:00:00Z"
  }
}
```

</details>

<a id="put-api-provider-prices-id"></a>
### `PUT /api/provider-prices/{id}`

**Access:** Bearer JWT; `prices.manage`; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `id` | path | integer (int64) | yes | — |

**Request:** `application/json`; [ChangeProviderPriceRequest](#model-changeproviderpricerequest).

```json
{
  "price": 150.0
}
```

**Success:** HTTP 200; [ProviderPriceResponseApiResponse](#model-providerpriceresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "id": 101,
    "businessId": 101,
    "businessName": "Example Electrical",
    "businessArchivedAtUtc": null,
    "providerUserId": 101,
    "itemId": 101,
    "itemCode": "ELECTRICAL_CHECK",
    "itemName": "example",
    "itemStatus": "published",
    "occupationCode": "electrical_services",
    "currencyCode": "AUD",
    "calendarYear": 2026,
    "price": 150.0,
    "withdrawnAtUtc": null,
    "createdAtUtc": "2026-10-18T12:00:00Z",
    "updatedAtUtc": "2026-10-18T12:00:00Z"
  }
}
```

</details>

<a id="get-api-provider-prices-id-history"></a>
### `GET /api/provider-prices/{id}/history`

**Access:** Bearer JWT; `prices.view`; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `id` | path | integer (int64) | yes | — |
| `Page` | query | integer (int32) | no | default: `1`; minimum: 1; maximum: 1000; range 1–1000 |
| `PageSize` | query | integer (int32) | no | default: `20`; minimum: 1; maximum: 100; range 1–100 |

**Request body:** none.

**Success:** HTTP 200; [ProviderPriceEventResponsePagedResponseApiResponse](#model-providerpriceeventresponsepagedresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "items": [
      {
        "id": 101,
        "submissionId": 101,
        "actorUserId": 101,
        "action": "example",
        "before": null,
        "after": {},
        "createdAtUtc": "2026-10-18T12:00:00Z"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "hasMore": false
  }
}
```

</details>

<a id="post-api-provider-prices-id-restore"></a>
### `POST /api/provider-prices/{id}/restore`

**Access:** Bearer JWT; `prices.manage`; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `id` | path | integer (int64) | yes | — |

**Request:** `application/json`; [ChangeProviderPriceRequest](#model-changeproviderpricerequest).

```json
{
  "price": 150.0
}
```

**Success:** HTTP 200; [ProviderPriceResponseApiResponse](#model-providerpriceresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "id": 101,
    "businessId": 101,
    "businessName": "Example Electrical",
    "businessArchivedAtUtc": null,
    "providerUserId": 101,
    "itemId": 101,
    "itemCode": "ELECTRICAL_CHECK",
    "itemName": "example",
    "itemStatus": "published",
    "occupationCode": "electrical_services",
    "currencyCode": "AUD",
    "calendarYear": 2026,
    "price": 150.0,
    "withdrawnAtUtc": null,
    "createdAtUtc": "2026-10-18T12:00:00Z",
    "updatedAtUtc": "2026-10-18T12:00:00Z"
  }
}
```

</details>

<a id="post-api-provider-prices-id-withdraw"></a>
### `POST /api/provider-prices/{id}/withdraw`

**Access:** Bearer JWT; `prices.delete`; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `id` | path | integer (int64) | yes | — |

**Request body:** none.

**Success:** HTTP 200; [ProviderPriceResponseApiResponse](#model-providerpriceresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "id": 101,
    "businessId": 101,
    "businessName": "Example Electrical",
    "businessArchivedAtUtc": null,
    "providerUserId": 101,
    "itemId": 101,
    "itemCode": "ELECTRICAL_CHECK",
    "itemName": "example",
    "itemStatus": "published",
    "occupationCode": "electrical_services",
    "currencyCode": "AUD",
    "calendarYear": 2026,
    "price": 150.0,
    "withdrawnAtUtc": "2026-10-18T12:00:00Z",
    "createdAtUtc": "2026-10-18T12:00:00Z",
    "updatedAtUtc": "2026-10-18T12:00:00Z"
  }
}
```

</details>

<a id="get-api-provider-prices-available-items"></a>
### `GET /api/provider-prices/available-items`

**Access:** Bearer JWT; `prices.view`; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `Page` | query | integer (int32) | no | default: `1`; minimum: 1; maximum: 1000; range 1–1000 |
| `PageSize` | query | integer (int32) | no | default: `20`; minimum: 1; maximum: 100; range 1–100 |

**Request body:** none.

**Success:** HTTP 200; [ProviderPriceAvailableItemResponsePagedResponseApiResponse](#model-providerpriceavailableitemresponsepagedresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "items": [
      {
        "id": 101,
        "code": "123456",
        "occupationCode": "electrical_services",
        "occupationName": "example",
        "name": "Example item",
        "description": null,
        "currencyCode": "AUD",
        "guidePrice": 150.0,
        "minProviderPrice": 100.0,
        "maxProviderPrice": 200.0,
        "status": "example",
        "publishedAtUtc": null,
        "retiredAtUtc": null,
        "createdAtUtc": "2026-10-18T12:00:00Z",
        "updatedAtUtc": "2026-10-18T12:00:00Z"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "hasMore": false
  }
}
```

</details>

<a id="get-api-provider-prices-current"></a>
### `GET /api/provider-prices/current`

**Access:** Bearer JWT; `prices.view`; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `Page` | query | integer (int32) | no | default: `1`; minimum: 1; maximum: 1000; range 1–1000 |
| `PageSize` | query | integer (int32) | no | default: `20`; minimum: 1; maximum: 100; range 1–100 |

**Request body:** none.

**Success:** HTTP 200; [ProviderCurrentPriceResponsePagedResponseApiResponse](#model-providercurrentpriceresponsepagedresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "items": [
      {
        "id": 101,
        "code": "ELECTRICAL_CHECK",
        "name": "Example item",
        "description": null,
        "occupationCode": "electrical_services",
        "occupationName": "example",
        "currencyCode": "AUD",
        "guidePrice": 100.0,
        "minProviderPrice": 80.0,
        "maxProviderPrice": 150.0,
        "effectivePrice": 100.0,
        "priceSource": "guide",
        "submissionId": null,
        "calendarYear": null,
        "withdrawnAtUtc": null
      }
    ],
    "page": 1,
    "pageSize": 20,
    "hasMore": false
  }
}
```

</details>

<a id="post-api-provider-prices-item-requests"></a>
### `POST /api/provider-prices/item-requests`

**Access:** Bearer JWT; `prices.manage`; full access required.

**Request:** `application/json`; [CreatePriceItemRequest](#model-createpriceitemrequest).

```json
{
  "occupationCode": "electrical_services",
  "proposedName": "Electrical safety check"
}
```

**Success:** HTTP 200; [PriceItemRequestResponseApiResponse](#model-priceitemrequestresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "id": 101,
    "businessId": 101,
    "businessName": "Example Electrical",
    "businessArchivedAtUtc": null,
    "providerUserId": 101,
    "occupationCode": "electrical_services",
    "occupationName": "example",
    "proposedName": "Electrical safety check",
    "proposedDescription": null,
    "suggestedPrice": null,
    "status": "pending",
    "catalogueItemId": null,
    "decisionReason": null,
    "decidedByUserId": null,
    "decidedAtUtc": null,
    "createdAtUtc": "2026-10-18T12:00:00Z",
    "updatedAtUtc": "2026-10-18T12:00:00Z"
  }
}
```

</details>

<a id="get-api-provider-prices-me"></a>
### `GET /api/provider-prices/me`

**Access:** Bearer JWT; `prices.view`; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `BusinessId` | query | integer (int64) | no | minimum: 1; maximum: 9.223372036854776e+18; range 1–9.223372036854776E+18 |
| `ItemId` | query | integer (int64) | no | minimum: 1; maximum: 9.223372036854776e+18; range 1–9.223372036854776E+18 |
| `Year` | query | integer (int32) | no | minimum: 2020; maximum: 9999; range 2020–9999 |
| `IncludeArchived` | query | boolean | no | default: `true` |
| `IncludeWithdrawn` | query | boolean | no | default: `true` |
| `Page` | query | integer (int32) | no | default: `1`; minimum: 1; maximum: 1000; range 1–1000 |
| `PageSize` | query | integer (int32) | no | default: `20`; minimum: 1; maximum: 100; range 1–100 |

**Request body:** none.

**Success:** HTTP 200; [ProviderPriceResponsePagedResponseApiResponse](#model-providerpriceresponsepagedresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "items": [
      {
        "id": 101,
        "businessId": 101,
        "businessName": "Example Electrical",
        "businessArchivedAtUtc": null,
        "providerUserId": 101,
        "itemId": 101,
        "itemCode": "ELECTRICAL_CHECK",
        "itemName": "example",
        "itemStatus": "published",
        "occupationCode": "electrical_services",
        "currencyCode": "AUD",
        "calendarYear": 2026,
        "price": 150.0,
        "withdrawnAtUtc": null,
        "createdAtUtc": "2026-10-18T12:00:00Z",
        "updatedAtUtc": "2026-10-18T12:00:00Z"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "hasMore": false
  }
}
```

</details>

<a id="get-api-services-search"></a>
### `GET /api/services/search`

**Access:** Bearer JWT; `services.view`; full access required.

| Parameter | In | Type | Required | Default / validation |
|---|---|---|---|---|
| `Latitude` | query | number (double) | yes | minimum: -90; maximum: 90; required; nonblank for strings; range -90–90 |
| `Longitude` | query | number (double) | yes | minimum: -180; maximum: 180; required; nonblank for strings; range -180–180 |
| `MembershipId` | query | string | no | max length: 80; max length 80 |
| `OccupationCode` | query | string | no | max length: 80; max length 80 |
| `Page` | query | integer (int32) | no | default: `1`; minimum: 1; maximum: 1000; range 1–1000 |
| `PageSize` | query | integer (int32) | no | default: `20`; minimum: 1; maximum: 100; range 1–100 |

**Request body:** none.

**Success:** HTTP 200; [ServiceSearchResponseApiResponse](#model-servicesearchresponseapiresponse).

<details>
<summary>Illustrative success response</summary>

```json
{
  "traceId": "example-trace-id",
  "code": "Success",
  "data": {
    "items": [
      {
        "id": 101,
        "title": "Example service update",
        "description": "Example description of the work.",
        "occupationCode": "electrical_services",
        "occupationName": "example",
        "suburb": "Sydney",
        "regionCode": "NSW",
        "latitude": -33.8688,
        "longitude": 151.2093,
        "createdAtUtc": "2026-10-18T12:00:00Z",
        "providerUserId": 101,
        "providerMembershipId": "example",
        "providerUserTypeCode": "example",
        "providerName": "example",
        "profilePictureUrl": null,
        "businessName": "Example Electrical",
        "businessPictureUrl": null,
        "businessLatitude": 1,
        "businessLongitude": 1,
        "distanceKm": null,
        "canRequestInspection": false,
        "providerAverageRating": null,
        "providerRatingCount": 0
      }
    ],
    "page": 1,
    "pageSize": 20,
    "hasMore": false
  }
}
```

</details>

## Models and field rules

Required means the field is declared required in the DTO/validation contract. Nullable is separate and is taken from the C# model where available (Swagger can overstate nullable reference fields). For inputs, `[Required]` rejects null/blank even where the CLR type is nullable. Request defaults apply when a field is omitted; defaults do not make conditional business requirements optional.

<a id="model-admincancelcardrequest"></a>
### `AdminCancelCardRequest`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `reason` | string | yes | no | min length: 1; max length: 2000; required; nonblank for strings; max length 2000 |

<a id="model-admincardactionrequest"></a>
### `AdminCardActionRequest`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `action` | string | yes | no | min length: 1; pattern: `^(dispatch\|delivery_failed\|resend\|reissue\|receive\|void)$`; required; nonblank for strings; pattern: ^(dispatch\|delivery_failed\|resend\|reissue\|receive\|void)$ |
| `reason` | string | no | yes | max length: 2000; max length 2000 |
| `carrier` | string | no | yes | max length: 100; max length 100 |
| `trackingReference` | string | no | yes | max length: 200; max length 200 |

<a id="model-admincarddecisionrequest"></a>
### `AdminCardDecisionRequest`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `action` | string | yes | no | min length: 1; pattern: `^(accept\|reject)$`; required; nonblank for strings; pattern: ^(accept\|reject)$ |
| `reason` | string | no | yes | max length: 2000; max length 2000 |

<a id="model-admincreatecardrequest"></a>
### `AdminCreateCardRequest`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `auditReason` | string | yes | no | min length: 1; max length: 2000; required; nonblank for strings; max length 2000 |
| `employeeId` | integer (int64) | no | yes | minimum: 1; maximum: 9.223372036854776e+18; range 1–9.223372036854776E+18 |
| `previousCardId` | integer (int64) | no | yes | minimum: 1; maximum: 9.223372036854776e+18; range 1–9.223372036854776E+18 |
| `replacementReason` | string | no | yes | pattern: `^(expired\|damaged\|lost)$`; pattern: ^(expired\|damaged\|lost)$ |

<a id="model-booleanapiresponse"></a>
### `BooleanApiResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `traceId` | string | yes | no | — |
| `code` | string | yes | no | — |
| `data` | boolean | no | yes | — |

<a id="model-cardallowanceresponse"></a>
### `CardAllowanceResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `available` | integer (int64) | no | no | — |
| `cardFeeMinor` | integer (int64) | no | yes | — |
| `cardRequestsEnabled` | boolean | no | no | — |
| `allowances` | [CardAllowanceUnitResponse](#model-cardallowanceunitresponse)[] | no | no | — |

<a id="model-cardallowanceresponseapiresponse"></a>
### `CardAllowanceResponseApiResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `traceId` | string | yes | no | — |
| `code` | string | yes | no | — |
| `data` | [CardAllowanceResponse](#model-cardallowanceresponse) | no | yes | — |

<a id="model-cardallowanceunitresponse"></a>
### `CardAllowanceUnitResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `id` | integer (int64) | no | no | — |
| `status` | string | yes | no | — |
| `createdAtUtc` | string (date-time) | no | no | — |

<a id="model-carddeliveryaddressrequest"></a>
### `CardDeliveryAddressRequest`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `streetAddress` | string | yes | no | min length: 1; max length: 255; required; nonblank for strings; max length 255 |
| `suburb` | string | yes | no | min length: 1; max length: 100; required; nonblank for strings; max length 100 |
| `regionCode` | string | yes | no | min length: 1; max length: 20; required; nonblank for strings; max length 20 |
| `postalCode` | string | yes | no | min length: 1; max length: 20; required; nonblank for strings; max length 20 |

<a id="model-carddeliveryaddressresponse"></a>
### `CardDeliveryAddressResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `streetAddress` | string | yes | no | — |
| `suburb` | string | yes | no | — |
| `regionCode` | string | yes | no | — |
| `postalCode` | string | yes | no | — |

<a id="model-cardeventresponse"></a>
### `CardEventResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `actorUserId` | integer (int64) | no | yes | — |
| `action` | string | yes | no | — |
| `previousStatus` | string | no | yes | — |
| `status` | string | yes | no | — |
| `note` | string | no | yes | — |
| `createdAtUtc` | string (date-time) | yes | no | — |

<a id="model-cardpaymentrefundresponse"></a>
### `CardPaymentRefundResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `id` | integer (int64) | no | no | — |
| `userId` | integer (int64) | no | no | — |
| `cardRequestId` | integer (int64) | no | yes | — |
| `amountMinor` | integer (int64) | no | no | — |
| `operationId` | string (uuid) | no | no | — |
| `status` | string | yes | no | — |
| `reason` | string | yes | no | — |
| `createdAtUtc` | string (date-time) | no | no | — |
| `updatedAtUtc` | string (date-time) | no | no | — |

<a id="model-cardpaymentrefundresponsepagedresponse"></a>
### `CardPaymentRefundResponsePagedResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `items` | [CardPaymentRefundResponse](#model-cardpaymentrefundresponse)[] | yes | no | — |
| `page` | integer (int32) | yes | no | — |
| `pageSize` | integer (int32) | yes | no | — |
| `hasMore` | boolean | yes | no | — |

<a id="model-cardpaymentrefundresponsepagedresponseapiresponse"></a>
### `CardPaymentRefundResponsePagedResponseApiResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `traceId` | string | yes | no | — |
| `code` | string | yes | no | — |
| `data` | [CardPaymentRefundResponsePagedResponse](#model-cardpaymentrefundresponsepagedresponse) | no | yes | — |

<a id="model-cardpaymentrequest"></a>
### `CardPaymentRequest`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `requestId` | string (uuid) | no | no | default: `"00000000-0000-0000-0000-000000000000"` |
| `consentAccepted` | boolean | no | no | default: `false` |
| `employeeId` | integer (int64) | no | yes | minimum: 1; maximum: 9.223372036854776e+18; range 1–9.223372036854776E+18 |
| `previousCardId` | integer (int64) | no | yes | minimum: 1; maximum: 9.223372036854776e+18; range 1–9.223372036854776E+18 |
| `replacementReason` | string | no | yes | pattern: `^(expired\|damaged\|lost)$`; pattern: ^(expired\|damaged\|lost)$ |
| `streetAddress` | string | yes | no | min length: 1; max length: 200; required; nonblank for strings; max length 200 |
| `suburb` | string | yes | no | min length: 1; max length: 100; required; nonblank for strings; max length 100 |
| `regionCode` | string | yes | no | min length: 1; max length: 80; required; nonblank for strings; max length 80 |
| `postalCode` | string | yes | no | min length: 1; max length: 20; required; nonblank for strings; max length 20 |

<a id="model-cardrequesteventresponse"></a>
### `CardRequestEventResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `actorUserId` | integer (int64) | no | yes | — |
| `action` | string | yes | no | — |
| `previousStatus` | string | no | yes | — |
| `status` | string | yes | no | — |
| `note` | string | no | yes | — |
| `createdAtUtc` | string (date-time) | yes | no | — |

<a id="model-cardrequestlistresponse"></a>
### `CardRequestListResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `items` | [CardRequestResponse](#model-cardrequestresponse)[] | yes | no | — |
| `page` | integer (int32) | yes | no | — |
| `pageSize` | integer (int32) | yes | no | — |
| `hasMore` | boolean | yes | no | — |

<a id="model-cardrequestlistresponseapiresponse"></a>
### `CardRequestListResponseApiResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `traceId` | string | yes | no | — |
| `code` | string | yes | no | — |
| `data` | [CardRequestListResponse](#model-cardrequestlistresponse) | no | yes | — |

<a id="model-cardrequestresponse"></a>
### `CardRequestResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `fundingSource` | string | no | no | — |
| `paidAmountMinor` | integer (int64) | no | yes | — |
| `refundStatus` | string | no | yes | — |
| `firstDispatchedAtUtc` | string (date-time) | no | yes | — |
| `id` | integer (int64) | yes | no | — |
| `ownerUserId` | integer (int64) | yes | no | — |
| `subjectType` | string | yes | no | — |
| `employeeId` | integer (int64) | no | yes | — |
| `businessId` | integer (int64) | no | yes | — |
| `subjectName` | string | yes | no | — |
| `membershipId` | string | no | yes | — |
| `employeeOccupationCode` | string | no | yes | — |
| `employeeOccupationName` | string | no | yes | — |
| `previousCardId` | integer (int64) | no | yes | — |
| `replacementReason` | string | no | yes | — |
| `deliveryAddress` | [CardDeliveryAddressResponse](#model-carddeliveryaddressresponse) | no | yes | — |
| `legacyApproval` | boolean | yes | no | — |
| `fulfillmentClosedAtUtc` | string (date-time) | no | yes | — |
| `cardId` | integer (int64) | no | yes | — |
| `status` | string | yes | no | — |
| `decisionReason` | string | no | yes | — |
| `decidedByUserId` | integer (int64) | no | yes | — |
| `decidedAtUtc` | string (date-time) | no | yes | — |
| `createdAtUtc` | string (date-time) | yes | no | — |
| `updatedAtUtc` | string (date-time) | yes | no | — |
| `history` | [CardRequestEventResponse](#model-cardrequesteventresponse)[] | yes | no | — |

<a id="model-cardrequestresponseapiresponse"></a>
### `CardRequestResponseApiResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `traceId` | string | yes | no | — |
| `code` | string | yes | no | — |
| `data` | [CardRequestResponse](#model-cardrequestresponse) | no | yes | — |

<a id="model-cardresponse"></a>
### `CardResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `id` | integer (int64) | yes | no | — |
| `cardNumber` | string | yes | no | — |
| `requestId` | integer (int64) | yes | no | — |
| `ownerUserId` | integer (int64) | yes | no | — |
| `subjectType` | string | yes | no | — |
| `employeeId` | integer (int64) | no | yes | — |
| `businessId` | integer (int64) | no | yes | — |
| `previousCardId` | integer (int64) | no | yes | — |
| `subjectName` | string | yes | no | — |
| `membershipId` | string | no | yes | — |
| `employeeOccupationCode` | string | no | yes | — |
| `employeeOccupationName` | string | no | yes | — |
| `businessName` | string | no | yes | — |
| `providerMembershipId` | string | no | yes | — |
| `deliveryAddress` | [CardDeliveryAddressResponse](#model-carddeliveryaddressresponse) | yes | no | — |
| `validityYears` | integer (int32) | yes | no | — |
| `issuedAtUtc` | string (date-time) | yes | no | — |
| `expiresAtUtc` | string (date-time) | yes | no | — |
| `status` | string | yes | no | — |
| `isValid` | boolean | yes | no | — |
| `dispatchedAtUtc` | string (date-time) | no | yes | — |
| `carrier` | string | no | yes | — |
| `trackingReference` | string | no | yes | — |
| `receivedAtUtc` | string (date-time) | no | yes | — |
| `invalidatedAtUtc` | string (date-time) | no | yes | — |
| `invalidationReason` | string | no | yes | — |
| `history` | [CardEventResponse](#model-cardeventresponse)[] | yes | no | — |

<a id="model-cardresponseapiresponse"></a>
### `CardResponseApiResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `traceId` | string | yes | no | — |
| `code` | string | yes | no | — |
| `data` | [CardResponse](#model-cardresponse) | no | yes | — |

<a id="model-changeproviderpricerequest"></a>
### `ChangeProviderPriceRequest`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `price` | number (double) | yes | yes | minimum: 0.01; maximum: 9999999999.99; required; nonblank for strings; range 0.01–9999999999.99 |

<a id="model-createpricecatalogueitemrequest"></a>
### `CreatePriceCatalogueItemRequest`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `code` | string | yes | no | min length: 1; max length: 30; required; nonblank for strings; max length 30 |
| `occupationCode` | string | yes | no | min length: 1; max length: 80; required; nonblank for strings; max length 80 |
| `name` | string | yes | no | min length: 1; max length: 150; required; nonblank for strings; max length 150 |
| `description` | string | no | yes | max length: 2000; max length 2000 |
| `guidePrice` | number (double) | yes | yes | minimum: 0.01; maximum: 9999999999.99; required; nonblank for strings; range 0.01–9999999999.99 |
| `minProviderPrice` | number (double) | yes | yes | minimum: 0.01; maximum: 9999999999.99; required; nonblank for strings; range 0.01–9999999999.99 |
| `maxProviderPrice` | number (double) | yes | yes | minimum: 0.01; maximum: 9999999999.99; required; nonblank for strings; range 0.01–9999999999.99 |

<a id="model-createpriceitemrequest"></a>
### `CreatePriceItemRequest`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `occupationCode` | string | yes | no | min length: 1; max length: 80; required; nonblank for strings; max length 80 |
| `proposedName` | string | yes | no | min length: 1; max length: 150; required; nonblank for strings; max length 150 |
| `proposedDescription` | string | no | yes | max length: 2000; max length 2000 |
| `suggestedPrice` | number (double) | no | yes | minimum: 0.01; maximum: 9999999999.99; range 0.01–9999999999.99 |

<a id="model-discoveredserviceresponse"></a>
### `DiscoveredServiceResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `id` | integer (int64) | yes | no | — |
| `title` | string | yes | no | — |
| `description` | string | yes | no | — |
| `occupationCode` | string | yes | no | — |
| `occupationName` | string | yes | no | — |
| `suburb` | string | yes | no | — |
| `regionCode` | string | yes | no | — |
| `latitude` | number (double) | yes | no | — |
| `longitude` | number (double) | yes | no | — |
| `createdAtUtc` | string (date-time) | yes | no | — |
| `providerUserId` | integer (int64) | yes | no | — |
| `providerMembershipId` | string | yes | no | — |
| `providerUserTypeCode` | string | yes | no | — |
| `providerName` | string | yes | no | — |
| `profilePictureUrl` | string | no | yes | — |
| `businessName` | string | yes | no | — |
| `businessPictureUrl` | string | no | yes | — |
| `businessLatitude` | number (double) | yes | no | — |
| `businessLongitude` | number (double) | yes | no | — |
| `distanceKm` | number (double) | no | yes | — |
| `canRequestInspection` | boolean | yes | no | — |
| `providerAverageRating` | number (double) | no | yes | — |
| `providerRatingCount` | integer (int64) | yes | no | — |

<a id="model-globalpriceoverriderequest"></a>
### `GlobalPriceOverrideRequest`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `price` | number (double) | no | yes | minimum: 0.01; maximum: 9999999999.99; range 0.01–9999999999.99 |
| `reason` | string | yes | no | min length: 1; max length: 2000; required; nonblank for strings; max length 2000 |

<a id="model-grantconfirmationsrequest"></a>
### `GrantConfirmationsRequest`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `requestId` | string (uuid) | no | no | default: `"00000000-0000-0000-0000-000000000000"` |
| `userId` | integer (int64) | no | no | default: `0`; minimum: 1; maximum: 9.223372036854776e+18; range 1–9.223372036854776E+18 |
| `count` | integer (int32) | no | no | default: `0`; minimum: 1; maximum: 1000; range 1–1000 |
| `reason` | string | yes | no | min length: 1; max length: 2000; required; nonblank for strings; max length 2000 |

<a id="model-marketplacesettingsrequest"></a>
### `MarketplaceSettingsRequest`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `searchRadiusKm` | number (double) | no | no | default: `50`; minimum: 1; maximum: 79228162514264337593543950335; range 1–79228162514264337593543950335 |
| `cardRequestsEnabled` | boolean | no | no | default: `false` |
| `cardFeeMinor` | integer (int64) | no | yes | minimum: 50; maximum: 99999999; range 50–99999999 |
| `reason` | string | yes | no | min length: 1; max length: 2000; required; nonblank for strings; max length 2000 |

<a id="model-marketplacesettingsresponse"></a>
### `MarketplaceSettingsResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `searchRadiusKm` | number (double) | no | no | — |
| `cardRequestsEnabled` | boolean | no | no | — |
| `cardFeeMinor` | integer (int64) | no | yes | — |
| `updatedAtUtc` | string (date-time) | no | no | — |

<a id="model-marketplacesettingsresponseapiresponse"></a>
### `MarketplaceSettingsResponseApiResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `traceId` | string | yes | no | — |
| `code` | string | yes | no | — |
| `data` | [MarketplaceSettingsResponse](#model-marketplacesettingsresponse) | no | yes | — |

<a id="model-paymentoperationresponse"></a>
### `PaymentOperationResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `id` | string (uuid) | no | no | — |
| `kind` | string | yes | no | — |
| `status` | string | yes | no | — |
| `checkoutUrl` | string | no | yes | — |
| `inspectionId` | integer (int64) | no | yes | — |
| `cardRequestId` | integer (int64) | no | yes | — |
| `refundRequired` | boolean | no | no | — |
| `errorCode` | string | no | yes | — |
| `createdAtUtc` | string (date-time) | no | no | — |
| `updatedAtUtc` | string (date-time) | no | no | — |

<a id="model-paymentoperationresponseapiresponse"></a>
### `PaymentOperationResponseApiResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `traceId` | string | yes | no | — |
| `code` | string | yes | no | — |
| `data` | [PaymentOperationResponse](#model-paymentoperationresponse) | no | yes | — |

<a id="model-paymentreasonrequest"></a>
### `PaymentReasonRequest`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `reason` | string | yes | no | min length: 1; max length: 2000; required; nonblank for strings; max length 2000 |

<a id="model-pricecatalogueeventlistresponse"></a>
### `PriceCatalogueEventListResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `items` | [PriceCatalogueEventResponse](#model-pricecatalogueeventresponse)[] | yes | no | — |
| `page` | integer (int32) | yes | no | — |
| `pageSize` | integer (int32) | yes | no | — |
| `hasMore` | boolean | yes | no | — |

<a id="model-pricecatalogueeventlistresponseapiresponse"></a>
### `PriceCatalogueEventListResponseApiResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `traceId` | string | yes | no | — |
| `code` | string | yes | no | — |
| `data` | [PriceCatalogueEventListResponse](#model-pricecatalogueeventlistresponse) | no | yes | — |

<a id="model-pricecatalogueeventresponse"></a>
### `PriceCatalogueEventResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `id` | integer (int64) | yes | no | — |
| `itemId` | integer (int64) | yes | no | — |
| `actorUserId` | integer (int64) | yes | no | — |
| `action` | string | yes | no | — |
| `before` | object | no | yes | — |
| `after` | object | yes | no | — |
| `createdAtUtc` | string (date-time) | yes | no | — |

<a id="model-pricecatalogueitemresponse"></a>
### `PriceCatalogueItemResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `id` | integer (int64) | yes | no | — |
| `code` | string | yes | no | — |
| `occupationCode` | string | yes | no | — |
| `occupationName` | string | yes | no | — |
| `name` | string | yes | no | — |
| `description` | string | no | yes | — |
| `currencyCode` | string | yes | no | — |
| `guidePrice` | number (double) | no | yes | — |
| `minProviderPrice` | number (double) | no | yes | — |
| `maxProviderPrice` | number (double) | no | yes | — |
| `providerAveragePrice` | number (double) | no | yes | — |
| `providerSubmissionCount` | integer (int32) | no | yes | — |
| `price` | number (double) | no | no | — |
| `globalOverride` | number (double) | no | yes | — |
| `status` | string | yes | no | — |
| `publishedAtUtc` | string (date-time) | no | yes | — |
| `retiredAtUtc` | string (date-time) | no | yes | — |
| `createdAtUtc` | string (date-time) | yes | no | — |
| `updatedAtUtc` | string (date-time) | yes | no | — |

<a id="model-pricecatalogueitemresponseapiresponse"></a>
### `PriceCatalogueItemResponseApiResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `traceId` | string | yes | no | — |
| `code` | string | yes | no | — |
| `data` | [PriceCatalogueItemResponse](#model-pricecatalogueitemresponse) | no | yes | — |

<a id="model-pricecataloguelistresponse"></a>
### `PriceCatalogueListResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `items` | [PriceCatalogueItemResponse](#model-pricecatalogueitemresponse)[] | yes | no | — |
| `page` | integer (int32) | yes | no | — |
| `pageSize` | integer (int32) | yes | no | — |
| `hasMore` | boolean | yes | no | — |

<a id="model-pricecataloguelistresponseapiresponse"></a>
### `PriceCatalogueListResponseApiResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `traceId` | string | yes | no | — |
| `code` | string | yes | no | — |
| `data` | [PriceCatalogueListResponse](#model-pricecataloguelistresponse) | no | yes | — |

<a id="model-priceitemrequestresponse"></a>
### `PriceItemRequestResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `id` | integer (int64) | yes | no | — |
| `businessId` | integer (int64) | yes | no | — |
| `businessName` | string | yes | no | — |
| `businessArchivedAtUtc` | string (date-time) | no | yes | — |
| `providerUserId` | integer (int64) | yes | no | — |
| `occupationCode` | string | yes | no | — |
| `occupationName` | string | yes | no | — |
| `proposedName` | string | yes | no | — |
| `proposedDescription` | string | no | yes | — |
| `suggestedPrice` | number (double) | no | yes | — |
| `status` | string | yes | no | — |
| `catalogueItemId` | integer (int64) | no | yes | — |
| `decisionReason` | string | no | yes | — |
| `decidedByUserId` | integer (int64) | no | yes | — |
| `decidedAtUtc` | string (date-time) | no | yes | — |
| `createdAtUtc` | string (date-time) | yes | no | — |
| `updatedAtUtc` | string (date-time) | yes | no | — |

<a id="model-priceitemrequestresponseapiresponse"></a>
### `PriceItemRequestResponseApiResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `traceId` | string | yes | no | — |
| `code` | string | yes | no | — |
| `data` | [PriceItemRequestResponse](#model-priceitemrequestresponse) | no | yes | — |

<a id="model-providercurrentpriceresponse"></a>
### `ProviderCurrentPriceResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `id` | integer (int64) | no | no | — |
| `code` | string | yes | no | — |
| `name` | string | yes | no | — |
| `description` | string | no | yes | — |
| `occupationCode` | string | yes | no | — |
| `occupationName` | string | yes | no | — |
| `currencyCode` | string | yes | no | — |
| `guidePrice` | number (double) | no | no | — |
| `minProviderPrice` | number (double) | no | no | — |
| `maxProviderPrice` | number (double) | no | no | — |
| `effectivePrice` | number (double) | no | no | — |
| `priceSource` | string | yes | no | — |
| `submissionId` | integer (int64) | no | yes | — |
| `calendarYear` | integer (int32) | no | yes | — |
| `withdrawnAtUtc` | string (date-time) | no | yes | — |

<a id="model-providercurrentpriceresponsepagedresponse"></a>
### `ProviderCurrentPriceResponsePagedResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `items` | [ProviderCurrentPriceResponse](#model-providercurrentpriceresponse)[] | yes | no | — |
| `page` | integer (int32) | yes | no | — |
| `pageSize` | integer (int32) | yes | no | — |
| `hasMore` | boolean | yes | no | — |

<a id="model-providercurrentpriceresponsepagedresponseapiresponse"></a>
### `ProviderCurrentPriceResponsePagedResponseApiResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `traceId` | string | yes | no | — |
| `code` | string | yes | no | — |
| `data` | [ProviderCurrentPriceResponsePagedResponse](#model-providercurrentpriceresponsepagedresponse) | no | yes | — |

<a id="model-providerpriceavailableitemresponse"></a>
### `ProviderPriceAvailableItemResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `id` | integer (int64) | yes | no | — |
| `code` | string | yes | no | — |
| `occupationCode` | string | yes | no | — |
| `occupationName` | string | yes | no | — |
| `name` | string | yes | no | — |
| `description` | string | no | yes | — |
| `currencyCode` | string | yes | no | — |
| `guidePrice` | number (double) | no | no | — |
| `minProviderPrice` | number (double) | yes | no | — |
| `maxProviderPrice` | number (double) | yes | no | — |
| `status` | string | yes | no | — |
| `publishedAtUtc` | string (date-time) | no | yes | — |
| `retiredAtUtc` | string (date-time) | no | yes | — |
| `createdAtUtc` | string (date-time) | yes | no | — |
| `updatedAtUtc` | string (date-time) | yes | no | — |

<a id="model-providerpriceavailableitemresponsepagedresponse"></a>
### `ProviderPriceAvailableItemResponsePagedResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `items` | [ProviderPriceAvailableItemResponse](#model-providerpriceavailableitemresponse)[] | yes | no | — |
| `page` | integer (int32) | yes | no | — |
| `pageSize` | integer (int32) | yes | no | — |
| `hasMore` | boolean | yes | no | — |

<a id="model-providerpriceavailableitemresponsepagedresponseapiresponse"></a>
### `ProviderPriceAvailableItemResponsePagedResponseApiResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `traceId` | string | yes | no | — |
| `code` | string | yes | no | — |
| `data` | [ProviderPriceAvailableItemResponsePagedResponse](#model-providerpriceavailableitemresponsepagedresponse) | no | yes | — |

<a id="model-providerpriceeventresponse"></a>
### `ProviderPriceEventResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `id` | integer (int64) | yes | no | — |
| `submissionId` | integer (int64) | yes | no | — |
| `actorUserId` | integer (int64) | yes | no | — |
| `action` | string | yes | no | — |
| `before` | object | no | yes | — |
| `after` | object | yes | no | — |
| `createdAtUtc` | string (date-time) | yes | no | — |

<a id="model-providerpriceeventresponsepagedresponse"></a>
### `ProviderPriceEventResponsePagedResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `items` | [ProviderPriceEventResponse](#model-providerpriceeventresponse)[] | yes | no | — |
| `page` | integer (int32) | yes | no | — |
| `pageSize` | integer (int32) | yes | no | — |
| `hasMore` | boolean | yes | no | — |

<a id="model-providerpriceeventresponsepagedresponseapiresponse"></a>
### `ProviderPriceEventResponsePagedResponseApiResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `traceId` | string | yes | no | — |
| `code` | string | yes | no | — |
| `data` | [ProviderPriceEventResponsePagedResponse](#model-providerpriceeventresponsepagedresponse) | no | yes | — |

<a id="model-providerpriceresponse"></a>
### `ProviderPriceResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `id` | integer (int64) | yes | no | — |
| `businessId` | integer (int64) | yes | no | — |
| `businessName` | string | yes | no | — |
| `businessArchivedAtUtc` | string (date-time) | no | yes | — |
| `providerUserId` | integer (int64) | yes | no | — |
| `itemId` | integer (int64) | yes | no | — |
| `itemCode` | string | yes | no | — |
| `itemName` | string | yes | no | — |
| `itemStatus` | string | yes | no | — |
| `occupationCode` | string | yes | no | — |
| `currencyCode` | string | yes | no | — |
| `calendarYear` | integer (int32) | yes | no | — |
| `price` | number (double) | yes | no | — |
| `withdrawnAtUtc` | string (date-time) | no | yes | — |
| `createdAtUtc` | string (date-time) | yes | no | — |
| `updatedAtUtc` | string (date-time) | yes | no | — |

<a id="model-providerpriceresponseapiresponse"></a>
### `ProviderPriceResponseApiResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `traceId` | string | yes | no | — |
| `code` | string | yes | no | — |
| `data` | [ProviderPriceResponse](#model-providerpriceresponse) | no | yes | — |

<a id="model-providerpriceresponsepagedresponse"></a>
### `ProviderPriceResponsePagedResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `items` | [ProviderPriceResponse](#model-providerpriceresponse)[] | yes | no | — |
| `page` | integer (int32) | yes | no | — |
| `pageSize` | integer (int32) | yes | no | — |
| `hasMore` | boolean | yes | no | — |

<a id="model-providerpriceresponsepagedresponseapiresponse"></a>
### `ProviderPriceResponsePagedResponseApiResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `traceId` | string | yes | no | — |
| `code` | string | yes | no | — |
| `data` | [ProviderPriceResponsePagedResponse](#model-providerpriceresponsepagedresponse) | no | yes | — |

<a id="model-servicesearchresponse"></a>
### `ServiceSearchResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `items` | [DiscoveredServiceResponse](#model-discoveredserviceresponse)[] | yes | no | — |
| `page` | integer (int32) | yes | no | — |
| `pageSize` | integer (int32) | yes | no | — |
| `hasMore` | boolean | yes | no | — |

<a id="model-servicesearchresponseapiresponse"></a>
### `ServiceSearchResponseApiResponse`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `traceId` | string | yes | no | — |
| `code` | string | yes | no | — |
| `data` | [ServiceSearchResponse](#model-servicesearchresponse) | no | yes | — |

<a id="model-submitproviderpricerequest"></a>
### `SubmitProviderPriceRequest`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `itemId` | integer (int64) | yes | no | minimum: 1; maximum: 9.223372036854776e+18; range 1–9.223372036854776E+18 |
| `price` | number (double) | yes | yes | minimum: 0.01; maximum: 9999999999.99; required; nonblank for strings; range 0.01–9999999999.99 |

<a id="model-updatepricecatalogueitemrequest"></a>
### `UpdatePriceCatalogueItemRequest`

| JSON field | Type | Required | Nullable | Default / validation |
|---|---|---|---|---|
| `name` | string | yes | no | min length: 1; max length: 150; required; nonblank for strings; max length 150 |
| `description` | string | no | yes | max length: 2000; max length 2000 |
| `guidePrice` | number (double) | yes | yes | minimum: 0.01; maximum: 9999999999.99; required; nonblank for strings; range 0.01–9999999999.99 |
| `minProviderPrice` | number (double) | yes | yes | minimum: 0.01; maximum: 9999999999.99; required; nonblank for strings; range 0.01–9999999999.99 |
| `maxProviderPrice` | number (double) | yes | yes | minimum: 0.01; maximum: 9999999999.99; required; nonblank for strings; range 0.01–9999999999.99 |

<!-- GENERATED API REFERENCE: END -->
