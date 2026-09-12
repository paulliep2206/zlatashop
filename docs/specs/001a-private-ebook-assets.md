# Private e-book assets and product administration

Status: Approved

Parent: [001-virtual-products.md](001-virtual-products.md)

## Goal

Store immutable e-book versions privately, associate one current version with each virtual product,
and define virtual-product validity without exposing a storage credential or enabling virtual
checkout.

## Current repository behavior

- `Media` is a public-read, image-only upload collection. Administrators can create, update, and
  delete its records, while anyone can read them. The configured UploadThing adapter stores this
  collection with `acl: "public-read"`.
- The installed `@payloadcms/storage-uploadthing` adapter accepts `public-read` or `private` ACL per
  adapter configuration. The underlying cloud-storage plugin can target collections separately and,
  unless `disablePayloadAccessControl` is enabled, serves a file through Payload's
  `/:collectionSlug/file/:filename` route after applying the upload collection's read access.
- The UploadThing adapter injects `_key`, and Payload/cloud storage injects upload metadata including
  `url`, `filename`, `mimeType`, and `filesize`. `admin.hidden` does not prevent an injected field
  from appearing in REST or GraphQL.
- Products already support `productType: "virtual"` and Payload drafts. `price`, `stockStatus`, and
  `stock` are currently required. Only `stock` is hidden in the admin for virtual products.
- Current product detail, structured-data, add-to-cart, quantity, and stock-indicator code uses
  `stock` and/or `stockStatus`. The implemented WayForPay initiation path ignores those fields for a
  virtual product but rejects virtual-only and mixed carts while their independent server rollout
  gates are disabled. It does not yet validate an e-book asset.
- The product override spreads the plugin collection configuration, but replaces its `fields`
  array. The ecommerce plugin currently supplies draft/version, access, trash, field, and hook
  behavior that future overrides must preserve deliberately.
- Payload uses PostgreSQL and writes generated types to `src/payload-types.ts`; `generate:types` and
  the Payload CLI are available. There is currently no committed Payload migration directory or
  recorded production schema baseline.

## Storage and collection design

- Add a dedicated upload collection with slug `ebook-assets`. Do not store an e-book in `Media`,
  change `Media` access, change its `image/*` restriction, or change its public-read UploadThing
  behavior.
- Configure `ebook-assets` through a separate UploadThing adapter instance with `acl: "private"`.
  Keep Payload file-route access enabled; `disablePayloadAccessControl` must not be set for this
  collection.
- Before rollout, prove in the target UploadThing application that per-upload ACL override is
  enabled. If it is not, use a separate UploadThing application/token whose default ACL is private.
  In either configuration, a staging smoke test must prove that a newly uploaded e-book rejects the
  unsigned UploadThing object URL while an existing `Media` image remains anonymously readable.
- Collection create, read, update, and delete operations are administrator-only. Customer and
  anonymous REST and GraphQL operations receive no asset document. Local API operations performed
  on behalf of a user set `overrideAccess: false`; an intentional privileged operation is explicit.
- One `ebook-assets` document represents one immutable binary version. Its binary, `_key`, `url`,
  `filename`, `mimeType`, `filesize`, and checksum cannot be changed in place. Correcting or replacing
  a file creates a new document. Detected format plus format/scanner state are system-owned lifecycle
  fields and can change only through their authenticated transition services without changing the
  version's file identity.
- Products gain one current-version relationship to `ebook-assets`. That relationship has
  administrator-only field read access so anonymous/customer product responses omit both a
  populated document and its ID at every relationship depth. It is also omitted from storefront
  queries and serialized cart/product responses.
- A product whose type is not `virtual` cannot save or publish with the e-book relationship. The
  save is rejected with a field-specific error rather than silently retaining the association.
- Preserve the product collection's existing access, drafts/versioning, trash behavior, hooks, and
  plugin-provided fields when adding the relationship and validation. Preserve all upload and cloud
  storage hooks when configuring `ebook-assets`.

## Public-data and retrieval boundary

- Treat the asset document ID, product-to-asset relationship value, UploadThing `_key`, any raw
  UploadThing object URL, the Payload file URL/filename, and every signed URL as protected data.
- Anonymous and customer reads of `ebook-assets` are denied at collection level. Protected product
  fields are denied at field level. Hiding a field only in the admin UI or relying only on
  relationship population depth is insufficient.
- Anonymous REST and GraphQL product queries, direct asset queries, cart population, storefront
  server-component results, JSON/structured data, and error bodies contain none of the protected
  values. User-scoped Local API tests use `overrideAccess: false` and prove the same result.
