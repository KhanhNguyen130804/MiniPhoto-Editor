# MiniPhoto Editor — Hướng dẫn làm việc cho agent

Tài liệu dành cho agent AI và developer được giao việc trong repository MiniPhoto Editor. Trước mỗi task, đọc [docs/CONTEXT_SUMMARY.md](docs/CONTEXT_SUMMARY.md) để nắm hiện trạng, quyết định và blocker; đọc [docs/WALKTHROUGH.md](docs/WALKTHROUGH.md) để biết công việc đã làm và bằng chứng kiểm tra. Sau đó đọc [PRD_MINIPHOTO_EDITOR.md](PRD_MINIPHOTO_EDITOR.md) và [docs/roadmap.md](docs/roadmap.md) theo phạm vi task. Tệp này hướng dẫn cách triển khai và kiểm chứng; PRD là nguồn đặc tả hành vi sản phẩm, roadmap là kế hoạch ngày công.

Context và walkthrough là bản ghi theo thời điểm: luôn đối chiếu với checkout/Git thực tế, không coi kế hoạch hoặc kết quả lịch sử là bằng chứng mới. Sau task làm thay đổi hiện trạng, cập nhật hai tệp trong `docs/` với đầu ra, kiểm tra thực tế, giới hạn và bước tiếp theo; không ghi secret hoặc tự đánh dấu AC đạt.

## 1. Mục tiêu và cách sử dụng tài liệu

- Xây website giúp người dùng chọn một ảnh, chỉnh hình học/màu, thêm chữ/hình và tải kết quả trong vài phút.
- Desktop là trải nghiệm chính; mobile dùng website responsive với đủ nhóm công cụ P0.
- Xử lý ảnh tại thiết bị; không yêu cầu tài khoản hoặc dịch vụ xử lý ảnh server trong MVP.
- Khi nhận task, xác định ngày/phase, backlog B01–B12 và AC liên quan; chỉ thực hiện phạm vi được giao.
- Đọc toàn bộ PRD trong lần tiếp nhận đầu tiên; các lần sau đọc lại phần bị tác động và thay đổi mới.
- Theo yêu cầu mới nhất của người dùng. Nếu người dùng giới hạn chỉ đọc, không tạo/sửa/xóa tệp, cài dependency, build/test, khởi động server hay thay đổi Git/config.
- Yêu cầu khảo sát trước đây không thay thế yêu cầu triển khai mới được người dùng giao. Ngược lại, có roadmap không đồng nghĩa được phép tự triển khai toàn bộ roadmap.
- Khi PRD, roadmap và task có khác biệt ảnh hưởng phạm vi hoặc hành vi, chỉ rõ khác biệt và làm rõ phần phụ thuộc; tiếp tục các phần độc lập đã được giao.

## 2. Hiện trạng ban đầu và nguồn thông tin

Tại thời điểm tạo hướng dẫn này, repository ở giai đoạn tài liệu: có PRD và roadmap; chưa có mã ứng dụng, dependency manifest, lockfile, script build/test hoặc bằng chứng nghiệm thu sản phẩm. Đây là mốc ban đầu, không phải trạng thái vĩnh viễn. Mỗi phiên làm việc phải kiểm tra checkout thực tế.

| Nguồn | Trách nhiệm |
|---|---|
| Yêu cầu người dùng hiện tại | Phạm vi được giao, ưu tiên, quyền chạy lệnh/publish và thay đổi quyết định |
| `PRD_MINIPHOTO_EDITOR.md` | Phạm vi P0/P1, FR-01–15, quy tắc dữ liệu, AC-01–42 và release gate |
| `docs/roadmap.md` | Kế hoạch cơ sở 30 ngày công, 6 phase, đầu ra và gate từng phase |
| `AGENT.md` | Quy trình làm việc, ranh giới trách nhiệm, kiểm chứng và bàn giao |
| `docs/CONTEXT_SUMMARY.md` | Hiện trạng theo thời điểm, quyết định, blocker và bước tiếp theo |
| `docs/WALKTHROUGH.md` | Công việc đã thực hiện, cách đọc dự án và bằng chứng kiểm tra |
| Mã nguồn và cấu hình thực tế | Hành vi đã có và môi trường đang sử dụng; không suy từ cây thư mục gợi ý |
| README/QA khi được tạo | Setup thực tế, script có thật, giới hạn, kết quả kiểm tra và thiết bị/browser |

Không suy trạng thái repository này từ dự án khác. Không coi ví dụ TypeScript, sơ đồ, wireframe ASCII, backlog hoặc thư mục gợi ý trong PRD là implementation.

## 3. Quyết định đã có và giả định còn mở

Theo PRD mục 1:

| ID | Nội dung | Trạng thái cần giữ đúng |
|---|---|---|
| D01 | Website desktop và responsive mobile; không app native | Người dùng xác nhận |
| D02 | Adjust P0 chỉ Brightness, Contrast, Saturation | Người dùng xác nhận |
| D03 | Exposure, Temperature, Blur, Sharpness thuộc phiên bản sau | Người dùng xác nhận |
| D04 | Tự lưu một draft local để restore sau reload | Người dùng xác nhận |
| D05 | Import/export, geometry, filters, text, shapes, layers, history, compare | Kế thừa ý tưởng gốc, chi tiết theo PRD |
| D06 | Xử lý tại browser, không login/AI trong MVP | Kế thừa ý tưởng gốc |
| D07 | React + TypeScript + Vite + Fabric.js, CSS Modules | Đề xuất kỹ thuật |
| D08 | Một source image, một document, tối đa 50 overlay | Đề xuất giới hạn |
| D09 | Tiếng Việt, MiniPhoto Editor, Home sáng/Editor tối | Giả định thiết kế |
| D10 | Mobile có đủ công cụ qua bottom sheet | Diễn giải đề xuất cho responsive |
| D11 | Không analytics, quảng cáo, tracking ngoài | Đề xuất |
| D12 | Mục đích dự án, đội ngũ, deadline, kỹ năng | Chưa có câu trả lời trong PRD |

