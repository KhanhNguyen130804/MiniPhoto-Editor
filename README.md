# MiniPhoto Editor

MiniPhoto Editor là trình chỉnh sửa ảnh chạy cục bộ trong trình duyệt. Bản Android dùng Capacitor để đóng gói cùng giao diện web hiện có; không có backend xử lý ảnh hoặc đồng bộ đám mây.

## Lấy tông màu từ ảnh mẫu

1. Mở ảnh cần chỉnh, chọn **Bộ lọc → Màu từ ảnh mẫu → Chọn ảnh mẫu**.
2. Chọn một JPG/PNG/WebP tĩnh (≤20 MiB, ≤12 MP, mỗi cạnh ≤8192 px).
3. Xem thử ở mức 70%, chỉnh **Độ mạnh** 0–100%, rồi **Áp dụng**. **Hủy xem thử/Escape** bỏ phần chưa áp dụng; **Xóa màu mẫu** bỏ riêng hiệu ứng này.

Màu mẫu được áp trước preset và ba slider, chỉ tác động ảnh nền. Một Apply tạo tối đa một bước Undo. Phần xem thử chưa được autosave; khi xuất ảnh hoặc đổi công cụ, chọn áp dụng/bỏ xem thử/tiếp tục chỉnh. Rời Editor bỏ phần chưa áp dụng.

Draft lưu công thức màu, không lưu ảnh mẫu. Sau reload vẫn chỉnh độ mạnh, xóa màu và export được; thumbnail mẫu chỉ còn trong phiên hiện tại. Snapshot schema 2 được đọc sang schema 3 trong RAM; lần lưu tiếp theo mới ghi schema mới. Bản app cũ chỉ hiểu schema 2 không khôi phục đầy đủ draft schema 3.

Chất lượng phụ thuộc hai ảnh; không có phân vùng hay bảo vệ da tự động. Chi tiết thuật toán, kiểm chứng và phần QA còn mở: [docs/COLOR_TRANSFER.md](docs/COLOR_TRANSFER.md).

## Chạy web và harness

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5188 --strictPort
```

Mở `/tests/manual/color-transfer.html` trên origin kiểm tra riêng, chưa có draft. Harness có core/render/persistence, phép đo 3 MP/12 MP và checklist UI. `npm.cmd run build` chạy typecheck và build web; kết quả mới nhất được ghi trong tài liệu tính năng.

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