- An anonymous request to `/api/ebook-assets/file/:filename`, including a known filename, is denied
  without proxying the private binary. An unsigned direct UploadThing URL is also denied.
- This specification generates no customer signed URL. Signed URL creation is introduced only by
  001b after entitlement authorization. No signed URL is persisted in Payload.
- Tests inspect complete response bodies for protected values rather than checking only selected
  fields or expected status codes.

## Upload validation contract

- Validation is server-side and applies identically to admin UI, REST, GraphQL mutations where
  supported, and Local API uploads. File-picker restrictions are not validation.
- A usable version requires all of the following to agree: the normalized terminal filename
  extension, declared MIME type, detected container/signature, the 100 MiB size limit, and successful
  structural parsing. Format validation is independent of malware scanner state.
- Filename extensions and MIME values are compared case-insensitively after trimming surrounding
  whitespace. The filename must have the terminal extension in the matrix. A missing MIME value is
  rejected. `application/octet-stream` is allowed only where the matrix lists it and never replaces
  or weakens signature, container, or parser checks.

### Approved format matrix

| Format | Terminal extension | Accepted MIME values | Required content validation | Rejected in v1 |
| --- | --- | --- | --- | --- |
| PDF | `.pdf` | `application/pdf`, `application/octet-stream` | Bytes start at offset 0 with `%PDF-` followed by a syntactically valid PDF version; a bounded PDF parser must successfully resolve the document structure, cross-reference data, trailer, and end-of-file marker. | Malformed or truncated structure, a non-PDF signature, or any parser-detected encryption/password protection, including an encryption dictionary. |
| EPUB | `.epub` | `application/epub+zip`, `application/octet-stream` | A valid ZIP/OCF container; the first local entry is the uncompressed ASCII file `mimetype` whose exact content is `application/epub+zip`; `META-INF/container.xml` is well-formed and names at least one existing package document; each selected package document is well-formed XML with root `package` in namespace `http://www.idpf.org/2007/opf`. | Any ZIP/OCF or XML failure; more than 2,000 central-directory entries; more than 524,288,000 total uncompressed bytes; a per-entry or aggregate uncompressed-to-compressed ratio above 20:1; absolute, drive-prefixed, backslash, NUL, or `..` traversal paths after normalization; symbolic-link entries; ZIP encryption; or `META-INF/encryption.xml` declaring encrypted resources. |
| FB2 | `.fb2` | `application/x-fictionbook+xml`, `application/xml`, `text/xml`, `application/octet-stream` | A well-formed XML document that validates against a repository-pinned local copy of the FictionBook 2.0 schema, with root `FictionBook` in namespace `http://www.gribuser.ru/xml/fictionbook/2.0`. Schema imports resolve only to pinned local files. | A malformed document, wrong root/namespace, schema failure, DTD or entity declaration, external entity or XInclude use, or any attempted network/file-system resolution. Compressed `.fb2.zip` is not accepted. |
| MOBI | `.mobi` | `application/x-mobipocket-ebook`, `application/octet-stream` | A bounded Palm Database parser verifies a complete header and record table, exact ASCII `BOOKMOBI` at zero-based offsets 60–67, positive record count, monotonic in-bounds record offsets, and exact ASCII `MOBI` at 16 bytes after the first record's start with a declared header length that fits that record. | `.prc` or `.azw` extensions, `TEXTREAD` without `BOOKMOBI`, malformed/truncated headers or record tables, zero records, overlapping/non-monotonic/out-of-bounds record offsets, or an absent/out-of-bounds MOBI header. |

- Format validation receives at most 104,857,600 input bytes and has a 30-second wall-clock deadline
  per asset. A timeout rejects the format. Parsers must not allocate or read from unchecked declared
  lengths or offsets. Each parsed XML document is limited to 128 element depth and 1,000,000 total
  elements. DTDs, general/parameter external entities, XInclude, schema downloads, file-system
  resolution, and all parser network access are disabled.
- EPUB limits are checked from the central directory before extraction and again while streaming
  decompression. The 20:1 limit applies both per non-empty entry and to the aggregate archive;
  compressed size zero with non-empty output is rejected. Extraction never writes paths supplied by
  the archive to the application filesystem.
- The maximum is exactly 104,857,600 bytes (100 MiB) per asset. It applies before storage and at the
  upload transport. Payload must abort rather than truncate an over-limit upload. The design must
  account for the deployment platform's server-upload limit or explicitly configure authenticated
  client uploads without weakening server-side validation.
