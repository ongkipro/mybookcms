# Malaysia Shipping Research — 2026-08-23

## Decision use

This research supports the merchant-owned D1 rate-table design in
[`PRD.md`](../../PRD.md) (Market contract). It is not a courier
contract, live quote, or a promise that a merchant will receive these rates.

## Verified observations

| Topic | Observation | Source |
| --- | --- | --- |
| Public postpaid bands | Ninja Van's current West Malaysia drop-off table publishes RM6.50/7.30/8.10/8.90/9.70 for 1–5 kg; pickup adds RM1. | [Ninja Van MY last-mile delivery](https://www.ninjavan.co/en-my/logistics-solutions/last-mile-parcel-delivery) |
| East Malaysia bands | The current East Malaysia drop-off table publishes RM13/23/35/43/54 for 1–5 kg; pickup is separately priced. | [Ninja Van MY last-mile delivery](https://www.ninjavan.co/en-my/logistics-solutions/last-mile-parcel-delivery) |
| Rate variables | A current Ninja Van support article says prices depend on parcel dimensions, service, and potential address-change fees, and the billable weight can be actual or volumetric. | [Ninja Van MY support](https://www.ninjavan.co/en-my/support/shipper-support/pricing-and-coverage/how-to-calculate-and-check-shipping-rates) |
| Account pricing | Ninja Van says account-manager shippers should use their own rate card; its business page notes rates are exclusive of taxes and COD fees. | [Ninja Van last-mile delivery](https://www.ninjavan.co/en-my/logistics-solutions/last-mile-parcel-delivery) |
| COD fee | Ninja Van's support policy states 3% of the collected amount or RM4 minimum. This is a payment/collection fee, not a universal delivery rate. | [Ninja Van MY COD support](https://www.ninjavan.co/en-my/support/shipper-support/billing-and-invoicing/cash-on-delivery-cod) |
| Postcode format | Universal Postal Union country guidance defines Malaysia postcodes as five digits to the left of the locality name. | [UPU Malaysia addressing guide](https://www.upu.int/UPU/media/upu/PostalEntitiesFiles/addressingUnit/mysEn.pdf) |
| Labuan coverage | Malaysia's official MyInvois state-code list identifies Wilayah Persekutuan Labuan separately. | [MyInvois state codes](https://sdk.myinvois.hasil.gov.my/codes/state-codes/) |
| Location directory | Malaysia's official open-data catalogue publishes the MCMC postcode snapshot with city, state, and postcode fields; the snapshot used here was updated 2026-06-16. | [data.gov.my postcode dataset](https://data.gov.my/ms-MY/data-catalogue/poskod) |

## Consequences

1. No public rate is safe to hard-code as a live courier quote.
2. Weight-only pricing is a transparent initial merchant policy, but it cannot
   claim to reproduce volumetric provider billing.
3. Peninsular, Sabah, Sarawak, and Labuan remain separate fallback zones, while
   each of the 13 states and three Federal Territories owns an editable rate.
4. The merchant-safe reference policy rounds the current public tables upward
   for pickup/tax variance: Peninsular RM8/9/10/11/12 and Sabah/Sarawak/Labuan
   RM15/26/39/48/60 for 1–5 kg. Labuan follows the East Malaysia policy as a
   documented merchant inference, not a courier promise.
5. COD collection cost is deliberately excluded from delivery rates. Manual
   bank-transfer buyers must never inherit a COD fee, and MyBookCMS does not
   claim a provider fee without a provider integration.
6. Runtime address search uses the checked-in D1 snapshot and never calls the
   open-data portal or a courier while a buyer is checking out.