Không tự đánh dấu D07–D12 đã được duyệt. Khi được giao triển khai, nêu các mặc định trong implementation plan, dựa vào ủy quyền và quyết định đã có trong phiên; chỉ hỏi thông tin thực sự chặn phần phụ thuộc. Các giới hạn/hiệu năng là mục tiêu đề xuất cần kiểm chứng, không phải benchmark có sẵn.

## 4. Phạm vi sản phẩm

### 4.1. P0 bắt buộc trước khi gọi MVP hoàn chỉnh

| Nhóm | Phạm vi |
|---|---|
| Import | Chọn file/drag-drop; đúng một JPG/JPEG, PNG hoặc WebP tĩnh |
| Geometry | Crop Free, 1:1, 4:3, 3:4, 16:9, 9:16; resize giữ tỷ lệ; rotate ±90°; flip H/V |
| Adjust | Brightness, Contrast, Saturation |
| Filters | Original + Warm, Cool, Vintage, B&W, Fade, Vivid, Film, Sepia, Dramatic |
| Text | Nhiều textbox, multiline tiếng Việt, một style mỗi textbox, move/scale/rotate |
| Shapes | Rectangle, circle, line; fill/stroke/opacity và thuộc tính vị trí |
| Layers | Chọn, ẩn/hiện, xóa overlay, lên/xuống một bậc |
| History | Undo/redo tối đa 50 bước, giới hạn JSON history phụ |
| Compare | Giữ hình học hiện tại, bỏ màu/filter và ẩn overlay trong render tạm |
| Export | PNG/JPG/WebP, tên file, quality lossy, nền JPG, output đúng W×H |
| Draft | Một draft IndexedDB theo origin/profile, restore/recovery và bảo vệ nhiều tab |
| UX | Responsive, keyboard/touch, accessibility, trạng thái lỗi và xác nhận reset/thay ảnh |

### 4.2. P1 hoặc ngoài phạm vi hiện tại

Không tự thêm nhiều ảnh, import URL/clipboard, HEIC/RAW/GIF/SVG, canvas trắng, rich text, vẽ tay, sticker, group/mask/blend, rotate tài liệu góc bất kỳ, resize méo, batch/ZIP/PDF/SVG export, target KB, nhiều project, cloud sync, login, payment, AI, PWA/service worker hoặc collaboration.

Local-first cho phép tiếp tục thao tác sau khi app/font/engine đã tải; chưa bảo đảm mở lại/reload website khi offline. IndexedDB không phải backup vĩnh viễn và không chuyển draft sang thiết bị/domain khác.

## 5. Quy trình nhận và thực hiện task

1. Xác nhận đúng thư mục, nhánh, HEAD, trạng thái tracked/untracked và remote khi công việc liên quan Git.
2. Đọc hướng dẫn repository nếu có; đọc PRD, roadmap và toàn bộ các file/caller mà thay đổi sẽ tác động.
3. Truy vết UI → command → scene/header → snapshot/history → draft/export. Với bug, tìm tất cả caller của phần định sửa trước khi chọn vị trí sửa.
4. Trình bày kế hoạch trước khi code: mục tiêu, phạm vi, file dự kiến, dependency thực sự cần, AC, cách kiểm chứng và giới hạn.
5. Tận dụng code/helper/pattern đã tồn tại; chọn browser API hoặc dependency đã có trước khi thêm mới.
6. Thực hiện thay đổi nhỏ nhất đáp ứng đầy đủ hành vi. Giữ công việc sẵn có; không sửa unrelated file hoặc chuyển stack ngoài phạm vi.
7. Kiểm tra phần bị tác động và regression liên quan trong phạm vi được giao. Khi task chỉ là tài liệu, kiểm tra nội dung/link/cấu trúc thay vì chạy build ứng dụng.
8. Đọc lại diff và cập nhật tài liệu liên quan khi hành vi, setup, giới hạn hoặc kết quả kiểm chứng thay đổi.
9. Bàn giao ngắn gọn bằng tiếng Việt: thay đổi, file, kiểm tra thực tế, AC đạt/chưa đạt, blocker và bước phù hợp tiếp theo.

Không dùng ngày roadmap như deadline cứng. Gate chưa đạt thì cập nhật vấn đề/ước lượng và xử lý nguyên nhân; không tự chuyển sang feature phụ thuộc để tạo cảm giác tiến độ.

## 6. Stack và dependency

Stack mặc định đề xuất của PRD là React, TypeScript strict, Vite, Fabric.js, CSS Modules/CSS variables, IndexedDB native, Vitest và Playwright. Static host HTTPS chỉ phục vụ app/assets.

- Kiểm tra manifest/lockfile thực tế trước khi chọn phiên bản. Khi khởi tạo, xác minh tài liệu chính thức và yêu cầu Node hiện hành rồi pin phiên bản; ghi Node trong setup.
- Không ghép ví dụ Fabric v5 với API modular/async của phiên bản mới mà không kiểm tra migration.
- React render DOM; Fabric quản lý canvas/scene. Canvas instance nằm trong ref/runtime, không trong React state hay IndexedDB.
- Không cài đồng thời Fabric và Konva hoặc thêm React wrapper chỉ vì tiện ví dụ.
- CSS Modules là mặc định đề xuất. Nếu có quyết định dùng Tailwind, sử dụng nhất quán một hệ thống; không đưa framework CSS vào chỉ để giải quyết vài control.
- Không thêm Redux/Zustand, DI framework, command bus, plugin framework, repository/domain layers, worker framework hoặc DB server khi nhu cầu hiện tại chưa cần.
- Worker/OffscreenCanvas chỉ xem xét sau số đo cho thấy main thread không đạt gate.
- Khóa dependency bằng lockfile; không dùng nâng cấp dependency làm thay đổi phụ trong task khác.

