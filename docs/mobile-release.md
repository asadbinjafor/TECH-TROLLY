# Android and iOS release

The app uses React Native views/inputs, native stack and bottom-tab navigation, SafeArea handling, keyboard avoidance, secure token storage, native pickers/date selection, draft persistence and native print/share APIs. It does not wrap the website in a WebView. The bundled Noto Sans Bengali font is used in UI and embedded as base64 in receipt print HTML.

Expo SDK 58's recommended React 19.3.0 and React Native 0.88.1 are locked. `expo install --check` reports dependencies up to date; Expo Doctor passed 20/20 checks. Android and iOS Hermes JavaScript bundles both exported successfully. These are not installable APK/AAB/IPA files and do not prove native compilation, device installation, keyboard behavior or file sharing on a device.

Configured app IDs: `com.techtrolley.shop` for Android/iOS; these are proposed implementation identifiers whose availability/ownership must be checked in the actual store accounts. Version 1.0.0, Android versionCode 1 and iOS buildNumber 1. Existing Tech Trolley icon/splash branding is bundled. No camera/microphone/storage permission is requested for unapproved scanning features.

Before a cloud build, set the public API endpoint in the corresponding EAS environment. Preview/production profiles require HTTPS. Use e.g. the selected deployment's `/api` base when using the portable same-origin host. No secret belongs in EXPO_PUBLIC variables. A physical phone's localhost is itself: for development, set `.env` to the computer's actual LAN IP plus port 3000, keep both devices on an authorized LAN and restrict firewall exposure; a tunnel is another explicit development option.

```powershell
Set-Location E:\Taki\tech-trolley-mobile
npx eas-cli login
npx eas-cli init
# Supply account/project and public API environment before continuing.
npx eas-cli build --platform android --profile development
npm run dev
# Installable internal APK:
npx eas-cli build --platform android --profile preview
# Separately signed Play production AAB:
npx eas-cli build --platform android --profile production
# Apple device/internal build, with registered devices and signing:
npx eas-cli build --platform ios --profile preview
# App Store Connect/TestFlight path:
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
```

No build job was started: `eas whoami --non-interactive` returned Not logged in; Android preview build stopped with “An Expo user account is required to proceed.” No account/token/project is available. Java and Android SDK are also absent, so local Android compilation is blocked. No signing material is in Git. Windows can initiate cloud iOS builds, but the local Apple iOS Simulator requires macOS; no Windows simulator is promised. TestFlight is a separate distribution step, not public App Store publication.

Device acceptance still required on signed development builds: both languages/themes, large text/screen-reader labels, keyboard/numeric entry and Android Back, resume/midnight/draft retention, offline/network-loss/retry recovery, exact stock conflict across two clients, first-login password change, native date picker, receipt PDF font/IMEI accuracy, save/share/print and authorization/session revocation. No device test is claimed from Expo Go or JS bundle success.

Store metadata draft: name “Tech Trolley”; category Business; description “Internal inventory, sales, dues and daily accounts for one mobile shop. Assigned accounts only.” Supply actual support URL, privacy URL, screenshots, account review access and approved distribution choice before submission. Do not fabricate contact details. Public registration is absent.

Privacy draft for Owner review: the service stores assigned staff/Owner names and optional emails, password hashes/session hashes, optional customer/supplier/person names and phone numbers, IMEIs/product details, transactions and audit timestamps. Credentials use secure storage; business data is shared with the shop's authenticated users per role. No advertising, tracking, camera or location feature is implemented. Printing/sharing sends only the selected receipt/export to the OS action chosen by the user. Hosting/backup subprocessors and retention/deletion contact need actual deployment details. This draft is not a submitted store disclosure.

Official guidance checked: [development builds](https://docs.expo.dev/develop/development-builds/introduction/), [internal distribution](https://docs.expo.dev/build/internal-distribution/), [store submission](https://docs.expo.dev/deploy/submit-to-app-stores/), [iOS Simulator](https://docs.expo.dev/workflow/ios-simulator/). Account-specific store requirements cannot be verified without the selected accounts.
