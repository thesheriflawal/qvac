# Kynettic Web — Developer Documentation

> **Last updated:** April 2026
> **Written for:** Junior/intern developers who are new to this codebase. If you just finished a bootcamp or masterclass, this document will walk you through everything — how the app is structured, how data flows, where to find things, and how to avoid breaking stuff.

---

## Table of Contents

1. [What is Kynettic?](#1-what-is-kynettic)
2. [Tech Stack](#2-tech-stack)
3. [Folder Structure — Where Everything Lives](#3-folder-structure--where-everything-lives)
4. [Running the Project Locally](#4-running-the-project-locally)
5. [Design System & Brand Colors](#5-design-system--brand-colors)
6. [How the App is Architected](#6-how-the-app-is-architected)
7. [The API Proxy — Why You Never Call the Backend Directly](#7-the-api-proxy--why-you-never-call-the-backend-directly)
8. [Authentication — Login, Signup, 2FA, and Tokens](#8-authentication--login-signup-2fa-and-tokens)
9. [Context Providers — The App's Global Memory](#9-context-providers--the-apps-global-memory)
10. [Hooks](#10-hooks)
11. [Services — The API Communication Layer](#11-services--the-api-communication-layer)
12. [App Layout & Navigation](#12-app-layout--navigation)
13. [Pages — Landing & Public](#13-pages--landing--public)
14. [Pages — Authentication](#14-pages--authentication)
15. [Pages — Authenticated App](#15-pages--authenticated-app)
16. [Modals & Overlays](#16-modals--overlays)
17. [Shared Components](#17-shared-components)
18. [Fee Calculations Explained](#18-fee-calculations-explained)
19. [Common Patterns You'll See Everywhere](#19-common-patterns-youll-see-everywhere)
20. [Debugging Guide — When Things Go Wrong](#20-debugging-guide--when-things-go-wrong)

---

## 1. What is Kynettic?

Kynettic is a **peer-to-peer (P2P) cryptocurrency trading platform** built primarily for the Nigerian market. Think of it like a crypto exchange where regular people can post ads to buy or sell crypto, and other users execute trades against those ads — all automatically, no chat required, no manual settlement.

Here's what users can do on the platform:

- **Trade crypto P2P** — Buy and sell USDT, USDC, BTC, ETH, and others against Nigerian Naira (NGN) using automated settlement
- **Manage wallets** — Both crypto wallets (on-chain) and fiat wallets (NGN)
- **Deposit and withdraw** — Deposit crypto via blockchain address, withdraw to bank accounts or other wallets
- **Post trading ads** — Set your own price and limits, other users trade against you
- **KYC verification** — 3-tier identity verification system that unlocks higher limits
- **Security features** — Two-factor authentication (2FA) using Google Authenticator, 6-digit transaction PIN
- **Internal transfers** — Send money to another Kynettic user for free, instantly
- **Earn referral rewards** — Share your referral code, earn KP points when friends join and trade

**The key differentiator:** Everything is automated. Unlike typical P2P platforms where buyers and sellers chat and manually confirm transfers, Kynettic's trades execute programmatically through escrow. No human has to do anything after hitting the trade button.

The web app was originally a React Native mobile app that was converted to a Next.js web application. That's why you'll sometimes see patterns that feel "mobile-first" — things like bottom sheets, PIN keyboards, and scroll-heavy layouts. That's intentional.

---

## 2. Tech Stack

Here's every major tool used in this project and why it's there:

| Technology | Version | What it does |
|---|---|---|
| **Next.js** | 16.x | The React framework. Handles routing (App Router), server-side rendering, and the API proxy layer |
| **React** | 19.x | UI library — the component model everything is built on |
| **TypeScript** | 5.x | Typed JavaScript. Helps you catch bugs before they happen. If you're new to TypeScript, think of it as JavaScript with type annotations |
| **Tailwind CSS** | 4.x | Utility-first CSS. Instead of writing CSS files, you apply class names directly in JSX like `className="text-sm font-bold text-blue-500"` |
| **Axios** | 1.x | HTTP client for making API requests. More powerful than `fetch` — has interceptors for auth tokens |
| **Framer Motion** | 12.x | Animation library. Used on the landing page for smooth enter/exit animations |
| **Lucide React** | 0.575.x | Icon library. Every icon in the app comes from here |
| **qrcode.react** | 4.x | Generates QR codes for crypto deposit addresses and 2FA setup |
| **html-to-image + jsPDF** | latest | Used to download transaction receipts as PNG or PDF |

**Package Manager:** npm
**Node version:** 18+
**Build output:** Static + SSR via `next build`

---

## 3. Folder Structure — Where Everything Lives

```
kynettic-web/
├── public/                         # Images, logos, SVGs served as static files
│   ├── KYNETTIC.png                # Main logo (used in receipts, navbar)
│   ├── preview.jpg                 # Open Graph image (shows when sharing on social)
│   └── assets/                     # Extra static assets
│
├── src/
│   ├── app/                        # Next.js App Router — every folder here = a URL route
│   │   ├── layout.tsx              # Root HTML shell — fonts, metadata, wraps ALL pages
│   │   ├── providers.tsx           # Wraps the app in Auth + Wallet + Ads context
│   │   ├── globals.css             # Global CSS — Tailwind setup + brand color tokens
│   │   ├── page.tsx                # Landing page → /
│   │   │
│   │   ├── login/                  # → /login
│   │   │   ├── page.tsx            # Email + password form
│   │   │   └── 2fa/page.tsx        # Google Authenticator code entry
│   │   │
│   │   ├── signup/                 # → /signup
│   │   │   ├── page.tsx            # Step 1: Email
│   │   │   ├── otp/page.tsx        # Step 2: OTP verification
│   │   │   ├── password/page.tsx   # Step 3: Set password
│   │   │   └── success/page.tsx    # Step 4: Welcome screen
│   │   │
│   │   ├── forgot-password/        # → /forgot-password
│   │   │   ├── page.tsx            # Email entry
│   │   │   ├── otp/page.tsx        # OTP verification
│   │   │   ├── reset/page.tsx      # New password entry
│   │   │   └── success/page.tsx    # Confirmation
│   │   │
│   │   ├── fees/page.tsx           # → /fees (public fee schedule page)
│   │   ├── p2p-fees/page.tsx       # → /p2p-fees (P2P fees explained)
│   │   ├── privacy-policy/         # → /privacy-policy
│   │   ├── terms-of-service/       # → /terms-of-service
│   │   ├── delete-account/         # → /delete-account
│   │   ├── about/page.tsx          # → /about
│   │   │
│   │   ├── (app)/                  # Route group — ALL authenticated pages live here
│   │   │   ├── layout.tsx          # Auth guard + main shell (sidebar + header)
│   │   │   │
│   │   │   ├── wallet/             # → /wallet (main dashboard)
│   │   │   ├── asset-detail/       # → /asset-detail?symbol=USDT (single asset view)
│   │   │   ├── history/            # → /history (full transaction history)
│   │   │   ├── transaction-details/ # → /transaction-details?id=xxx
│   │   │   ├── balance/            # → /balance
│   │   │   ├── account-summary/    # → /account-summary
│   │   │   │
│   │   │   ├── deposit/            # → /deposit (crypto deposit address)
│   │   │   ├── deposit-search/     # → /deposit-search (pick a coin to deposit)
│   │   │   ├── deposit-success/    # → /deposit-success
│   │   │   │
│   │   │   ├── withdraw-search/    # → /withdraw-search (pick a coin to withdraw)
│   │   │   ├── withdraw-crypto/    # → /withdraw-crypto?symbol=USDT
│   │   │   ├── withdraw-fiat/      # → /withdraw-fiat (NGN bank transfer)
│   │   │   ├── withdraw-fiat-confirm/ # → /withdraw-fiat-confirm
│   │   │   ├── withdraw-success/   # → /withdraw-success
│   │   │   ├── fiat-withdraw-success/ # → /fiat-withdraw-success
│   │   │   │
│   │   │   ├── fiat-internal-transfer/  # → /fiat-internal-transfer
│   │   │   ├── crypto-internal-transfer/ # → /crypto-internal-transfer
│   │   │   ├── bank-transfer/      # → /bank-transfer
│   │   │   ├── fiat-security/      # → /fiat-security
│   │   │   │
│   │   │   ├── p2p/                # → /p2p (marketplace)
│   │   │   │   ├── page.tsx
│   │   │   │   └── ad/[adId]/page.tsx  # → /p2p/ad/123 (public ad landing)
│   │   │   ├── buy-crypto/         # → /buy-crypto (execute a buy trade)
│   │   │   ├── sell-crypto/        # → /sell-crypto (execute a sell trade)
│   │   │   ├── post-ad/            # → /post-ad (create/edit an ad)
│   │   │   ├── my-ads/             # → /my-ads (manage your ads)
│   │   │   ├── orders/             # → /orders (P2P trade history)
│   │   │   ├── order-details/      # → /order-details
│   │   │   ├── bulk-coins-purchase/ # → /bulk-coins-purchase
│   │   │   ├── ad-share/           # → /ad-share
│   │   │   │
│   │   │   ├── profile/            # → /profile
│   │   │   ├── personal-details/   # → /personal-details
│   │   │   ├── edit-contact-details/ # → /edit-contact-details
│   │   │   ├── edit-username/      # → /edit-username
│   │   │   ├── currency-selector/  # → /currency-selector
│   │   │   │
│   │   │   ├── security-settings/  # → /security-settings
│   │   │   ├── two-factor-setup/   # → /two-factor-setup
│   │   │   ├── pin-setup/          # → /pin-setup
│   │   │   ├── change-pin/         # → /change-pin
│   │   │   ├── change-pin-verify/  # → /change-pin-verify
│   │   │   ├── change-pin-new/     # → /change-pin-new
│   │   │   ├── change-pin-success/ # → /change-pin-success
│   │   │   ├── change-password/    # → /change-password
│   │   │   ├── email-confirmation/ # → /email-confirmation
│   │   │   │
│   │   │   ├── verification-dashboard/ # → /verification-dashboard (KYC overview)
│   │   │   ├── tier1-basic/        # → /tier1-basic (KYC personal info)
│   │   │   ├── tier1-bvn/          # → /tier1-bvn (BVN entry)
│   │   │   ├── tier1-id/           # → /tier1-id (ID type selection)
│   │   │   ├── tier1-selfie/       # → /tier1-selfie (selfie upload)
│   │   │   ├── tier2-address/      # → /tier2-address
│   │   │   ├── tier2-proof/        # → /tier2-proof
│   │   │   ├── tier3-advanced/     # → /tier3-advanced
│   │   │   │
│   │   │   ├── notifications/      # → /notifications
│   │   │   ├── notification-details/ # → /notification-details?id=xxx
│   │   │   ├── manage-notifications/ # → /manage-notifications
│   │   │   ├── manage-blacklist/   # → /manage-blacklist
│   │   │   │
│   │   │   ├── referrals/          # → /referrals
│   │   │   ├── review/             # → /review
│   │   │   ├── support/            # → /support
│   │   │   └── terms/             # → /terms
│   │   │
│   │   └── api/
│   │       └── v1/[...path]/route.ts  # The API proxy — ALL backend calls go through here
│   │
│   ├── components/                 # Reusable components used across pages
│   │   ├── Sidebar.tsx             # Left navigation sidebar
│   │   ├── RightSidebar.tsx        # Right sidebar (desktop only: filters + promos)
│   │   ├── LoadingScreen.tsx       # Full-screen loading spinner
│   │   ├── CurrencyIcon.tsx        # Shows a crypto/fiat icon by symbol
│   │   ├── VerificationGateModal.tsx # KYC gate popup
│   │   ├── TransactionItem.tsx     # Single transaction row in a list
│   │   ├── FilterModal.tsx         # Filter panel for history
│   │   ├── ReceiptActions.tsx      # Download/Share buttons for receipts
│   │   ├── landing/                # Landing page section components
│   │   └── modals/                 # All modal dialogs
│   │
│   ├── context/                    # Global React state (shared across all pages)
│   │   ├── AuthContext.tsx         # User session: who is logged in
│   │   ├── WalletContext.tsx       # Wallet balances
│   │   └── AdsContext.tsx          # P2P marketplace ads + currencies + fees
│   │
│   ├── hooks/                      # Custom React hooks
│   │   ├── useVerificationGate.ts  # KYC check with caching
│   │   └── useReceiptDownload.ts   # Receipt download/share logic
│   │
│   ├── services/                   # All API calls live here
│   │   ├── api.ts                  # The Axios instance + auth interceptors
│   │   ├── auth.service.ts         # Login, register, 2FA, token refresh
│   │   ├── wallet.service.ts       # Wallets, transactions, withdrawals, deposits
│   │   ├── p2p.service.ts          # P2P ads, orders, fees, currencies
│   │   ├── kyc.service.ts          # KYC submission and status
│   │   ├── security.service.ts     # PIN, 2FA, password management
│   │   ├── referral.service.ts     # Referral stats and claims
│   │   ├── notification.service.ts # In-app notifications
│   │   ├── review.service.ts       # User reviews
│   │   └── user.service.ts         # Profile read/update
│   │
│   └── utils/
│       └── errorHandler.ts         # Converts API errors to human-readable messages
```

---

## 4. Running the Project Locally

### Step 1 — Clone and install

```bash
git clone <repo-url>
cd kynettic-web
npm install
```

### Step 2 — Start the development server

```bash
npm run dev
```

This starts the app at `http://localhost:3000`. You'll see the landing page at `/`.

### Step 3 — Other commands

```bash
npm run build   # Build for production
npm start       # Start the production build
npm run lint    # Run ESLint checks
```

### Environment Variables

The backend URL is configured via an environment variable in the API proxy:

```
BACKEND_URL=https://api.kynettic.com
```

Create a `.env.local` file in the project root if you need to point at a different backend (like a staging server). For most development work, the proxy is already configured and you don't need to touch anything.

> **Note for new devs:** You don't call the backend directly. All API calls go through the Next.js proxy at `/api/v1/...`. More on why in Section 7.

---

## 5. Design System & Brand Colors

### CSS Custom Properties

All brand colors are defined as CSS variables in `src/app/globals.css`:

```css
@theme {
  --color-primary: #4472B7;         /* Brand blue — buttons, links, borders, active states */
  --color-primary-dark: #2d5a9e;    /* Darker blue for hover effects */
  --color-secondary: #FBAD45;       /* Orange/amber — CTAs on the landing page */
  --color-dark: #000000;
  --color-light: rgba(68,114,183,0.13); /* Very light blue tint for backgrounds */
  --color-dark-navy: #1D3B53;       /* Primary heading and text color */
  --color-secondary-gray: #8E8E93;  /* Muted/placeholder text */
  --color-screen-bg: #F5F5F5;       /* App page background */
}
```

In Tailwind, you use these as `bg-primary`, `text-primary`, `border-primary`, etc.

### Color Usage Reference

| Color | Hex | When to use |
|---|---|---|
| Primary Blue | `#4472B7` | Buttons, active nav items, input borders, links |
| Dark Navy | `#1D3B53` | Page headings, card titles, primary body text |
| Orange | `#FBAD45` | Landing page CTAs only |
| Buy Green | `#5CB85C` | "Buy" buttons, success states, completed badges |
| Sell Red | `#D92D20` | "Sell" buttons, error states, failed badges |
| Receipt Green | `#34C759` | Success indicators in receipts |
| Secondary Gray | `#8E8E93` | Labels, placeholders, secondary info |
| Screen BG | `#F5F5F5` | Every authenticated app page background |
| White | `#FFFFFF` | Cards, modals, sidebars |
| Light Blue BG | `#EBF4FF` | Input fields, selected states |
| Info Blue BG | `#F0F7FF` | Fee cards, info sections |

### Typography

Three fonts are loaded in `src/app/layout.tsx`:

- **Roboto** (400/500/600/700) — Default body font for the authenticated app
- **Outfit** (all weights) — Headings in the app
- **DM Sans** — Used on the landing/marketing pages

### Landing Page Special Case

The landing page uses a CSS class `.landing-scope` that reverses the primary/secondary colors — making orange the primary and blue the secondary. This is why the landing page looks different from the app's blue-heavy palette.

### UI Conventions

**Standard button styles:**
```jsx
{/* Primary action */}
<button className="bg-primary text-white font-bold py-4 rounded-xl">
  Submit
</button>

{/* Secondary / cancel */}
<button className="bg-[#F0F4F8] text-[#1D3B53] font-bold py-4 rounded-xl">
  Cancel
</button>

{/* Danger */}
<button className="bg-red-500 text-white font-bold py-4 rounded-xl">
  Delete
</button>

{/* Outline */}
<button className="border-2 border-primary text-primary font-bold py-4 rounded-xl">
  Secondary
</button>
```

**Standard modal patterns:**
```jsx
{/* Centered modal (for confirmations, receipts) */}
<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
  <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl">
    {/* content */}
  </div>
</div>

{/* Bottom sheet (for lists, network pickers) */}
<div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
  <div className="bg-white rounded-t-3xl w-full max-w-lg p-5 pb-8">
    <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" /> {/* drag handle */}
    {/* content */}
  </div>
</div>
```

---

## 6. How the App is Architected

Think of the app in layers. Each layer has a job, and they talk to each other in one direction:

```
┌─────────────────────────────────────────────────────────┐
│  Browser (user interacts with the UI)                   │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Page Component (e.g. /wallet/page.tsx)                 │
│  → Reads global state from Context                      │
│  → Calls Service functions for API operations           │
│  → Manages local UI state with useState                 │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Context (AuthContext, WalletContext, AdsContext)        │
│  → Holds global state shared between pages              │
│  → Calls services internally                            │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Service Layer (wallet.service.ts, p2p.service.ts, etc) │
│  → Wraps API calls in named functions                   │
│  → Returns response.data to callers                     │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  api.ts (Axios instance)                                │
│  → Adds Bearer token to every request                   │
│  → Handles 401 → auto-refreshes token                   │
│  → Points at /api/v1/... (internal proxy)               │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Next.js API Route: /api/v1/[...path]/route.ts          │
│  → Proxies the request to the real backend              │
│  → Strips browser headers, adds CORS headers            │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Backend: https://api.kynettic.com/api/v1/...           │
└─────────────────────────────────────────────────────────┘
```

### Route Groups — What is `(app)`?

Next.js App Router lets you create "route groups" by wrapping a folder name in parentheses. The `(app)` folder is a route group — it doesn't affect the URL, but it lets all the pages inside share a common layout.

- Pages inside `(app)/` → protected by auth, wrapped in the sidebar layout
- Pages outside `(app)/` (like `/login`, `/signup`) → public, no sidebar

### State Management Philosophy

There's no Redux, no Zustand, no complex state library. The app uses:

- **React Context** for the three pieces of global state (auth, wallets, ads)
- **`useState`** inside each page for everything else
- **URL query params** for passing data between pages (e.g., `?symbol=USDT&currency_id=5`)

If a piece of state is needed by multiple unrelated pages → it goes in Context. If it's only needed by one page → it stays in that page's `useState`.

---

## 7. The API Proxy — Why You Never Call the Backend Directly

**File:** `src/app/api/v1/[...path]/route.ts`

When you make an API call from the browser like:
```
GET /api/v1/users/me/wallets
```

Next.js intercepts it and the route handler forwards it to the actual backend:
```
GET https://api.kynettic.com/api/v1/users/me/wallets
```

**Why go through this proxy instead of calling the backend directly?**

1. **CORS** — Browsers block requests to different domains unless the server explicitly allows it. By proxying through the same domain (`kynettic.com`), we avoid all CORS issues.
2. **Security** — The real backend URL never appears in the browser. Users can't see or directly call the backend.
3. **Flexibility** — You can swap the backend URL by changing one environment variable (`BACKEND_URL`) without touching any frontend code.

**What the proxy does:**
- Supports GET, POST, PUT, PATCH, DELETE
- Strips browser-only headers (`host`, `origin`, `referer`, `connection`, `content-length`)
- Passes everything else through (including `Authorization: Bearer ...`)
- Returns the backend response with `Access-Control-Allow-Origin: *`
- Disables Next.js caching (`no-store`) so responses are always fresh

**What the proxy does NOT do:**
- It does NOT add authentication. The `Authorization` header comes from the client-side Axios interceptor in `api.ts`.

---

## 8. Authentication — Login, Signup, 2FA, and Tokens

### Where Tokens Live

```
localStorage:
  accessToken       → JWT used in every API request header
  refreshToken      → Used to get a new accessToken when it expires
  user              → JSON-stringified user object (name, email, KYC tier, etc.)

sessionStorage:
  pre_auth_token    → Temporary token during 2FA login flow
  registration_token → Temporary token during email signup flow
```

### Login Flow (Standard)

```
User enters email + password at /login
  → authService.login(email, password) → POST /auth/login
  → If success: response has { access_token, refresh_token, user }
    → setAuthData() stores tokens and user in localStorage
    → Redirect to /wallet ✓
  → If 2FA is enabled: response has { pre_auth_token } instead
    → Store pre_auth_token in sessionStorage
    → Redirect to /login/2fa?email=user@email.com
```

### Login Flow (2FA Enabled)

```
User is on /login/2fa
  → Reads pre_auth_token from sessionStorage
  → User opens Google Authenticator, gets 6-digit code
  → Enters code via PIN keypad
  → authService.verify2FA(preAuthToken, code) → POST /auth/2fa/verify
  → If success: response has { access_token, refresh_token, user }
    → setAuthData() → Redirect to /wallet ✓
```

### Registration Flow

The signup is a 4-step flow, each step on its own page:

```
Step 1 — /signup
  User enters email
  → authService.registerRequestOtp(email) → POST /auth/register/request-otp
  → Redirect to /signup/otp?email=...

Step 2 — /signup/otp
  User enters 6-digit OTP from email
  → authService.registerVerifyOtp(email, otp) → POST /auth/register/verify-otp
  → Returns registration_token
  → Stored in sessionStorage
  → Redirect to /signup/password

Step 3 — /signup/password
  User sets password (+ optional referral code)
  → authService.registerSetPassword(token, password, referralCode) → POST /auth/register/set-password
  → Auto-login: setAuthData() stores tokens
  → Redirect to /wallet

Step 4 — /signup/success (optional landing)
```

### Password Reset Flow

```
/forgot-password → /forgot-password/otp → /forgot-password/reset → /forgot-password/success
```

Same pattern as signup — OTP first, then action.

### Automatic Token Refresh (The Smart Part)

When your access token expires, the API returns `401 Unauthorized`. Instead of logging you out, the app automatically gets a new token:

```
Request fails with 401
  → api.ts interceptor catches it
  → Pauses the failed request
  → Queues any other requests that come in during this time
  → Calls POST /auth/refresh with refreshToken
  → If refresh succeeds:
    → Updates accessToken and refreshToken in localStorage
    → Replays all queued requests with the new token ✓
  → If refresh also fails (401/403):
    → Clears all tokens from localStorage
    → Calls authEvents.onUnauthorized()
    → AuthContext catches this → calls logout() → user is redirected to /login
```

This is why users rarely get logged out unexpectedly — the refresh happens silently in the background.

### The `user` Object

After login, the user's profile is stored in localStorage and available via `useAuth().user`. Key fields:

```typescript
{
  id: string,
  uid: string,              // Kynettic unique ID (e.g., KYN-123456)
  email: string,
  username: string,
  first_name: string,
  last_name: string,
  full_name: string,
  phone_number: string,
  referral_code: string,
  is_verified: boolean,
  kyc_tier: number,         // 0 = unverified, 1/2/3 = KYC tiers
  two_factor_enabled: boolean,
  // ... more backend fields
}
```

---

## 9. Context Providers — The App's Global Memory

All three contexts are set up in `src/app/providers.tsx` and wrap the entire app. They load at startup and provide data to any component that asks for it.

### AuthContext (`src/context/AuthContext.tsx`)

**Job:** Knows who is logged in and manages session state.

```typescript
// How to use it in any component:
import { useAuth } from "@/context/AuthContext";

const { user, isAuthenticated, login, logout, updateUser, setAuthData } = useAuth();
```

**What it provides:**

| Value | Type | What it is |
|---|---|---|
| `user` | `any \| null` | The full user object. `null` if not logged in |
| `isAuthenticated` | `boolean` | `true` if there's a valid session |
| `loading` | `boolean` | `true` while login/logout is processing |
| `isInitializing` | `boolean` | `true` during the initial localStorage restore on page load |
| `login(email, password)` | function | Calls the login API. Throws `{ requires2FA, email, pre_auth_token }` if 2FA is needed |
| `logout()` | function | Clears tokens and resets state |
| `updateUser(data)` | function | Merges new data into the existing user object (useful after profile edits) |
| `setAuthData(token, refresh, user)` | function | Called after 2FA or signup to store all auth data at once |

**On page load:** Before any page renders, AuthContext checks localStorage for existing tokens and restores the session. While this is happening, `isInitializing = true`. The app layout shows a loading spinner during this time so you never see a flash of the login page.

---

### WalletContext (`src/context/WalletContext.tsx`)

**Job:** Fetches and caches the user's wallet balances. Every wallet-related page reads from here.

```typescript
import { useWallet } from "@/context/WalletContext";

const { wallets, loading, fetchWallets, getWalletByCurrency, internalTransfer } = useWallet();
```

**What it provides:**

| Value | Type | What it is |
|---|---|---|
| `wallets` | `Wallet[]` | Array of all the user's wallets |
| `loading` | `boolean` | `true` while fetching |
| `error` | `string \| null` | Error message if fetch failed |
| `fetchWallets()` | function | Re-fetches wallet data from API |
| `getWalletByCurrency(symbol)` | function | Returns the wallet for a given currency code (case-insensitive) |
| `internalTransfer(data)` | function | Sends internal transfer, then auto-refreshes wallets |

**Wallet object shape:**
```typescript
interface Wallet {
  id: string | number;
  currency: string;            // e.g., "USDT", "NGN", "BTC"
  currency_id: string | number;
  balance: string | number;        // Current total balance
  locked_balance: string | number; // Funds locked in active orders
  is_virtual?: boolean;            // true if no real wallet entry exists yet
}
```

**Available balance** (what users can spend) is always:
```
available = balance - locked_balance
```

**The "virtual wallet" trick:** When wallets are fetched, the context cross-references the user's actual wallets with the full list of supported currencies. If a supported currency (like BNB) isn't in the user's wallet list, it creates a fake "virtual" wallet with `balance: 0` and `is_virtual: true`. This ensures every supported asset always appears in the UI — even if the user has never received it.

---

### AdsContext (`src/context/AdsContext.tsx`)

**Job:** Manages the user's own P2P ads, the list of tradeable currencies, and the platform fee multiplier.

```typescript
import { useAds } from "@/context/AdsContext";

const {
  ads, currencies, loading, p2pFeeMultiplier,
  refreshAds, addAd, updateAd, deleteAd, toggleAdStatus
} = useAds();
```

**What it provides:**

| Value | Type | What it is |
|---|---|---|
| `ads` | `Ad[]` | The logged-in user's posted P2P ads |
| `currencies` | `Currency[]` | All tradeable currencies with type (crypto/fiat) |
| `loading` | `boolean` | `true` while fetching |
| `p2pFeeMultiplier` | `number` | Default `1.003` — used to calculate effective trade limits |
| `refreshAds()` | function | Re-fetch ads |
| `addAd(data)` | function | Create new ad + refresh |
| `updateAd(id, data)` | function | Update existing ad + refresh |
| `deleteAd(id)` | function | Delete ad + refresh |
| `toggleAdStatus(id, currentStatus)` | function | Toggle between `"active"` and `"paused"` |

**The `p2pFeeMultiplier` explained:**
- Fetched from `GET /p2p/fees` which returns a decimal rate (e.g., `0.0015` for 0.15%)
- The multiplier is calculated as: `1 + feeRate × 2` = `1 + 0.0015 × 2` = `1.003`
- The "× 2" accounts for the fact that the fee is charged on both sides of the trade (maker + taker)
- Default before API loads: `1.003`
- Used everywhere to calculate effective trade limits (see Section 18)

---

## 10. Hooks

### `useVerificationGate` (`src/hooks/useVerificationGate.ts`)

**Job:** Before allowing a user to deposit, withdraw, or trade, check if they've completed KYC (tier ≥ 1). If not, show them a popup directing them to verify.

```typescript
const {
  isVerified,          // boolean — is the user KYC tier 1 or higher?
  isLoading,           // boolean — still checking
  showGate,            // boolean — whether to show the verification prompt
  setShowGate,         // setter for showGate
  requireVerification, // function(onPass?) → boolean
  handleVerifyNow,     // function → navigates to /verification-dashboard
} = useVerificationGate();
```

**How to use it on a page:**
```typescript
const { requireVerification, showGate, setShowGate, handleVerifyNow } = useVerificationGate();

// When user clicks "Deposit":
const handleDeposit = () => {
  if (!requireVerification()) return; // stops here and shows the gate
  // ... proceed with deposit
};
```

**Caching:** The hook caches the KYC status for 60 seconds at the module level (`_cachedTier`, `_cacheTimestamp`). This prevents an API call on every button click. After a successful KYC submission, call `invalidateKYCCache()` (exported from the same file) to force a fresh check.

---

### `useReceiptDownload` (`src/hooks/useReceiptDownload.ts`)

**Job:** Converts a React ref'd DOM element (the receipt card) into a downloadable PNG or PDF, or shares it via the Web Share API.

```typescript
const receiptRef = useRef<HTMLDivElement>(null);
const { downloadImage, downloadPDF, share, working } = useReceiptDownload(receiptRef, "withdrawal-receipt");
```

**Parameters:**
- `ref` — A React ref pointing to the DOM element to capture
- `filename` — Base filename for downloads (without extension)

**What it provides:**
- `downloadImage()` — Downloads as a PNG (2× pixel ratio for sharpness)
- `downloadPDF()` — Converts the PNG to an A4 PDF via jsPDF and downloads it
- `share()` — Uses the native Web Share API on mobile, falls back to image download if not supported
- `working` — `true` while any operation is in progress (disables buttons)

**How receipts are captured:** The `receiptRef` wraps the visual receipt section in the modal. `html-to-image` renders that DOM element to a canvas, then converts it to a PNG blob. Everything inside the ref is captured exactly as it looks on screen.

---

## 11. Services — The API Communication Layer

All services live in `src/services/`. Every service imports the Axios instance from `api.ts` and wraps API calls in named async functions. They always return `response.data` (the API's JSON body) directly.

**Rule:** Never write `axios.get()` or `fetch()` directly in a page. All API calls go through a service function.

---

### `api.ts` — The Axios Instance

The foundation. Every service uses this.

- **Base URL:** `/api/v1` (goes through the Next.js proxy)
- **Timeout:** 30 seconds
- **Request interceptor:** Reads `localStorage.accessToken` and adds `Authorization: Bearer <token>` to every request
- **Response interceptor:** Catches 401 responses and runs the token refresh queue (see Section 8)
- **`authEvents`:** A module-level object. `authEvents.onUnauthorized` is set by AuthContext to a logout function. The interceptor calls it when the refresh token is also expired.

---

### `auth.service.ts`

Handles everything related to user identity.

| Function | Method | Endpoint | Notes |
|---|---|---|---|
| `login(email, password)` | POST | `/auth/login` | Sends `device_type: "web"`. Returns tokens or `pre_auth_token` for 2FA |
| `logout()` | POST | `/auth/logout` | Invalidates the token server-side |
| `registerRequestOtp(email)` | POST | `/auth/register/request-otp` | Sends OTP to email |
| `registerVerifyOtp(email, otp)` | POST | `/auth/register/verify-otp` | Returns `registration_token` |
| `registerSetPassword(token, password, referralCode?)` | POST | `/auth/register/set-password` | Completes registration. Returns full auth response |
| `forgotPasswordRequestOtp(email)` | POST | `/auth/forgot-password/request-otp` | Sends reset OTP |
| `forgotPasswordVerifyOtp(email, otp)` | POST | `/auth/forgot-password/verify-otp` | Returns reset token |
| `forgotPasswordReset(token, newPassword)` | POST | `/auth/forgot-password/reset` | Sets new password |
| `refreshToken(token)` | POST | `/auth/refresh` | Gets new access token from refresh token |
| `verify2FA(preAuthToken, code)` | POST | `/auth/2fa/verify` | Completes 2FA login |

---

### `wallet.service.ts`

The biggest service — handles wallets, transactions, withdrawals, and deposits.

**Wallet & Transaction endpoints:**

| Function | Method | Endpoint | Notes |
|---|---|---|---|
| `getWallets()` | GET | `/users/me/wallets` | All user wallets |
| `getTransactions(currency?, filters?)` | GET | `/users/me/wallet-transactions` | Supports `category`, `page`, `page_size`, `start_date`, `end_date` |
| `getTransaction(id)` | GET | `/users/me/wallet-transactions/{id}` | Single transaction detail |
| `getWalletAddress(chain, currency)` | GET | `/users/me/wallet-address` | Deposit address for a coin on a network |
| `getCurrencies()` | GET | `/currencies` | All supported currencies |
| `getCurrencyNetworks(currencyId)` | GET | `/currencies/{id}/networks` | Available blockchain networks for a coin |
| `getCurrencyPrice(currencyId)` | GET | `/currencies/{id}/price` | Current price in USD |

**Withdrawal endpoints:**

| Function | Method | Endpoint | Notes |
|---|---|---|---|
| `withdrawCrypto(chain, currency, address, amount, pin, authCode, networkType)` | POST | `/users/me/crypto-withdrawals` | On-chain crypto withdrawal. Requires Idempotency-Key |
| `withdrawFiat(data)` | POST | `/users/me/fiat-withdrawals` | NGN bank transfer |
| `getWithdrawalFees()` | GET | `/withdrawal-fees` | Fiat fee tiers + general info |
| `getCryptoWithdrawalFee(currency, chain)` | GET | `/withdrawal-fees/crypto` | Network fee for a specific coin+chain |

**Deposit & bank endpoints:**

| Function | Method | Endpoint | Notes |
|---|---|---|---|
| `getDepositAccount()` | GET | `/users/me/deposit-account` | Virtual NGN bank account for fiat deposits |
| `getFiatBanks()` | GET | `/users/me/fiat-banks` | User's saved Nigerian banks |
| `lookupFiatBank(accountNumber, bankCode)` | POST | `/users/me/fiat-bank-lookup` | Resolve account name from account number + bank code |

**Internal transfer:**

| Function | Method | Endpoint | Notes |
|---|---|---|---|
| `internalTransfer(data)` | POST | `/users/me/internal-transfer` | Free instant transfer to another Kynettic user. Requires Idempotency-Key |

---

### `p2p.service.ts`

Everything P2P marketplace.

| Function | Method | Endpoint | Notes |
|---|---|---|---|
| `getMarketplaceAds(type, currencyId?)` | GET | `/p2p/ads` | Public ads. `type` is "buy" or "sell" from the API's perspective |
| `getAdById(id)` | GET | `/p2p/ads/{id}` | Single ad details |
| `getMyAds(status?)` | GET | `/p2p/my-ads` | User's own posted ads |
| `createAd(data)` | POST | `/p2p/ads` | Create a new ad |
| `updateAd(id, data)` | PATCH | `/p2p/ads/{id}` | Edit an existing ad |
| `deleteAd(id)` | DELETE | `/p2p/ads/{id}` | Delete an ad |
| `getOrders(filters?)` | GET | `/p2p/orders` | User's trade history |
| `executeTrade(adId, amount, inputCurrency, pin)` | POST | `/p2p/orders` | Execute a trade against an ad. Requires Idempotency-Key |
| `getFees()` | GET | `/p2p/fees` | Returns the platform fee rate as a decimal |
| `getCurrencies()` | GET | `/currencies` | Available trading currencies |
| `getCommunityLinks()` | GET | `/community-links` | Social media/community URLs |

> **Buy vs Sell — the confusing part:** When a user wants to **buy** crypto, they look at ads from people who are **selling**. So in the API, fetching "buy" ads means `type=sell` and fetching "sell" ads means `type=buy`. The frontend flips it. Keep this in mind when reading p2p/page.tsx.

---

### `kyc.service.ts`

KYC verification submission and status checking.

| Function | Method | Endpoint | Response fields |
|---|---|---|---|
| `getKYCStatus()` | GET | `/users/me/kyc/status` | `tier`, `next_tier`, `status`, `bvn_verified`, `nin_verified`, `selfie_verified`, `address_verified`, `rejection_reason` |
| `submitTier1(data)` | POST | `/users/me/kyc/tier1` | Personal info + BVN |
| `submitTier2(data)` | POST | `/users/me/kyc/tier2` | NIN verification |
| `submitTier3(formData)` | POST | `/users/me/kyc/tier3` | FormData with selfie, ID photo, address proof |

**KYC Tier Limits:**

| Tier | Requirements | Daily Limit |
|---|---|---|
| 0 (Unverified) | None | View only |
| 1 | Personal details + BVN | ₦1,000 – ₦5,000 |
| 2 | Tier 1 + NIN | ₦5,000 – ₦50,000 |
| 3 | Tier 1+2 + Biometrics + Docs | Unlimited |

---

### `security.service.ts`

PIN, 2FA, and password management.

| Function | Method | Endpoint | Notes |
|---|---|---|---|
| `setup2FA()` | POST | `/users/me/2fa/setup` | Returns `{ otpauth_url, secret }` — use URL for QR code |
| `enable2FA(code)` | POST | `/users/me/2fa/enable` | Verifies the first code from the authenticator app |
| `disable2FA(code, pin)` | POST | `/users/me/2fa/disable` | Requires both authenticator code AND transaction PIN |
| `setupPin(pin)` | POST | `/users/me/pin/setup` | Create the 6-digit transaction PIN |
| `changePin(oldPin, newPin)` | POST | `/users/me/pin/change` | Change existing PIN |
| `changePassword(oldPassword, newPassword)` | POST | `/users/me/change-password` | |

---

### `referral.service.ts`

| Function | Endpoint | Returns |
|---|---|---|
| `getReferralProfile()` | GET `/users/me/referral` | Referral code, points balance |
| `getReferrals()` | GET `/users/me/referrals` | List of referred users + their status |
| `getPoints()` | GET `/users/me/referral/points` | KP points balance |
| `getClaims()` | GET `/users/me/referral/claims` | Claimed rewards history |
| `getLeaderboard()` | GET `/users/me/referral/leaderboard` | Top referrers |
| `claimPoints()` | POST `/users/me/referral/claim` | Claim available KP points |

---

### `notification.service.ts`

| Function | Endpoint | Notes |
|---|---|---|
| `getNotifications(page, status?)` | GET `/users/me/notifications` | `status` can be `"all"` or `"unread"` |
| `markAsRead(id)` | PATCH `/users/me/notifications/{id}/read` | Mark single notification as read |
| `markAllAsRead()` | PATCH `/users/me/notifications/read-all` | Bulk mark all as read |

---

### `user.service.ts`

| Function | Endpoint | Notes |
|---|---|---|
| `getProfile()` | GET `/users/me` | Full user profile |
| `updateProfile(data)` | PUT `/users/me` | Update any profile fields |

---

## 12. App Layout & Navigation

### Root Layout (`src/app/layout.tsx`)

The outermost wrapper. Sets up:
- Google Font imports (Roboto, Outfit, DM Sans)
- Page metadata (title, description, Open Graph image)
- The `<Providers>` component that wraps everything in context
- Metadata base URL: `https://kynettic.com`

### Providers (`src/app/providers.tsx`)

Wraps children in all three contexts in order:

```tsx
<AuthProvider>
  <WalletProvider>
    <AdsProvider>
      {children}
    </AdsProvider>
  </WalletProvider>
</AuthProvider>
```

Order matters — WalletContext uses AuthContext (needs `isAuthenticated`), and AdsContext can potentially do the same.

### App Shell Layout (`src/app/(app)/layout.tsx`)

Every authenticated page lives inside this layout. It:

1. **Auth guard:** Checks `isAuthenticated`. If not logged in, redirects to `/login`. While `isInitializing` is true, shows `<LoadingScreen />`.
2. **Sidebar:** Renders `<Sidebar>` on the left (fixed, 230px wide on desktop, overlay on mobile)
3. **Main content area:** Rendered between the sidebars, padded appropriately
4. **Right sidebar:** Renders `<RightSidebar>` on the right (280px, only on xl screens)
5. **Mobile header:** On mobile, shows the Kynettic logo + notification bell + hamburger menu
6. **Notification badge:** Fetches unread count on mount via `notificationService.getNotifications(1, "unread")` and shows a red badge (max "9+")

**Responsive layout:**
- Mobile (< 768px): Full width, top header bar, no sidebars
- Tablet (768px–1279px): Left sidebar visible, no right sidebar
- Desktop (≥ 1280px): Both sidebars visible

### Sidebar (`src/components/Sidebar.tsx`)

Navigation links rendered in the left sidebar:

| Label | Route | Icon |
|---|---|---|
| Wallet | `/wallet` | Wallet icon |
| History | `/history` | Clock icon |
| P2P | `/p2p` | Arrows icon |
| Orders | `/orders` | List icon |
| My Ads | `/my-ads` | Megaphone icon |

Also shows the user's initials and first name at the bottom, with a link to `/profile`.

Active route is highlighted with the primary blue color. On mobile, the sidebar is an overlay with a backdrop — tapping outside closes it.

### Right Sidebar (`src/components/RightSidebar.tsx`)

Desktop-only (hidden on smaller screens). Contains:
- **Rotating promo cards** — Two promotional banners (bulk coins, P2P) that auto-rotate every 5 seconds
- **Filter panel** — Checkbox/radio filters (currently UI-only, not wired to actual filtering)
- **Community links** — Social media links fetched from `GET /community-links`

---

## 15. Pages — Authenticated App

### Wallet — `/wallet`

**File:** `src/app/(app)/wallet/page.tsx`

The main dashboard. Shows the user's portfolio and wallet list.

**State:**
- `viewMode: "Crypto" | "Fiat"` — toggle between crypto and fiat views
- `hidden` — hides balance amounts (privacy mode)
- `search` — filters the wallet list
- `cryptoPrices` — cached USD prices for non-stablecoin assets

**Key logic:**

*Fiat currency detection* — a hardcoded list is used to tell crypto from fiat:
```typescript
const FIAT_CODES = ["NGN", "USD", "EUR", "GBP", "KES", "GHS", "ZAR"];
```

*Total balance calculation:*
- Crypto view: Sum of (each wallet's balance × its USD price). Stablecoins (USDT, USDC, BUSD, DAI) are priced at exactly $1.
- Fiat view: Just the NGN wallet balance.

*Available balance:*
```
availableBalance = wallet.balance - wallet.locked_balance
```
`locked_balance` is funds currently held in active P2P orders (escrow). The user can't spend this.

**Actions from wallet page:**
- Click wallet row → `/asset-detail?symbol=USDT&balance=171.5&currency_id=5`
- Deposit → Opens `<DepositModal>`
- Withdraw → Routes to `/withdraw-search`
- Add funds (fiat) → Routes to `/bank-transfer`

---

### Asset Detail — `/asset-detail`

**File:** `src/app/(app)/asset-detail/page.tsx`

Single-asset view. Shows balance + full transaction history for one currency.

**Query params:** `symbol`, `balance`, `currency_id`

**Features:**
- Balance card with hide/show toggle
- Action buttons: Deposit, Send (internal transfer), Buy (P2P), Sell (P2P)
- Transaction list grouped by date
- Click any transaction → `/transaction-details?id=xxx`

---

### Transaction Details — `/transaction-details`

**File:** `src/app/(app)/transaction-details/page.tsx`

Full detail view for a single transaction. Also renders a downloadable receipt.

**Query params:** `id` (transaction ID)

Shows different fields depending on the transaction method:
- **P2P trades:** Shows maker/taker fees, order number, counterparty
- **On-chain withdrawals:** Shows TX hash, blockchain explorer link, destination address
- **Bank transfers:** Shows bank name, account number, recipient name
- **Internal transfers:** Shows recipient email or UID

---

### P2P Marketplace — `/p2p`

**File:** `src/app/(app)/p2p/page.tsx`

The main trading marketplace. Shows a list of ads from other users.

**Key state:**
- `tradeType: "Buy" | "Sell"` — what the current user wants to do
- `selectedAsset` — e.g., "USDT"
- `selectedFiat` — always "NGN" for now

**The buy/sell flip:** This trips up new developers. The "tradeType" is from the user's perspective:
- User wants to **Buy** → fetch ads where API `type=sell` (people selling crypto)
- User wants to **Sell** → fetch ads where API `type=buy` (people buying crypto)

**Effective max calculation:**
```typescript
const effectiveMax = ad.max_amount / p2pFeeMultiplier;
```
The max amount shown to the user is lower than the ad's `max_amount` because the platform fee reduces the actual spendable amount. More on this in Section 18.

**Clicking an ad** navigates to:
- `/buy-crypto?ad={encodeURIComponent(JSON.stringify(ad))}` — for buy trades
- `/sell-crypto?ad={encodeURIComponent(JSON.stringify(ad))}` — for sell trades

---

### Buy Crypto — `/buy-crypto`

**File:** `src/app/(app)/buy-crypto/page.tsx`

Executes a buy trade against a specific ad.

**Query params:** `ad={stringified ad object}` or `adId={id}`

**Flow:**
1. User selects payment method (Fiat NGN or Crypto)
2. User enters amount
3. Platform calculates fee and total
4. User accepts disclaimer
5. User enters 6-digit PIN
6. Trade executes via `p2pService.executeTrade()`
7. Success modal shows receipt

**Key calculations (buy crypto with NGN):**
```typescript
const takerFeeRate = (p2pFeeMultiplier - 1) / 2;    // = 0.0015 (0.15%)
const fiatAmount = quantity × adRate;                 // NGN amount for the crypto
const platformFee = fiatAmount × takerFeeRate;        // 0.15% of fiat
const totalToPay = fiatAmount + platformFee;          // what leaves user's NGN wallet
```

**Validation errors:**
- `LIMIT` — amount is outside the ad's min/max limits
- `BALANCE` — user doesn't have enough NGN (or crypto) to cover the trade + fee

---

### Sell Crypto — `/sell-crypto`

**File:** `src/app/(app)/sell-crypto/page.tsx`

Mirror of buy-crypto. Executes a sell trade.

**Key calculations (sell crypto for NGN):**
```typescript
const takerFeeRate = (p2pFeeMultiplier - 1) / 2;    // = 0.0015 (0.15%)
const fiatReceived = cryptoAmount × adRate;           // NGN the user would get
const platformFee = fiatReceived × takerFeeRate;      // 0.15% of fiat
const totalToReceive = fiatReceived - platformFee;    // what lands in user's NGN wallet
```

---

### Post Ad — `/post-ad`

**File:** `src/app/(app)/post-ad/page.tsx`

Where users create or edit their P2P trading ads.

**Ad types:**
- **Buy ad** — "I want to buy USDT. Quantities in NGN."
- **Sell ad** — "I want to sell USDT. Quantities in USDT."

**Pricing types:**
- **Fixed** — You set an exact NGN/USDT rate
- **Relative** — Your price tracks the market rate ± a fixed amount (e.g., market + 50 NGN)

**Important fee note:** As the ad creator (maker), users are charged **0.15%** on each trade executed against their ad.

**Validation:** When max limit ÷ p2pFeeMultiplier < min limit, the limit range is too narrow and the ad can't be submitted. The taker max calculation is shown live.

**Edit mode:** If `?ad=...` is in the URL, the form pre-fills with existing ad data and calls `updateAd` instead of `createAd`.

---

### My Ads — `/my-ads`

**File:** `src/app/(app)/my-ads/page.tsx`

Manage all your posted ads.

**Features:**
- Filter by All / Active / Inactive
- Global toggle to pause/activate all ads at once
- Per-ad actions: Share (generate share link), Edit (go to `/post-ad?ad=...`), Delete (with confirmation)
- Shows remaining quantity dynamically

---

### Orders — `/orders`

**File:** `src/app/(app)/orders/page.tsx`

History of all P2P trades the user has been part of.

**Tabs:** Completed / Failed

**Order modal:** Click any order to see full details including:
- Counterparty info
- Maker fee (if the user posted the ad)
- Taker fee (if the user responded to someone else's ad)
- All timestamps

---

### Withdraw Crypto — `/withdraw-crypto`

**File:** `src/app/(app)/withdraw-crypto/page.tsx`

On-chain crypto withdrawal to an external wallet.

**Query params:** `symbol`, `currency_id`

**Flow:**
1. Choose network (bottom sheet modal, filters out inactive networks and TON)
2. Enter destination wallet address
3. Network fee is fetched live from `GET /withdrawal-fees/crypto?currency=usdt&chain=erc20`
4. Enter amount (validates against balance and address format)
5. PIN confirmation
6. Receipt modal with download/share

**Address validation:**
```typescript
// Ethereum and EVM chains:
const ETH_RE = /^0x[0-9a-fA-F]{40}$/;

// TRON:
const TRX_RE = /^T[A-Za-z1-9]{33}$/;

// Bitcoin:
const BTC_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[ac-hj-np-z02-9]{6,87}$/;
```

**Fee parsing:** The API's `data` field may be a string, number, or object. The code handles all cases:
```typescript
if (typeof d === "string" || typeof d === "number") {
  fee = String(d);
} else if (d && typeof d === "object") {
  const v = d.fee ?? d.fees ?? d.amount ?? d.value ?? d.withdrawal_fee;
  if (v != null) fee = String(v);
}
```

---

### Withdraw Fiat — `/withdraw-fiat`

**File:** `src/app/(app)/withdraw-fiat/page.tsx`

NGN bank transfer withdrawal.

**Flow:**
1. Sender name is shown automatically (read from `useAuth().user`)
2. Select bank from list (searchable dropdown)
3. Enter 10-digit account number
4. Account name is automatically resolved from the bank API (debounced 500ms)
5. Enter amount
6. Fees calculated from tiers:
   - ₦0–₦9,999: ₦30 flat
   - ₦10,000+: ₦30 + ₦50 stamp duty = ₦80
7. PIN confirmation
8. Receipt with Kynettic branding (logo, green success circle, download/share)

---

### Deposit — `/deposit`

**File:** `src/app/(app)/deposit/page.tsx`

Get a blockchain address to deposit crypto.

**Query params:** `coin`, `currencyId`

**Flow:**
1. Select network (bottom sheet with active networks, TON excluded)
2. Accept risk acknowledgment checkboxes (required before address shows)
3. See wallet address + QR code
4. Copy address button

---

### History — `/history`

**File:** `src/app/(app)/history/page.tsx`

Full transaction history with advanced filtering.

**Filters:**
- Category: All, Deposit, Withdrawal, P2P, Transfer
- Time range: Last 7 days, 30 days, 90 days, or custom date picker

**Pagination:** 20 per page with "Load more" button.

**Layout:** On desktop, the filter panel appears in the right sidebar. On mobile, filters open as a bottom sheet modal.

---

### Profile — `/profile`

**File:** `src/app/(app)/profile/page.tsx`

User profile hub.

**Shows:**
- Avatar with user's initials
- Full name
- UID (with copy button)
- Verification badges (Email, SMS, Identity)
- Navigation links to all account settings
- Community social links
- Logout button
- Delete account option

---

### Security Settings — `/security-settings`

**File:** `src/app/(app)/security-settings/page.tsx`

Manages 2FA and PIN.

**Features:**
- Toggle 2FA on/off (enabling routes to `/two-factor-setup`)
- Disabling 2FA requires both the 6-digit authenticator code AND the transaction PIN
- PIN setup / change links
- Password change link

---

### Two-Factor Setup — `/two-factor-setup`

**File:** `src/app/(app)/two-factor-setup/page.tsx`

Step-by-step Google Authenticator setup.

**Steps:** intro → qr → verify → success

1. **Intro:** Explains what 2FA is
2. **QR:** Calls `securityService.setup2FA()`, displays QR code and manual secret key (using `qrcode.react`)
3. **Verify:** User enters the first 6-digit code from their authenticator app
4. **Success:** Shows warnings to keep the backup codes safe

---

### Verification Dashboard — `/verification-dashboard`

**File:** `src/app/(app)/verification-dashboard/page.tsx`

KYC status overview and upgrade flow.

**Shows:**
- Progress bar (0–100% based on tier)
- 3 tier cards with requirements and current status
- Tier limit comparison table
- "Upgrade" buttons routing to respective KYC pages

**Status values:** `"completed"`, `"pending"` (in review), `"rejected"`, or not started

---

### Referrals — `/referrals`

**File:** `src/app/(app)/referrals/page.tsx`

Referral program dashboard.

**Shows:**
- KP Points balance in a gradient card
- Referral code with copy button and share button
- How-it-works modal (4 steps)
- List of referred users with their status (active/inactive)

---

### Notifications — `/notifications`

**File:** `src/app/(app)/notifications/page.tsx`

In-app notifications list. Click any notification to see `/notification-details?id=xxx`.

---

### Fiat Internal Transfer — `/fiat-internal-transfer`

**File:** `src/app/(app)/fiat-internal-transfer/page.tsx`

Free instant NGN transfer to another Kynettic user.

**Recipient methods:** Email address or Kynettic UID
**No fee** — internal transfers are always free
**PIN required** before sending

---

### Crypto Internal Transfer — `/crypto-internal-transfer`

Same as fiat internal transfer but for crypto assets.

---

## 16. Modals & Overlays

### `P2PEnterPinModal`

**File:** `src/components/modals/P2PEnterPinModal.tsx`

The 6-digit transaction PIN entry modal used before every sensitive action (trades, withdrawals, posting ads).

**Props:**
```typescript
{
  visible: boolean;
  onClose: () => void;
  onSubmit: (pin: string) => void;
}
```

**Features:**
- 6 individual input boxes, each accepting one digit
- Auto-focuses the next box as you type
- Backspace moves to the previous box
- Paste support (extracts only the digits from pasted text)
- Submit button disabled until all 6 digits are filled
- "Forgot Pin?" link to `/change-pin`

---

### `P2POrderSuccessModal`

**File:** `src/components/modals/P2POrderSuccessModal.tsx`

The trade success receipt modal shown after a P2P trade completes.

**Props:**
```typescript
{
  visible: boolean;
  onClose: () => void;
  order: {
    type: string;       // "Buy" or "Sell"
    amount: string;     // NGN amount
    price: string;      // Rate at time of trade
    fee: string;        // Platform fee
    quantity: string;   // Crypto quantity
    orderNo: string;
    orderTime: string;
    advertiser: string; // Counterparty username
    currency: string;   // e.g., "USDT"
  }
}
```

Features a styled receipt with Kynettic branding that can be downloaded as PNG/PDF or shared.

---

### `DepositModal`

**File:** `src/components/modals/DepositModal.tsx`

Multi-step deposit flow modal supporting both crypto and fiat.

**Props:**
```typescript
{
  visible: boolean;
  onClose: () => void;
  symbol?: string;
  mode: "crypto" | "fiat";
  uid?: string;
}
```

**Steps (state machine):**
```
"choose" → user picks crypto or fiat
  → "crypto" → network picker → "qr" (show deposit address + QR)
  → "fiat-currency" → "fiat-bank" (show virtual bank account details)
```

---

### `StatusModal`

Generic success/error/info modal used throughout the app.

```typescript
{
  visible: boolean;
  type: "success" | "error" | "info";
  title: string;
  message: string;
  onClose: () => void;
}
```

---

### `ReceiptActions`

**File:** `src/components/ReceiptActions.tsx`

The row of action buttons at the bottom of every receipt.

**Props:**
```typescript
{
  onDownloadImage: () => void;
  onDownloadPDF: () => void;
  onShare: () => void;
  working: boolean;   // disables buttons while any operation runs
}
```

Shows: Share button, Download dropdown (Image or PDF options).

---

## 17. Shared Components

### `CurrencyIcon`

**File:** `src/components/CurrencyIcon.tsx`

Displays the logo or flag for a currency symbol.

```tsx
<CurrencyIcon symbol="USDT" size={32} />
<CurrencyIcon symbol="NGN" size={24} />
```

Crypto logos are fetched from a CDN. Fiat currencies show flag emojis.

---

### `LoadingScreen`

**File:** `src/components/LoadingScreen.tsx`

Full-screen loading state shown during auth initialization or page loads.

---

### `TransactionItem`

**File:** `src/components/TransactionItem.tsx`

A single row in a transaction list. Shows type icon, description, amount (colored by direction), and date.

---

### `VerificationGateModal`

**File:** `src/components/VerificationGateModal.tsx`

Shown when an unverified user tries to perform an action that requires KYC. Has a "Verify Now" button that routes to `/verification-dashboard`.

---

## 18. Fee Calculations Explained

Understanding fees is critical to working on the trading and withdrawal pages. Here's a complete breakdown.

### P2P Trading Fees

The platform charges **0.15%** on each P2P trade.

The fee multiplier (`p2pFeeMultiplier`) is the key value:
```
p2pFeeMultiplier = 1 + feeRate × 2
                 = 1 + 0.0015 × 2
                 = 1.003
```

The `× 2` is because both the maker (ad creator) and taker (ad responder) each pay 0.15%.

**Taker fee rate** (what you pay when executing against someone's ad):
```
takerFeeRate = (p2pFeeMultiplier - 1) / 2
             = (1.003 - 1) / 2
             = 0.0015    (0.15%)
```

**Buying crypto (paying NGN):**
```
fiatAmount   = cryptoQuantity × adRate
platformFee  = fiatAmount × takerFeeRate       // 0.15% of what you're paying
totalToPay   = fiatAmount + platformFee         // leaves user's NGN wallet
```

**Selling crypto (receiving NGN):**
```
fiatAmount      = cryptoQuantity × adRate
platformFee     = fiatAmount × takerFeeRate     // 0.15% of what you receive
totalToReceive  = fiatAmount - platformFee       // lands in user's NGN wallet
```

**Effective max for takers:** Ads have a `max_amount` set by the ad creator. But since the fee is deducted from that amount, the taker's spendable limit is slightly lower:
```
effectiveMax = ad.max_amount / p2pFeeMultiplier
```
This is displayed as the limit in the marketplace and on the trade execution pages.

---

### Crypto Withdrawal Fees

Network fees are fetched live from the API for each currency + network combination:

```
GET /withdrawal-fees/crypto?currency=usdt&chain=erc20
```

The response's `data` field contains the fee amount. The response shape can vary — the code handles `data` as a string, number, or object.

No hardcoded fee values for crypto. Always comes from the API.

---

### Fiat Withdrawal Fees (NGN Bank Transfer)

Two tiers — fetched from `GET /withdrawal-fees` but with local fallback:

| Amount Range | Transfer Charge | Stamp Duty | Total Fee |
|---|---|---|---|
| ₦0 – ₦9,999 | ₦30 | ₦0 | **₦30** |
| ₦10,000+ | ₦30 | ₦50 | **₦80** |

Stamp duty is a Nigerian government charge on transactions ≥ ₦10,000.

**Sufficient balance check:**
```typescript
const totalRequired = parsedAmount + totalFee;
const insufficient = totalRequired > availableBalance;
```
Users need enough balance to cover both the amount AND the fee.

---

### Internal Transfer Fees

**Free.** Always. No fee for sending to another Kynettic user.

---

## 19. Common Patterns You'll See Everywhere

### Idempotency Keys

Any API call that moves money uses an `Idempotency-Key` header:
```typescript
headers: { "Idempotency-Key": crypto.randomUUID() }
```
This prevents double charges if the user double-clicks or if a network timeout causes a retry. The backend uses this key to detect and reject duplicate requests.

---

### Comma-Formatted Amount Inputs

The fiat withdrawal page formats numbers with commas as you type:
```typescript
const commaFormat = (v: string) => {
  const [int, dec] = v.replace(/,/g, "").split(".");
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (dec !== undefined ? `.${dec}` : "");
};
```
When sending to the API, always strip commas first: `rawAmount.replace(/,/g, "")`.

---

### Available Balance Calculation

This pattern appears on every withdrawal/trade page:
```typescript
const availableBalance = wallet
  ? parseFloat(String(wallet.balance || 0)) - parseFloat(String(wallet.locked_balance || 0))
  : 0;
```
Always use `parseFloat(String(...))` because the API returns these as strings sometimes.

---

### Copy to Clipboard Pattern

```typescript
const [copiedField, setCopiedField] = useState<string | null>(null);

// In handler:
await navigator.clipboard.writeText(value);
setCopiedField("fieldName");
setTimeout(() => setCopiedField(null), 2000);

// In JSX:
{copiedField === "fieldName"
  ? <CheckCircle2 size={14} className="text-green-500" />
  : <Copy size={14} className="text-[#8E8E93]" />
}
```

---

### Page-Level Error Display

Every page with a form uses the same pattern for showing errors:
```tsx
{error && (
  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
    {error}
  </div>
)}
```

Always clear the error at the start of an action: `setError("")`.

---

### URL Query Params for Page-to-Page Data

Next.js App Router pages use `useSearchParams()` to read data passed in the URL:
```typescript
const params = useSearchParams();
const symbol = params.get("symbol") || "BTC";
const currencyId = params.get("currency_id") || "";
```

The P2P pages pass full ad objects as stringified JSON in the URL:
```typescript
// Sender:
router.push(`/buy-crypto?ad=${encodeURIComponent(JSON.stringify(ad))}`);

// Receiver:
const adParam = params.get("ad");
const ad = adParam ? JSON.parse(decodeURIComponent(adParam)) : null;
```

---

### Loading States

The pattern for async operations:
```typescript
const [loading, setLoading] = useState(false);

const handleSubmit = async () => {
  setLoading(true);
  setError("");
  try {
    await someService.doSomething();
    // handle success
  } catch (e) {
    setError(getErrorMessage(e));
  } finally {
    setLoading(false); // always runs, even on error
  }
};
```

---

### `getErrorMessage` Utility

Never display raw error objects to users. Always use:
```typescript
import { getErrorMessage } from "@/utils/errorHandler";

setError(getErrorMessage(e));
```

This maps common API errors and HTTP status codes to readable messages:
- `"invalid credentials"` → `"Incorrect email or password"`
- HTTP 401 → `"Session expired"`
- HTTP 403 → `"Permission denied"`
- Network error → `"No internet connection"`

---

### Suspense Wrapping for `useSearchParams`

Any page that uses `useSearchParams()` must be wrapped in `<Suspense>`. You'll see this pattern in many pages:

```tsx
function MyPageContent() {
  const params = useSearchParams();
  // ... page logic
}

export default function MyPage() {
  return (
    <Suspense>
      <MyPageContent />
    </Suspense>
  );
}
```

**If you forget the Suspense wrapper, Next.js will throw a build error.** This is a common gotcha for new developers.

---

### TON Network Exclusion

Across all network selectors, TON (Telegram Open Network) is always filtered out:
```typescript
const list = networks.filter(n => n.is_active && !n.chain_key?.toLowerCase().includes("ton"));
```

---

## 20. Debugging Guide — When Things Go Wrong

### "The page shows a loading spinner forever"

Check `isInitializing` in AuthContext. If localStorage is corrupted (e.g., a non-JSON value in `user`), the try/catch in AuthContext catches it and sets `isInitializing = false` — but if there's a logic error before that, it might stay `true`. Clear localStorage in DevTools and reload.

---

### "API calls return 401 constantly"

1. Check if `accessToken` exists in localStorage (DevTools → Application → Local Storage)
2. Check if the token is expired — paste it into `jwt.io` to see the expiry
3. Check if the refresh endpoint is also failing — open Network tab and filter for `/auth/refresh`
4. If refresh fails, the user gets logged out automatically. This is expected behavior.

---

### "The fee shows `[object Object]`"

The fee API returns data in the `data` field of the response, but the shape can vary. The parsing in `withdraw-crypto/page.tsx` handles string, number, and object cases. If you see `[object Object]`, the API changed its response shape — check the actual API response in Network tab and update the parsing logic.

---

### "P2P trade limit errors even though the amount looks valid"

Remember `effectiveMax = ad.max_amount / p2pFeeMultiplier`. The displayed limit is slightly lower than the raw ad limit. If the user enters exactly the displayed max, it should pass. If it's still failing, check if `p2pFeeMultiplier` is loaded (it might still be the default `1.003` if the fee API call failed).

---

### "The receipt download shows a blank image"

The receipt is captured from a `ref`'d DOM element using `html-to-image`. Common causes:
1. The ref isn't attached (check that `ref={receiptRef}` is on the correct div)
2. The element is inside a `display:none` container — `html-to-image` can't capture hidden elements
3. Images (like the Kynettic logo) failed to load — the capture happens after render, so check if network images are loading
4. CORS issues with external images — use Next.js `<Image>` component which proxies images

---

### "Wallet balances are stale after a withdrawal"

`WalletContext` doesn't auto-refresh after every action. Pages that modify balances need to manually call `fetchWallets()` after success. Check if the withdrawal success handler calls it:
```typescript
const { fetchWallets } = useWallet();
// ... after successful withdrawal:
await fetchWallets();
```

---

### "User can access restricted pages without KYC"

The `useVerificationGate` hook has a 60-second cache. If a user just completed KYC, the old (unverified) status might still be cached. Call `invalidateKYCCache()` after successful KYC submission to force a fresh check.

---

### "The build fails with `useSearchParams` error"

Any component using `useSearchParams()` must be wrapped in `<Suspense>`. See the Suspense pattern in Section 19.

---

### "Ads show wrong price after changing fee rate"

The fee multiplier comes from `GET /p2p/fees`. The default before the API responds is `1.003`. If the backend returns a different rate, AdsContext updates `p2pFeeMultiplier`. Any component that reads this value re-renders automatically because it comes from context. If prices look wrong, check the `/p2p/fees` API response in the Network tab.

---

### Local Development Quick Checklist

When something isn't working, run through this list:

1. ✅ Is the dev server running? (`npm run dev`)
2. ✅ Is there a token in localStorage? (DevTools → Application)
3. ✅ Does the API call appear in the Network tab? (Filter: `api/v1`)
4. ✅ What does the API response actually look like? (Click the request in Network tab)
5. ✅ Is there a TypeScript error? (Check terminal for red text)
6. ✅ Is there a console error? (DevTools → Console)
7. ✅ Is the component wrapped in Suspense if it uses `useSearchParams`?
8. ✅ Is the environment variable set if you're pointing at a different backend?

---

*This document should be your first stop whenever you're confused about how something works. If something in the codebase isn't covered here, read the file directly — it's usually well-commented — and then consider adding a section to this document so the next developer benefits.*

*Welcome to the team. The codebase is approachable once you understand the layered architecture. Start with the context providers, understand the service layer, then read individual pages — they all follow the same patterns.*
