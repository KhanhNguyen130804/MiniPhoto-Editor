# MiniPhoto Editor

MiniPhoto Editor là trình chỉnh sửa ảnh chạy cục bộ trong trình duyệt. Bản Android dùng Capacitor để đóng gói cùng giao diện web hiện có; không có backend xử lý ảnh hoặc đồng bộ đám mây.

## Yêu cầu Android

- Node.js 24 (xem `.nvmrc` và `package.json`).
- Android Studio và Android SDK Platform 36.
- JDK 21 được cấu hình làm Gradle JDK. Android project dùng Gradle wrapper 8.14.3.
- Android System WebView 80 trở lên để chạy bundle JavaScript đã build.

## Build APK debug trên Windows

```powershell
npm.cmd ci
npm.cmd run build
npx.cmd cap sync android
Set-Location android
.\gradlew.bat assembleDebug
```

`cap sync` sao chép bundle web đã build vào Android project; chạy build web trước khi sync. APK cài thủ công nằm ở `android/app/build/outputs/apk/debug/app-debug.apk`. Có thể cài bằng `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`.

Đây là APK debug, không dành cho Play Store. Mã nguồn wrapper được lưu trong `android/`; APK, keystore và file cấu hình SDK cục bộ không đưa vào Git.

## Dữ liệu và quyền

- Ảnh nguồn, snapshot và thumbnail của bản nháp được lưu trong IndexedDB của WebView. Dữ liệu không đồng bộ và bị xóa khi gỡ ứng dụng hoặc xóa dữ liệu app.
- Trên Android, thao tác **Lưu vào thư viện** ghi ảnh xuất vào `Pictures/MiniPhoto Editor`. Android 10 trở lên dùng MediaStore mà không xin quyền đọc thư viện; Android 7–9 chỉ xin quyền ghi khi người dùng lưu ảnh.
- Bản web tiếp tục dùng liên kết tải ảnh của trình duyệt.