## 7. Kiến trúc và trách nhiệm module

Luồng đích theo PRD:

```text
File local → validation/decode → source asset + proxy preview
UI → editor commands/transaction → Fabric scene + document header
scene/header → snapshot adapter → history trong RAM
snapshot + source → draft coordinator → IndexedDB → validate/restore
snapshot cố định + source đầy đủ → export canvas riêng → Blob → browser download
```

| Phần | Trách nhiệm | Ranh giới |
|---|---|---|
| UI/pages/panels | Form pending, tool, dialog, copy, accessibility, view model | Không gọi IndexedDB trực tiếp hoặc giữ bản sao đầy đủ scene |
| Editor engine | Lifecycle, commands, commit boundary, scene/header | Không biến thành component React lớn chứa tất cả trách nhiệm |
| Geometry | Crop/resize/rotate/flip theo document px | Không biết DOM, React hoặc screen coordinates |
| Image/assets | Validation, decode, EXIF, immutable source, proxy và cleanup | Không upload nguồn lên mạng |
| Filters | Recipes/version, preset/adjust pipeline | Native filters là dữ liệu suy ra |
| Snapshot | Chuẩn hóa serialize/restore, asset binding, validation | Loại dữ liệu runtime, URL ngoài và proxy-only scale |
| History | Undo/redo pointer, snapshot, branch/no-op/limits | Không sao chép bitmap vào mỗi bước |
| Persistence | Transaction IndexedDB, revision, lease, save/restore | Không thao tác DOM hoặc hứa storage bền vĩnh viễn |
| Export | Render full-resolution, font/filter readiness, encode/MIME | Không dùng bitmap preview làm nguồn output |

Cây thư mục trong PRD mục 29 là cấu trúc gợi ý. Chỉ tạo file/folder khi task dùng tới. Các vị trí đích chính: `src/app`, `src/pages`, `src/features/editor/{components,panels,engine,persistence}`, `public/fonts`, `tests`, `docs`. Không scaffold cả cây hoặc module tương lai từ ngày đầu.

Nguồn state chuẩn:

- Fabric scene: geometry, overlay, z-order, visibility.
- Document header/metadata ảnh nền: W/H, source asset, preset/adjust chuẩn.
- React: tool/panel/dialog, form pending và view model nhỏ.
- Runtime: viewport/selection, documentId, generation, revision, history pointer và jobs.
- Draft coordinator + transaction: savedRevision và quyền ghi draft.

## 8. Bất biến bắt buộc của dữ liệu

1. Một document luôn có một source-image; nguồn Blob bất biến.
2. Document px độc lập CSS canvas, devicePixelRatio, zoom và pan.
3. Geometry đổi toàn composition, kể cả overlay hidden/off-canvas; filter/adjust chỉ đổi ảnh nền.
4. Overlay ngoài khung được clip, vẫn tồn tại trong scene/Layers.
5. Viewport/selection/panel/compare không được persist vào snapshot hoặc sinh history.
6. Snapshot và history không chứa bitmap/Base64, event handler, cache, controls, viewport, URL remote hoặc native filter trùng với imageAppearance.
7. Một user action tạo tối đa một history step; no-op không tạo commit.
8. Revision tăng khi commit/undo/redo, không giảm chỉ vì nội dung được undo.
9. Save cũ/async từ document cũ không ghi đè state mới; kết quả được kiểm bằng generation/revision.
10. Lỗi import/restore/save/export giữ document hiện tại và dữ liệu phục hồi được; tài nguyên ứng viên thất bại phải được dọn.
11. Không âm thầm giảm resolution, đổi format, đổi font hoặc xóa draft để che lỗi.
12. Thành công phải gắn đúng ý nghĩa: transaction complete mới SAVED; tạo Blob/yêu cầu download không chứng minh user đã lưu trên ổ đĩa.

## 9. Import, viewport và geometry

### 9.1. Import

- Validate đúng một file → byte size → header/MIME → metadata dimensions/animation → decode → dimensions sau EXIF → document ứng viên → xác nhận thay → fit.
- `accept`, extension và `File.type` không thay validation. Parser có kiểm bounds/length, decoder vẫn phải bắt lỗi.
- Từ chối APNG/WebP động và các định dạng ngoài P0; không tự lấy file đầu khi thả nhiều file.
- Normalize EXIF một lần; giữ alpha; không dùng GPS hoặc sao chép metadata vào output.
- Hủy picker không là lỗi; lỗi decode/thay ảnh bị hủy giữ document/draft cũ.

### 9.2. Viewport và selection

- Fit sau import/crop; zoom tương tác 10–400%, cho phép Fit thấp hơn 10% khi cần.
- Hit test/drag/crop đảo viewport transform để dùng document coordinates.
- Desktop Space+drag pan khi không nhập text; wheel không tạo scroll trap. Mobile có chế độ pan và nút Fit.
- Chọn một overlay; ảnh nền không draggable/selectable; Layers chọn được hidden/off-canvas object.

### 9.3. Crop/resize/rotate/flip

- Crop chỉ trong document, tối thiểu 1 px; Free làm tròn biên và kiểm bounds; fixed ratio dùng bội nguyên của ratio rút gọn.
- Crop `(x0,y0,w,h)` đổi document sang w×h và dịch toàn scene `(-x0,-y0)`, không rasterize text/shapes.
- Crop pending khóa command xung đột; Apply một commit, Cancel/Escape không thay document/history.
- Resize giữ tỷ lệ; sửa một cạnh, cạnh kia làm tròn; dùng scale đồng đều cho source/text/shape/stroke. Không kéo circle thành ellipse do rounding.
- Validate empty, NaN, infinity, số âm/thập phân và limits ở command boundary; không chỉ ở form.
- Rotate ±90° đổi W/H; flip giữ W/H; transform cả object gồm angle/scale/flip/stroke, không chỉ left/top.
- Upscale phải thông báo không tạo thêm chi tiết. Resize nhỏ rồi lớn vẫn render từ source.

