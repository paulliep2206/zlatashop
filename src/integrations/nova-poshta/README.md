# Nova Poshta integration

This module owns Nova Poshta API transport, validation, office lookup, order persistence, and
optional electronic waybill creation. Browser code calls the Payload endpoint at
`GET /api/nova-poshta/warehouses`; the Nova Poshta API key remains server-side.

## Configuration

Copy the `NOVA_POSHTA_*` variables from `.env.example` into the deployment environment. Generate
the API key in the Nova Poshta business account. Sender, contact, city, and warehouse refs must
belong to that account.

Automatic waybill creation is deliberately disabled by default. After verifying all sender refs
and shipment defaults, set:

```dotenv
NOVA_POSHTA_CREATE_WAYBILL_ON_ORDER=true
```

The waybill is created only after WayForPay has confirmed payment and created the order. A Nova
Poshta failure does not roll back or hide a paid order: the order stores a `failed` waybill status
and the server logs the original error. Successful responses store the waybill ref, number, cost,
and estimated delivery date.

The current implementation supports office-to-office parcels (`WarehouseWarehouse`) with one
seat, sender-paid non-cash delivery, and a configurable default weight/description. Product-level
dimensions, multiple seats, cash on delivery, courier delivery, and retry jobs are outside this
module's current scope.
