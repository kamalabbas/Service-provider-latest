# Frontend change handoff

## Annual access, businesses, employees, cards and pricing

**Prepared 12 November 2026**  
**Backend baseline V040**  
**Audience Web, mobile and administration frontend teams**

This handoff covers the latest member-eligibility and annual-payment changes. Confirm that the target API has migrations through V040 and the matching API release before acceptance testing.

## 1. Member eligibility

Read the member's `userTypeCode` from `GET /api/members/me`. Combine user-type eligibility with the operation's required permissions and profile/business prerequisites.

| User type | Business | Service listings | Employees | Personal membership card | Employee cards | My Prices | Global Price guide |
|---|---|---|---|---|---|---|---|
| Tradeperson | Eligible | Eligible | Eligible | Eligible | Eligible | Eligible | Annual price-list benefit |
| Individual | Eligible | — | — | — | — | — | Annual price-list benefit |
| Builder | Eligible | — | — | — | — | — | Annual price-list benefit |
| Developer | Eligible | — | — | — | — | — | Annual price-list benefit |
| Public & Government Sector | — | — | — | — | — | — | Annual price-list benefit |

The API codes are `tradeperson`, `individual`, `builder`, `developer` and `public_government_sector`.

### Businesses

- Show business creation and management for Tradepeople, Individuals, Builders and Developers.
- Apply the existing one-active-business rule and business-name, valid ABN, optional valid ACN, address and coordinate requirements.
- Government is ineligible for business management through every actor, including SuperAdmin.
- Profiles collect the required information for each member type.

### Services and employees

- Show service-listing and employee-management screens for Tradepeople.
- Employee rosters belong to the Tradeperson's business. Tradepeople can assign eligible employees to inspections through the existing inspection workflow.
- Apply the relevant `services.*` and `employees.*` permissions to reads, writes and lifecycle removals.

### Navigation and direct links

For Individual, Builder, Developer and Government member screens, remove Services, Employees, My Prices and Membership cards from navigation, dashboard widgets and shortcuts. Guard direct routes too.

Show the Global Price guide entry according to `price-catalogue.view`, and use the returned price-list entitlement to display its content or purchase prompt.

SuperAdmin screens use explicit administrative endpoints. Filter business-owner selectors to the four eligible types. Filter new provider-record and card-owner selectors to Tradepeople.

## 2. Physical membership cards

Only Tradeperson owners may request personal cards or cards for their employees.

| Card | Prerequisites |
|---|---|
| Personal membership card | Completed Tradeperson profile and required card permissions. |
| Employee card | Tradeperson owner, active owned business, eligible active employee and required card/employee permissions. |

Card eligibility is independent of paid annual access. Card validity uses the separate SuperAdmin-configured duration.

The card workflow includes the configured fee or complimentary allowance, admin approval, issuance, dispatch, authenticated receipt and eligible replacements. Use the unified funded request endpoint for personal, employee and replacement requests.