## 10. Adjust, preset, text, shapes và layers

### 10.1. Adjust/preset

- Brightness/Contrast/Saturation: UI −100…100, bước 1, mặc định 0; mapping đề xuất UI/100, clamp theo engine đã pin.
- Preset theo PRD mục 17: Mode → RGB gain → preset B/C/S; sau đó user B/C/S. Không đổi thứ tự tùy tiện.
- Giữ alpha và màu overlay; thumbnail lấy ảnh hiện tại đã chuẩn hóa/crop, không dùng stock image.
- Original chỉ tắt preset; Reset Adjust chỉ về ba slider 0; chọn lại giá trị đang dùng là no-op.
- Một drag/keyboard interaction gom thành một commit; Escape revert gesture. Numeric input commit Enter/blur.
- Preview schedule theo frame và giữ giá trị cuối; không queue mọi input event.
- `presetVersion` ban đầu 1; đổi recipe cần version và đường restore cũ, không âm thầm đổi màu draft cũ.

### 10.2. Text/IME/font

- Textbox multiline plain text, một style, tối đa 2.000 Unicode code point; không diễn giải HTML/Markdown.
- Font đề xuất Noto Sans/Noto Serif self-host với đủ glyph/kiểu tiếng Việt, có license thực tế.
- Font size 8–512 document px; scale đồng đều, textbox width điều khiển wrap; properties có X/Y/góc/nội dung.
- Mobile ưu tiên textarea; một phiên edit có một nguồn nhập active.
- IME composition không kích hoạt undo/commit toàn editor; undo khi textarea focus thuộc native input. Enter của multiline thêm newline.
- Kết thúc phiên sửa mới gom history; textbox trống được loại trong cùng transaction và có thể undo.
- Đổi panel/export phải hoàn tất phiên nhập, không làm mất chữ pending. Chờ font trước đo/render/export; lỗi font có retry/đổi font.

### 10.3. Shapes/layers

- Rectangle, circle, line; stroke 0–50 px, riêng line >0; opacity 0–100%; fill có thể transparent.
- Kích thước mặc định thích ứng ảnh; không tạo width/height 0 hoặc NaN. Circle giữ hình tròn.
- Tổng text/shape không quá giới hạn overlay. Một add/delete/gesture/property interaction là một commit.
- Layers topmost trước, background cuối. Background có thể ẩn nhưng không xóa/reorder; overlay được lên/xuống một bậc.
- Hidden object không hit-test/export; chọn từ Layers không tự bật visibility. Boundary reorder là no-op.

## 11. Transaction, history và lifecycle

Transaction chung: baseline snapshot → live preview → kết thúc interaction → so baseline → push history/tăng revision/publish view model/lên lịch save.

- Native Fabric event và toolbar command đi qua cùng commit boundary; tránh ghi đôi.
- History giữ trạng thái hiện tại cộng tối đa 50 snapshot trước; phụ giới hạn 10 MiB JSON, bỏ cũ nhất và thông báo.
- Undo/redo restore toàn snapshot: document geometry, appearance, visibility và z-order. Sửa sau undo bỏ redo branch.
- Replay khóa listener commit và chờ restore xong; save chạy cho revision undo/redo mới.
- Import document mới tạo baseline/history mới; reload chỉ phục hồi snapshot mới nhất.
- Một canvas instance/editor mount; đăng ký listener một lần, cleanup listener/observer/bitmap/canvas khi unmount; chịu được StrictMode lặp mount/cleanup.
- Generation guard cho import/restore/filter/export; dispose/load theo API async của phiên bản engine thực tế.
- Reset tất cả về source đã normalized, Original, adjust 0, nền visible, bỏ overlays: một commit undo được; baseline sẵn thì no-op.

## 12. Snapshot, contract nội bộ và IndexedDB

Snapshot khái niệm theo PRD mục 30 gồm `schemaVersion`, `appVersion`, `rendererVersion`, document `{width,height,sourceAssetId}`, imageAppearance `{presetId,presetVersion,brightness,contrast,saturation}` và scene từ dưới lên.

Scene object giữ ID, role `source-image|text|shape`, assetRef cho source và nativeData được allowlist. Runtime validation phải kiểm finite numbers, limits, một source, unique ID, assetRef, font/text/preset/version và type/fields của engine. TypeScript không thay runtime validation storage.

Source asset giữ ID, immutable Blob, MIME đã kiểm, bytes, W/H sau EXIF, tên gốc local và createdAt. Không persist nhiều bitmap/proxy lớn. Migration cần version/fixture; nếu chưa hỗ trợ schema, recovery giữ dữ liệu cũ.

| Command khái niệm | Trách nhiệm |
|---|---|
| `importImage` | File + generation → candidate asset/document hoặc domain error |
| `applyCrop`, `resizeDocument`, `rotateDocument`, `flipDocument` | Geometry toàn document qua transaction |
| `setImageAppearance` | Preset/sliders → native filter suy ra và commit boundary |
| `addText`, `addShape`, `updateObject` | Object ID, allowlisted properties, preview/commit |
| `setVisibility`, `moveLayer`, `deleteObject` | Action hợp lệ hoặc no-op |
| `undo`, `redo`, `getSnapshot`, `restoreSnapshot` | Roundtrip snapshot/scene đã validate |
| `saveDraft`, `loadDraft`, `deleteDraft` | Transaction source/snapshot/lease và save state |
| `exportImage` | Immutable snapshot/options → Blob đúng MIME |

Đây là tên hàm khái niệm; thiết kế cụ thể theo implementation plan và code có sẵn. Giữ hành vi/AC khi điều chỉnh API. Async dùng Promise và lỗi domain nhất quán `{code,userMessage}`.

IndexedDB đề xuất `miniphoto-local`, version 1:

| Store | Key | Dữ liệu |
|---|---|---|
| `assets` | Asset ID | Blob/metadata của draft hiện tại |
| `drafts` | `current` | Snapshot, asset ID, thumbnail, timestamps, revision |
| `meta` | `draft-owner` | ownerSessionId và lease expiry |

