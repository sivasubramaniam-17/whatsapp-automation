# WhatsApp Automation — Flutter mobile app

Native iOS/Android client that calls the **same backend API** as the web
dashboard. Login → Inbox (read + reply) → Contacts (list + add).

## Screens
- `lib/screens/login_screen.dart` — sign in / register
- `lib/screens/home_screen.dart` — bottom nav (Inbox / Contacts) + logout
- `lib/screens/inbox_screen.dart` — conversation list (pull to refresh)
- `lib/screens/thread_screen.dart` — message thread + reply (24h-window aware)
- `lib/screens/contacts_screen.dart` — contact list + add
- `lib/api.dart` — API client (JWT in SharedPreferences)
- `lib/config.dart` — API base URL

## One-time setup

1. **Install Flutter** (includes Dart):
   https://docs.flutter.dev/get-started/install
   Then verify: `flutter doctor`

2. **Generate the platform folders** (this repo has only `lib/` + `pubspec.yaml`).
   From inside `mobile/`:
   ```bash
   flutter create .
   flutter pub get
   ```
   `flutter create .` adds the `android/`, `ios/`, etc. folders without touching
   your `lib/` code.

## Run it

Start the backend first (from repo root): `npm run dev` (port 4000).

Then, from `mobile/`:

```bash
# Android emulator (reaches your laptop via 10.0.2.2 — the default):
flutter run

# iOS simulator:
flutter run --dart-define=API_BASE_URL=http://localhost:4000

# Real phone (easiest): point at the public tunnel so there are no LAN/cleartext issues:
flutter run --dart-define=API_BASE_URL=https://YOUR-TUNNEL.trycloudflare.com
```

Sign in with the test account: **me@acme.com / password123**.

## Note on plain HTTP (Android)
Android blocks cleartext `http://` by default. Two options:
- **Recommended:** use the **https** tunnel URL (`--dart-define=API_BASE_URL=https://…`).
- Or, after `flutter create .`, add `android:usesCleartextTraffic="true"` to the
  `<application>` tag in `android/app/src/main/AndroidManifest.xml`.

## What to build next
Push notifications for new inbound messages, contact detail/edit, and a
campaigns tab — all just call existing API endpoints.