```http
POST /api/card-requests/checkout
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

Add `employeeId` for an employee. Replacements also supply `previousCardId` and `replacementReason`. Follow the returned payment operation until the request is created or its financial outcome is resolved. The detailed guide covers allowance selection, replacement rules, fulfillment and automatic refunds. [Card funding and fulfillment](22-marketplace-updates.md#starting-a-paid-or-complimentary-physical-card-request).

## 3. My Prices and the Global Price guide

### Tradeperson's private list

- Show My Prices for Tradepeople with the required `prices.*` permissions.
- Use `GET /api/provider-prices/current` for published items matching the Tradeperson's active service occupations.
- Display `effectivePrice`, `priceSource`, Guide and the permitted Min/Max range.
- A latest custom annual submission supplies the effective price. The current Guide supplies the default when there is no custom submission or the latest submission is withdrawn.
- Tradepeople can maintain their private prices without purchasing an annual plan, subject to the existing provider prerequisites and annual submission rules.
- Member access to submissions, history and item suggestions requires Tradeperson type. Explicit SuperAdmin history views support administrative investigation.

### Global contributions

A Tradeperson's effective prices contribute only while all of these conditions hold.

1. The account is active and verified, with a completed Tradeperson profile.
2. The business is active.
3. An eligible active service matches the catalogue item's occupation.
4. Provider Visibility annual access is active.

Each eligible business contributes one effective price per item, including its Guide defaults. Purchasing Price List Access alone grants guide access. Contribution eligibility requires Provider Visibility.

The Global guide displays the returned `price`, including any SuperAdmin override or Guide fallback. Use the private pricing endpoints for the Tradeperson's range and Guide information. [Pricing contracts and examples](22-marketplace-updates.md#global-price-list-screen).

## 4. Annual plans use one-time Stripe payments

| Stable plan code | Eligible buyer | Benefits |
|---|---|---|
| `price_list` | Every completed member type | Global Price guide access. |
| `provider` | Tradeperson | Global Price guide access and discoverability of eligible services. |

Read names, descriptions, availability and prices from `GET /api/payments/plans`. Respect `isAvailable`, `isEligible` and the Stripe price's `isPublished` value.

Each purchase authorizes one payment for an annual access term. Present manual renewal and the paid expiry date in the billing screen.

| Action | API and behavior |
|---|---|
| First purchase | `POST /api/payments/subscriptions/checkout`. A verified payment activates one calendar year. |
| Manual renewal | Same endpoint during the final 30 days. Extend from the current expiry while the term is active. |
| Purchase after expiry | Same endpoint. A new year starts from verified payment activation. |
| Upgrade Price List Access to Provider Visibility | `POST /api/payments/subscriptions/change` with `planCode: "provider"`. Collect the prorated difference and retain expiry. |
| Upgrade costing below AUD 0.50 | The API grants the remaining-term upgrade free. Handle an immediate `succeeded` operation with amount zero. |
| Choose a lower plan for next year | Purchase `price_list` through manual renewal. Display the prepaid following term. |

One following term can be prepaid. The next purchase uses its snapshotted price, which Checkout presents for authorization. Existing paid access retains its expiry.

### Purchase and renewal payload

```json
{
  "requestId": "11111111-1111-4111-8111-111111111111",
  "planCode": "price_list",
  "consentAccepted": true
}
```

Use the same shape with `planCode: "provider"` for the upgrade endpoint.

### Account response model

Load `GET /api/payments/me`. Use `hasPriceListAccess` and `hasProviderVisibility` together with role permissions to control paid features. Its nullable `subscription` property describes the application-managed annual term.

```json
{
  "termId": 601,
  "channel": "stripe",
  "planCode": "price_list",
  "status": "active",
  "paidFromUtc": "2026-11-12T10:00:00Z",
  "paidUntilUtc": "2027-11-12T10:00:00Z",
  "canRenew": false,
  "canUpgrade": true,
  "upcomingPlanCode": null,
  "upcomingStartsAtUtc": null,
  "upcomingPaidUntilUtc": null
}
```

This example represents a Tradeperson on Price List Access. Drive renewal and upgrade actions from `canRenew` and `canUpgrade`. Show the following plan and its dates when `upcomingPlanCode` is present.

Retire the Cancel renewal control and calls to `POST /api/payments/subscriptions/cancel`. Update clients that used `cancelAtPeriodEnd`, `renewalOffRequired` or `pendingPlanCode` to the annual-term fields above.

## 5. Checkout, mobile return and financial outcomes

1. Generate and persist one nonempty request UUID per logical purchase.
2. Obtain consent, submit the request and retain the returned operation `id`.
3. Poll `GET /api/payments/operations/{id}` through `queued` and `processing`.
4. At `requires_action`, open the returned HTTPS `checkoutUrl`.
5. Implement frontend `/billing` to recover `operationId` and resume polling after the Stripe return or a reload.
6. At `succeeded`, inspect `refundRequired`, then refresh the payment account and affected resources. An immediately successful free upgrade proceeds directly to this step.
7. For `failed` or `review_required`, display the returned outcome and keep the operation reference available for support.

Use the same UUID and identical input for network retries. A new logical purchase gets a new UUID. The verified API outcome controls access and resource creation.

Operations can expose `amountMinor`, `planCode`, `accessStartsAtUtc`, `accessEndsAtUtc`, `refundRequired` and `refundStatus`. When a paid annual purchase cannot be activated, display its automatic full-refund progress.

Mobile clients return through the existing HTTPS `/billing` URL. The mobile/hosting team configures Android App Links or iOS Universal Links and the associated verification files. Coordinate public-store purchase presentation with the store-billing review described in the payment guide. [Payment integration](21-payments.md).

### Expiry, refunds and account changes

| Event | Frontend behavior |
|---|---|
| Annual term expires | Refresh account benefits and show the manual-purchase action. |
| Account is deactivated | The paid calendar continues. Reactivation restores remaining eligible access. |
| Full annual-payment refund | Refresh the account. The associated funded entitlement ends. |
| Disputed annual payment | Refresh and display the affected benefits' suspended state. |
| Upgrade refund or dispute | Refresh to the original plan's remaining valid entitlement. |

Routine refunds for unused annual time are outside the current member workflow. Financial states come from the server.

## 6. Type changes and live updates

When SuperAdmin changes a Tradeperson to Individual, Builder or Developer, the business is retained, service listings/employees are archived and affected membership cards are invalidated. A change to Government also archives the business.

Follow the existing session-revocation and profile-completion flow. Refresh the current membership identifier, member type, permissions and resource data after the next authorized sign-in. Rebuild navigation from that current state.

Consume SignalR `notificationReceived` and refetch the relevant resources.

| Event | Refresh |
|---|---|
| `payment.*` | Annual access, operation status, applicable transactions/refunds and discovery or pricing views. |
| `payment.annual_expiring` | Account and renewal controls. |
| `payment.annual_expired` | Account and paid-feature visibility. |
| `marketplace.changed` | Applicable discovery and pricing queries. |
| `card-request.*`, `card.*` | Card requests, cards and delivery state. |

Three-day expiry reminders and expiry notices use email, action-needed push and SignalR. Refresh on reconnect and app focus as well. Display UTC timestamps in the user's timezone. Payment `amountMinor` values are integer AUD cents. Catalogue/private `price` values are decimal AUD.

## 7. Acceptance checklist

- [ ] Tradeperson, Individual, Builder and Developer can manage eligible businesses.
- [ ] Government business management is rejected through member and admin flows.
- [ ] Employee management and service listings are Tradeperson member features.
- [ ] My Prices and Membership cards are hidden on other member types' navigation, dashboards and direct routes.
- [ ] Tradepeople can request personal and eligible employee cards independently of annual access.
- [ ] A Tradeperson can maintain private prices with the appropriate permissions before purchasing a plan.
- [ ] Provider Visibility controls discovery and Global-price contributions, including Guide defaults.
- [ ] Price List Access grants the Global guide to every eligible member type.
- [ ] Manual renewal handles the final 30 days, expiry and one prepaid following term.
- [ ] Paid upgrades retain expiry. Sub-minimum upgrades handle immediate success.
- [ ] Checkout return, reload and network retries resume the original operation.
- [ ] Refunds, disputes and expiry refresh verified benefits and visible controls.
- [ ] Type changes refresh authentication, profile setup, membership details and feature eligibility.
- [ ] SignalR updates and mobile HTTPS returns refresh the appropriate screens.

## Detailed implementation references

- Business forms, validation and administrative contracts. [05 — Business details](05-business-details.md).
- Employee roster and inspection assignment. [10 — Employees](10-employees.md).
- Card requests and physical fulfillment. [11 — Card requests](11-card-requests.md), [11-b — Card issuance](11b-card-issuance.md).
- Private prices, annual submissions and suggestions. [14 — Provider prices](14-provider-prices.md).
- Payment schemas, operation states and examples. [21 — Payments](21-payments.md).
- Card funding, Global/private pricing and administrative settings. [22 — Marketplace updates](22-marketplace-updates.md).
- Current controller routes and permissions. [20 — Endpoint index](20-endpoint-index.md).