- Import/thay/xóa document dùng transaction atomic trên các store liên quan; không xóa nguồn cũ trước khi nguồn mới lưu thành công.
- Source lưu một lần; sau commit chỉ cập nhật snapshot/thumbnail; autosave debounce đề xuất 800 ms, latest revision thắng.
- SAVED chỉ khi transaction complete và revision vẫn mới nhất; thay đổi trong lúc save tiếp tục DIRTY.
- Save lỗi giữ draft cũ, banner bền và khả năng export RAM. Không coi tab close/beforeunload là bảo đảm flush.
- Restore: schema → asset → limits → object/font/preset → scene usable → fit; không khôi phục history phiên cũ.
- Draft hỏng không tự xóa; cho recovery/mở lại source hoặc bỏ draft bằng xác nhận.
- Lease timeout đề xuất 60 s; quyền ghi được kiểm trong transaction. Tab khác có thể edit/export RAM nhưng không autosave.
- Tab mất lease không tự chiếm quyền khi quay lại; thay draft bằng nội dung tab này cần hành động và xác nhận của người dùng sản phẩm.
- BroadcastChannel không thay kiểm quyền trong transaction. Không merge/sync realtime hai document.

## 13. Export và compare

Export: hoàn tất edit/gesture → xử lý pending crop/resize → thoát compare → immutable snapshot/revision → chờ font/source/filter → render canvas riêng W×H → encode → kiểm MIME/Blob/decode → download/fallback link → cleanup.

- PNG/WebP giữ alpha; JPG composite trên nền đặc người dùng chọn, mặc định trắng.
- Default PNG khi có alpha/nền ẩn, còn lại JPG. Quality JPG/WebP 1–100 mặc định 90; không hiện quality cho PNG.
- Kích thước export readonly theo document; muốn đổi mở Resize. Preview export có cạnh tối đa đề xuất 1200 px.
- Filename loại path separators/control chars, trim, giới hạn 100 ký tự, fallback `miniphoto-edited`, đuôi đúng format.
- Kiểm encoder capability và MIME thực tế; không download PNG mang đuôi WebP.
- Output không chứa handles/grid/checkerboard; không phụ thuộc zoom/DPR/proxy; hidden layers không xuất.
- Khóa sửa document và export lặp trong job; đóng dialog chỉ bỏ nhận kết quả nếu encode không cancel được.
- Source/filter vượt WebGL limit hoặc mất context dùng CPU fallback; không âm thầm giảm output.
- URL/bitmap/export canvas chỉ release sau khi download/link không còn cần; byte size chỉ báo khi Blob thật tồn tại.

Compare giữ geometry/viewport, tạm bỏ preset/sliders, ẩn overlay và hiển thị nền dù background đang hidden. Nó không mutate scene/history/draft. Release pointer, cancel hoặc mất focus trả edited; export luôn lấy edited snapshot. Nhãn giải thích đây là ảnh trước chỉnh màu với cùng hình học hiện tại.

## 14. Giới hạn và trạng thái lỗi

| Thông số | Giá trị PRD / ghi chú |
|---|---|
| Source | ≤20 MiB; static JPEG/PNG/WebP |
| Document/import/restore/resize/export | Mỗi cạnh 1–8192 px; tổng ≤12.000.000 px |
| Overlay | ≤50 text/shape |
| History | ≤50 undo steps và ≤10 MiB JSON |
| Text | ≤2.000 Unicode code point/textbox; font size 8–512 px |
| Draft | Source ≤20 MiB, snapshot ≤1 MiB, thumbnail ≤256 KiB |
| Proxy preview | Mục tiêu cạnh ≤2048 px; có thể ≤1280 px trên mobile khi cần |
| Autosave/lease | Debounce khoảng 800 ms; lease timeout đề xuất 60 s |

Các giá trị đề xuất cần số đo/điều chỉnh minh bạch trước release. Validate ở import/restore/command/export; thay breakpoint không làm đổi document/limits đang mở.

Document lifecycle: `EMPTY → IMPORTING → READY`; restore `RESTORING → READY` hoặc recovery. Crop pending/export/replay khóa action phù hợp trên document READY. Save state độc lập: `NOT_SAVED`, `DIRTY`, `SAVING`, `SAVED`, `SAVE_ERROR`, `OTHER_TAB_OWNER`.

| Error code | Phục hồi bắt buộc |
|---|---|
| `MULTIPLE_FILES`, `UNSUPPORTED_FORMAT`, `ANIMATED_IMAGE` | Báo loại/số file được hỗ trợ, chọn lại; giữ document |
| `FILE_TOO_LARGE`, `IMAGE_TOO_LARGE` | Báo giới hạn, hướng dẫn giảm trước; không tự downsample |
| `DECODE_FAILED` | Chọn/chuyển định dạng; không xóa document cũ |
| `INVALID_SIZE`, `OVERLAY_LIMIT` | Lỗi đúng field/phạm vi; sửa input/xóa bớt overlay |
| `FONT_LOAD_FAILED` | Retry/đổi font; không export fallback âm thầm |
| `SAVE_QUOTA`, `SAVE_FAILED` | Giữ draft cũ; banner và export kết quả hiện tại |
| `DRAFT_INVALID` | Recovery, mở source nếu hợp lệ hoặc bỏ draft có xác nhận |
| `OTHER_TAB_OWNER` | Dừng autosave tab này; thông báo lựa chọn đúng |
| `WEBGL_UNAVAILABLE` | Fallback tương thích, giữ output đúng |
| `OUT_OF_MEMORY`, `EXPORT_FAILED` | Giữ state, retry/format khác hoặc resize chủ động |

Lỗi field gần field; mất khả năng save có banner bền. Diagnostic loại dữ liệu riêng tư. Không reset editor tổng quát khi gặp exception.

