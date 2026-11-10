# Complete controller endpoint index

Every current controller operation appears exactly once below. Shared [health/media/Swagger routes](00-integration-basics.md) and the [SignalR hub](18-realtime-notifications.md) are documented separately.

| Method | Path | Feature | Access |
|---|---|---|---|
| GET | `/api/admin/announcements` | [Announcements](16-announcements.md#get-api-admin-announcements) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/announcements` | [Announcements](16-announcements.md#post-api-admin-announcements) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/announcements/{id}` | [Announcements](16-announcements.md#get-api-admin-announcements-id) | Bearer JWT; Role: SuperAdmin; full access required |
| PUT | `/api/admin/announcements/{id}` | [Announcements](16-announcements.md#put-api-admin-announcements-id) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/announcements/{id}/history` | [Announcements](16-announcements.md#get-api-admin-announcements-id-history) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/announcements/{id}/publish` | [Announcements](16-announcements.md#post-api-admin-announcements-id-publish) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/announcements/{id}/retire` | [Announcements](16-announcements.md#post-api-admin-announcements-id-retire) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/businesses` | [Business details](05-business-details.md#get-api-admin-businesses) | Bearer JWT; Role: SuperAdmin; full access required |
| DELETE | `/api/admin/businesses/{businessId}` | [Business details](05-business-details.md#delete-api-admin-businesses-businessid) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/businesses/{businessId}` | [Business details](05-business-details.md#get-api-admin-businesses-businessid) | Bearer JWT; Role: SuperAdmin; full access required |
| PUT | `/api/admin/businesses/{businessId}` | [Business details](05-business-details.md#put-api-admin-businesses-businessid) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/businesses/{businessId}/history` | [Business details](05-business-details.md#get-api-admin-businesses-businessid-history) | Bearer JWT; Role: SuperAdmin; full access required |
| PUT | `/api/admin/businesses/{businessId}/picture` | [Business details](05-business-details.md#put-api-admin-businesses-businessid-picture) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/businesses/users/{userId}` | [Business details](05-business-details.md#post-api-admin-businesses-users-userid) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/card-requests` | [Card requests and delivery addresses](11-card-requests.md#get-api-admin-card-requests) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/card-requests/{requestId}` | [Card requests and delivery addresses](11-card-requests.md#get-api-admin-card-requests-requestid) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/card-requests/{requestId}/cancel` | [Card requests and delivery addresses](11-card-requests.md#post-api-admin-card-requests-requestid-cancel) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/card-requests/{requestId}/decision` | [Card requests and delivery addresses](11-card-requests.md#post-api-admin-card-requests-requestid-decision) | Bearer JWT; Role: SuperAdmin; full access required |
| PUT | `/api/admin/card-requests/{requestId}/delivery-address` | [Card requests and delivery addresses](11-card-requests.md#put-api-admin-card-requests-requestid-delivery-address) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/card-requests/{requestId}/issue` | [Card issuance, delivery and replacements](11b-card-issuance.md#post-api-admin-card-requests-requestid-issue) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/card-requests/users/{ownerUserId}` | [Card requests and delivery addresses](11-card-requests.md#post-api-admin-card-requests-users-owneruserid) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/card-settings` | [Card issuance, delivery and replacements](11b-card-issuance.md#get-api-admin-card-settings) | Bearer JWT; Role: SuperAdmin; full access required |
| PUT | `/api/admin/card-settings` | [Card issuance, delivery and replacements](11b-card-issuance.md#put-api-admin-card-settings) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/cards` | [Card issuance, delivery and replacements](11b-card-issuance.md#get-api-admin-cards) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/cards/{cardId}` | [Card issuance, delivery and replacements](11b-card-issuance.md#get-api-admin-cards-cardid) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/cards/{cardId}/action` | [Card issuance, delivery and replacements](11b-card-issuance.md#post-api-admin-cards-cardid-action) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/clients` | [Client relationships](12-client-relationships.md#get-api-admin-clients) | Bearer JWT; Role: SuperAdmin; full access required |
| PUT | `/api/admin/clients/businesses/{businessId}/clients/{clientUserId}/visibility` | [Client relationships](12-client-relationships.md#put-api-admin-clients-businesses-businessid-clients-clientuserid-visibility) | Bearer JWT; Role: SuperAdmin; full access required |
| DELETE | `/api/admin/employees/{employeeId}` | [Employees](10-employees.md#delete-api-admin-employees-employeeid) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/employees/{employeeId}` | [Employees](10-employees.md#get-api-admin-employees-employeeid) | Bearer JWT; Role: SuperAdmin; full access required |
| PUT | `/api/admin/employees/{employeeId}` | [Employees](10-employees.md#put-api-admin-employees-employeeid) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/employees/businesses/{businessId}` | [Employees](10-employees.md#post-api-admin-employees-businesses-businessid) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/employees/users/{userId}` | [Employees](10-employees.md#get-api-admin-employees-users-userid) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/inspections` | [Inspections](08-inspections.md#get-api-admin-inspections) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/inspections/{inspectionId}` | [Inspections](08-inspections.md#get-api-admin-inspections-inspectionid) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/inspections/{inspectionId}/decision` | [Inspections](08-inspections.md#post-api-admin-inspections-inspectionid-decision) | Bearer JWT; Role: SuperAdmin; full access required |
| PUT | `/api/admin/inspections/{inspectionId}/employee` | [Inspections](08-inspections.md#put-api-admin-inspections-inspectionid-employee) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/inspections/{inspectionId}/rating` | [Inspections](08-inspections.md#post-api-admin-inspections-inspectionid-rating) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/inspections/users/{requesterUserId}` | [Inspections](08-inspections.md#post-api-admin-inspections-users-requesteruserid) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/issue-reports` | [Push installations and issue reports](17-operational-communications.md#get-api-admin-issue-reports) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/issue-reports/{id}` | [Push installations and issue reports](17-operational-communications.md#get-api-admin-issue-reports-id) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/issue-reports/{id}/history` | [Push installations and issue reports](17-operational-communications.md#get-api-admin-issue-reports-id-history) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/issue-reports/{id}/status` | [Push installations and issue reports](17-operational-communications.md#post-api-admin-issue-reports-id-status) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/marketplace/card-allowances/grant` | [BRD 19 marketplace, card payments and pricing](22-marketplace-updates.md#post-api-admin-marketplace-card-allowances-grant) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/marketplace/card-refunds` | [BRD 19 marketplace, card payments and pricing](22-marketplace-updates.md#get-api-admin-marketplace-card-refunds) | Bearer JWT; Role: SuperAdmin; full access required |
| PUT | `/api/admin/marketplace/global-prices/{itemId}/override` | [BRD 19 marketplace, card payments and pricing](22-marketplace-updates.md#put-api-admin-marketplace-global-prices-itemid-override) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/marketplace/settings` | [BRD 19 marketplace, card payments and pricing](22-marketplace-updates.md#get-api-admin-marketplace-settings) | Bearer JWT; Role: SuperAdmin; full access required |
| PUT | `/api/admin/marketplace/settings` | [BRD 19 marketplace, card payments and pricing](22-marketplace-updates.md#put-api-admin-marketplace-settings) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/marketplace/users/{userId}/card-allowances` | [BRD 19 marketplace, card payments and pricing](22-marketplace-updates.md#get-api-admin-marketplace-users-userid-card-allowances) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/marketplace/users/{userId}/card-allowances/{id}/revoke` | [BRD 19 marketplace, card payments and pricing](22-marketplace-updates.md#post-api-admin-marketplace-users-userid-card-allowances-id-revoke) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/marketplace/users/{userId}/price-list` | [BRD 19 marketplace, card payments and pricing](22-marketplace-updates.md#get-api-admin-marketplace-users-userid-price-list) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/payments/audit` | [Payments and subscriptions](21-payments.md#get-api-admin-payments-audit) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/payments/confirmations` | [Payments and subscriptions](21-payments.md#get-api-admin-payments-confirmations) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/payments/confirmations/{id}/revoke` | [Payments and subscriptions](21-payments.md#post-api-admin-payments-confirmations-id-revoke) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/payments/confirmations/grant` | [Payments and subscriptions](21-payments.md#post-api-admin-payments-confirmations-grant) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/payments/operations` | [Payments and subscriptions](21-payments.md#get-api-admin-payments-operations) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/payments/operations/{id}/retry` | [Payments and subscriptions](21-payments.md#post-api-admin-payments-operations-id-retry) | Bearer JWT; Role: SuperAdmin; full access required |
| PUT | `/api/admin/payments/plans/{code}` | [Payments and subscriptions](21-payments.md#put-api-admin-payments-plans-code) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/payments/refunds` | [Payments and subscriptions](21-payments.md#get-api-admin-payments-refunds) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/payments/settings` | [Payments and subscriptions](21-payments.md#get-api-admin-payments-settings) | Bearer JWT; Role: SuperAdmin; full access required |
| PUT | `/api/admin/payments/settings` | [Payments and subscriptions](21-payments.md#put-api-admin-payments-settings) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/payments/transactions` | [Payments and subscriptions](21-payments.md#get-api-admin-payments-transactions) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/payments/users/{id}` | [Payments and subscriptions](21-payments.md#get-api-admin-payments-users-id) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/price-catalogue` | [Price catalogue](13-price-catalogue.md#get-api-admin-price-catalogue) | Bearer JWT; `price-catalogue-admin.view`; full access required |
| POST | `/api/admin/price-catalogue` | [Price catalogue](13-price-catalogue.md#post-api-admin-price-catalogue) | Bearer JWT; `price-catalogue.manage`; full access required |
| GET | `/api/admin/price-catalogue/{itemId}` | [Price catalogue](13-price-catalogue.md#get-api-admin-price-catalogue-itemid) | Bearer JWT; `price-catalogue-admin.view`; full access required |
| PUT | `/api/admin/price-catalogue/{itemId}` | [Price catalogue](13-price-catalogue.md#put-api-admin-price-catalogue-itemid) | Bearer JWT; `price-catalogue.manage`; full access required |
| GET | `/api/admin/price-catalogue/{itemId}/history` | [Price catalogue](13-price-catalogue.md#get-api-admin-price-catalogue-itemid-history) | Bearer JWT; `price-catalogue-admin.view`; full access required |
| POST | `/api/admin/price-catalogue/{itemId}/publish` | [Price catalogue](13-price-catalogue.md#post-api-admin-price-catalogue-itemid-publish) | Bearer JWT; `price-catalogue.manage`; full access required |
| POST | `/api/admin/price-catalogue/{itemId}/retire` | [Price catalogue](13-price-catalogue.md#post-api-admin-price-catalogue-itemid-retire) | Bearer JWT; `price-catalogue.delete`; full access required |
| GET | `/api/admin/provider-prices` | [Provider prices and item requests](14-provider-prices.md#get-api-admin-provider-prices) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/provider-prices/{id}` | [Provider prices and item requests](14-provider-prices.md#get-api-admin-provider-prices-id) | Bearer JWT; Role: SuperAdmin; full access required |
| PUT | `/api/admin/provider-prices/{id}` | [Provider prices and item requests](14-provider-prices.md#put-api-admin-provider-prices-id) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/provider-prices/{id}/history` | [Provider prices and item requests](14-provider-prices.md#get-api-admin-provider-prices-id-history) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/provider-prices/{id}/restore` | [Provider prices and item requests](14-provider-prices.md#post-api-admin-provider-prices-id-restore) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/provider-prices/{id}/withdraw` | [Provider prices and item requests](14-provider-prices.md#post-api-admin-provider-prices-id-withdraw) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/provider-prices/businesses/{businessId}` | [Provider prices and item requests](14-provider-prices.md#post-api-admin-provider-prices-businesses-businessid) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/provider-prices/businesses/{businessId}/item-requests` | [Provider prices and item requests](14-provider-prices.md#post-api-admin-provider-prices-businesses-businessid-item-requests) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/provider-prices/item-requests` | [Provider prices and item requests](14-provider-prices.md#get-api-admin-provider-prices-item-requests) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/provider-prices/item-requests/{id}` | [Provider prices and item requests](14-provider-prices.md#get-api-admin-provider-prices-item-requests-id) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/provider-prices/item-requests/{id}/approve` | [Provider prices and item requests](14-provider-prices.md#post-api-admin-provider-prices-item-requests-id-approve) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/provider-prices/item-requests/{id}/history` | [Provider prices and item requests](14-provider-prices.md#get-api-admin-provider-prices-item-requests-id-history) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/provider-prices/item-requests/{id}/reject` | [Provider prices and item requests](14-provider-prices.md#post-api-admin-provider-prices-item-requests-id-reject) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/quotes` | [Quotes](09-quotes.md#get-api-admin-quotes) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/quotes` | [Quotes](09-quotes.md#post-api-admin-quotes) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/quotes/{quoteId}` | [Quotes](09-quotes.md#get-api-admin-quotes-quoteid) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/quotes/{quoteId}/decision` | [Quotes](09-quotes.md#post-api-admin-quotes-quoteid-decision) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/quotes/{quoteId}/pdf` | [Quotes](09-quotes.md#get-api-admin-quotes-quoteid-pdf) | Bearer JWT; Role: SuperAdmin; full access required |
| PUT | `/api/admin/quotes/{quoteId}/pdf` | [Quotes](09-quotes.md#put-api-admin-quotes-quoteid-pdf) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/reference-choices/{catalogue}` | [Reference choices](06-reference-choices.md#get-api-admin-reference-choices-catalogue) | Bearer JWT; `reference-admin.view`; full access required |
| POST | `/api/admin/reference-choices/{catalogue}` | [Reference choices](06-reference-choices.md#post-api-admin-reference-choices-catalogue) | Bearer JWT; `reference.manage`; full access required |
| DELETE | `/api/admin/reference-choices/{catalogue}/{code}` | [Reference choices](06-reference-choices.md#delete-api-admin-reference-choices-catalogue-code) | Bearer JWT; `reference.delete`; full access required |
| PUT | `/api/admin/reference-choices/{catalogue}/{code}` | [Reference choices](06-reference-choices.md#put-api-admin-reference-choices-catalogue-code) | Bearer JWT; `reference.manage`; full access required |
| POST | `/api/admin/reference-choices/{catalogue}/{code}/reactivate` | [Reference choices](06-reference-choices.md#post-api-admin-reference-choices-catalogue-code-reactivate) | Bearer JWT; `reference.manage`; full access required |
| GET | `/api/admin/roles` | [Member types, roles and account administration](03-member-types-and-roles.md#get-api-admin-roles) | Bearer JWT; `roles.view`; full access required |
| POST | `/api/admin/roles` | [Member types, roles and account administration](03-member-types-and-roles.md#post-api-admin-roles) | Bearer JWT; `roles.manage`; full access required |
| DELETE | `/api/admin/roles/{roleId}` | [Member types, roles and account administration](03-member-types-and-roles.md#delete-api-admin-roles-roleid) | Bearer JWT; `roles.delete`; full access required |
| PUT | `/api/admin/roles/{roleId}` | [Member types, roles and account administration](03-member-types-and-roles.md#put-api-admin-roles-roleid) | Bearer JWT; `roles.manage`; full access required |
| GET | `/api/admin/roles/permissions` | [Member types, roles and account administration](03-member-types-and-roles.md#get-api-admin-roles-permissions) | Bearer JWT; `roles.view`; full access required |
| DELETE | `/api/admin/services/{serviceId}` | [Services and discovery](07-service-discovery.md#delete-api-admin-services-serviceid) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/services/{serviceId}` | [Services and discovery](07-service-discovery.md#get-api-admin-services-serviceid) | Bearer JWT; Role: SuperAdmin; full access required |
| PUT | `/api/admin/services/{serviceId}` | [Services and discovery](07-service-discovery.md#put-api-admin-services-serviceid) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/services/users/{userId}` | [Services and discovery](07-service-discovery.md#get-api-admin-services-users-userid) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/services/users/{userId}` | [Services and discovery](07-service-discovery.md#post-api-admin-services-users-userid) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/support/tickets` | [Support conversations](15-support.md#get-api-admin-support-tickets) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/support/tickets/{id}` | [Support conversations](15-support.md#get-api-admin-support-tickets-id) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/support/tickets/{id}/close` | [Support conversations](15-support.md#post-api-admin-support-tickets-id-close) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/support/tickets/{id}/history` | [Support conversations](15-support.md#get-api-admin-support-tickets-id-history) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/support/tickets/{id}/messages` | [Support conversations](15-support.md#get-api-admin-support-tickets-id-messages) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/support/tickets/{id}/messages` | [Support conversations](15-support.md#post-api-admin-support-tickets-id-messages) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/support/tickets/{id}/reopen` | [Support conversations](15-support.md#post-api-admin-support-tickets-id-reopen) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/support/tickets/users/{ownerUserId}` | [Support conversations](15-support.md#post-api-admin-support-tickets-users-owneruserid) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/users` | [Member types, roles and account administration](03-member-types-and-roles.md#get-api-admin-users) | Bearer JWT; `users.view`; full access required |
| POST | `/api/admin/users/{userId}/deactivate` | [Member types, roles and account administration](03-member-types-and-roles.md#post-api-admin-users-userid-deactivate) | Bearer JWT; `users.delete`; full access required |
| GET | `/api/admin/users/{userId}/profile` | [Profiles](04-profiles.md#get-api-admin-users-userid-profile) | Bearer JWT; Role: SuperAdmin; full access required |
| PUT | `/api/admin/users/{userId}/profile` | [Profiles](04-profiles.md#put-api-admin-users-userid-profile) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/users/{userId}/profile/history` | [Profiles](04-profiles.md#get-api-admin-users-userid-profile-history) | Bearer JWT; Role: SuperAdmin; full access required |
| PUT | `/api/admin/users/{userId}/profile/picture` | [Profiles](04-profiles.md#put-api-admin-users-userid-profile-picture) | Bearer JWT; Role: SuperAdmin; full access required |
| POST | `/api/admin/users/{userId}/reactivate` | [Member types, roles and account administration](03-member-types-and-roles.md#post-api-admin-users-userid-reactivate) | Bearer JWT; `users.manage`; full access required |
| GET | `/api/admin/users/{userId}/roles` | [Member types, roles and account administration](03-member-types-and-roles.md#get-api-admin-users-userid-roles) | Bearer JWT; `roles.view`; full access required |
| PUT | `/api/admin/users/{userId}/roles` | [Member types, roles and account administration](03-member-types-and-roles.md#put-api-admin-users-userid-roles) | Bearer JWT; `roles.manage` AND `users.manage`; full access required |
| PUT | `/api/admin/users/{userId}/user-type` | [Member types, roles and account administration](03-member-types-and-roles.md#put-api-admin-users-userid-user-type) | Bearer JWT; Role: SuperAdmin; full access required |
| GET | `/api/admin/users/all` | [Member types, roles and account administration](03-member-types-and-roles.md#get-api-admin-users-all) | Bearer JWT; `users.view`; full access required |
| GET | `/api/announcements` | [Announcements](16-announcements.md#get-api-announcements) | Bearer JWT; `announcements.view`; full access required |
| GET | `/api/announcements/{id}` | [Announcements](16-announcements.md#get-api-announcements-id) | Bearer JWT; `announcements.view`; full access required |
| POST | `/api/auth/check-password-recovery-code` | [Password recovery](02-password-recovery.md#post-api-auth-check-password-recovery-code) | Anonymous allowed |
| POST | `/api/auth/mobile/refresh` | [Account access](01-account-access.md#post-api-auth-mobile-refresh) | Anonymous allowed |
| POST | `/api/auth/mobile/sign-in` | [Account access](01-account-access.md#post-api-auth-mobile-sign-in) | Anonymous allowed |
| POST | `/api/auth/mobile/sign-out` | [Account access](01-account-access.md#post-api-auth-mobile-sign-out) | Anonymous allowed |
| POST | `/api/auth/register` | [Account access](01-account-access.md#post-api-auth-register) | Anonymous allowed |
| POST | `/api/auth/request-password-recovery` | [Password recovery](02-password-recovery.md#post-api-auth-request-password-recovery) | Anonymous allowed |
| POST | `/api/auth/resend-verification` | [Account access](01-account-access.md#post-api-auth-resend-verification) | Anonymous allowed |
| POST | `/api/auth/reset-password` | [Password recovery](02-password-recovery.md#post-api-auth-reset-password) | Anonymous allowed |
| POST | `/api/auth/verify-email` | [Account access](01-account-access.md#post-api-auth-verify-email) | Anonymous allowed |
| POST | `/api/auth/web/refresh` | [Account access](01-account-access.md#post-api-auth-web-refresh) | Anonymous allowed |
| POST | `/api/auth/web/sign-in` | [Account access](01-account-access.md#post-api-auth-web-sign-in) | Anonymous allowed |
| POST | `/api/auth/web/sign-out` | [Account access](01-account-access.md#post-api-auth-web-sign-out) | Anonymous allowed |
| DELETE | `/api/businesses/me` | [Business details](05-business-details.md#delete-api-businesses-me) | Bearer JWT; `businesses.delete`; full access required |
| GET | `/api/businesses/me` | [Business details](05-business-details.md#get-api-businesses-me) | Bearer JWT; `businesses.view`; full access required |
| POST | `/api/businesses/me` | [Business details](05-business-details.md#post-api-businesses-me) | Bearer JWT; `businesses.manage`; full access required |
| PUT | `/api/businesses/me` | [Business details](05-business-details.md#put-api-businesses-me) | Bearer JWT; `businesses.manage`; full access required |
| PUT | `/api/businesses/me/picture` | [Business details](05-business-details.md#put-api-businesses-me-picture) | Bearer JWT; `businesses.manage`; full access required |
| GET | `/api/card-requests/{requestId}` | [Card requests and delivery addresses](11-card-requests.md#get-api-card-requests-requestid) | Bearer JWT; `card-requests.view`; full access required |
| POST | `/api/card-requests/{requestId}/cancel` | [Card requests and delivery addresses](11-card-requests.md#post-api-card-requests-requestid-cancel) | Bearer JWT; `card-requests.delete`; full access required |
| PUT | `/api/card-requests/{requestId}/delivery-address` | [Card requests and delivery addresses](11-card-requests.md#put-api-card-requests-requestid-delivery-address) | Bearer JWT; `card-requests.manage`; full access required |
| GET | `/api/card-requests/allowances` | [BRD 19 marketplace, card payments and pricing](22-marketplace-updates.md#get-api-card-requests-allowances) | Bearer JWT; `card-requests.view`; full access required |
| POST | `/api/card-requests/cards/{cardId}/report-lost` | [BRD 19 marketplace, card payments and pricing](22-marketplace-updates.md#post-api-card-requests-cards-cardid-report-lost) | Bearer JWT; `card-requests.manage`; full access required |
| POST | `/api/card-requests/checkout` | [BRD 19 marketplace, card payments and pricing](22-marketplace-updates.md#post-api-card-requests-checkout) | Bearer JWT; `card-requests.manage`; full access required |
| GET | `/api/card-requests/me` | [Card requests and delivery addresses](11-card-requests.md#get-api-card-requests-me) | Bearer JWT; `card-requests.view`; full access required |
| GET | `/api/card-requests/refunds` | [BRD 19 marketplace, card payments and pricing](22-marketplace-updates.md#get-api-card-requests-refunds) | Bearer JWT; `card-requests.view`; full access required |
| GET | `/api/cards/{cardId}` | [Card issuance, delivery and replacements](11b-card-issuance.md#get-api-cards-cardid) | Bearer JWT; `cards.view`; full access required |
| POST | `/api/cards/{cardId}/receive` | [Card issuance, delivery and replacements](11b-card-issuance.md#post-api-cards-cardid-receive) | Bearer JWT; `cards.manage`; full access required |
| GET | `/api/cards/me` | [Card issuance, delivery and replacements](11b-card-issuance.md#get-api-cards-me) | Bearer JWT; `cards.view`; full access required |
| GET | `/api/clients/me` | [Client relationships](12-client-relationships.md#get-api-clients-me) | Bearer JWT; `clients.view`; full access required |
| PUT | `/api/clients/me/{businessId}/{clientUserId}/visibility` | [Client relationships](12-client-relationships.md#put-api-clients-me-businessid-clientuserid-visibility) | Bearer JWT; `clients.delete` to hide; `clients.manage` to restore; full access required |
| GET | `/api/clients/providers/me` | [Client relationships](12-client-relationships.md#get-api-clients-providers-me) | Bearer JWT; `clients.view`; full access required |
| GET | `/api/employees/me` | [Employees](10-employees.md#get-api-employees-me) | Bearer JWT; `employees.view`; full access required |
| POST | `/api/employees/me` | [Employees](10-employees.md#post-api-employees-me) | Bearer JWT; `employees.manage`; full access required |
| DELETE | `/api/employees/me/{employeeId}` | [Employees](10-employees.md#delete-api-employees-me-employeeid) | Bearer JWT; `employees.delete`; full access required |
| GET | `/api/employees/me/{employeeId}` | [Employees](10-employees.md#get-api-employees-me-employeeid) | Bearer JWT; `employees.view`; full access required |
| PUT | `/api/employees/me/{employeeId}` | [Employees](10-employees.md#put-api-employees-me-employeeid) | Bearer JWT; `employees.manage`; full access required |
| POST | `/api/inspections` | [Inspections](08-inspections.md#post-api-inspections) | Bearer JWT; `inspections.manage`; full access required |
| GET | `/api/inspections/{inspectionId}` | [Inspections](08-inspections.md#get-api-inspections-inspectionid) | Bearer JWT; `inspections.view`; full access required |
| POST | `/api/inspections/{inspectionId}/accept` | [Inspections](08-inspections.md#post-api-inspections-inspectionid-accept) | Bearer JWT; `inspections.manage`; full access required |
| POST | `/api/inspections/{inspectionId}/cancel` | [Inspections](08-inspections.md#post-api-inspections-inspectionid-cancel) | Bearer JWT; `inspections.delete`; full access required |
| POST | `/api/inspections/{inspectionId}/complete` | [Inspections](08-inspections.md#post-api-inspections-inspectionid-complete) | Bearer JWT; `inspections.manage`; full access required |
| POST | `/api/inspections/{inspectionId}/completion-code` | [Inspections](08-inspections.md#post-api-inspections-inspectionid-completion-code) | Bearer JWT; `inspections.manage`; full access required |
| PUT | `/api/inspections/{inspectionId}/employee` | [Inspections](08-inspections.md#put-api-inspections-inspectionid-employee) | Bearer JWT; `inspections.manage`; full access required |
| POST | `/api/inspections/{inspectionId}/rating` | [Inspections](08-inspections.md#post-api-inspections-inspectionid-rating) | Bearer JWT; `inspections.manage`; full access required |
| POST | `/api/inspections/{inspectionId}/reject` | [Inspections](08-inspections.md#post-api-inspections-inspectionid-reject) | Bearer JWT; `inspections.delete`; full access required |
| PUT | `/api/inspections/{inspectionId}/visibility` | [Inspections](08-inspections.md#put-api-inspections-inspectionid-visibility) | Bearer JWT; `inspections.delete` to hide; `inspections.manage` to restore; full access required |
| GET | `/api/inspections/me` | [Inspections](08-inspections.md#get-api-inspections-me) | Bearer JWT; `inspections.view`; full access required |
| POST | `/api/issue-reports` | [Push installations and issue reports](17-operational-communications.md#post-api-issue-reports) | Anonymous allowed |
| GET | `/api/members/employee-positions` | [Reference choices](06-reference-choices.md#get-api-members-employee-positions) | Bearer JWT; `reference.view`; profile-setup access supported |
| GET | `/api/members/licence-types` | [Reference choices](06-reference-choices.md#get-api-members-licence-types) | Bearer JWT; `reference.view`; profile-setup access supported |
| GET | `/api/members/me` | [Member types, roles and account administration](03-member-types-and-roles.md#get-api-members-me) | Bearer JWT; `profiles.view`; profile-setup access supported |
| POST | `/api/members/me/deactivate` | [Member types, roles and account administration](03-member-types-and-roles.md#post-api-members-me-deactivate) | Bearer JWT; profile-setup access supported |
| GET | `/api/members/me/profile` | [Profiles](04-profiles.md#get-api-members-me-profile) | Bearer JWT; `profiles.view`; profile-setup access supported |
| PUT | `/api/members/me/profile` | [Profiles](04-profiles.md#put-api-members-me-profile) | Bearer JWT; `profiles.manage`; profile-setup access supported |
| PUT | `/api/members/me/profile/picture` | [Profiles](04-profiles.md#put-api-members-me-profile-picture) | Bearer JWT; `profiles.manage`; profile-setup access supported |
| PUT | `/api/members/me/user-type` | [Member types, roles and account administration](03-member-types-and-roles.md#put-api-members-me-user-type) | Bearer JWT; `profiles.manage`; profile-setup access supported |
| GET | `/api/members/occupations` | [Reference choices](06-reference-choices.md#get-api-members-occupations) | Bearer JWT; `reference.view`; profile-setup access supported |
| GET | `/api/members/regions` | [Reference choices](06-reference-choices.md#get-api-members-regions) | Anonymous allowed |
| GET | `/api/members/user-types` | [Member types, roles and account administration](03-member-types-and-roles.md#get-api-members-user-types) | Anonymous allowed |
| POST | `/api/notifications/installations` | [Push installations and issue reports](17-operational-communications.md#post-api-notifications-installations) | Bearer JWT; `notifications.manage`; profile-setup access supported |
| DELETE | `/api/notifications/installations/{installationId}` | [Push installations and issue reports](17-operational-communications.md#delete-api-notifications-installations-installationid) | Bearer JWT; `notifications.delete`; profile-setup access supported |
| GET | `/api/notifications/installations/me` | [Push installations and issue reports](17-operational-communications.md#get-api-notifications-installations-me) | Bearer JWT; `notifications.view`; profile-setup access supported |
| GET | `/api/payments/cards` | [Payments and subscriptions](21-payments.md#get-api-payments-cards) | Bearer JWT; `payments.view`; profile-setup access supported |
| DELETE | `/api/payments/cards/{id}` | [Payments and subscriptions](21-payments.md#delete-api-payments-cards-id) | Bearer JWT; `payments.delete`; profile-setup access supported |
| PUT | `/api/payments/cards/{id}/default` | [Payments and subscriptions](21-payments.md#put-api-payments-cards-id-default) | Bearer JWT; `payments.manage`; full access required |
| POST | `/api/payments/cards/setup` | [Payments and subscriptions](21-payments.md#post-api-payments-cards-setup) | Bearer JWT; `payments.manage`; full access required |
| GET | `/api/payments/confirmations` | [Payments and subscriptions](21-payments.md#get-api-payments-confirmations) | Bearer JWT; `payments.view`; profile-setup access supported |
| POST | `/api/payments/inspections/checkout` | [Payments and subscriptions](21-payments.md#post-api-payments-inspections-checkout) | Bearer JWT; `payments.manage` AND `inspections.manage`; full access required |
| GET | `/api/payments/me` | [Payments and subscriptions](21-payments.md#get-api-payments-me) | Bearer JWT; `payments.view`; profile-setup access supported |
| GET | `/api/payments/operations/{id}` | [Payments and subscriptions](21-payments.md#get-api-payments-operations-id) | Bearer JWT; `payments.view`; profile-setup access supported |
| POST | `/api/payments/operations/{id}/cancel` | [Payments and subscriptions](21-payments.md#post-api-payments-operations-id-cancel) | Bearer JWT; `payments.delete`; profile-setup access supported |
| GET | `/api/payments/plans` | [Payments and subscriptions](21-payments.md#get-api-payments-plans) | Bearer JWT; `payments.view`; profile-setup access supported |
| GET | `/api/payments/refunds` | [Payments and subscriptions](21-payments.md#get-api-payments-refunds) | Bearer JWT; `payments.view`; profile-setup access supported |
| POST | `/api/payments/stripe/webhook` | [Payments and subscriptions](21-payments.md#post-api-payments-stripe-webhook) | Anonymous allowed |
| POST | `/api/payments/subscriptions/cancel` | [Payments and subscriptions](21-payments.md#post-api-payments-subscriptions-cancel) | Bearer JWT; `payments.delete`; profile-setup access supported |
| POST | `/api/payments/subscriptions/change` | [Payments and subscriptions](21-payments.md#post-api-payments-subscriptions-change) | Bearer JWT; `payments.manage`; full access required |
| POST | `/api/payments/subscriptions/checkout` | [Payments and subscriptions](21-payments.md#post-api-payments-subscriptions-checkout) | Bearer JWT; `payments.manage`; full access required |
| GET | `/api/payments/transactions` | [Payments and subscriptions](21-payments.md#get-api-payments-transactions) | Bearer JWT; `payments.view`; profile-setup access supported |
| GET | `/api/price-catalogue` | [Price catalogue](13-price-catalogue.md#get-api-price-catalogue) | Bearer JWT; `price-catalogue.view`; full access required |
| GET | `/api/price-catalogue/{itemId}` | [Price catalogue](13-price-catalogue.md#get-api-price-catalogue-itemid) | Bearer JWT; `price-catalogue.view`; full access required |
| POST | `/api/provider-prices` | [Provider prices and item requests](14-provider-prices.md#post-api-provider-prices) | Bearer JWT; `prices.manage`; full access required |
| GET | `/api/provider-prices/{id}` | [Provider prices and item requests](14-provider-prices.md#get-api-provider-prices-id) | Bearer JWT; `prices.view`; full access required |
| PUT | `/api/provider-prices/{id}` | [Provider prices and item requests](14-provider-prices.md#put-api-provider-prices-id) | Bearer JWT; `prices.manage`; full access required |
| GET | `/api/provider-prices/{id}/history` | [Provider prices and item requests](14-provider-prices.md#get-api-provider-prices-id-history) | Bearer JWT; `prices.view`; full access required |
| POST | `/api/provider-prices/{id}/restore` | [Provider prices and item requests](14-provider-prices.md#post-api-provider-prices-id-restore) | Bearer JWT; `prices.manage`; full access required |
| POST | `/api/provider-prices/{id}/withdraw` | [Provider prices and item requests](14-provider-prices.md#post-api-provider-prices-id-withdraw) | Bearer JWT; `prices.delete`; full access required |
| GET | `/api/provider-prices/available-items` | [Provider prices and item requests](14-provider-prices.md#get-api-provider-prices-available-items) | Bearer JWT; `prices.view`; full access required |
| GET | `/api/provider-prices/current` | [BRD 19 marketplace, card payments and pricing](22-marketplace-updates.md#get-api-provider-prices-current) | Bearer JWT; `prices.view`; full access required |
| POST | `/api/provider-prices/item-requests` | [Provider prices and item requests](14-provider-prices.md#post-api-provider-prices-item-requests) | Bearer JWT; `prices.manage`; full access required |
| GET | `/api/provider-prices/item-requests/{id}` | [Provider prices and item requests](14-provider-prices.md#get-api-provider-prices-item-requests-id) | Bearer JWT; `prices.view`; full access required |
| GET | `/api/provider-prices/item-requests/{id}/history` | [Provider prices and item requests](14-provider-prices.md#get-api-provider-prices-item-requests-id-history) | Bearer JWT; `prices.view`; full access required |
| GET | `/api/provider-prices/item-requests/me` | [Provider prices and item requests](14-provider-prices.md#get-api-provider-prices-item-requests-me) | Bearer JWT; `prices.view`; full access required |
| GET | `/api/provider-prices/me` | [Provider prices and item requests](14-provider-prices.md#get-api-provider-prices-me) | Bearer JWT; `prices.view`; full access required |
| POST | `/api/quotes` | [Quotes](09-quotes.md#post-api-quotes) | Bearer JWT; `quotes.manage`; full access required |
| GET | `/api/quotes/{quoteId}` | [Quotes](09-quotes.md#get-api-quotes-quoteid) | Bearer JWT; `quotes.view`; full access required |
| POST | `/api/quotes/{quoteId}/accept` | [Quotes](09-quotes.md#post-api-quotes-quoteid-accept) | Bearer JWT; `quotes.manage`; full access required |
| GET | `/api/quotes/{quoteId}/pdf` | [Quotes](09-quotes.md#get-api-quotes-quoteid-pdf) | Bearer JWT; `quotes.view`; full access required |
| PUT | `/api/quotes/{quoteId}/pdf` | [Quotes](09-quotes.md#put-api-quotes-quoteid-pdf) | Bearer JWT; `quotes.manage`; full access required |
| POST | `/api/quotes/{quoteId}/reject` | [Quotes](09-quotes.md#post-api-quotes-quoteid-reject) | Bearer JWT; `quotes.delete`; full access required |
| POST | `/api/quotes/{quoteId}/withdraw` | [Quotes](09-quotes.md#post-api-quotes-quoteid-withdraw) | Bearer JWT; `quotes.delete`; full access required |
| GET | `/api/quotes/me` | [Quotes](09-quotes.md#get-api-quotes-me) | Bearer JWT; `quotes.view`; full access required |
| GET | `/api/services/{serviceId}` | [Services and discovery](07-service-discovery.md#get-api-services-serviceid) | Bearer JWT; `services.view`; full access required |
| GET | `/api/services/me` | [Services and discovery](07-service-discovery.md#get-api-services-me) | Bearer JWT; `services.view`; full access required |
| POST | `/api/services/me` | [Services and discovery](07-service-discovery.md#post-api-services-me) | Bearer JWT; `services.manage`; full access required |
| DELETE | `/api/services/me/{serviceId}` | [Services and discovery](07-service-discovery.md#delete-api-services-me-serviceid) | Bearer JWT; `services.delete`; full access required |
| GET | `/api/services/me/{serviceId}` | [Services and discovery](07-service-discovery.md#get-api-services-me-serviceid) | Bearer JWT; `services.view`; full access required |
| PUT | `/api/services/me/{serviceId}` | [Services and discovery](07-service-discovery.md#put-api-services-me-serviceid) | Bearer JWT; `services.manage`; full access required |
| GET | `/api/services/search` | [Services and discovery](07-service-discovery.md#get-api-services-search) | Bearer JWT; `services.view`; full access required |
| POST | `/api/support/tickets` | [Support conversations](15-support.md#post-api-support-tickets) | Bearer JWT; `support.manage`; profile-setup access supported |
| GET | `/api/support/tickets/{id}` | [Support conversations](15-support.md#get-api-support-tickets-id) | Bearer JWT; `support.view`; profile-setup access supported |
| POST | `/api/support/tickets/{id}/close` | [Support conversations](15-support.md#post-api-support-tickets-id-close) | Bearer JWT; `support.delete`; profile-setup access supported |
| GET | `/api/support/tickets/{id}/history` | [Support conversations](15-support.md#get-api-support-tickets-id-history) | Bearer JWT; `support.view`; profile-setup access supported |
| GET | `/api/support/tickets/{id}/messages` | [Support conversations](15-support.md#get-api-support-tickets-id-messages) | Bearer JWT; `support.view`; profile-setup access supported |
| POST | `/api/support/tickets/{id}/messages` | [Support conversations](15-support.md#post-api-support-tickets-id-messages) | Bearer JWT; `support.manage`; profile-setup access supported |
| POST | `/api/support/tickets/{id}/reopen` | [Support conversations](15-support.md#post-api-support-tickets-id-reopen) | Bearer JWT; `support.manage`; profile-setup access supported |
| GET | `/api/support/tickets/me` | [Support conversations](15-support.md#get-api-support-tickets-me) | Bearer JWT; `support.view`; profile-setup access supported |

Coverage: **241 controller operations across 204 paths**.
