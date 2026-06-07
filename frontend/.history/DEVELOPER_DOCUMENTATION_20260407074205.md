# Kynettic Web — Comprehensive Developer Documentation

> **Last updated:** April 2026
> This document covers every file, screen, service, component, and architectural decision in the Kynettic Web codebase. A developer with no prior exposure to this project should be able to understand, extend, and debug everything using only this document.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Folder Structure](#3-folder-structure)
4. [Running the Project](#4-running-the-project)
5. [Design System & Brand Colors](#5-design-system--brand-colors)
6. [Architecture Overview](#6-architecture-overview)
7. [API Proxy Layer](#7-api-proxy-layer)
8. [Authentication Flow](#8-authentication-flow)
9. [Context Providers](#9-context-providers)
10. [Hooks](#10-hooks)
11. [Services](#11-services)
12. [App Layout & Navigation](#12-app-layout--navigation)
13. [Landing Pages](#13-landing-pages)
14. [Authentication Pages](#14-authentication-pages)
15. [App Pages (Authenticated)](#15-app-pages-authenticated)
16. [Modals & Overlays](#16-modals--overlays)
17. [Shared Components](#17-shared-components)
18. [Public Assets](#18-public-assets)
19. [Common Patterns](#19-common-patterns)
20. [Debugging Guide](#20-debugging-guide)

---

## 1. Project Overview

**Kynettic** is a P2P (peer-to-peer) cryptocurrency trading platform built for the Nigerian market (and broader Africa). It allows users to:

- Buy and sell crypto (USDT, USDC, BTC, ETH, etc.) against NGN using automated P2P settlement
- Manage crypto and fiat wallets
- Post/manage P2P trading ads
- Complete KYC verification (3-tier system)
- Set up 2FA and transaction PIN
- Send/receive internal transfers between Kynettic users
- Earn referral commissions

The web application was converted from a React Native mobile app, preserving all features and screen flows while adapting UI for desktop/browser.

**Key differentiator:** Trading is fully automated — no chat, no screenshots, no manual settlement. Orders execute programmatically.

---

## 2. Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16.1.6 | React framework (App Router) |
| React | 19.2.3 | UI library |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 4 | Utility-first styling |
| Axios | 1.x | HTTP client |
| Framer Motion | 12.x | Animations |
| Lucide React | 0.575.0 | Icon library |
| qrcode.react | 4.x | QR code generation |

**Node/Package Manager:** npm
**Build:** `next build` → static/SSR output

---

## 3. Folder Structure

```
kynettic-web/
├── public/                        # Static assets (images, icons, logos)
├── src/
│   ├── app/                       # Next.js App Router pages
│   │   ├── layout.tsx             # Root HTML shell + font providers
│   │   ├── providers.tsx          # Context providers wrapper
│   │   ├── globals.css            # Tailwind imports + @theme tokens
│   │   ├── page.tsx               # Landing page (/)
│   │   ├── login/                 # /login and /login/2fa
│   │   ├── signup/                # /signup + OTP/password/success sub-pages
│   │   ├── forgot-password/       # Password reset flow
│   │   ├── privacy-policy/        # /privacy-policy
│   │   ├── terms-of-service/      # /terms-of-service
│   │   ├── fees/                  # /fees
│   │   ├── delete-account/        # /delete-account
│   │   ├── (app)/                 # Route group: authenticated pages
│   │   │   ├── layout.tsx         # Auth guard + main shell (sidebar + right sidebar)
│   │   │   ├── wallet/            # /wallet
│   │   │   ├── p2p/               # /p2p
│   │   │   ├── my-ads/            # /my-ads
│   │   │   ├── post-ad/           # /post-ad
│   │   │   ├── buy-crypto/        # /buy-crypto
│   │   │   ├── sell-crypto/       # /sell-crypto
│   │   │   ├── withdraw-crypto/   # /withdraw-crypto
│   │   │   ├── withdraw-fiat/     # /withdraw-fiat
│   │   │   ├── withdraw-search/   # /withdraw-search (asset picker)
│   │   │   ├── deposit-fiat/      # /deposit-fiat
│   │   │   ├── fiat-internal-transfer/ # /fiat-internal-transfer
│   │   │   ├── orders/            # /orders (trade history)
│   │   │   ├── profile/           # /profile
│   │   │   ├── referrals/         # /referrals
│   │   │   ├── security-settings/ # /security-settings
│   │   │   ├── two-factor-setup/  # /two-factor-setup
│   │   │   ├── pin-setup/         # /pin-setup
│   │   │   ├── tier1-basic/       # KYC tier 1 step 1
│   │   │   ├── tier1-id/          # KYC tier 1 step 2 (BVN)
│   │   │   ├── tier1-selfie/      # KYC tier 1 step 3 (selfie)
│   │   │   ├── tier2-address/     # KYC tier 2 step 1
│   │   │   ├── tier2-proof/       # KYC tier 2 step 2
│   │   │   ├── tier3-advanced/    # KYC tier 3
│   │   │   └── verification-dashboard/ # KYC overview
│   │   └── api/
│   │       └── v1/[...path]/route.ts  # API proxy to backend
│   ├── components/
│   │   ├── Sidebar.tsx            # Left navigation sidebar
│   │   ├── RightSidebar.tsx       # Right sidebar (filters + promos + community)
│   │   ├── LoadingScreen.tsx      # Full-screen loading spinner
│   │   ├── CurrencyIcon.tsx       # Crypto/fiat currency logo resolver
│   │   ├── VerificationGateModal.tsx # KYC gate popup
│   │   ├── landing/               # Landing page sections
│   │   └── modals/                # Reusable modal components
│   ├── context/
│   │   ├── AuthContext.tsx        # User auth state
│   │   ├── WalletContext.tsx      # Wallet balances
│   │   └── AdsContext.tsx         # P2P ads + currencies
│   ├── hooks/
│   │   └── useVerificationGate.ts # KYC check with caching
│   ├── services/
│   │   ├── api.ts                 # Axios instance + interceptors
│   │   ├── auth.service.ts        # Login/register/2FA calls
│   │   ├── wallet.service.ts      # Wallets/transactions/withdrawals
│   │   ├── p2p.service.ts         # P2P ads/orders/currencies
│   │   ├── kyc.service.ts         # KYC submission/status
│   │   ├── security.service.ts    # PIN/2FA setup
│   │   ├── referral.service.ts    # Referral stats
│   │   ├── notification.service.ts # Notifications
│   │   ├── review.service.ts      # User reviews
│   │   └── user.service.ts        # Profile updates
│   └── utils/
│       └── errorHandler.ts        # Error message extractor
```

---

## 4. Running the Project

```bash
# Install dependencies
npm install

# Development server (http://localhost:3000)
npm run dev

# Production build
npm run build
npm start

# Lint
npm run lint
```
 
**Environment:** No `.env` file is required for the proxy — the backend URL is hardcoded in `src/app/api/v1/[...path]/route.ts`.

---

## 5. Design System & Brand Colors

### CSS Custom Properties (`src/app/globals.css`)

```css
@theme {
  --color-primary: #4472B7;        /* Brand blue — buttons, links, accents */
  --color-primary-dark: #2d5a9e;   /* Darker blue for hover states */
  --color-secondary: #FBAD45;      /* Orange/amber — CTA on landing */
  --color-dark: #000000;
  --color-light: rgba(68,114,183,0.13); /* Light blue tint */
  --color-dark-navy: #1D3B53;      /* Primary text color */
  --color-secondary-gray: #8E8E93; /* Secondary/muted text */
  --color-screen-bg: #F5F5F5;      /* App background */
}
```

### Key Color Usage

| Color | Hex | Usage |
|---|---|---|
| Primary Blue | `#4472B7` | Buttons, active states, borders, icons |
| Dark Navy | `#1D3B53` | Headings, primary text |
| Buy Green | `#5CB85C` | Buy buttons, success states |
| Sell Red | `#D92D20` | Sell buttons, error states |
| Secondary Gray | `#8E8E93` | Placeholder text, labels |
| Screen BG | `#F5F5F5` | App page background |
| White | `#FFFFFF` | Cards, modals, sidebar |

### Typography

- **Body font:** Roboto (weights 400/500/600/700)
- **Headings font:** Outfit (all weights)
- **Landing page:** DM Sans

The landing page uses a special CSS scope `.landing-scope` which overrides the primary color to `#FBAD45` (orange) and secondary to `#4472B7`.

### Modal / Overlay Patterns

**Centered modal:**
```jsx
<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
  <div className="bg-white rounded-2xl w-full max-w-md p-6 mx-4">
    {/* content */}
  </div>
</div>
```

**Bottom sheet:**
```jsx
<div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
  <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 pb-10">
    <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-6" /> {/* drag handle */}
    {/* content */}
  </div>
</div>
```

**Button conventions:**
- Primary action: `bg-primary text-white font-bold py-4 rounded-xl`
- Secondary/cancel: `bg-[#F0F4F8] text-[#1D3B53] font-bold py-4 rounded-xl`
- Danger: `bg-red-500 text-white`
- Outline: `border-2 border-primary text-primary`

---

## 6. Architecture Overview

```
Browser
  └── Next.js App Router
        ├── Public routes: /, /login, /signup, /privacy-policy, etc.
        └── (app) route group (auth-guarded)
              ├── layout.tsx → checks auth → shows Sidebar + RightSidebar
              └── pages → consume Context → call Services → API Proxy → Backend
```

### Data Flow

```
Page Component
  → useContext(AuthContext / WalletContext / AdsContext)
  → Service function (e.g., walletService.getWallets())
  → api.ts Axios instance (adds Bearer token)
  → /api/v1/[...path] Next.js Route Handler (proxy)
  → https://kynettic-backend.onrender.com/api/v1/...
```

### State Management

All global state lives in React Contexts:

| Context | State | Provider location |
|---|---|---|
| AuthContext | `user`, `isAuthenticated`, `loading` | `providers.tsx` (root) |
| WalletContext | `wallets[]`, `loading`, `error` | `providers.tsx` (root) |
| AdsContext | `ads[]`, `currencies[]`, `p2pFeeMultiplier` | `providers.tsx` (root) |

---

## 7. API Proxy Layer

**File:** `src/app/api/v1/[...path]/route.ts`

All frontend API calls go to `/api/v1/...` which is proxied server-side to:
```
https://kynettic-backend.onrender.com/api/v1/...
```

This avoids CORS issues and hides the backend URL from the browser. The proxy:
1. Strips browser-specific headers (`host`, `origin`, `referer`, `connection`)
2. Forwards the method, body, and remaining headers (including `Authorization`)
3. Returns the backend response with `Access-Control-Allow-Origin: *`
4. Supports GET, POST, PUT, PATCH, DELETE

**Important:** The proxy adds no authentication. The `Authorization: Bearer <token>` header is added client-side by `api.ts` interceptor.

---

## 8. Authentication Flow

### Login Flow

```
/login → enter email + password
  → authService.login() → POST /auth/login
  → if response has pre_auth_token → redirect to /login/2fa
  → if normal response → setAuthData() → localStorage + AuthContext → redirect to /wallet
```

### 2FA Flow (`/login/2fa`)

- User enters 6-digit TOTP code using PIN pad (visual dots + numeric keypad)
- Calls `authService.verify2FA(preAuthToken, code)` → POST `/auth/2fa/verify`
- On success: `setAuthData()` → redirect to `/wallet`
- Token stored in `sessionStorage` key `pre_auth_token`

### Registration Flow

```
/signup → enter email
  → authService.registerRequestOtp() → POST /auth/register/request-otp

/signup/otp → enter 6-digit OTP
  → authService.registerVerifyOtp() → POST /auth/register/verify-otp
  → stores registration_token in sessionStorage

/signup/password → set password (+ optional referral code)
  → authService.registerSetPassword(token, password, referralCode)
  → POST /auth/register/set-password
  → auto-login: setAuthData() → redirect to /wallet

/signup/success → success confirmation
```

### Token Storage

```
localStorage:
  - accessToken     → JWT access token (used in every API call)
  - refreshToken    → Used to get new access token on 401
  - user            → JSON-stringified user object

sessionStorage:
  - pre_auth_token  → Temporary token during 2FA login
  - registration_token → Temporary token during signup
```

### Token Refresh (Automatic)

When any API call returns 401:
1. Pause the failed request
2. Queue any concurrent requests
3. Call `POST /auth/refresh` with the stored `refreshToken`
4. On success: update both tokens, replay queued requests
5. On failure (401/403 from refresh): clear all tokens, call `authEvents.onUnauthorized()` → triggers logout in AuthContext

### Logout

- Calls `POST /auth/logout`
- Clears `localStorage` (`accessToken`, `refreshToken`, `user`)
- Resets AuthContext state
- The API interceptor also clears storage when it detects a logout response URL

---

## 9. Context Providers

### AuthContext (`src/context/AuthContext.tsx`)

**Purpose:** Global user session management.

```typescript
interface AuthContextType {
  user: any | null;           // User profile object from backend
  loading: boolean;           // Login in-progress
  isInitializing: boolean;    // True during initial localStorage restore
  isAuthenticated: boolean;
  login(email, password): Promise<any>;
  logout(): Promise<void>;
  updateUser(userData): Promise<void>;  // Merges into existing user
  setAuthData(access_token, refresh_token, userData): void;
}
```

**Key behaviour:**
- On mount: restores user from `localStorage` before rendering children
- Sets `isInitializing = true` until the check completes
- Registers `authEvents.onUnauthorized` to handle forced logouts from interceptor

**`user` object fields** (from backend):
```typescript
{
  id, uid, email, username,
  first_name, last_name,
  phone_number, referral_code,
  is_verified, kyc_tier,
  two_factor_enabled,
  // ... more fields
}
```

### WalletContext (`src/context/WalletContext.tsx`)

**Purpose:** Fetches and caches user wallet balances.

```typescript
interface WalletContextData {
  wallets: Wallet[];
  loading: boolean;
  error: string | null;
  fetchWallets(): Promise<void>;
  getWalletByCurrency(currency: string): Wallet | undefined;
  internalTransfer(data): Promise<any>;
}
```

**Wallet shape:**
```typescript
interface Wallet {
  id: string | number;
  currency: string;          // e.g., "USDT", "NGN", "BTC"
  currency_id: string | number;
  balance: string | number;
  locked_balance: string | number;
  is_virtual?: boolean;      // true = wallet exists from supported currency list but user has no real entry
}
```

**Wallet merging logic:**
1. Fetch supported currencies (`GET /currencies`)
2. Fetch user wallets (`GET /users/me/wallets`)
3. For each supported currency: find matching user wallet, or create `is_virtual: true` entry with balance=0
4. Append any user wallets not in the supported currency list

This ensures every supported asset is always shown, even if balance is 0.

**Currency cache:** `_cachedCurrencies` is a module-level variable (persists across re-renders) to avoid re-fetching currencies on every wallet refresh.

### AdsContext (`src/context/AdsContext.tsx`)

**Purpose:** User's P2P ads, available currencies, and fee multiplier.

```typescript
interface AdsContextType {
  ads: Ad[];
  currencies: Currency[];
  loading: boolean;
  p2pFeeMultiplier: number;  // Default 1.004 (0.4% fee × 2 sides = 0.8% spread)
  refreshAds(): Promise<void>;
  addAd(data: CreateP2PAdRequest): Promise<void>;
  updateAd(id, updates): Promise<void>;
  deleteAd(id): Promise<void>;
  toggleAdStatus(id, currentStatus): Promise<void>;
}
```

**Ad status toggle:** Converts between local boolean `active` and API strings `"active"` / `"paused"`.

**Fee multiplier:** Fetched from `GET /p2p/fees`. Formula: `1 + feeRate * 2`. Used on the P2P marketplace to calculate effective maximum amounts (the spread is applied on both buy and sell sides).

---

## 10. Hooks

### `useVerificationGate` (`src/hooks/useVerificationGate.ts`)

**Purpose:** Check if the current user is KYC-verified (tier ≥ 1) before allowing certain actions.

```typescript
const {
  isVerified,           // boolean
  isLoading,            // boolean (initial fetch)
  showGate,             // boolean (show verification popup)
  setShowGate,          // setter
  requireVerification,  // (onPass?: () => void) => boolean
  handleVerifyNow,      // () => void (navigates to /verification-dashboard)
} = useVerificationGate();
```

**Module-level cache** (shared across all instances of the hook):
- `_cachedTier`: the numeric KYC tier (0, 1, 2, 3)
- `_cacheTimestamp`: when it was fetched
- `_staleTier`: last known value (used for optimistic rendering)
- TTL: 60 seconds

**`requireVerification(onPass?)`:** Returns `true` and calls `onPass` if verified. Returns `false` and shows the gate modal if not verified.

**`invalidateKYCCache()`:** Exported function to force a fresh KYC check (call this after successful KYC submission).

---

## 11. Services

All services import the `api` instance from `api.ts`. They return the full `response.data` object.

### `api.ts` — Axios Instance

- **Base URL:** `/api/v1` (relative, goes through Next.js proxy)
- **Timeout:** 30 seconds
- **Request interceptor:** Attaches `Authorization: Bearer <accessToken>` from localStorage
- **Response interceptor:** Handles 401 with token refresh queue (see §8)
- **`authEvents`:** Module-level event object. `authEvents.onUnauthorized` is set by AuthContext to trigger logout.

### `auth.service.ts`

| Method | Endpoint | Payload |
|---|---|---|
| `login(email, password)` | POST `/auth/login` | `{ email, password, device_type: "web" }` |
| `logout()` | POST `/auth/logout` | — |
| `registerRequestOtp(email)` | POST `/auth/register/request-otp` | `{ email }` |
| `registerVerifyOtp(email, otp)` | POST `/auth/register/verify-otp` | `{ email, otp }` |
| `registerSetPassword(token, password, referralCode?)` | POST `/auth/register/set-password` | `{ registration_token, password, referral_code? }` |
| `forgotPasswordRequestOtp(email)` | POST `/auth/forgot-password/request-otp` | `{ email }` |
| `forgotPasswordVerifyOtp(email, otp)` | POST `/auth/forgot-password/verify-otp` | `{ email, otp }` |
| `forgotPasswordReset(token, newPassword)` | POST `/auth/forgot-password/reset` | `{ reset_token, new_password }` |
| `refreshToken(refreshToken)` | POST `/auth/refresh` | `{ refresh_token }` |
| `verify2FA(preAuthToken, code)` | POST `/auth/2fa/verify` | `{ pre_auth_token, code }` |
| `loginWithGoogle(idToken)` | POST `/auth/google` | `{ id_token }` |
| `loginWithApple(idToken)` | POST `/auth/apple` | `{ id_token }` |

### `wallet.service.ts`

| Method | Endpoint | Notes |
|---|---|---|
| `getWallets()` | GET `/users/me/wallets` | Returns all user wallet balances |
| `getTransactions(currency?, page, pageSize, category?, startDate?, endDate?)` | GET `/users/me/wallet-transactions` | Paginated |
| `getTransaction(id)` | GET `/users/me/wallet-transactions/:id` | Single transaction detail |
| `getWalletAddress(chain, currency)` | GET `/users/me/wallet-address` | Deposit address for on-chain |
| `getCurrencyNetworks(currencyId)` | GET `/currencies/:id/networks` | Available blockchain networks |
| `getCurrencies()` | GET `/currencies` | All supported currencies |
| `getCurrencyPrice(currencyId)` | GET `/currencies/:id/price` | Current fiat price |
| `withdrawCrypto(chain, currency, address, amount, pin, auth_code, network)` | POST `/users/me/crypto-withdrawals` | Idempotency-Key header |
| `getDepositAccount()` | GET `/users/me/deposit-account` | Bank details for NGN deposit |
| `getFiatBanks()` | GET `/users/me/fiat-banks` | User's saved bank accounts |
| `lookupFiatBank(accountNumber, bankCode)` | POST `/users/me/fiat-bank-lookup` | Verifies bank account |
| `withdrawFiat(data)` | POST `/users/me/fiat-withdrawals` | Idempotency-Key header |
| `getCryptoWithdrawalFee(currency, chain)` | GET `/withdrawal-fees/crypto` | Fee for specific asset/chain |
| `getWithdrawalFees()` | GET `/withdrawal-fees` | All fees |
| `internalTransfer(data)` | POST `/users/me/internal-transfer` | Transfer to another Kynettic user |

### `p2p.service.ts`

| Method | Endpoint | Notes |
|---|---|---|
| `getOrders(filters)` | GET `/p2p/orders` | All user orders |
| `getAdById(id)` | GET `/p2p/ads/:id` | Single ad |
| `getMarketplaceAds(type, currencyId?, page)` | GET `/p2p/ads` | Public marketplace; type="buy" or "sell" |
| `getMyAds(status?, page)` | GET `/p2p/my-ads` | Authenticated user's ads |
| `getCurrencies()` | GET `/currencies` | All supported currencies |
| `createAd(data)` | POST `/p2p/ads` | Create new ad |
| `updateAd(id, data)` | PATCH `/p2p/ads/:id` | Update ad |
| `deleteAd(id)` | DELETE `/p2p/ads/:id` | Delete ad |
| `getFees()` | GET `/p2p/fees` | Platform fee rate |
| `executeTrade(adId, amountInput, inputCurrency, pin)` | POST `/p2p/orders` | Execute trade; Idempotency-Key |
| `getCommunityLinks()` | GET `/community-links` | Community social links |

**`executeTrade` payload:**
```json
{
  "ad_id": "...",
  "amount_input": "50000",
  "input_currency": "fiat",   // or "crypto"
  "pin": "123456"
}
```

### `kyc.service.ts`

| Method | Endpoint | Notes |
|---|---|---|
| `getKYCStatus()` | GET `/users/me/kyc/status` | Returns tier, status, verification flags |
| `submitTier1(data)` | POST `/users/me/kyc/tier1` | Basic info + BVN |
| `submitTier2(data)` | POST `/users/me/kyc/tier2` | NIN |
| `submitTier3(data: FormData)` | POST `/users/me/kyc/tier3` | Document upload (multipart) |

**KYC Status response:**
```typescript
{
  tier: string,              // e.g., "tier1", "tier2"
  next_tier: string,
  status: string,            // "pending", "approved", "rejected"
  bvn_verified: boolean,
  nin_verified: boolean,
  selfie_verified: boolean,
  address_verified: boolean,
  rejection_reason: string,
  tier1_identity_type: string
}
```

### `security.service.ts`

Handles PIN setup and 2FA setup (TOTP). Typical methods:
- `setupPin(pin, auth_code)` → POST `/users/me/pin`
- `setup2FA()` → GET `/users/me/2fa/setup` (returns TOTP secret + QR URL)
- `verify2FASetup(code)` → POST `/users/me/2fa/enable`
- `disable2FA(code)` → POST `/users/me/2fa/disable`
- `changePin(old_pin, new_pin, auth_code)` → POST `/users/me/pin/change`
- `requestAuthCode(type)` → POST `/users/me/auth-code` (sends OTP to email)

### `referral.service.ts`

- `getReferralStats()` → GET `/users/me/referrals`
- Returns: referral code, total referrals, earned commissions, referred users list

### `notification.service.ts`

- `getNotifications(page)` → GET `/users/me/notifications`
- `markAsRead(id)` → PATCH `/users/me/notifications/:id`

### `user.service.ts`

- `getProfile()` → GET `/users/me`
- `updateProfile(data)` → PATCH `/users/me`

### `review.service.ts`

- `getReviews()` → GET `/reviews`
- `submitReview(data)` → POST `/reviews`

---

## 12. App Layout & Navigation

### Root Layout (`src/app/layout.tsx`)

Wraps everything in:
- Google Fonts: Roboto, Outfit, DM Sans (via next/font)
- `<Providers>` (AuthContext + WalletContext + AdsContext)
- `<body suppressHydrationWarning>` (avoids SSR/CSR hydration mismatch with localStorage)

### App Layout (`src/app/(app)/layout.tsx`)

Authentication guard + shell for all authenticated pages.

**Guard logic:**
1. Reads `user` and `loading` from AuthContext
2. If not `loading` and no `user`: redirect to `/login`
3. Otherwise: show layout

**Layout structure:**
```
<div className="flex min-h-screen bg-[#F5F5F5]">
  <Sidebar />                    // Fixed left sidebar (230px wide)
  <main className="flex-1 ml-[230px]">
    <div className="flex gap-6">
      <div className="flex-1">{children}</div>
      <RightSidebar />           // 280px right sidebar (xl+ only)
    </div>
  </main>
</div>
```

**Mobile:** Left sidebar is hidden behind a hamburger button. The top bar shows logo + notification icon.

### Sidebar (`src/components/Sidebar.tsx`)

**Navigation items:**
| Label | Route | Icon |
|---|---|---|
| Wallet | /wallet | Wallet |
| P2P Trading | /p2p | RefreshCw |
| My Ads | /my-ads | ClipboardList |
| Orders | /orders | ShoppingBag |
| Refer & Earn | /referrals | Gift |

**Bottom section:** User profile button (avatar initials + name + email) that navigates to `/profile`. Uses `pb-8 pt-4 border-t border-gray-100 mt-2` for spacing.

**Mobile overlay:** `sidebarOpen` state in app layout controls a sliding drawer.

### RightSidebar (`src/components/RightSidebar.tsx`)

Shown only on `xl` screens (`hidden xl:block`).

**Sections:**
1. **Filter Panel:** Checkbox filters (verified advertisers, no-verification ads) + radio sort options (Overall/Completed/Price). These are currently UI-only (not connected to API filtering).
2. **Rotating promo card:** Cycles between "Buy Bulk Coins" and "P2P Trading" cards every 5 seconds. Has dot indicators.
3. **Community links:** Fetched from `GET /community-links`. Displays platform icon (from simpleicons CDN) + label as clickable links.

---

## 13. Landing Pages

### Landing Page (`src/app/page.tsx`)

The root landing page. All sections wrapped in `<div className="landing-scope">` which overrides `--color-primary` to orange `#FBAD45`.

**Sections (in order):**
1. `<Navbar />` — top navigation with logo, nav links, sign in/up buttons
2. `<Hero />` — headline + phone mockup
3. `<Partners />` — partner logos (Dojah, Nomba, Google)
4. `<HowItWorks />` — 3-step flow
5. `<WhatWeDo />` — feature cards
6. `<AboutSection />` — about + stats
7. `<LiquiditySection />` — liquidity info
8. `<WhyDifferent />` — differentiators
9. `<FAQSection />` — accordion FAQs
10. `<Footer />` — links + social icons

### Key Landing Components

**`Navbar.tsx`:** Sticky top nav, mobile hamburger menu, scroll-aware styling.

**`Hero.tsx`:** Main hero with animated phone mockup, call-to-action buttons linking to `/signup`.

**`FAQSection.tsx`:** Accordion-style FAQ. Each item toggles open/close.

**`BulkSupplyModal.tsx`:** Modal for bulk coin purchase inquiry form.

**`Footer.tsx`:** Logo, quick links, social media icons (Facebook, X/Twitter, Instagram, YouTube).

---

## 14. Authentication Pages

### `/login` (`src/app/login/page.tsx`)

- Email + password form
- Calls `useAuth().login()`
- On `requires2FA` error: stores `pre_auth_token` in sessionStorage → redirect to `/login/2fa`
- On success: redirect to `/wallet`
- Links to `/signup` and `/forgot-password`

### `/login/2fa` (`src/app/login/2fa/page.tsx`)

- PIN dots (6 dots showing filled/empty) + numeric keypad (3×4 grid + backspace + 0)
- Auto-submits on 6th digit
- Reads `pre_auth_token` from sessionStorage
- Calls `authService.verify2FA(preAuthToken, code)`
- On success: `setAuthData()` → redirect to `/wallet`

### `/signup` → `/signup/otp` → `/signup/password` → `/signup/success`

Multi-step registration:
1. `/signup`: Email input → calls `registerRequestOtp()`
2. `/signup/otp`: 6-digit OTP from email → calls `registerVerifyOtp()` → stores `registration_token` in sessionStorage
3. `/signup/password`: Password (+ confirm + optional referral code) → calls `registerSetPassword()` → auto-login → `/wallet`
4. `/signup/success`: Success screen with "Go to Wallet" button

### `/forgot-password`

3-step flow mirroring signup: email → OTP verify → new password.

---

## 15. App Pages (Authenticated)

All pages are under `src/app/(app)/` and protected by the app layout auth guard.

---

### Wallet (`/wallet`)

**File:** `src/app/(app)/wallet/page.tsx`

**Purpose:** Main financial hub. Shows total balance, individual wallets, recent transactions.

**Key features:**
- Balance card with waves background (`backgroundImage: "url('/waves.png')"` CSS inline — NOT Next.js `<Image>`)
- Toggle: hide zero balances
- Wallet list with per-asset balance, NGN equivalent, deposit/withdraw buttons
- Transaction list with filter (date range, category, asset)
- **Crypto deposit** → opens `DepositModal` component
- **Fiat deposit** → opens `FiatDepositModal` (centered modal showing bank details + UID copy)
- **Crypto withdraw** → navigates to `/withdraw-search`
- **Fiat withdraw** → opens `FiatWithdrawSheet` (bottom sheet with "Bank Withdrawal" and "Internal Transfer" options)

**Important note on waves background:** Using `<Image fill>` requires an explicit height on the parent. Instead, set `backgroundImage` as a CSS inline style on the div.

---

### P2P Trading (`/p2p`)

**File:** `src/app/(app)/p2p/page.tsx`

**Purpose:** Public P2P marketplace — browse and initiate trades.

**Key features:**
- Buy/Sell toggle (tab)
- Asset dropdown (ALL, USDT, USDC, BTC, ETH, …) — default: `"ALL"`
- Fiat dropdown (NGN)
- Amount filter (collapsible)
- Ad cards showing: advertiser name + orders count, price, limits, quantity
- **Buy/Sell button** navigates to `/buy-crypto?ad=...` or `/sell-crypto?ad=...` with the full ad object JSON-encoded in the URL

**API call direction:** When user selects "Buy" (user wants to buy), it fetches `type=sell` ads (advertisers selling). Vice versa.

**Colors:** Buy button `bg-[#5CB85C]`, Sell button `bg-[#D92D20]`

---

### Buy Crypto (`/buy-crypto`)

**File:** `src/app/(app)/buy-crypto/page.tsx`

- Receives ad via `?ad=...` URL param (JSON-encoded)
- User enters NGN amount (or crypto amount toggle)
- Shows price, limits, advertiser info
- PIN modal (`P2PEnterPinModal`) → calls `p2pService.executeTrade()`
- Disclaimer modal (`P2PDisclaimerModal`) before PIN entry
- Success modal (`P2POrderSuccessModal`) on completion

---

### Sell Crypto (`/sell-crypto`)

**File:** `src/app/(app)/sell-crypto/page.tsx`

Mirror of buy-crypto but for selling. Same modal flow.

---

### My Ads (`/my-ads`)

**File:** `src/app/(app)/my-ads/page.tsx`

- Lists user's ads with filter tabs (All/Active/Inactive)
- Per-ad: toggle active/inactive, Share, Edit (→ `/post-ad?ad=...`), Delete
- Global toggle: activate/deactivate all ads at once
- Delete confirmation via `ConfirmationModal`

---

### Post Ad (`/post-ad`)

**File:** `src/app/(app)/post-ad/page.tsx`

Multi-step form to create or edit a P2P ad:
1. Select type (Buy/Sell) and asset (currency)
2. Set price type (Fixed/Relative) and price
3. Set quantities and limits
4. Set payment terms and PIN confirmation
5. Submit via `AdsContext.addAd()` or `AdsContext.updateAd()`

When editing: receives `?ad=...` param with existing ad data.

---

### Orders (`/orders`)

**File:** `src/app/(app)/orders/page.tsx`

- Lists all completed/active orders
- Filter by status and asset
- Order detail view: trade info, timestamps, status
- Max width: `max-w-lg mx-auto`

---

### Withdraw Search (`/withdraw-search`)

**File:** `src/app/(app)/withdraw-search/page.tsx`

Asset picker for crypto withdrawals. Shows all user wallets, option to hide zero balances.

On selecting an asset, shows a bottom sheet with two options:
1. **On-Chain Withdrawal** → `/withdraw-crypto?symbol=...&currency_id=...`
2. **Internal Transfer** → `/fiat-internal-transfer?currency=...`

---

### Withdraw Crypto (`/withdraw-crypto`)

**File:** `src/app/(app)/withdraw-crypto/page.tsx`

- Input: recipient address, amount, network selection
- Shows estimated fee (from `walletService.getCryptoWithdrawalFee()`)
- PIN confirmation + email OTP auth code
- Calls `walletService.withdrawCrypto()`

---

### Withdraw Fiat (`/withdraw-fiat`)

**File:** `src/app/(app)/withdraw-fiat/page.tsx`

- Bank selection from saved banks or add new
- Account lookup to verify bank details
- Amount input
- PIN + OTP confirmation
- Calls `walletService.withdrawFiat()`

---

### Deposit Fiat (`/deposit-fiat`)

**File:** `src/app/(app)/deposit-fiat/page.tsx`

- Shows user's dedicated NGN deposit bank account details
- Includes account number, bank name, account name
- Copy buttons for easy sharing

---

### Fiat Internal Transfer (`/fiat-internal-transfer`)

**File:** `src/app/(app)/fiat-internal-transfer/page.tsx`

- Transfer to another Kynettic user by email or UID
- Amount input
- PIN + OTP confirmation
- Calls `walletService.internalTransfer()`

---

### Profile (`/profile`)

**File:** `src/app/(app)/profile/page.tsx`

**Sections:**
1. **Header card:** Blue (`bg-primary`) card with initials avatar, name, verification badges (Email/SMS/Identity), UID copy button
2. **Main menu:** Edit Profile, Verification, Pin and 2FA Settings, Manage Notifications, Referrals
3. **Help & Support:** Contact Us, FAQs, Privacy Policy, Reviews
4. **Communities:** Fetched from `GET /community-links`, shows platform icon + label as external links
5. **Log Out:** Calls `logout()` → redirects to `/login`
6. **Delete Account:** Opens confirmation bottom sheet → navigates to `/delete-account`

---

### Security Settings (`/security-settings`)

**File:** `src/app/(app)/security-settings/page.tsx`

- PIN management (set/change)
- 2FA management (enable/disable → links to `/two-factor-setup`)
- Change password

---

### Two Factor Setup (`/two-factor-setup`)

**File:** `src/app/(app)/two-factor-setup/page.tsx`

4-step flow:
1. **Intro:** Explains 2FA, "Get Started" button
2. **QR:** Fetches TOTP secret/QR URL from API, shows QR code + manual key
3. **Verify:** User enters 6-digit TOTP code to confirm setup
4. **Success:** `ShieldCheck` icon, "Your account is now more secure" → "Okay" → `/security-settings`

---

### PIN Setup (`/pin-setup`)

**File:** `src/app/(app)/pin-setup/page.tsx`

- Set/change 6-digit transaction PIN
- Double-entry confirmation
- Email OTP auth code required
- Uses PIN dot + numeric keypad UI pattern

---

### Referrals (`/referrals`)

**File:** `src/app/(app)/referrals/page.tsx`

- Shows referral code with copy + share buttons
- Referral stats: total referrals, total earnings
- List of referred users
- Calls `referral.service.getReferralStats()`

---

### KYC Verification

**Verification Dashboard** (`/verification-dashboard`): Overview of KYC tiers with current status indicators.

**Tier 1 — Basic Info** (`/tier1-basic`):
- First name, last name, username, phone, date of birth
- `kycService.submitTier1()`

**Tier 1 — Identity** (`/tier1-id`):
- BVN entry + display name on P2P toggle

**Tier 1 — Selfie** (`/tier1-selfie`):
- Selfie photo upload

**Tier 2 — Address** (`/tier2-address`):
- Physical address details
- `kycService.submitTier2()`

**Tier 2 — Proof** (`/tier2-proof`):
- Proof of address document upload

**Tier 3 — Advanced** (`/tier3-advanced`):
- Advanced verification with government ID
- FormData upload via `kycService.submitTier3()`

---

## 16. Modals & Overlays

All modal files are in `src/components/modals/`.

### `DepositModal.tsx`

**Shows:** Deposit options for both crypto and fiat.

**Modes:**
- `mode="crypto"`: Shows "Receive from wallet" (on-chain address) and "Receive from another Kynettic user" (UID share)
- `mode="fiat"`: Shows bank details for NGN deposit with inline UID copy

**Styling:** Centered modal, option rows use `bg-[#F7F9FC] border border-[#E2E8F0]` with hover `bg-[#EBF4FF] border-primary`. Close button: `bg-primary text-white`.

---

### `WithdrawCryptoModal.tsx`

**Shows:** Two withdrawal options:
1. "On-Chain Withdrawal" → navigates to `/withdraw-search`
2. "Internal Transfer" → navigates to `/fiat-internal-transfer`

Both icon containers: `bg-primary/10 text-primary`. Close button: `bg-primary text-white`.

---

### `P2PEnterPinModal.tsx`

**Purpose:** Enter 6-digit PIN before executing a P2P trade.

**Implementation:** 6 individual `<input>` boxes using `useRef` array. Auto-focuses next box on digit entry, backspace moves to previous.

```typescript
const PIN_LENGTH = 6;
const [digits, setDigits] = useState<string[]>(Array(PIN_LENGTH).fill(""));
const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
```

**Features:** Lock icon header, "Forgot Pin? Reset pin" link (navigates to `/pin-setup`), "Complete Trade" submit button.

---

### `P2PDisclaimerModal.tsx`

**Purpose:** User must acknowledge the automated order disclaimer before trading.

**Features:**
- `AlertTriangle` icon in `#FFF3E0` circle
- Full disclaimer text about automated settlements
- Checkbox `agreed` state — gates the Confirm button
- Cancel: plain border button. Confirm: `bg-primary` (only enabled when checked)

---

### `P2POrderSuccessModal.tsx`

**Purpose:** Confirms a completed P2P trade.

**Features:**
- Detects buy vs sell from order data (`isBuy`)
- `ArrowDownCircle` (green) for buy, `ArrowUpCircle` (red) for sell
- Copy order number button
- "Order Dispute?" link → `/support`
- "Done" → closes modal

---

### `ConfirmationModal.tsx`

**Purpose:** Generic yes/no confirmation dialog.

```typescript
interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  variant?: "default" | "danger";
}
```

**Styling:**
- Cancel: `border-2 border-primary text-primary`
- Confirm (default): `bg-primary text-white`
- Confirm (danger): `bg-red-500 text-white`

---

### `StatusModal.tsx`

**Purpose:** Generic success/error status display after an operation.

```typescript
interface Props {
  visible: boolean;
  onClose: () => void;
  status: "success" | "error";
  title: string;
  message?: string;
}
```

---

### `VerificationGateModal.tsx`

**Purpose:** Shown when user tries to perform an action requiring KYC.

**Features:**
- `ShieldAlert` icon
- Message explaining verification is required
- "Verify Now" button → `/verification-dashboard`
- "Later" dismiss button

**Usage:**
```tsx
const { showGate, setShowGate, handleVerifyNow } = useVerificationGate();
// ...
<VerificationGateModal
  visible={showGate}
  onClose={() => setShowGate(false)}
  onVerify={handleVerifyNow}
/>
```

---

## 17. Shared Components

### `CurrencyIcon.tsx`

**Purpose:** Resolves and displays crypto/fiat currency logos.

```typescript
<CurrencyIcon symbol="USDT" size={24} />
```

**Resolution logic:**
1. Check local assets in `/public/icons/` (e.g., `usdt.png`)
2. Fall back to CDN (CoinGecko or simpleicons)
3. If nothing found: shows colored circle with first letter

---

### `LoadingScreen.tsx`

Full-screen loading state shown while auth initializes or page data loads. Shows Kynettic logo + spinner.

---

## 18. Public Assets

All static files are in `/public/`. Key assets:

| File | Usage |
|---|---|
| `KYNETTIC.png` | Full logo (text + mark) |
| `iconletter.png` | Wordmark (text only) |
| `iconmark.png` | Logo mark (icon only) |
| `waves.png` | Decorative wave pattern (wallet balance card background) |
| `favicon.png` | Browser tab icon |
| `buyIcon.png` / `sellIcon.png` | Wallet action icons |
| `depositIcon.png` / `sendIcon.png` | Wallet action icons |
| `ngn-icon.png` / `usdc-logo.png` | Currency icons |
| `profilePic.svg` | Default avatar |
| `app-store.png` / `playStoreLogo.png` | App download badges |
| `fbLogo.png` / `xLogo.png` / `instagramLogo.png` / `youtubeLogo.png` | Social media icons |
| `bannerImg.png` | Landing hero image |
| `cuate.png` | Landing illustration |
| `different.png` / `imgDifferent.png` | "Why Different" section images |
| `footerPhone.png` | Footer phone mockup |
| `google-icon.png` / `appleIconBlack.png` | Social login buttons |
| `Qrcode.png` | Sample QR code |
| `icons/` | Directory of cryptocurrency icons |

---

## 19. Common Patterns

### URL param passing between pages

Large objects (like P2P ads) are passed via URL params using JSON encoding:
```typescript
// Navigate with data
router.push(`/buy-crypto?ad=${encodeURIComponent(JSON.stringify(adObject))}`);

// Receive data
const searchParams = useSearchParams();
const ad = JSON.parse(decodeURIComponent(searchParams.get("ad") || "{}"));
```

**Warning:** URL params have length limits. For large objects, consider sessionStorage.

### Idempotency Keys

Financial operations (withdraw, transfer, trade) include a unique `Idempotency-Key` header to prevent duplicate submissions:
```typescript
headers: { "Idempotency-Key": crypto.randomUUID() }
```

### Error handling

```typescript
import { extractErrorMessage } from "@/utils/errorHandler";
try {
  await someService.call();
} catch (err) {
  const message = extractErrorMessage(err); // Returns user-friendly string
  // show toast or set error state
}
```

### KYC gate pattern

```typescript
const { requireVerification, showGate, setShowGate, handleVerifyNow } = useVerificationGate();

const handleAction = () => {
  requireVerification(() => {
    // This runs only if user is verified
    doTheActualThing();
  });
};
```

### Numeric PIN pad

The standard PIN input pattern used in PIN setup, 2FA login, etc.:

```
[ • ][ • ][ • ][ • ][ • ][ • ]   ← visual dot display

[ 1 ][ 2 ][ 3 ]
[ 4 ][ 5 ][ 6 ]
[ 7 ][ 8 ][ 9 ]
[   ][ 0 ][ ← ]
```

Either:
- **Individual `<input>` boxes** (P2PEnterPinModal style): 6 refs, auto-focus advancement
- **Controlled string state** + visual dots + custom keypad buttons (PIN setup / 2FA style)

---

## 20. Debugging Guide

### "User gets logged out unexpectedly"

1. Check `localStorage.getItem("refreshToken")` in browser DevTools
2. Open Network tab → look for `/api/v1/auth/refresh` call
3. If refresh returns 401/403: tokens are expired/invalid → expected logout
4. If refresh never fires: the original 401 might be on an auth route (those skip refresh by design)

### "API calls return 404 or wrong data"

1. Check Network tab → request URL should be `/api/v1/...`
2. Proxy maps to `https://kynettic-backend.onrender.com/api/v1/...`
3. Verify the endpoint path matches what the service file sends

### "Wallet balances don't update after transaction"

1. `WalletContext.fetchWallets()` must be called after the transaction
2. Most service calls in `WalletContext.internalTransfer()` auto-call `fetchWallets()`
3. For external transactions (withdrawals), the page must manually call `fetchWallets()`

### "KYC status not updating after verification"

The KYC cache TTL is 60 seconds. Force a fresh check:
```typescript
import { invalidateKYCCache } from "@/hooks/useVerificationGate";
invalidateKYCCache(); // Clear the module-level cache
```

### "Waves background not showing on wallet card"

Do NOT use `<Image fill>` — it requires explicit parent height. Use CSS:
```tsx
<div style={{ backgroundImage: "url('/waves.png')" }} className="bg-cover bg-center">
```

### "Modal not showing / z-index issues"

All modals use `z-50`. The sidebar uses `z-40`. Ensure modals are rendered inside the page component, not inside deeply nested CSS transform containers (which create new stacking contexts).

### "simpleicons CDN icons not loading"

URL format: `https://cdn.simpleicons.org/{platform}/{hexColorWithoutHash}`

Example:
```
https://cdn.simpleicons.org/telegram/229ED9
https://cdn.simpleicons.org/whatsapp/25D366
https://cdn.simpleicons.org/x/000000
```

The platform name must be lowercase and match the simpleicons slug exactly.

### "P2P fee calculation seems wrong"

Fee multiplier formula: `1 + feeRate * 2`
- `feeRate` comes from `GET /p2p/fees` (e.g., `0.004` = 0.4%)
- The `* 2` accounts for fee being applied on both buy and sell sides
- `effectiveMax = parseFloat(ad.max_amount) / p2pFeeMultiplier`

### TypeScript errors on `user` object

`user` from AuthContext is typed as `any`. Cast to access fields:
```typescript
const u = user as Record<string, any> || {};
const name = u.first_name || u.username;
```

### "Next.js hydration mismatch errors"

These typically occur with localStorage access during SSR. Always wrap localStorage reads in:
```typescript
if (typeof window !== "undefined") {
  // safe to access localStorage
}
```
The `api.ts` interceptor already does this. The `<body suppressHydrationWarning>` in root layout suppresses minor mismatches.

---

## Quick Reference: All API Endpoints

| Category | Method | Path |
|---|---|---|
| **Auth** | POST | `/auth/login` |
| | POST | `/auth/logout` |
| | POST | `/auth/register/request-otp` |
| | POST | `/auth/register/verify-otp` |
| | POST | `/auth/register/set-password` |
| | POST | `/auth/forgot-password/request-otp` |
| | POST | `/auth/forgot-password/verify-otp` |
| | POST | `/auth/forgot-password/reset` |
| | POST | `/auth/refresh` |
| | POST | `/auth/2fa/verify` |
| | POST | `/auth/google` |
| | POST | `/auth/apple` |
| **User** | GET | `/users/me` |
| | PATCH | `/users/me` |
| | GET | `/users/me/kyc/status` |
| | POST | `/users/me/kyc/tier1` |
| | POST | `/users/me/kyc/tier2` |
| | POST | `/users/me/kyc/tier3` |
| | GET | `/users/me/pin` |
| | POST | `/users/me/pin` |
| | POST | `/users/me/pin/change` |
| | GET | `/users/me/2fa/setup` |
| | POST | `/users/me/2fa/enable` |
| | POST | `/users/me/2fa/disable` |
| | POST | `/users/me/auth-code` |
| | GET | `/users/me/referrals` |
| | GET | `/users/me/notifications` |
| | PATCH | `/users/me/notifications/:id` |
| **Wallet** | GET | `/users/me/wallets` |
| | GET | `/users/me/wallet-transactions` |
| | GET | `/users/me/wallet-transactions/:id` |
| | GET | `/users/me/wallet-address` |
| | GET | `/users/me/deposit-account` |
| | GET | `/users/me/fiat-banks` |
| | POST | `/users/me/fiat-bank-lookup` |
| | POST | `/users/me/crypto-withdrawals` |
| | POST | `/users/me/fiat-withdrawals` |
| | POST | `/users/me/internal-transfer` |
| **Currencies** | GET | `/currencies` |
| | GET | `/currencies/:id/networks` |
| | GET | `/currencies/:id/price` |
| **Fees** | GET | `/withdrawal-fees` |
| | GET | `/withdrawal-fees/crypto` |
| **P2P** | GET | `/p2p/ads` |
| | POST | `/p2p/ads` |
| | GET | `/p2p/ads/:id` |
| | PATCH | `/p2p/ads/:id` |
| | DELETE | `/p2p/ads/:id` |
| | GET | `/p2p/my-ads` |
| | GET | `/p2p/orders` |
| | POST | `/p2p/orders` |
| | GET | `/p2p/fees` |
| **Community** | GET | `/community-links` |

---

*End of documentation. For questions, review the relevant service file and the corresponding page component together to trace the full data flow.*
