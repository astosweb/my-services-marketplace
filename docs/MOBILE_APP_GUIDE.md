# Mobile Application Guide (`ios-app`)

## Overview

The **Gobid iOS Application** (`ios-app/GobidApp`) is a native SwiftUI client designed for iOS 17+, delivering a full service marketplace experience for requesters and providers.

---

## Key Features & UI Components

### 1. Explore View (`GobidApp/Features/ExploreView.swift`)

The main marketplace browser supports two distinct layout modes toggling from the navigation toolbar:

- **List Layout**: Responsive 2-column or 3-column category grid, followed by request cards displaying cover photos, city location, budget badge, and offer/view counts.
- **Map Layout**: Interactive Apple Maps (`MapKit`) interface displaying request location pins, user location marker, and a bottom swipeable carousel synchronized with pin selection.

### 2. Request Detail (`GobidApp/Features/RequestDetailView.swift`)

Detailed view showing request photo gallery, pricing/status badges, requester profile summary, and a static MapKit view with "Directions / Open in Maps" integration.

### 3. Authentication & Keychain Management

- **Endpoints Integrated**: Register, Login, Refresh, Logout, Forgot Password, Reset Password, User Profile & Stats.
- **Keychain Storage**: `KeychainManager` stores the 7-day refresh token in the secure enclave when "Remember Me" is selected.
- **Coalesced Task Queue**: Prevents network thrashing on token expiration by queuing all failed 401 requests until a single refresh task completes.