- Store format state separately as `pending`, `valid`, or `invalid`, with a detected format and
  rejection reason. Replacement uploads begin with format state `pending` and scanner state
  `pending`. A successful format check does not make scanner state `clean`, and a clean scan does not
  make an invalid format valid.
- Malware scanning is required before an asset is valid or downloadable. Only a successful result
  changes scanner state to `clean`. A failed, unavailable, or timed-out scan changes or keeps scanner
  state as `quarantined`. `pending` and `quarantined` assets cannot satisfy product publication and
  cannot be delivered. Scanner identity, attempt ID, timestamps, and result/reason are retained for
  audit without exposing scanner details publicly.
- Format and scanner fields deny ordinary admin, REST, GraphQL, and user-scoped Local API updates.
  Scanner transitions run only through a server-owned service authenticated as the configured
  scanner worker. Every attempt has a unique idempotency key. Repeating the same authenticated event
  is a no-op returning the stored outcome; an unauthenticated event or a conflicting reuse of an
  idempotency key is rejected and audited. A quarantined asset may become clean only after a new
  authenticated scan attempt succeeds.
- A failed validation or scan creates no usable asset. If a database record or UploadThing object
  was created before failure, the operation records and verifies compensating cleanup; an orphaned
  private object must never be attachable to a product.

## Product validity and availability contract

- The effective price is `specialPrice` when it is a number, otherwise `price`. A valid effective
  price is finite, strictly positive, and exactly convertible to positive integer minor units using
  the same rule as server payment initiation.
- A valid private asset exists, has format state `valid`, has scanner state `clean`, has its binary
  and private storage key recorded, is not archived or pending deletion, and matches the product's
  current `ebook-assets` relationship.
- A virtual product may transition to `_status: "published"` only when its effective price and
  private asset are valid. Enforce this on every write path, including admin, REST, GraphQL, Local
  API, and draft-to-published transitions. A failure identifies the price or e-book relationship;
  a hidden admin condition alone is not enforcement.
- The authoritative virtual availability predicate is: published product, valid effective price,
  and valid private asset. `stock` and `stockStatus` are never inputs. For virtual products, their
  admin controls are hidden or read-only and their required-field validation cannot block a valid
  virtual draft or publication. Existing stored stock values may remain for schema compatibility but
  have no virtual meaning.
- 001a owns the predicate and product publication invariant. Under the parent responsibility map,
  001c must use that same predicate for storefront stock presentation, product structured data,
  add-to-cart, cart quantity behavior, and payment-time availability; it must not reproduce a
  stock-based virtual rule. The already implemented disabled WayForPay gates remain authoritative
  until 001c/001d explicitly enable them.
- Physical `simple` and `configurable` product availability remains based on the existing
  `stock`/`stockStatus` rules and is regression-tested.

## Replacement, references, and deletion

- A replacement upload creates a new `ebook-assets` document without changing the product's current
  relationship automatically. Every replacement begins with format and scanner states `pending`;
  it never inherits `valid` or `clean` from the old version and never overwrites the old storage key
  or binary. After validation/scanning, changing the product's current-version relationship is a
  separate write subject to the publication invariant.
- An old version may be archived after replacement. Archived versions are hidden from normal product
  asset selection but remain directly visible to administrators with appropriate archived filters
  and continue to resolve existing entitlement downloads.
- Any already captured order item or entitlement continues to reference its original asset version.
  Replacement does not rewrite those records. The umbrella's unresolved payment capture boundary
  affects only a payment that has not yet captured a version, not an existing entitlement.
- A version referenced by an entitlement cannot be hard-deleted or have its binary deleted. A
  version still selected by a product or referenced by another immutable purchase record is not
  unreferenced and likewise cannot be deleted. Enforcement must be race-safe through database
  constraints/transactional checks, not only an admin UI check.
- An administrator may request deletion only for an unreferenced version. The request atomically
  rechecks references and changes lifecycle state to `pending-deletion`; it does not synchronously
  delete the record or binary. Pending-deletion versions are hidden from product selection and cannot
  acquire new references.
- An idempotent asynchronous job claims a pending deletion, rechecks all references immediately
  before provider deletion, records a stable internal deletion-operation ID, and calls UploadThing by
  the version's immutable file key. If a reference exists or is created concurrently, deletion is
  refused and the binary remains. Database constraints and transactionally enforced reference
  creation close the check/delete race.
- After UploadThing confirms deletion or an idempotent provider response confirms the object is
  already absent, the job removes the asset record. Provider errors retain the record and key, mark
  deletion failed with an administrator-visible reason and attempt history, and remain retryable.
  Repeating a successful job or the same delivery does not delete another object or report a false
  failure.
