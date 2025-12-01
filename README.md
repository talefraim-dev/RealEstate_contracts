# RealtyContracts Mobile (Expo)

## Quick start
```bash
cd mobile
npm i
npx expo start
```
Open on Android/iOS via Expo Go. Add to Home Screen if you want app-like feel.

## Debug
- Use `Open JS Debugger` from the in-app dev menu.
- Android emulator backend URL: use `http://10.0.2.2:<port>` instead of localhost.
- Real device: use your machine IP, e.g., `http://192.168.1.50:8000`.

## E-sign backend
Set `ESIGN_BACKEND` inside `App.tsx` to your server base URL (e.g., `http://192.168.1.50:8000/esign`).
