# Ricoz Mobile

Expo SDK 57, React Native, and Expo Router. Screens live in `src/app`, and role-aware workspace visibility is controlled by `src/features/registry.ts`. Server authorization remains authoritative.

## Development

Use Node.js 22.13 or newer and run commands from `mobile`:

```bash
npm ci
npm test
npm run typecheck
npm run lint
npx expo start --dev-client
```

Calls require a native development or preview build, not Expo Go. The web preview intentionally does not implement native calling.

### WebRTC Native Module Not Found

Expo Go does not include the WebRTC native module. `npm install` installs the JavaScript package but cannot add native code to Expo Go or to an older installed development build.

Startup now checks for WebRTC before importing LiveKit or the native call provider. When it is missing, the app can open without loading native calling, and call controls are unavailable. Restart Metro with `npx expo start --clear` after this JavaScript fix. This fallback does not enable calling in Expo Go.

Build a custom Android development client:

```bash
npx eas-cli@latest build --platform android --profile development
```

Install the resulting APK on your Android device. Launch **Ricoz Innovation**, not **Expo Go**, then connect it to Metro:

```bash
npx expo start --dev-client --clear
```

Keep the phone and computer on the same network. Rebuild and reinstall the native app after upgrading Expo or adding/updating native dependencies; clearing Metro alone cannot install missing native modules. For a local build, use `npx expo run:android --device` with an Android SDK configured. Regenerate stale generated native projects before rebuilding, preserving any manual native changes.

For local API development, set `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_CHAT_WS_URL` in `.env.local`. Use a reachable LAN IP on physical devices, not `localhost`. Production defaults are `https://innovationapi.ricoz.in/api/v1` and `wss://innovationapi.ricoz.in/ws/chat`.

## Feature Coverage

### Organization, Tasks, and Keyboard Handling

Organization now loads real reporting assignments from `/organization`. It provides the website-style Chart and Outline modes, ancestor-preserving search/department filtering, collapsible branches, company root, SVG reporting connectors, zoom/fit controls, profiles, assignment/reporting-parent editing, and OTP-confirmed removal. Phones default to Outline. Advanced custom-role catalog management and the website's team-onboarding dialog are not yet one-to-one ports.

Contributor Tasks now has Assigned/Enhancement/Submitted/Accepted board columns, list/search/status controls, delivery details, progress reports, optional repository/live links, and manager-review submission. Leadership Tasks exposes actionable/delivery/review/completed queues and brief creation, head routing, manager planning, delegated work items, review/enhancement decisions, and history. Server authorization remains authoritative.

Task Reports uses typed summaries, contributor groups, department/status/search filters, server pagination, the 84-day contribution heatmap, latest reports, and performance/hierarchy progress metrics. Unit tests cover hierarchy filtering/layout/cycles, task stages, deadline-based on-time filtering, daily heatmap aggregation, and API request payloads. Browser fixtures verified chart connections and controls, assignment saves, contributor submission and read-only state, report filtering, validation recovery, and brief/routing requests at phone/desktop widths. Fixtures do not certify live permissions or every workflow stage.

Forms use Expo-compatible `react-native-keyboard-controller`, a root `KeyboardProvider`, and the shared `FormScrollView` with focused-input scrolling and a 20px caret gap. Form screens and action panels use it; chat keeps its independent composer layout. Duplicate auth keyboard-avoidance wrappers were removed. SVG rendering uses `react-native-svg`.

After these native dependencies are added, **rebuild and reinstall an existing custom development/production binary** before testing. Clearing Metro alone cannot add native modules. Use `npx eas-cli@latest build --platform android --profile development` or `npx expo run:android` with a configured local toolchain. Use the matching current SDK 57 Expo Go runtime when previewing in Expo Go. A physical-device keyboard test is still required: focus low-positioned and multiline fields, change inputs with the keyboard open, open modal editors, dismiss the keyboard, and verify safe-area behavior on Android and iOS.

### Layout Audit (2026-10-06)