- Archival cannot change the immutable version ID, binary, key, or reference resolution.

## Migration, rollback, and rollout

- [000a-postgres-migration-baseline.md](000a-postgres-migration-baseline.md) is an operational
  prerequisite. Do not generate or apply the 001a feature migration until 000a has verified the
  production PostgreSQL baseline and its required recovery evidence has been approved.
- Commit generated Payload types and a reviewed PostgreSQL migration for the new collection,
  product relationship, indexes, enums/status fields, and reference protection. Do not rely on
  development `push` in staging or production.
- Before applying the feature migration, run a read-only dry run against the pre-001a schema that
  reports every published `virtual` product. Because that schema has no private-asset relationship,
  every reported record lacks a valid private asset by definition. Report stable product ID and
  current status but no protected storage value. A named reviewer approves that report before the
  write phase.
- After the feature migration adds the nullable relationship, the reviewed data phase idempotently
  moves every reported product to Draft. It does not
  manufacture, infer, or guess an asset association and does not reclassify a product. Existing
  physical `simple` and `configurable` products and their publication/stock state remain unchanged.
  The migration aborts transactionally on an unexpected product type, status, relationship shape, or
  other state that cannot be classified safely; it does not partially apply the legacy conversion.
- Use an additive, expand-first database migration so old application code continues to read
  products during the schema rollout. Enable the private adapter only with the new collection code;
  existing `Media` rows and objects are not copied or re-ACL'd.
- Keep both virtual WayForPay rollout gates disabled before, during, and after 001a deployment.
  Deploying this specification does not enable customer purchase, payment, entitlement, or download
  entry points. A virtual cart reaching payment initiation is rejected before payment creation.
- Staging verification covers the pre-migration dataset, migration, old/new application overlap,
  private upload and anonymous denial, public `Media` regression, generated types, and disabled
  payment gates. It also includes the backup, schema comparison, empty-database reconstruction,
  production-copy migration, and rollback/recovery evidence required by 000a.
- Rollback disables new writes and returns to the previous application without changing any private
  object to public. Additive schema may remain in place. Run a destructive `down` migration only if
  no e-book record, product reference, or later-spec reference exists; otherwise use a forward fix.
  Private binaries remain private throughout rollback, and orphan cleanup is an explicit audited
  operation.

## Acceptance criteria

- Given an existing CMS/product image and a newly uploaded e-book, when anonymous retrieval is
  attempted, then the image remains readable while both the unsigned UploadThing e-book URL and
  Payload e-book file route are denied.
- Given an anonymous user or any non-admin user, when asset CRUD or protected fields are requested
  through REST or GraphQL, then the asset request is denied and product/cart/storefront responses
  contain no asset ID, relationship value, filename, `_key`, direct URL, Payload file URL, or signed
  URL.
- Given an anonymous Local API operation with `overrideAccess: false`, when products and assets are
  read at multiple relationship depths, then it returns the same protected-data boundary as REST
  and GraphQL. A regression test demonstrates why the same call without enforced access is not a
  public-data path.
- Given one fixture for each approved format and the configured byte boundary, when validation is
  exercised, then the exact extension/MIME/signature matrix accepts the valid fixtures and rejects
  every cross-format mismatch, malformed/truncated fixture, disallowed encryption/container case,
  file of 104,857,601 bytes, and fixture rejected by scanning. A file of exactly 104,857,600 bytes is
  within the size limit. Rejection leaves no usable document or attachable orphan.
- Given an upload of 104,857,601 bytes, when either the transport or server-side validator receives
  it, then the request aborts without truncation and no UploadThing object or usable asset is created.
  Given exactly 104,857,600 bytes, size validation alone does not reject it.
- Given PDF, EPUB, FB2, MOBI, generic-octet-stream, malformed, encrypted, traversal, ZIP-bomb, XML
  entity, oversized-structure, and parser-timeout fixtures, when the matrix is exercised, then every
  accepted fixture satisfies its extension, MIME, and structural row and every rejected fixture
  fails for its specified reason within the parsing bounds. `application/octet-stream` alone never
  causes acceptance.
- Given a newly validated asset, when its scan is pending, fails, times out, or the scanner is
  unavailable, then it remains non-downloadable and cannot publish a product; failure, timeout, and
  unavailability leave it quarantined. Only a successful scan makes it clean and eligible.
- Given format state `valid` with scanner state other than `clean`, or scanner state `clean` with
  format state other than `valid`, when publication or delivery eligibility is evaluated, then the
  asset is rejected. Only the independent combination `valid` and `clean` is eligible.
