# Bidy EE

Native SwiftUI client for the Bidy marketplace API.

## API configuration

`HERO_API_BASE_URL` is set via the Xcode build setting of the same name and merged into
`heroApp/Info.plist`. It defaults to `http://127.0.0.1:3000` (Simulator → local API).
Override per configuration or in CI with the deployed HTTPS API URL. For a physical device
on the same network, switch it to your Mac's LAN IP (e.g. `http://192.168.x.x:3000`).

Local-network HTTP is allowed for development via
`NSAppTransportSecurity` → `NSAllowsLocalNetworking` in `Info.plist`. Production API URLs should
always use HTTPS.

## Explore

`ExploreView` (`heroApp/Features/ExploreView.swift`) is the marketplace browser and has two
layouts, toggled from the navigation bar:

- **List** – request cards with photo, category, city/distance, budget, offer/view counts.
- **Map** – Apple Maps (MapKit for SwiftUI) with a pin per request, the user's location,
  and a swipeable card carousel that stays in sync with the selected pin.

Search, category chips and sorting (Recommended, Newest, Highest Budget, Nearest) are applied
client side on the page loaded from `GET /requests?limit=50`. Categories are derived from the
loaded requests, so no extra endpoint is needed.

`RequestDetailView` (`heroApp/Features/RequestDetailView.swift`) is shared by Explore and My
Requests: photo gallery, status/pricing badges, stats, requester card, and a non-interactive
map with Directions / Open in Maps links.

### Location permission

Distance labels, the "Nearest" sort and the map's user location need
`NSLocationWhenInUseUsageDescription` (already in `heroApp/Info.plist`). The prompt is only
shown when the user opens the map layout or picks the "Nearest" sort — never on launch.

## Authentication

The app integrates:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh` (automatic on `401`, coalesced)
- `POST /auth/logout`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET/PATCH /auth/me` and `GET /auth/me/stats`

Refresh tokens are stored in Keychain when Remember Me is enabled. Without Remember
Me, the session stays in memory only.

Password reset works end-to-end against the API. In development/test, the API returns
the raw reset token so the app can prefill the Reset Password screen. Production
responses stay generic until an email provider is added.