Chat inbox, conversation, call-history, and status routes no longer render the dashboard header, sidebar, department rail, or tab navbar. Chat retains local back/conversation controls. The conversation's animated frame explicitly fills its screen so the composer stays docked at the bottom. Android uses its configured resize behavior; iOS adjusts for measured keyboard overlap without an arbitrary extra lift.

Shared controls now use scrollable tabs, parent-width-aware stat grids, wrapping titles/badges/buttons, consistent touch targets, and properly sized multiline fields. Duplicate feature navigation headers were removed. Login scrolls on short screens, Marketing campaign inputs stack vertically, calendar tiles fit narrow grids, Security's sign-out button has a valid minimum height, and Investor verification has a single scroll owner. Wide feature pages use a constrained content width.

Browser audit coverage: all 45 registered feature routes at 320px and 390px; the final 45-route pass at 320px and 1280px; Home, Workspace, and Profile at 320px/1280px; and login, signup, and password recovery at 320x568. The final feature-route pass reported no page-level horizontal overflow or render exceptions. Additional checks covered long task/contact text, populated cards, form tabs, the chat composer, and recovery validation. Tests used isolated mock API responses, not production accounts. This does not certify every interaction/state or physical-device keyboard/notch behavior; complete Android/iOS device checks before release.

### Dashboard Behavior

Home and Overview now share the website-aligned dashboard in `src/components/website-dashboard-view.tsx`. The shell uses Geist, the website's neutral dashboard colors and red accent, searchable role-aware navigation, header badges, and an executive department rail on wide screens. Phones use a navigation drawer and horizontal department controls.

Executive accounts see personal task/attendance/leave metrics, upcoming deadlines, check-in/check-out, and planner/calendar/team links. Admin accounts also see governance metrics and recent access changes. Contributor accounts see the morning brief, task completion and delay metrics, saved schedule, and quick actions. Leadership takes precedence over department dashboards, matching website routing; customer and investor accounts open their portals.

Dashboard requests use the same website endpoints, including self-scoped leave and department-scoped workflow requests. Independent failures retain successful sections and show an error. Regression tests cover roles, status calculations, greeting boundaries, and request scoping. Browser checks use mocked API data and cover phone/desktop layout, drawer search, attendance actions, department selection, and partial failures; they are not a substitute for live role-by-role device testing.

This matches the main dashboard structure and behavior, not every website screen or theme setting. Some specialized native module screens still use their existing implementations, and the website's full dark-mode and detailed page workflows require further parity work.

The app exposes native screens for role dashboards, chat, call history, text statuses, attendance, leave, planner, goals, task reports, organization, users, companies, onboarding, products, service requests, HR, marketing, customer and investor portals, notifications, settings, security, recruitment, about, and contact. Recruitment administration includes draft creation, status changes, application review, and offer generation. Password recovery uses the existing email OTP endpoints.

This is not a certification of complete website parity. The registry test checks that each registered feature has a screen or loader; it does not verify every website action. Remaining parity/release work includes:

- Photo/video status publishing; existing photo/video statuses can be viewed.
- Complete message edit/delete/reaction/forwarding and group administration workflows.
- Detailed company management, product/service creation and editing, and all department-specific website actions.
- Full offer editing, sending, candidate acceptance, and investor-verification review workflows.
- Native incoming-call notification/UI while the app is backgrounded or terminated.
- Live, role-by-role integration tests against the API. Some screens expose read-only summaries; Learning, Projects, Work, Documents, Orders and Billing retain empty states where applicable. Do not treat an empty state as implemented transactional functionality.

## Production Runbook

### 1. Deploy the API First

Follow [the server deployment guide](../DEPLOYMENT.md). Deploy the new authenticated `GET /api/v1/chat/calls/ice-servers` endpoint before shipping this mobile build. The API requires MongoDB, Redis, the chat persistence worker, and HTTPS/WSS proxying for `/ws/chat`.

For an existing PM2 deployment, from the production `server` directory:

```bash
npm ci
npm run build
pm2 restart ricoz-api --update-env
```

