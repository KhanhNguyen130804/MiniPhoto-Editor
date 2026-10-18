# Màu từ ảnh mẫu — triển khai và kiểm chứng

Ngày: **16/10/2026**, Asia/Saigon. Base HEAD `83b79c3`, nhánh `codex/phase-4-draft-restore`; thay đổi tính năng tại checkpoint này chưa commit/push.

**Trạng thái:** đã triển khai web và đóng gói Android, có bằng chứng browser cho core/UI/persistence/export. **Chưa nghiệm thu 100%:** thiếu Android thật/Gallery, CPU fallback chưa đạt mục tiêu preview desktop ổn định, chưa có benchmark mobile hoặc QA nhiều browser. Các gate QA toàn dự án giữ nguyên.

## 1. Sử dụng và phạm vi

1. Mở **Bộ lọc → Màu từ ảnh mẫu → Chọn ảnh mẫu**. Chọn đúng một JPEG, PNG hoặc WebP tĩnh, tối đa 20 MiB, 12 MP, 8192 px mỗi cạnh.
2. Chờ phân tích và render preview. Độ mạnh mặc định 70%, nhận số nguyên 0–100. Apply chỉ bật khi render mới nhất thành công.
3. **Áp dụng** commit tối đa một bước Undo và autosave canonical snapshot. **Hủy xem thử/Escape** trở lại baseline, không thêm history hoặc ghi draft. Apply 0% và **Xóa màu mẫu** bỏ riêng công thức màu.

Ảnh mẫu không trở thành layer/source thứ hai. Chỉ ảnh nền bị chuyển màu; alpha, overlay, geometry và layer order giữ nguyên. Thumbnail/tên mẫu chỉ tồn tại tạm trong phiên và chỉ hiện khi khớp công thức. Sau reload vẫn chỉnh strength/export/xóa màu mà không cần mẫu.

Khi có preview hoặc job phân tích:

- Đổi công cụ, thay ảnh chính, xuất ảnh: dialog **Áp dụng / Bỏ xem thử / Tiếp tục chỉnh**; chỉ chạy hành động sau khi xử lý preview.
- Đóng/mở bảng Thuộc tính giữ preview. Rời Editor sang Home/Privacy bỏ preview.
- Undo/Redo, preset, layer và takeover draft bị khóa đến khi Apply/Cancel; chọn mẫu trong tab quan sát không lấy quyền ghi của tab chủ.
- Android Back ưu tiên hủy job/preview trước điều hướng thường. Dialog đang mở giữ ưu tiên xử lý Back/Escape của dialog.
- Compare chỉ bật khi preview đã sẵn sàng; hiển thị ảnh nền trước mọi hiệu ứng, thả/cancel/blur trở lại preview, không commit.

Pipeline chung:

```text
Source → ColorTransfer → Preset → Brightness → Contrast → Saturation
```

Chọn preset giữ công thức màu. Original chỉ tắt preset; Reset Adjust chỉ reset ba slider. B&W hiển thị giải thích và hành động chọn Original, không tự đổi preset. Ảnh chính mới có baseline không màu mẫu. Chọn mẫu mới luôn phân tích nguồn trước hiệu ứng, không tích lũy từ kết quả lần trước.

## 2. Thuật toán v1

