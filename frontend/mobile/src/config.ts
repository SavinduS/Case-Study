// Server address. Set it in frontend/mobile/.env (copy .env.example) —
// EXPO_PUBLIC_API_BASE_URL is inlined at bundle time, so restart Expo with
// `npx expo start -c` after changing it. On a real phone the address must be
// your PC's LAN IP (ipconfig → IPv4) and Windows firewall must allow Node.js.
// Android emulator only: http://10.0.2.2:5000
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://192.168.1.100:5000';