Use your actual configured process name. Docker deployments should instead follow the Compose steps in the server guide.

### 2. Configure Calling

Set these variables only on the API server:

```dotenv
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=<server-only-key>
LIVEKIT_API_SECRET=<server-only-secret>
TURN_URLS=turn:turn.example.com:3478?transport=udp,turn:turn.example.com:3478?transport=tcp,turns:turn.example.com:5349?transport=tcp
TURN_SHARED_SECRET=<server-only-coturn-shared-secret>
```

Use a reachable TURN server configured for REST/shared-secret authentication with the same secret, a valid TLS certificate, and its required relay ports open. Set its realm and external IP correctly. The API issues one-hour credentials rather than exposing the shared secret. Without TURN configuration direct calls fall back to STUN and may fail on cellular, VPN, or restrictive Wi-Fi. LiveKit is required for group/community calls.

The existing role rules still apply: employees and interns can receive direct calls but cannot initiate them. Group start/end actions remain server-authorized. Foreground calling has compile/test coverage, but actual audio/video connectivity requires two-device validation.

### 3. Configure EAS

The project ID is already set in `app.json`; confirm access to that Expo project. Both application identifiers are `in.ricoz.innovation`. Verify ownership before the first store upload; identifiers cannot be casually changed after publication.

```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest project:info
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_API_URL --value https://innovationapi.ricoz.in/api/v1 --visibility plaintext
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_CHAT_WS_URL --value wss://innovationapi.ricoz.in/ws/chat --visibility plaintext
```

Update existing variables instead of creating duplicates. Configure the `preview` and `development` environments separately with staging URLs; otherwise the code's production defaults apply. Never put database, JWT, LiveKit, or TURN secrets in `EXPO_PUBLIC_*` variables.

### 4. Validate and Build a Preview

```bash
npm ci
npm test
npm run typecheck
npm run lint
npx expo-doctor
npx expo export --platform all
npx eas-cli@latest build --platform android --profile preview
```

Install the preview APK on two physical devices. For iOS internal builds, register test devices and use `npx eas-cli@latest build --platform ios --profile preview`; Apple Developer membership and provisioning are required.

Test login, OTP/password reset, refresh, each account role, submissions, uploads, approvals, notifications, and logout. For calls test mobile-to-mobile and website-to-mobile audio/video on different networks; accept, decline, mute, camera toggle, timeout, hangup during permission prompts, network loss, and logout. Verify both microphones/cameras stop after hangup and call history updates. Test LiveKit group joins/leaves separately.

`expo export` verifies JavaScript bundles, not native compilation, signing, or runtime media behavior. Expo Doctor does not replace a security audit. Run `npm audit --omit=dev` and review, resolve, or formally assess advisories before release; dependency changes can alter the counts. Do not run `npm audit fix --force`: suggested framework downgrades/major upgrades can be incompatible with this SDK without a planned migration.

### 5. Build Signed Store Binaries

After completing parity and release gates:

```bash
npx eas-cli@latest build --platform all --profile production
```

Configure Android signing and Apple provisioning through EAS. Production uses remote build version increments, Android AAB output, and an iOS IPA. Store credentials and build submissions have not been executed automatically.

### 6. Submit and Release

Create the apps in Play Console and App Store Connect. Configure Google's service-account upload credentials and Apple's App Store Connect credentials through the EAS dashboard/CLI. Set the real iOS `ascAppId` in the production submission profile when available.

```bash
npx eas-cli@latest submit --platform android --profile production
npx eas-cli@latest submit --platform ios --profile production
```

Select the intended production build when prompted. Start with Play internal testing and TestFlight, then complete store review, screenshots, privacy policy, data-safety/app-privacy declarations, age ratings, permissions justification, account-deletion requirements, and reviewer access. Submission is not automatic publication; promote/release in the store consoles after approval and required testing.

OTA updates are not configured in this project. Native changes require new binaries; do not run `eas update` until `expo-updates`, runtime compatibility, and update channels are configured and tested.
