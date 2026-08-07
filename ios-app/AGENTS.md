# AGENTS.md — Native iOS Client (`ios-app`)

Guidance for AI agents working on the **Native iOS SwiftUI Application** (`ios-app/GobidApp`).

Monorepo architecture standards live in the root [`AGENTS.md`](../AGENTS.md).

---

## Technical Stack & Architecture

- **Language & Framework**: Swift 6, SwiftUI, Combine / Swift Concurrency (`async/await`).
- **Maps & Location**: MapKit (`Map` view, user location pins, swipeable carousel).
- **Security & Storage**: iOS Keychain (`KeychainManager` for rotatable refresh tokens).
- **Networking**: `URLSession` talking directly to NestJS API (`http://127.0.0.1:3000` in simulator).

---

## 🔑 Key Coding Invariants

1. **Direct API Communication**: The iOS app communicates directly with NestJS API using `Authorization: Bearer <accessToken>` headers.
2. **Coalesced Token Refresh**: Handle HTTP 401 response challenges by triggering `TokenRefresher.refresh()`. The refresher uses Swift Concurrency tasks to coalesce simultaneous 401 failures into a single token rotation call.
3. **Keychain Auth Storage**: Save `refreshToken` to Keychain only when "Remember Me" is enabled. Otherwise, retain session in memory only.
4. **Dynamic Type & Responsive Layouts**: SwiftUI views (`ExploreView`, `RequestDetailView`) must support Dynamic Type fonts, adaptive grid columns, and light/dark appearance.

---

## 🛠️ Xcode Configuration

- **`GOBID_API_BASE_URL`**: From `Config/Shared.xcconfig` (default `http://127.0.0.1:3000`). Set root `.env` `LAN_LOCAL_IP_ADDRESS` and run `pnpm apply:lan` for a physical device on the LAN.
- **Location Permission**: `NSLocationWhenInUseUsageDescription` defined in `GobidApp/Info.plist`. The prompt is shown only when switching to Map layout or "Nearest" sort.