## 15. UI, responsive và accessibility

- Route đích `/`, `/editor`, `/privacy`; export/resume/confirm/help là dialog/bề mặt UI, panel tool không thành route riêng.
- Theme đề xuất Home sáng, Editor tối trung tính. Token ban đầu theo PRD: `#F8FAFC`, `#111827`, `#1F2937`, `#F9FAFB`, `#CBD5E1`, accent `#2563EB`, border `#475569`; đo contrast thực tế.
- Spacing 4/8/12/16/24 px; font UI 14–16 px; target touch ≥44×44 CSS px; icon có accessible name và tooltip phù hợp.
- Desktop ≥1024 px: topbar, toolbar, canvas, properties/layers; tablet 768–1023 px dùng drawer; mobile <768 px dùng thanh công cụ và bottom sheet.
- Mục tiêu nhỏ nhất 360 CSS px; bottom sheet khoảng tối đa 45% viewport khi không có bàn phím; theo dõi visual viewport và safe area.
- Label/form errors, visible focus, keyboard navigation, dialog focus trap/return focus và live region cho status; không chỉ dùng màu truyền trạng thái.
- Layers + numeric X/Y/angle/size cung cấp đường thao tác object qua keyboard. Arrow move 1 px, Shift+Arrow 10 px khi canvas focus.
- Undo Ctrl/Cmd+Z; redo Ctrl/Cmd+Shift+Z, Ctrl+Y trên Windows; Delete/Backspace chỉ khi scene focus. Không chiếm phím input/contenteditable/IME.
- Textarea mobile, pointer cancel/blur cho compare, pan mode và Fit phải dùng được bằng touch.
- Mọi trạng thái PRD mục 10.6 được thể hiện; không tạo phần trăm loading giả nếu API không cung cấp tiến độ.

## 16. Quyền riêng tư và tài nguyên

- File/pixel/text/snapshot chỉ ở RAM và IndexedDB; export Blob tải local. Host vẫn nhận request tải app và metadata network tùy cấu hình.
- Không gửi ảnh/draft/tên file/text vào telemetry, console, query string, diagnostic hoặc analytics.
- Không render filename/text qua innerHTML; không load remote URL trong snapshot/restore; font self-host.
- Không đưa API key/provider secret vào frontend. AI/cloud cần yêu cầu riêng về privacy, auth, quota và chi phí.
- Privacy copy mô tả đúng local draft, dùng máy chung, cách xóa, quota/private mode/eviction và origin isolation.
- Đóng gói license/attribution cho engine/font/icon/fixtures; không dùng ảnh cá nhân nhạy cảm làm fixture.
- Production HTTPS, security headers/CSP phù hợp module/blob/font/style của app và được kiểm trên candidate.
- Cleanup event listener, object URL, ImageBitmap, observer, temporary canvas theo lifecycle; không revoke asset/URL còn được dùng.

## 17. Roadmap, backlog và gate

| Phase | Ngày cơ sở | Backlog chính | Gate |
|---|---|---|---|
| 0 — Spike | 1–3 | B01 | EXIF/alpha, geometry có overlay, source/proxy snapshot, full export và Blob roundtrip bằng file thật |
| 1 — Nền tảng | 4–8 | B02–B05; rotate/flip thuộc B06 | Responsive shell, import/viewport/history, PNG/JPG export và undo đúng |
| 2 — Chỉnh ảnh | 9–14 | B06–B07 | Crop/resize/adjust/preset đúng geometry, màu, alpha và source fidelity |
| 3 — Creative | 15–20 | B08–B09 | Text/IME/font, shapes/layers/properties/keyboard và export đúng |
| 4 — Hoàn thiện | 21–25 | B10–B11 | Draft/lease/recovery, WebP, compare/error UI và mobile touch |
| 5 — QA/pilot/release | 26–30 | B12 | AC/evidence, browser/device, performance/privacy, pilot và release candidate |

30 ngày là phân bổ đề xuất trong 24–36 ngày công PRD, chưa kể dự phòng 15–25%; không gán lịch ngày tháng khi chưa có ngày bắt đầu/nhịp làm việc.

Các ngày 26–30 gom regression/QA toàn sản phẩm. Viết/chạy checks trọng yếu ngay trong phase có logic tương ứng khi phạm vi cho phép; không đợi ngày 26 mới kiểm geometry/history/export. Nếu chỉ được giao một ngày, không tự chạy hết phase sau. Phase 0 dùng harness tối thiểu để chứng minh rủi ro, không coi prototype là MVP.

## 18. Ma trận nghiệm thu AC-01–42

Các dòng dưới đây là mục tiêu kiểm chứng, không đánh dấu đã đạt. Chi tiết Given/When/Then theo PRD mục 34.

