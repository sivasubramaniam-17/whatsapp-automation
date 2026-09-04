// Base URL of the backend API.
//
// IMPORTANT: a phone/emulator cannot reach your laptop's "localhost".
//   - Android emulator: use http://10.0.2.2:4000
//   - iOS simulator:    use http://localhost:4000
//   - Real device:      use your laptop's LAN IP, e.g. http://192.168.1.5:4000
//                       or the public tunnel URL (https://xxxx.trycloudflare.com)
//
// You can also override at run time:
//   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000
const String kApiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:4000',
);