- Given an ordinary administrator, REST/GraphQL caller, or user-scoped Local API caller, when scanner
  or format fields are submitted, then the fields do not change. Given an unauthenticated scanner
  event, a replay, or conflicting reuse of an idempotency key, when transition is attempted, then an
  unauthenticated/conflicting event is rejected, an exact replay is a no-op, and only one audited
  transition is applied.
- Given a virtual product with a missing/invalid asset or invalid effective price, when any write
  path attempts publication, then publication fails with the corresponding field-specific error.
  Given a non-virtual product with an e-book relationship, save is rejected.
- Given an existing asset version, when an administrator attempts to replace its upload or change
  its binary, key, URL, filename, MIME, size, or checksum through any write API, then the write is
  rejected and the file identity remains unchanged. Ordinary writes also cannot change detected
  format or format/scanner state; authenticated lifecycle transitions may populate detected format
  and change their owned states, and remain audited.
- Given a valid published virtual product whose stored `stock` is zero and whose `stockStatus` is
  `out_stock`, when the shared availability predicate is evaluated, then it is available; changing
  only either stock field does not change the result. In the virtual-product admin form those stock
  controls are absent or read-only, and missing stock values do not cause validation failure.
  Physical product regressions retain their current stock behavior.
- Given a product asset is replaced, when the operation succeeds, then a new immutable asset ID/key
  exists in pending format/scanner state and the product still points to its previous version. A
  later product update can select the replacement only subject to publication validation. The old
  version remains unchanged, and the replacement cannot support publication until both states become
  valid/clean.
- Given an old version is archived, when an administrator uses the normal product asset selector,
  then that version is hidden and an explicit archived admin view still resolves it.
- Given a version selected by a product, including a concurrent attempt to create that reference,
  when normal hard deletion is attempted, then the record and binary remain. Given an unreferenced
  version, when an administrator requests deletion, then it first becomes pending-deletion and an
  idempotent job performs the provider call. Provider failure retains the record/key with visible
  retry state; provider success removes exactly that record, and job replay is harmless.
- Given a provider deletion failure, when an administrator inspects the asset and the asynchronous
  job retries, then the failure and attempt history are visible, the retry targets the same immutable
  key, and eventual provider success removes exactly that asset. Repeated retry delivery remains
  harmless.
- Given the legacy dry run, when published virtual products lack a valid private asset, then all and
  only those records appear in the review report. After approval, the write phase moves exactly those
  products to Draft without adding asset relationships or changing physical products. An unexpected
  unclassifiable state aborts the transaction without partial conversion.
- Given 000a is not approved and completed with its evidence accepted, when generation or application
  of the 001a feature migration is attempted, then the release procedure blocks it. Given completed
  000a evidence, when the 001a migration is later generated, then it is based on the committed
  baseline and must pass empty-database and fresh-production-copy migration tests before deployment.
- Given the migration and rollback runbook is exercised in staging, when old and new application
  versions overlap, then legacy physical records remain readable, the approved legacy-virtual policy
  is applied, migration status is clean, public images remain public, and no private binary is
  anonymously retrievable before, during, or after rollout/rollback.
- Given 001a is deployed without 001c and both server gates are disabled, when virtual-only or mixed
  payment initiation is attempted, then no payment is created. Existing physical checkout and media
  regressions pass.

## Downstream conformance criteria

These criteria are binding but are executed by the integration suites for the specifications that
own the later schema or surface; they do not block standalone 001a implementation verification.

- Given 001b has introduced order-item and entitlement references, when a referenced asset is
  replaced, archived, or submitted for deletion, then the captured reference continues to resolve
  the original ID and binary, and physical deletion is refused.
- Given 001c consumes the 001a availability predicate, when the same virtual fixture is rendered in
  storefront and structured data or evaluated by add-to-cart, cart, and payment-time validation,
  then no surface marks it unavailable because of `stock` or `stockStatus`.

## Open questions

None.

## Out of scope

- Checkout UI, payment finalization, entitlement creation, email, customer authorization, and
  customer download/signed-URL generation.
- Enabling either virtual payment gate. Storefront/cart integration of the availability predicate is
  owned by 001c, and mixed fulfillment is owned by 001d.

## Dependencies

Requires 000a to be approved and completed before generating or applying the 001a feature migration.
Deployment also requires 000 with both virtual payment gates disabled, the approved feature migration
and private-storage runbook, and completed staging privacy verification. Customer purchase remains
disabled until the later child specifications are deployed, migrated, verified, and their respective
gates are deliberately enabled.
