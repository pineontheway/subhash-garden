# Subhash Garden - POS System

Water park & resort management system. Mobile-first PWA for two counter operations: **Clothes Counter** (dress/tube/locker rental) and **Ticket Counter** (entry tickets).

## Tech Stack

- **Framework**: Next.js 16.1.1 (Pages Router), React 19.2.3, TypeScript
- **Styling**: Tailwind CSS v4, PostCSS
- **Database**: Turso (SQLite cloud) via `@libsql/client`
- **ORM**: Drizzle ORM (`src/lib/schema.ts` for schema, `src/lib/db.ts` for client)
- **Auth**: NextAuth.js with CredentialsProvider (email+password), JWT sessions, bcryptjs (10 rounds)
- **QR Codes**: `qrcode.react` (QRCodeSVG)
- **Printing**: Android WebView bridge (`window.Android.print()`)

## File Structure

```
src/pages/
  index.tsx              - Login screen + Clothes counter (dual-purpose)
  checkout.tsx           - Clothes rental payment & receipt
  return-advance.tsx     - Item collection, deductions & refund
  my-summary.tsx         - Daily cashier summary
  select-counter.tsx     - Counter type selection
  access-denied.tsx      - No-role error page
  _app.tsx               - SessionProvider wrapper
  _document.tsx          - PWA meta tags, manifest

  ticket-counter/
    index.tsx            - Ticket sales form
    start-session.tsx    - Session init (starting tag number)
    checkout.tsx         - Ticket payment & receipt
    end-session.tsx      - Shift summary & close

  api/
    auth/[...nextauth].ts  - Auth config (Credentials provider)
    prices/index.ts        - GET all prices, PUT update (admin)
    settings/index.ts      - GET all settings, PUT update (admin)
    transactions/index.ts  - POST create, GET list, PATCH return-advance
    ticket-transactions/index.ts - POST create, GET list
    users/index.ts         - GET list, POST create, PUT update role/password, DELETE remove role
    hello.ts               - Health check

src/lib/
  db.ts                  - Drizzle client init (Turso connection)
  schema.ts              - All table definitions

src/styles/globals.css   - Tailwind imports + CSS variables
src/types/next-auth.d.ts - Session/JWT type extensions (adds role)
drizzle/                 - Migration files
```

## Database Schema (src/lib/schema.ts)

### users
| Field | Type | Notes |
|-------|------|-------|
| id | text PK | NextAuth user ID |
| email | text unique | |
| name | text | Display name |
| passwordHash | text | bcrypt hashed |
| role | 'admin' \| 'cashier' \| NULL | NULL = no access |

### prices
| Field | Type | Notes |
|-------|------|-------|
| id | text PK | |
| itemKey | text unique | `male_costume` (used for Dress pricing), `female_costume` (legacy), `kids_costume` (legacy), `tube`, `locker`, `men_ticket`, `women_ticket`, `child_ticket` |
| itemName | text | Display name |
| price | real | |
| isActive | boolean | Default true |

### settings
Key-value store. Important keys:
- `upi_id`, `business_name` - Default/clothes counter UPI
- `clothes_upi_id`, `clothes_business_name` - Clothes-specific UPI (falls back to default)
- `tickets_upi_id`, `tickets_business_name` - Ticket counter UPI
- `enable_ticket_flow`, `enable_clothes_flow` - Toggle counters on/off

### transactions (Clothes)
| Field | Type | Notes |
|-------|------|-------|
| customerName, customerPhone | text | |
| maleCostume, femaleCostume, kidsCostume, tube, locker | integer | Quantities. UI shows single "Dress" item; `maleCostume` stores dress count, `femaleCostume` and `kidsCostume` are always 0 for new transactions. Old transactions may have data in all 3 costume columns — code sums them for backward compat. |
| lockerNumbers | text nullable | Free-form locker number(s) text. Compulsory when locker > 0 (validated in UI). Displayed on receipt and in return-advance modal. |
| subtotal | real | Items cost |
| advance | real | Amount collected upfront |
| totalDue | real | For normal: subtotal+advance. For VIP: just advance. For linked: subtotal |
| status | 'active' \| 'advance_returned' | |
| isComplimentary | boolean | VIP flag |
| paymentMethod | 'upi' \| 'cash' \| 'split' \| NULL | NULL for linked child |
| parentTransactionId | text nullable | Links child to parent (credit system) |
| cashierId, cashierName | text | Denormalized for history |
| returnDetails | text (JSON) | `ReturnDetails` on return |
| totalDeduction | real | Lost items cost on return |
| actualAmountReturned | real | advance - deductions |
| advanceReturnedAt, advanceReturnedBy | | Return metadata |

### ticketTransactions
| Field | Type | Notes |
|-------|------|-------|
| customerName, customerPhone | text | |
| vehicleType | text nullable | DB column is `vehicle_number` (repurposed). Values: `walk-in`, `bike`, `auto`, `car`, `bus`, `school-bus`. Required field in UI |
| tagNumbers | text | Comma-separated 6-digit numbers (1 per person) |
| menTicket, womenTicket, childTicket | integer | |
| subtotal, totalDue | real | Always equal (no advance for tickets) |
| paymentMethod | 'upi' \| 'cash' \| 'split' | |
| isComplimentary | boolean | |
| cashierId, cashierName | text | |