| AC | Nội dung cần chứng minh |
|---|---|
| AC-01 | Import static JPG/PNG/WebP đúng orientation/dimensions/Fit |
| AC-02 | Header/animation/empty/size/MP sai bị từ chối, document/draft cũ còn nguyên |
| AC-03 | Multiple files/hủy picker không tự thay document |
| AC-04 | Export W/H và nội dung độc lập zoom/DPR |
| AC-05 | Pointer qua zoom/pan dùng đúng document coordinates |
| AC-06 | Crop có overlays dịch/clip/z-order đúng, undo phục hồi |
| AC-07 | Cancel/Escape crop không đổi snapshot/history/draft |
| AC-08 | Crop ratio integer/bounds đúng, ratio không thể chứa bị disable |
| AC-09 | Resize scale đồng đều circle/text/line, pixel output và undo đúng |
| AC-10 | Resize input sai/limits không đổi document, báo field error |
| AC-11 | Rotate/flip biến đổi cả hidden/off-canvas object, giữ stack |
| AC-12 | Rotate 4 lần/flip 2 lần trở về geometry trong tolerance |
| AC-13 | 100 slider input events kết thúc đúng giá trị, một history step |
| AC-14 | Slider không đổi overlay/alpha; Reset Adjust giữ preset/crop |
| AC-15 | Preset + slider đúng thứ tự; Original chỉ tắt preset |
| AC-16 | Thumbnail/export cùng recipe/version |
| AC-17 | Text tiếng Việt/multiline/IME/font và export đúng |
| AC-18 | Undo trong textarea thuộc native input, không undo scene |
| AC-19 | Font pending/error làm export đợi/báo lỗi, không fallback âm thầm |
| AC-20 | Shape properties preview/output đúng, không NaN/zero-invalid |
| AC-21 | Hide/delete/reorder phản ánh output; background không xóa/reorder |
| AC-22 | Hidden/off-canvas layer chọn/sửa được, không tự bật visibility |
| AC-23 | Chuỗi geometry/adjust/text/reorder undo/redo toàn snapshot |
| AC-24 | Edit sau undo xóa redo; no-op/zoom/export không thêm history |
| AC-25 | Giới hạn history bỏ cũ nhất, giữ hiện tại và source còn dùng |
| AC-26 | Compare pointer cancel/blur về edited, không đổi history/snapshot |
| AC-27 | PNG/WebP output decode lại có alpha/W/H đúng |
| AC-28 | JPG alpha có background chọn và MIME JPEG thật |
| AC-29 | Encoder WebP trả PNG bị phát hiện, không tải đuôi WebP sai |
| AC-30 | Full source export từ proxy đúng chữ, không controls/checkerboard |
| AC-31 | Encode/font/memory failure giữ document/draft và retry được |
| AC-32 | Commit báo SAVED → reload/restore đúng source/scene/appearance |
| AC-33 | Save lỗi không báo SAVED, giữ draft cũ và export RAM được |
| AC-34 | Draft thiếu asset/schema lạ có recovery, không tự xóa |
| AC-35 | Tab cũ mất lease không ghi đè draft mới |
| AC-36 | Hủy/thất bại thay ảnh không để draft trỏ asset đã xóa |
| AC-37 | Reset tất cả về source baseline, một undo phục hồi composition |
| AC-38 | Mobile 360 px + keyboard vẫn truy cập tool/download |
| AC-39 | Keyboard-only dùng layers/X/Y/crop/slider/dialog/export |
| AC-40 | Network audit import/edit/save/export không gửi pixel/Blob/text/snapshot |
| AC-41 | StrictMode/lifecycle/async document cũ không trùng canvas/listener hoặc ghi đè |
| AC-42 | Snapshot proxy → full source restore đúng extent/transform |

## 19. Kiểm chứng và cách ghi evidence

Fixtures tối thiểu: JPEG ngang/dọc; EXIF 1–8; PNG alpha bán trong suốt; static WebP; APNG/animated WebP; sai extension/header; corrupt/empty; 1×1; 4000×3000; vượt 12 MP/8192 cạnh; color fixture; text tiếng Việt. Chỉ lưu fixtures có quyền sử dụng.

- Unit/core: geometry, ratio/rounding, history branch/no-op/limits, snapshot normalization, preset version và validation.
- Integration: IndexedDB rollback/revision/lease, source binding, import/restore races và storage recovery.
- E2E: geometry+màu+export; text+shape+layers+history+export; autosave+reload+restore. Quan sát download và mở/decode file.
- Manual: thiết bị thật, keyboard/touch/IME, font, screen reader, pointer cancellation, download, WebGL/CPU/memory fallback.
- Chọn checks phù hợp thay đổi; tái chạy/mở rộng khi có diff mới, lỗi hoặc concern còn mở. Không dựng suite lớn chỉ để mirror code.
- Build/typecheck/lint không chứng minh editor đúng; screenshot không thay file output; emulation không thay Android/iOS thật; mock quota không chứng minh quota thật.
- Ghi câu lệnh thực tế, kết quả/exit code, commit/version, fixture, device/browser và phạm vi. Historical evidence phải có nhãn lịch sử, không gọi là rerun.

Mục tiêu performance trên JPEG 2048×1536 ≤3 MiB, 5 overlay theo PRD; phải ghi cấu hình đo:

| Metric | Desktop | Mobile |
|---|---|---|
| Home usable cold cache Fast 4G | ≤2,5 s | ≤2,5 s trên profile mô tả |
| Import usable | ≤2 s | ≤4 s |
| Slider preview p95 | ≤150 ms | ≤250 ms |
| Object drag | ≥30 fps | ≥30 fps |
| Export fixture 3 MP | ≤3 s | ≤6 s |
| Restore sau app load | ≤3 s | ≤5 s |
| Main-thread freeze/tác vụ | Không >1 s | Không >1 s |

Không suy mục tiêu 3 MP cho 12 MP; đo riêng biên 12 MP, memory/failure và điều chỉnh limits nếu cần. GPU/CPU màu dùng tolerance phù hợp, không đòi file PNG byte-identical giữa browser.

Browser QA đề xuất: Chrome/Edge/Firefox desktop và Safari macOS/iOS hai major gần release, Chrome Android gần release; ghi exact versions đã chạy. Viewports: 360×800, 390×844, 768×1024, 1366×768, 1920×1080; portrait/landscape và bàn phím.

## 20. Lệnh làm việc trên Windows

Các lệnh sau là mẫu; chỉ chạy khi phù hợp phạm vi và file/script thực tế tồn tại. Repository ở giai đoạn tài liệu chưa có các npm scripts này.

```powershell
Get-Location
git status --short --branch
git branch --show-current
git rev-parse --verify HEAD
rg --files --hidden -g '!.git/**' -g '!node_modules/**' -g '!build/**' -g '!dist/**'
```

