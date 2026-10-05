# Lugaw Delights mobile apps

Android apps for Lugaw Delights, built with [Capacitor](https://capacitorjs.com). They use the **same Firebase project** as the website (https://lugawdelights.netlify.app), so orders, riders and payouts are shared.

The website lives in a separate folder (`lugaw-app`) and is not changed by anything here.

## Apps

| Folder | App | Status |
|---|---|---|
| `rider/` | Lugaw Delights Rider (`com.lugawdelights.rider`) | First test version |
| `customer/` | Lugaw Delights (`com.lugawdelights.app`), customer ordering | First test version |

## How the rider app is made

`rider/www/` is a copy of the website's rider page (`rider.html` → `index.html`) and the shared files it needs, with small app changes:

- documents and full-size photos open in a full-screen panel instead of a new window
- "Order food" opens the live ordering site
- the camera permission is declared for proof photos

`customer/www/` is a copy of the website's customer page (`index.html`) with the same shared files; "Ride with us" opens the live rider sign-up page.

When the website's pages change, copy the change into `rider/www/` and `customer/www/` too.

## Build a test version (Windows)

Needs Node.js 22+, JDK 21 and the Android SDK.

```
cd rider
npm install
npm run build:debug
```

The test app is written to `rider/android/app/build/outputs/apk/debug/app-debug.apk`.