## Authentication & Roles

- **Admin**: Full access - all counters, admin panel, user/price/settings management
- **Cashier**: Selected counter only, own transactions only, no admin access
- **NULL role**: Shows `/access-denied` page
- Cashiers must select counter type at `/select-counter` (stored in sessionStorage as `counterType`)
- Session enrichment: role fetched from DB on every session callback

## Key Business Logic

### Payment Methods
- **UPI**: QR code shown (amount encoded in UPI URI)
- **Cash**: Direct save, no QR
- **Split**: Two-step confirmation flow:
  1. QR modal shows UPI portion → "UPI Received"
  2. Cash confirmation modal → "Collect Rs.X in Cash" → "Cash Collected"
  3. Transaction saves only after both confirmations
- **VIP/Complimentary**: Zero payment, items tracked normally

### Linked Transactions (Credit System)
1. Customer pays advance on parent transaction
2. Later, customer wants more items using remaining advance as credit
3. Phone search on index page finds active parent → "Link to this transaction"
4. Creates linked child: advance=0, totalDue=subtotal (credit amount)
5. Parent can only have ONE linked child
6. Return processes both parent + child together
7. Refund = `parentAdvance - childSubtotal - parentDeductions - childDeductions`

### Advance Return Flow (return-advance.tsx)
- Search by phone (10 digits), name, or receipt ID (last 8 chars)
- Shows today's active transactions only (IST date filter)
- Per-item tracking: given qty, lost count → deduction = lost × price
- Linked child items tracked separately
- VIP returns: same flow but labeled "Collect Items" (purple theme)

### Tag Numbers (Ticket Counter)
- 6-digit sequential numbers, one per ticket person
- Session initialized at `/ticket-counter/start-session` with starting tag
- Auto-increments in sessionStorage (`nextTagNumber`)
- Session date validated against today (IST) to prevent cross-day conflicts

## API Endpoints Summary

| Endpoint | Methods | Auth | Notes |
|----------|---------|------|-------|
| `/api/prices` | GET, PUT | GET: public, PUT: admin | |
| `/api/settings` | GET, PUT | GET: public, PUT: admin | |
| `/api/users` | GET, POST, PUT, DELETE | Admin only | DELETE = remove role (not user) |
| `/api/transactions` | GET, POST, PATCH | Cashier/Admin | PATCH = return advance |
| `/api/ticket-transactions` | GET, POST | Cashier/Admin | |

### GET /api/transactions query params
`startDate`, `endDate`, `status` (active/advance_returned), `cashierId` (admin only), `search`, `includeLinked`

### GET /api/ticket-transactions query params
`startDate`, `endDate`, `search`, `cashierId` (admin only)

## UI Color Scheme
- **Green**: Clothes counter default, cash payments, success states
- **Blue**: Ticket counter theme
- **Purple**: VIP/complimentary, linked transactions, split payments
- **Orange/Red**: Returns, deductions, warnings, errors

## Admin Panel (/admin) - Tabs
1. **Users**: Create/edit users, assign roles, reset passwords
2. **Prices**: Inline-edit item prices
3. **Reports**: Date-range transaction reports with revenue breakdown
4. **Inventory**: Track items given/returned/lost with deductions
5. **Settings**: UPI IDs, business names per counter
6. **Flows**: Enable/disable ticket or clothes counter

## Environment Variables (.env.local)
- `TURSO_DATABASE_URL` - Turso SQLite connection
- `TURSO_AUTH_TOKEN` - Turso auth
- `NEXTAUTH_SECRET` - JWT signing secret
- `NEXTAUTH_URL` - App URL

## Dev Commands
```bash
npm run dev      # Start dev server (port 3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
```

## Receipt Printing
Two methods:
1. **Android WebView**: `window.Android.print(text)` - formats for 80mm thermal printer (48 chars/line)
2. **Web**: Receipt displayed as modal with print-optimized CSS

Receipt IDs: `HC-{last8chars}` (clothes), `TKT-{last8chars}` (tickets)

## Important Patterns
- All dates/times use IST (Asia/Kolkata timezone)
- Phone numbers: 10-digit, Indian phone validation commented out (disabled per user request)
- Cashier names denormalized into transactions for historical accuracy
- Vehicle type is required for ticket transactions, shown in checkout, receipt, print, my-summary (stats chips), and admin
- Split payment amounts must sum exactly to total
- Session-based counter selection persists in sessionStorage
- URL params used to pass data between index → checkout pages
- **Dress unification**: Male/Female/Kids Costume merged into single "Dress" item. `ItemType = 'dress' | 'tube' | 'locker'`. The `dress` type maps to `maleCostume` DB column (`male_costume` price key). Display/inventory/return code sums all 3 costume columns for backward compat with old transactions. No DB migration was done.