Lấy cảm hứng từ [Color Transfer between Images](https://home.cis.rit.edu/~cnspci/references/dip/color_transfer/reinhard2001.pdf); implementation này dùng **CIELAB sRGB/D65**. Không coi đây là bản tái tạo nguyên văn không gian màu của paper.

- Ảnh phân tích cạnh dài tối đa 256 px, giữ tỷ lệ, không upscale.
- Nguồn: phần nền trong khung document theo geometry hiện tại, trước hiệu ứng và không overlay; phân tích không phụ thuộc visibility/opacity của layer.
- Mẫu: toàn khung đã decode theo orientation; kiểm lại giới hạn sau decode.
- Pixel alpha 0 bị bỏ qua; alpha bán trong suốt là trọng số của mean/population standard deviation. Vùng hoàn toàn trong suốt báo lỗi, giữ trạng thái hợp lệ trước đó.
- Mỗi kênh: `gain = sigmaRef / sigmaSource`, `offset = meanRef - gain × meanSource`; nếu sigma nguồn <0,1 Lab thì gain=1.
- Gain L giới hạn 0,25–2, a/b 0–2. Hệ số làm tròn 6 chữ số thập phân.
- `LabResult = LabSource + strength/100 × (gain × LabSource + offset - LabSource)`.
- L được clamp 0–100, chuyển ngược RGB và clamp đầu ra; alpha giữ nguyên. Strength 0/recipe trung tính bỏ filter để tránh sai số roundtrip.
- Công thức giữ cố định khi crop/resize/rotate; chỉ chọn mẫu mới mới phân tích lại.

CPU dùng bảng tra chuyển đổi để tránh tính lũy thừa từng pixel; shader WebGL dùng phép chuyển đổi tương ứng. Sai số được kiểm trên fixture, không hứa giống từng byte trên mọi GPU. Thay hằng số/công thức cần algorithmVersion mới và fixture tương ứng.

Fabric có canvas WebGL cố định theo tile size (mặc định 4096 px). Fixture 8192×4 đã tái hiện clipping; pipeline chuyển tạm sang Canvas 2D cho nguồn vượt tile, áp dụng đủ chuỗi filter đồng bộ rồi khôi phục backend chung trong `finally`. Không giảm kích thước hoặc bỏ hiệu ứng. Sau đường WebGL, kiểm lỗi/context loss trước khi báo render thành công; harness ép lỗi để xác nhận không chấp nhận kết quả lỗi.

Không có chọn vùng mẫu, phân vùng chủ thể/bầu trời, bảo vệ da, thư viện mẫu hoặc LUT. Đây là giới hạn chức năng v1.

## 3. Mã nguồn và dữ liệu

| File/module | Vai trò |
|---|---|
| `src/features/editor/engine/colorTransfer.ts` | RGB/Lab, thống kê alpha-weighted, recipe, validation/normalization, phân tích mẫu và cleanup. |
| `src/features/editor/engine/ColorTransferFilter.ts` | Fabric filter CPU/WebGL. |
| `src/features/editor/engine/adjustmentFilters.ts` | Một pipeline dùng cho Editor, preset/draft thumbnail và export; Compare đặt colorTransfer=null. |
| `src/features/editor/useColorTransfer.ts` | Pending ngoài canonical, abort/generation, baseline identity, request ID, Apply/Cancel và deferred action. |
| `src/features/editor/ColorTransferControls.tsx` | Picker riêng, thumbnail, strength, status/error và dialog. |
| `src/App.tsx`, `EditorCanvas.tsx`, `src/app.css` | Nối workflow, khóa thao tác, Compare/Back/Escape, render acknowledgement và responsive panel. |
| `snapshot.ts`, `draftValidation.ts`, `draftStore.ts` trong engine | Schema 3, đọc schema 2 trong RAM, kiểm metadata và recovery. |
| `tests/manual/color-transfer.html` + `.ts` | Harness browser core/render/persistence, benchmark và checklist UI; TS được đưa vào typecheck. |

`imageAppearance.colorTransfer` bắt buộc, giá trị `null` hoặc:

```ts
{
  algorithmVersion: 1,
  gain: [number, number, number],
  offset: [number, number, number],
  strength: number // integer 1–100; 0 được normalize thành null trước commit
}
```

Validator kiểm đúng keys/tuple (kể cả array thiếu phần tử), kiểu số hữu hạn, gain theo giới hạn, offset −512…512 và version. Dùng `hasOwnProperty.call` để không phụ thuộc `Object.hasOwn` của WebView mới; harness kiểm khi API này không có. Không lưu file mẫu, Blob URL, bitmap, tên hoặc thumbnail mẫu vào snapshot/history/draft. Snapshot schema 2 hợp lệ được thêm colorTransfer=null trong RAM; **đọc không ghi lại record**. Lần commit/save thực sự sau đó ghi schema 3. Metadata schema của record phải khớp snapshot thô. Không đổi IndexedDB v1 hoặc object stores.

Schema/algorithm không hỗ trợ đi qua recovery nguồn hiện có, giữ source và record lỗi. **App cũ chỉ hiểu schema 2 không khôi phục đầy đủ draft schema 3**; không nên rollback app mà giả định draft mới tương thích ngược.

Mỗi job gắn asset, generation và baseline snapshot chứa geometry. Thay mẫu/hủy/thay nguồn/unmount làm kết quả cũ mất hiệu lực. Decode mẫu đầy đủ được dispose sau phân tích; chỉ còn thumbnail nhỏ. URL bị revoke khi thay mẫu, hủy mẫu không khớp canonical, Undo sang công thức khác hoặc unmount. Canvas phân tích được dispose. Lỗi preview trả về baseline và báo thử lại, không báo thành công hoặc ghi draft tạm.

Các effect render giữ cập nhật strength mới nhất qua animation frame; acknowledgement phải khớp request hiện tại. Preset thumbnail nhận snapshot canonical, không render cả lưới theo mỗi thay đổi strength pending. Autosave cũng chỉ nhận canonical snapshot.

## 4. Cách kiểm lại

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5188 --strictPort
```

Mở `http://127.0.0.1:5188/tests/manual/color-transfer.html` trong profile/origin thử nghiệm trống, không dùng bản nháp đang làm việc. Nút core tạo/xóa draft tổng hợp của chính harness; từ chối khi origin đã có draft. Hai nút chạy được khóa cùng lúc để không tranh Fabric backend.

- **Chạy core, render và persistence:** 6 nhóm, gồm toán học/alpha, parity CPU/WebGL, analysis/import, schema/history, export/thumbnail/overlay, IndexedDB/recovery.
- **Đo 3 MP và 12 MP:** chạy riêng, không mở inspector hoặc công việc nặng khác; ghi browser/backend/viewport. Phép đo không thay cho interaction benchmark trên thiết bị.
- UI checklist nằm ngay trên trang harness; cần chạy trên app thật và Android thật riêng.
- Regression có origin guard: Day 21 dùng `127.0.0.1:5175`, Day 22 `:5176`, Day 23 `:5177`. Không sửa guard hoặc xóa draft người dùng để chạy test.
- `npm.cmd run build` gồm TypeScript typecheck. Không thêm package test hoặc thư viện xử lý ảnh.

## 5. Bằng chứng browser ngày 16/10

Môi trường: Windows 10, Chrome **155.0.8059.84** headless, DPR 1, profile Playwright tạm riêng, SwiftShader qua `--use-angle=swiftshader --enable-unsafe-swiftshader`. Đây không phải WebView/điện thoại thật hoặc GPU phần cứng.

- Harness mới: **6 nhóm pass**, không có encoder bị skip trong Chrome này. CPU/WebGL sai khác RGB tối đa **1** trên hai recipe/fixture màu dày, ngưỡng 3; strength 0 đi qua, alpha giữ nguyên.
- Fixture self-reference, EXIF orientation 8, WebP phong cảnh, raw crop, source hidden/opacity, alpha-weighted, 1×1/flat/transparent, metadata size/animation/corrupt, bounds/version pass. JPEG EXIF còn được regression bằng harness import hiện có.
- Schema 2→3 không mutate snapshot cũ/không viết lại IndexedDB; unsupported algorithm và schema metadata lệch nhau được đưa vào source-only recovery, record còn nguyên.
- Export PNG/JPG/WebP được decode để kiểm kích thước/overlay text và shape; alpha PNG/WebP, thumbnail preset có màu, upscale 640×480 từ analysis tối đa 256 px pass. Regression export hiện có kiểm MIME/matte riêng.
- Regression **10 harness / 71 nhóm pass**: Day 2 import/Fabric (17), 7 (7), 14 (6), 16 (8), 20 (5), 21 (5), 22 (5), 23 (4), 24 (10), 25 Compare (4). Đây là các nhóm liên quan, không phải chạy toàn bộ test lịch sử hay đóng mọi gate.
- Automation UI app thật: pending không autosave, invalid number, panel close/reopen, dialog stay/apply/discard, một Apply/Undo/Redo, clear/zero, preset/Original/Reset Adjust, reload không mẫu, observer tab không ghi đè lease, mẫu lỗi/multiple giữ preview cũ, A tới muộn sau B, hủy job, Compare pointercancel/Space/Enter/blur, deferred main picker, viewport 360 px và simulated Android Back pass.
- UI tạo/tải PNG/JPG/WebP, đọc lại bytes đã tải và decode bằng browser đúng 640×480. Không kiểm mở bằng ứng dụng ảnh bên ngoài.
- 20 vòng chọn/hủy không đổi draft; kiểm URL tạm được revoke, lỗi render cố ý một lần phục hồi baseline và thử lại pass. Không có uncaught browser error; request quan sát trong bài UI chỉ tới origin thử nghiệm, không có upload ảnh/snapshot. Đây là quan sát trong phiên test, không phải kiểm chứng mọi network stack hoặc heap profiler.

### 5.1. Ảnh thật

Đã tạo/kiểm bằng mắt ma trận **3 ảnh × 3 mẫu** ở strength 70%, export PNG và decode lại đúng kích thước gốc:

- Chân dung 2687×3356: [President Barack Obama — Pete Souza, Official White House Photo](https://commons.wikimedia.org/wiki/File:President_Barack_Obama.jpg), public domain theo trang nguồn.
- Sản phẩm 3030×2670: [Banana-Single — Evan-Amos](https://commons.wikimedia.org/wiki/File:Banana-Single.jpg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
- Phong cảnh 1024×772: fixture `tests/fixtures/day2-import/webp-static.webp`, “A Wild Cherry”, Benjamin Gimmel, CC BY-SA 3.0; nguồn/giấy phép đã ghi trong README fixture.

Mẫu ấm/lạnh/tối được tạo cục bộ từ phong cảnh bằng biến đổi RGB kiểm soát; không phải bộ sưu tập ảnh mẫu thực tế đa dạng. File tải phục vụ QA và ma trận nằm ở thư mục TEMP, không thêm ảnh bên ngoài vào source repository. Ma trận tổng hợp là ảnh biến đổi phục vụ kiểm tra, áp dụng CC BY-SA 3.0 nếu phân phối lại phần có nguồn tương ứng; ghi công tác giả và thay đổi màu như trên.

**Quan sát:** tông phong cảnh thay đổi đúng hướng. Khi lấy thống kê phong cảnh áp cho chân dung/sản phẩm khác bố cục, màu da/áo và nền trắng bị kéo rõ sang cyan/xanh; mẫu tối làm tối cả chủ thể. Không thấy crash/giảm kích thước đầu ra ở 9 lần này. Kết quả không đủ để kết luận giữ da, không clipping hoặc phù hợp mọi ảnh. Cần pilot thêm ảnh ánh sáng khác nhau và đánh giá trực tiếp ở full size; không tự thay thuật toán/default đã duyệt để che giới hạn này.

### 5.2. Hiệu năng

Fixture tổng hợp, 5 shape overlay, StaticCanvas 1024×768, hai lần warmup; 3 MP dùng 20 strength khác nhau lấy p95, 12 MP dùng 2 lần lấy max. Đo đồng bộ `applyImageAdjustments + renderAll`, chưa bao gồm DOM input/compositor hoặc event-to-paint; WebGL call có phần GPU bất đồng bộ. Export PNG gồm render/encode thành Blob; output không giảm pixel.

| Fixture | Backend | Filter + StaticCanvas | PNG export | Output bytes |
|---|---|---:|---:|---:|
| 2048×1536 | Canvas 2D CPU | p95 167,7 ms | 425,8 ms | 2.201.845 |
| 2048×1536 | WebGL SwiftShader | p95 79,4 ms | 1690,5 ms | 2.200.365 |
| 4000×3000 | Canvas 2D CPU | max 926,6 ms | 1142,8 ms | 7.899.154 |
| 4000×3000 | WebGL SwiftShader | max 1,6 ms | 1689,0 ms | 7.897.168 |

CPU 3 MP **chưa đạt mục tiêu desktop p95 ≤150 ms một cách ổn định**; lần trước cùng số mẫu là 257,6 ms, cho thấy độ dao động. Bảng là lần đo sau sửa tile WebGL, không dùng kết quả để coi target đã đạt. WebGL số đo đồng bộ thấp không chứng minh event-to-paint đạt 150 ms. Export fixture này dưới 3 giây desktop, chưa chứng minh mọi format/ảnh hoặc mobile ≤6 giây. 12 MP CPU có thể khóa main thread khoảng một giây (lần trước 1172,5 ms); chưa đo peak memory/OOM thật. Nếu cần bảo đảm target trên CPU/mobile thì còn công việc hiệu năng và device benchmark, không hạ kích thước export âm thầm.

## 6. AC và phần còn mở

| AC | Trạng thái tại checkpoint | Bằng chứng / giới hạn |
|---|---|---|
| CT-01 | Đạt trong browser kiểm tra | File hợp lệ/EXIF/alpha, size/header/animation, lỗi và multiple; native Android picker chưa kiểm. |
| CT-02 | Đạt trong browser kiểm tra | Cancel preview/job, Escape, input rỗng và canonical/history/draft không nhận preview; OS picker Android chưa kiểm. |
| CT-03 | Đạt fixture | Zero bypass, self-reference trung tính; Lab roundtrip ≤1 RGB trên fixture. |
| CT-04 | Đạt fixture | Flat/đen/trắng/1×1/alpha/degenerate, không NaN/Infinity; fully transparent báo lỗi. |
| CT-05 | Đạt core/UI kiểm tra | History no-op/Undo/Redo/branch và Apply/Clear/Cancel. |
| CT-06 | Đạt trong phạm vi harness/UI | Raw geometry, overlay text/shape, alpha; Original/Reset giữ recipe. Không xác nhận mọi chuỗi layer của sản phẩm. |
| CT-07 | Đạt browser kiểm tra | Pointercancel, Space/Enter và blur trả về pending; không commit Compare. |
| CT-08 | Đạt browser kiểm tra | 3 MIME, dimensions, alpha/matte/overlay, tải và decode lại bytes; chưa Gallery hoặc ứng dụng ảnh ngoài. |
| CT-09 | Đạt browser kiểm tra | Save/reload/restore, RAM-only schema 2, strict metadata/unsupported algorithm recovery. Chưa quota/private mode/eviction thật. |
| CT-10 | Có bằng chứng browser; device còn mở | A/B nhanh, cancel job và rời Editor khi job còn đọc file, observer lease; guard asset/baseline/generation và unmount cleanup. Không chứng minh mọi race native picker. |
| CT-11 | **Chưa đạt đầy đủ** | Có keyboard controls và viewport 360 px, Back chỉ mô phỏng event. Không có thiết bị ADB để kiểm native picker, Back/Gallery, touch/IME/notch. |
| CT-12 | Đạt quan sát có giới hạn | 20 vòng, URL tracking, lỗi/retry, local-only requests; chưa heap profiler hoặc memory pressure trên thiết bị. |

Không đánh dấu toàn bộ chức năng đã nghiệm thu hoặc các gate toàn dự án đã đạt. Ưu tiên tiếp: Android thật → benchmark tương tác CPU/WebGL/mobile → pilot chất lượng màu → QA browser/memory/accessibility còn mở trong roadmap.

## 7. Build và artifact bàn giao

- `npm.cmd run build`: pass, gồm `tsc --noEmit`; main JS 673,65 kB (gzip 205,56 kB), CSS 42,02 kB. Vite còn cảnh báo chunk >500 kB; chưa làm công việc tách bundle ngoài phạm vi.
- `npx.cmd cap sync android`: pass. Gradle `assembleDebug --no-daemon --console=plain`: **BUILD SUCCESSFUL**, 123 tasks (27 executed, 96 up-to-date), 20 giây ở lần cuối. Dùng JDK Temurin 21.0.12.1 và Android SDK 36 có sẵn qua biến môi trường tiến trình; không đổi cấu hình global. Còn cảnh báo flatDir.
- APK debug: `android/app/build/outputs/apk/debug/app-debug.apk`, **5.645.309 byte**, SHA-256 `C5472B6F70A56F8E20185BCA420A291E778339D3D23C03908AD9BD2FB3693925`.
- Đã đọc ZIP APK và đối chiếu hash hai JS assets với `dist/assets`: khớp `index-CjSbcNtc.js` và `web-B3_eWvSi.js`. Đây là bằng chứng đóng gói đúng web bundle, không phải chạy ứng dụng trên Android.
- `adb devices`: danh sách trống, không cài/chạy APK hoặc ghi Gallery trên thiết bị trong task này.
- `git diff --check`: pass. Không commit/push. Các untracked có sẵn giữ nguyên; không thêm ảnh QA bên ngoài, dependency hoặc build output vào Git.