Sau khi project/setup đã được triển khai và task cho phép:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run test:e2e
npm.cmd run build
```

Đọc `package.json` trước, không báo script tồn tại khi chưa có. Dùng `npm.cmd`/`npx.cmd` nếu PowerShell chặn `.ps1`; không đổi ExecutionPolicy toàn máy chỉ để chạy npm. Server/dev/preview chỉ khởi động khi cần trong task, quản lý lifecycle và không để process phụ chạy sau bàn giao.

Nếu runner không khởi tạo được hoặc sandbox bị lỗi, ghi đúng lệnh chưa chạy; không suy đó là Git owner mismatch. Kiểm tra thông báo/owner trước khi sửa quyền. Chỉ dùng fallback được môi trường cho phép; không đổi config toàn máy để che lỗi.

## 21. Git và bảo toàn công việc

- Repository remote hiện dùng GitHub `KhanhNguyen130804/MiniPhoto-Editor`; kiểm tra `git remote -v` trước publish thay vì tin thông tin tĩnh.
- Kiểm tra staged/unstaged/untracked trước và sau task. Giữ `docs/roadmap.md` và mọi file sẵn có; không overwrite thay đổi của người dùng.
- Không reset hard, clean, stash hoặc checkout/restore để xóa công việc sẵn có. Khi cần branch mới, mặc định prefix `codex/`, theo tên người dùng yêu cầu nếu có.
- Không đổi Git identity global, safe.directory global, owner/ACL hoặc origin ngoài task được giao.
- Commit/push thực hiện khi người dùng giao hành động đó; ủy quyền commit một tệp trước đây không tự mở rộng sang mọi thay đổi tương lai.
- Stage đường dẫn cụ thể; đọc staged diff, kiểm `git diff --cached --check`, scope và credential patterns trước commit. Không dùng `git add .` khi có file unrelated.
- Commit message mô tả đúng phạm vi, ví dụ `docs: ...`, `feat(editor): ...`, `fix(export): ...`.
- Push nhánh đã chọn, không force push theo mặc định. Nếu remote có thay đổi, xử lý divergence và giữ lịch sử; không ghi đè để làm push pass.
- Sau push so local HEAD với `git ls-remote origin refs/heads/<branch>`, kiểm divergence/status; báo commit và push riêng.
- Không đưa ảnh cá nhân, source Blob, secrets, raw sensitive logs, generated build/node_modules/dist hoặc local cache vào repository.

## 22. Tài liệu, tiến độ và bàn giao

- PRD chỉ cập nhật khi hành vi/phạm vi/quyết định thay đổi được giao; không viết lại để hợp thức hóa implementation thiếu AC.
- Roadmap cập nhật tiến độ đúng ngày/phase được làm; lịch đề xuất không chứng minh hoàn thành. Ghi gate chưa đạt và điều chỉnh lịch minh bạch.
- README được tạo/cập nhật khi setup thật có Node/scripts/limits và browser evidence; QA_RELEASE ghi commit/version, fixtures, devices, checks, AC và lỗi còn lại khi bắt đầu ghi QA.
- Chỉ tạo tài liệu plan/evidence bổ sung khi task cần. Một bản ghi đủ rõ có thể phục vụ cả kế hoạch và kết quả; không sinh nhiều file trùng nội dung.
- Giữ ngày giờ theo Asia/Saigon và ghi rõ nếu ngày công là số thứ tự thay vì ngày lịch.
- Dùng trạng thái rõ: chưa bắt đầu; đang làm; đã có mã/chưa kiểm chứng; đã kiểm chứng trong phạm vi; bị chặn/chưa chạy. Không đồng nhất implemented với verified.

Mẫu kế hoạch trước implementation:

```text
Task/ngày/phase và backlog:
Mục tiêu, phạm vi và FR/AC:
Hiện trạng/caller cần tác động:
Các bước, file và dependency cần thiết:
Quy tắc dữ liệu/hành vi cần giữ:
Checks và evidence dự kiến:
Giả định/blocker ảnh hưởng phần phụ thuộc:
```

Mẫu bàn giao:

```text
Đã thay đổi: file và hành vi cụ thể.
Đã kiểm tra: command/fixture/browser/device và kết quả.
AC: đạt trong phạm vi nào; còn thiếu/chưa chạy gì.
Gate: đạt/chưa đạt và lý do.
Git: uncommitted/commit/push, SHA nếu thực hiện.
Bước tiếp theo trong phạm vi roadmap.
```

## 23. Deploy, release và checklist hoàn thành

- Deploy candidate frontend static HTTPS theo host được chọn, output theo build config thực tế; Cloudflare Pages trong PRD là ví dụ, chưa phải quyết định vendor.
- SPA fallback cho `/editor`/`/privacy`; kiểm assets/fonts/cache/headers/CSP/download trên candidate.
- Draft tách theo origin; localhost/preview/production không dùng chung dữ liệu. Domain change/rollback/schema compatibility cần ghi trong release plan.
- Chỉ production publish khi phạm vi triển khai được người dùng giao và release gate có evidence. Không dùng roadmap để tự suy quyền publish.
- Không tuyên bố mọi browser, offline hoàn toàn, privacy hoàn tất hoặc device UX đạt khi thiếu bằng chứng tương ứng.

Checklist trước khi kết thúc một task implementation:

- [ ] Đúng checkout/phạm vi và bảo toàn thay đổi sẵn có.
- [ ] Kế hoạch/giả định rõ; chỉ tạo module/dependency đang cần.
- [ ] Data invariants và source fidelity được giữ.
- [ ] Validation, async guards, cleanup và recovery phù hợp.
- [ ] AC/checks liên quan có kết quả hoặc giới hạn trung thực.
- [ ] File output/draft/device evidence đúng lớp kiểm chứng.
- [ ] Diff và tài liệu phù hợp thay đổi; không có dữ liệu nhạy cảm.
- [ ] Git actions chỉ trong ủy quyền; remote SHA xác nhận nếu đã push.
- [ ] Gate/progress/bàn giao phản ánh đúng việc đã hoàn thành.

Mọi mục chưa đạt phải được ghi rõ. Không hạ acceptance hoặc bỏ bảo vệ dữ liệu để gọi task/MVP hoàn thành.
