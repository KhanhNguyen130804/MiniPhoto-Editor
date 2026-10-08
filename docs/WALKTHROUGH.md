# MiniPhoto Editor — Walkthrough

Ngày ghi nhận: **09/10/2026**, Asia/Saigon.

Tài liệu ghi lại kết quả khảo sát và các bước đã triển khai. Repository hiện có app shell Day 4, canvas lifecycle/viewport Day 5, import Day 6, history Day 7, geometry/pan/export Day 8, crop Day 9–10, resize Day 11–12, adjust Day 13, preset màu Day 14, textbox Day 15, text properties Day 16, shape editor Day 17, Layers panel Day 18 và autosave/status Day 21. UI restore draft chưa triển khai. Walkthrough phân biệt phần đã triển khai, bằng chứng harness và hành vi UI đã kiểm.

## 1. Kết quả hiện có

| Tệp | Vai trò |
|---|---|
| [PRD_MINIPHOTO_EDITOR.md](../PRD_MINIPHOTO_EDITOR.md) | Đặc tả sản phẩm, FR, dữ liệu, kiến trúc, 42 AC và release gate |
| [docs/roadmap.md](roadmap.md) | Kế hoạch triển khai theo từng ngày công, phase và gate |
| [docs/DECISION_LOG.md](DECISION_LOG.md) | Quyết định stack, phạm vi MVP, tiêu chí và kết quả spike Day 1–3 |
| [AGENT.md](../AGENT.md) | Hướng dẫn làm việc, invariants, quy trình kiểm chứng/Git/bàn giao |
| [CONTEXT_SUMMARY.md](CONTEXT_SUMMARY.md) | Bối cảnh ngắn để tiếp tục task, hiện trạng và các quyết định còn mở |
| `WALKTHROUGH.md` | Giải thích đầu ra, quá trình và ranh giới bằng chứng |

Trong app hiện tại, Home và Editor dùng chung luồng chọn ảnh; dropzone Home nhận một file. Candidate hợp lệ được giải mã vào Fabric Canvas và fit viewport. Khi candidate được chấp nhận, `App` tạo baseline snapshot/history trong RAM; rotate/flip, crop Apply, resize Apply, adjust, preset, text, shape và layer visibility/delete commit snapshot vào history. Preset/slider chỉ áp lên ảnh nền; thumbnail dựng từ source và transform hiện tại, còn preview/export dùng shared filter helper từ `sourceElement` gốc để tránh lọc lặp. Text dùng Fabric Textbox, textarea thay thế cho nội dung, giới hạn 2.000 code point; export đợi Noto self-host trước render. Shape editor cho rectangle/circle/line có style và thao tác hình học. Layers panel liệt kê topmost-first, hỗ trợ chọn/hide/show/xóa overlay; background ở cuối, ẩn được nhưng không xóa. Hidden layers không hit-test hoặc xuất; hidden/off-canvas chọn từ panel vẫn mở properties mà không tự hiện. Export PNG/JPG dùng document dimensions và cảnh báo khi không có nội dung hiển thị. Crop pending vẫn tách khỏi snapshot cho tới Apply. Day 21 thêm autosave vào `miniphoto-local` IndexedDB và live save status; draft chưa được khôi phục vào UI sau reload. Harness Day 2/7/8/9/10/11/12/13/14/15/16/17/18/20/21 kiểm import, history, geometry, text, shapes, layers, export và autosave.

### Day 18 — Layers panel

`src/features/editor/engine/layers.ts` tạo danh sách nhãn từ snapshot, giữ thứ tự topmost-first, đặt ảnh nền cuối và cung cấp helper immutable để đổi visibility/xóa overlay. Số thứ tự shape được tính theo loại; nhãn text lấy 32 ký tự đầu đã gộp whitespace. `LayersPanel.tsx` có nút chọn, mắt ẩn/hiện và xóa; hàng ảnh nền không chọn/xóa được. `EditorCanvas` chọn overlay theo ID, kể cả khi hidden/off-canvas, và khóa Fabric `selectable`/`evented`/controls cho hidden objects. `App.tsx` thêm chuyển Thuộc tính/Lớp và cảnh báo export rỗng; không đổi schema hoặc thêm package.

`/tests/manual/day18-layers.html` chạy trong Chrome 155 / Windows 10, viewport 1280×720, DPR 1.1979: cả 5 nhóm pass — thứ tự/nhãn, visibility immutable/no-op/background, delete guard, history undo/redo và pixel export/hit-test. Rà soát lại các harness Day 7–18 pass tổng cộng 68 nhóm. `npm.cmd run typecheck`, `npm.cmd run build` và `git diff --check` pass; Vite báo bundle 599.99 kB vượt ngưỡng 500 kB.

Smoke UI dùng `tests/fixtures/day2-import/jpeg-orientation-1.jpg` (64×48): thêm rectangle/circle/text; xác nhận text/shape labels và z-order; hide/show; sửa stroke của layer hidden nhưng giữ hidden; chọn text ở X=100 từ Layers để mở properties mà vẫn visible; xóa selected và unselected layer, Undo/Redo, giữ selection còn lại; ẩn mọi layer để thấy cảnh báo; tạo PNG Blob 64×48. Background không có nút xóa. **Kết luận audit 08/10:** các đầu việc cụ thể của Day 18 trong roadmap đã được triển khai và smoke; nhưng FR-10/AC-21 chưa đạt 100% vì reorder overlay còn để Day 19. AC-22 có UI smoke; AC-39 keyboard-only, screen reader, touch và browser/device khác chưa kiểm. Chưa tải Blob xuống đĩa; Gate 3 còn mở.

## 2. Công việc trước task hiện tại — bằng chứng lịch sử

Theo kết quả các task trước trong hội thoại:

1. Đã cấu hình liên kết Git local với repository GitHub và email theo yêu cầu người dùng.
2. Đã commit PRD với commit `9675f2b3cc8052730a1a7bbb19948a4cd204477c`, message `docs: add MiniPhoto Editor PRD`; đã push và đối chiếu SHA remote tại thời điểm đó.
3. Đã tạo `docs/roadmap.md` theo PRD: 30 ngày công, 6 phase, đầu ra từng ngày và gate.
4. Đã tạo `AGENT.md`: 23 mục, hướng dẫn kiến trúc/quy tắc dữ liệu/triển khai, đủ 42 AC; đã đọc lại và kiểm tra đường dẫn tham chiếu.

Các bước này không chứng minh phần mềm đã được triển khai. Task hiện tại xác nhận HEAD local nhưng không chạy lại kiểm tra SHA GitHub. Không suy quyền push tài liệu mới từ việc trước đó được phép push PRD.

## 3. Công việc tạo tài liệu ban đầu

Yêu cầu: tạo một context summary và một walkthrough cho dự án.

Quá trình:

1. Xác nhận thư mục checkout bằng `Get-Location`.
2. Kiểm tra `git status --short --branch`, `git branch -vv`, `git log -1`, `git rev-parse HEAD`, `git diff --name-only` và `git ls-files`.
3. Liệt kê tệp bằng `rg --files`, bỏ qua thư mục sinh tự động; đọc agent, roadmap và các mục/quyết định của PRD.
4. Tạo `CONTEXT_SUMMARY.md` tại gốc để bàn giao trạng thái, quyết định, kiến trúc dự kiến, gate và bước kế tiếp.
5. Tạo `WALKTHROUGH.md` tại gốc để ghi đầu ra, quá trình thực hiện và giới hạn kiểm chứng.
6. Đọc lại hai tệp, kiểm tra tham chiếu local và trạng thái Git sau tạo.

Không chỉnh sửa các tài liệu có sẵn, không cài dependency, chạy build/test, khởi động server, đổi cấu hình, commit hoặc push trong task này.

### Cập nhật tổ chức và xuất bản tài liệu

Theo yêu cầu tiếp theo, chuyển context và walkthrough từ gốc vào `docs/`, sửa đường dẫn PRD/agent/roadmap và cập nhật `AGENT.md` hướng dẫn đọc cả hai trước mỗi task. Giữ tên `AGENT.md` đang có trong checkout. Bộ tài liệu được phép commit/push gồm `AGENT.md`, `docs/roadmap.md`, `docs/CONTEXT_SUMMARY.md`, `docs/WALKTHROUGH.md`; PRD và cấu hình khác không thay đổi.

Trước commit đã đối chiếu remote `main` ở SHA `9675f2b3cc8052730a1a7bbb19948a4cd204477c`. Kiểm tra tài liệu gồm liên kết tương đối, Git diff/cached diff và phạm vi stage. Commit/push được thực hiện sau kiểm tra; xác nhận kết quả bằng SHA remote và trạng thái Git cuối task, không coi đoạn mô tả quy trình này là bằng chứng push đã thành công.

## 4. Cách đọc dự án để tiếp tục

1. Đọc `docs/CONTEXT_SUMMARY.md` để nắm hiện trạng và quyết định chưa chốt.
2. Đọc `AGENT.md` để hiểu quy trình và các quy tắc không được phá vỡ.
3. Đọc PRD đầy đủ khi tiếp nhận lần đầu; tập trung mục 1, 6, 11–34 và phần liên quan task cụ thể.
4. Đọc `docs/WALKTHROUGH.md` và roadmap để xác định công việc đã làm, bằng chứng và ngày/phase được giao cùng điều kiện kết thúc.
5. Kiểm tra lại cây tệp và Git; trạng thái trong tài liệu này có thể thay đổi sau task mới.

Tên `AGENT.md` là tên người dùng yêu cầu; tài liệu này không xác nhận công cụ tự động nạp nó. Khi giao task, yêu cầu agent đọc tệp cùng PRD và context.

## 5. Luồng sản phẩm

### Nhập ảnh — Day 6 đã implementation

Home → chọn hoặc thả đúng một JPG/PNG/WebP tĩnh → kiểm tra size/header/MIME/dimensions/animation → decode theo EXIF orientation → tạo candidate trong RAM → khi được chấp nhận, tạo source asset ID + baseline snapshot/history → mở Editor và Fit viewport. Khi thay ảnh, app decode ứng viên trước; xác nhận mới thay candidate và reset history về baseline mới. Lỗi hoặc hủy giữ ảnh/history đang mở. Direct `/editor` khi không có candidate trong phiên trả về Home; route changes trong cùng phiên giữ candidate/history.

Đã kiểm thủ công xác nhận/hủy thay ảnh, lỗi giữ ảnh cũ, Fit/zoom cùng kích thước và back/forward. Day 7 cũng kiểm route về Home giữ ảnh, cancel replacement giữ document, accept PNG thay WebP bằng document 3×1. Người dùng xác nhận UI chỉ tải lên một ảnh; không ghi nhận kênh/thao tác/browser, nên chưa tính là kiểm tra thả nhiều file. Hủy file picker chưa xác minh. Geometry, adjust, lệnh chỉnh sửa, draft và export vẫn chưa implementation.

### Snapshot và history — Day 7 core

`App` giữ `HistoryState<EditorSnapshot>` theo document; baseline gồm schema version, document W/H/source asset ID, appearance Original/v1 với sliders 0 và transform source-image. History giữ JSON UTF-8, không giữ `File`, Fabric object, URL hoặc viewport. Commit no-op không tăng revision; commit sau undo loại redo branch; undo/redo tăng revision; giới hạn 50 bước undo và 10 MiB JSON, loại snapshot cũ nhất nhưng giữ current. Ảnh được chấp nhận tạo history mới; candidate pending/canceled không đổi history. Canvas nhận current snapshot để áp dụng transform source-image và document dimensions.

Core được kiểm qua `/tests/manual/day7-history.html`. UI Undo/Redo phản ánh `canUndo`/`canRedo`, nhưng chưa thể bật vì chưa có edit command. Vì vậy, restore snapshot qua engine được kiểm bằng harness; thao tác người dùng → commit → canvas restore chưa được nghiệm thu end-to-end.

### Autosave và restore

Runtime Day 21: import/commit/undo/redo → revision mới → debounce 800 ms → một save tại một thời điểm → transaction `assets`/`drafts` → báo SAVED sau complete. Cùng asset chỉ cập nhật snapshot/thumbnail; thay asset ghi mới, thay draft và xóa asset cũ atomically. Khi trang chuyển nền, app thử flush. `meta` đã có schema record; lease chưa triển khai.

Restore sau reload, validation/recovery, resume/bỏ draft là Day 22; phối hợp nhiều tab bằng lease là Day 23. Harness có thể đọc record hiện tại nhưng App chưa tự đọc/khôi phục draft.

Điểm kiểm chứng: quota/schema lỗi phải có recovery, draft cũ được giữ an toàn, tab mất lease không ghi đè. Tham chiếu PRD mục 24, 30–31.

### Compare và export

Compare dùng render tạm theo geometry hiện tại, bỏ màu/filter và ẩn overlay; không đổi history. Export lấy source đủ độ phân giải → áp dụng geometry, preset rồi slider và scene → chờ font → encode định dạng → kiểm MIME/dimensions → tải file và dọn tài nguyên.

Điểm kiểm chứng: PNG/WebP alpha, nền JPG, font tiếng Việt, quality, file mở được và pixel dimensions đúng. Tham chiếu PRD mục 22–23. Chưa có tệp ảnh export thực tế trong repository.

## 6. Kiểm tra tạo tài liệu ban đầu và giới hạn

| Kiểm tra | Kết quả/phạm vi |
|---|---|
| Checkout | Đúng thư mục MiniPhoto Editor được chỉ định |
| HEAD/branch local | `main`, HEAD `9675f2b…`, tracking `origin/main` |
| Tracked diff trước tạo | Không có tên tệp thay đổi |
| Tệp có sẵn | PRD, agent, roadmap; agent và docs chưa tracked |
| Hai tài liệu mới | Được kiểm bằng đọc lại, tồn tại tệp và tham chiếu local |
| GitHub live khi tạo ban đầu | Không kiểm lại remote SHA/fetch; lần tổ chức/xuất bản sau có đối chiếu remote như mục 3 |
| Build/test/runtime lúc tạo walkthrough | Không chạy; đây là bằng chứng lịch sử, không phải kiểm tra hiện tại |
| AC và release gate | Chưa có evidence đạt cho sản phẩm |

Không sử dụng screenshot, mock, wireframe hoặc đọc tài liệu làm bằng chứng runtime. Kết quả kiểm tra văn bản chỉ chứng minh đầu ra tài liệu, không chứng minh tính đúng của engine, export hoặc IndexedDB.

## 7. Hiện trạng và bước tiếp theo

**Hiện trạng trước Day 13 (08/10/2026):** Day 8 đã thêm rotate/flip, pan viewport và PNG/JPG export cho source-image; Day 9 crop pending; Day 10 Apply crop commit vào history, cập nhật document bounds/transform và giữ scene overlay cho preview/export. Day 11 thêm form resize giữ tỷ lệ và kiểm tra giới hạn. Day 12 nối Apply với shared transform/history, giữ source và scene; manual browser harness pass geometry, history và PNG export. Typecheck/build pass; Vite cảnh báo bundle 550.93 kB >500 kB. Harness dùng synthetic fixture; luồng import → Apply → Undo → export trong UI sản phẩm và fit/center sau resize chưa được smoke. Day 10 chưa xác nhận đủ acceptance: browser smoke chưa đo fit/center sau Apply; fixed-ratio Apply chưa kiểm UI end-to-end; AC-06 dùng scene fixture và AC-07 cần draft chưa tồn tại. Day 11 chưa xác nhận AC-10 đầy đủ; Day 12 AC-09 còn QA browser/device. Gate 1 đạt theo vertical slice ảnh nguồn (import → geometry → undo → output). Chưa có UI tạo/chỉnh/chọn layer. Day 8 chưa đủ: AC-04 chưa so sánh zoom 50%/200% và DPR khác; AC-11 cần xác minh overlay hidden/off-canvas qua rotate/flip; AC-12 có bằng chứng ma trận và scene fixture; AC-28 pass harness; AC-30 thiếu proxy sản phẩm; AC-31 chưa chạy encode/memory failure và retry. AC-03 vẫn một phần (multi-file drop và hủy picker chưa kiểm); AC-41 chưa xác minh. Chi tiết ở mục 12, 14–20 và [Decision Log](DECISION_LOG.md).

**Cập nhật sau Day 13 (08/10/2026):** Có ba adjust Brightness/Contrast/Saturation trong Properties, filter dùng chung cho preview/export, và `sourceElement` gốc giữ nguyên. Day 13 harness pass 4 nhóm assert; regression Day 8/10/12 pass 6/6/4 nhóm. Build/typecheck pass; bundle 555.87 kB >500 kB. Harness đo filter + `StaticCanvas.renderAll()` p95 0.1 ms/12 lần ở Chrome 155 trên Windows 10, viewport 1280×720, DPR 1.1979; đây không phải số đo animation frame/compositor hoặc mobile. Codex In-app Browser không cung cấp native file picker nên chưa smoke luồng sản phẩm với ảnh fixture; AC-13/14 chưa xác nhận 100%. Gate 2 còn mở; bước kế tiếp Day 14 là preset màu.

**Cập nhật sau Day 14 (08/10/2026):** Thêm `PresetId` và công thức v1 cho 9 preset + Original; shared filter pipeline Mode → RGB gain → preset B/C/S → user B/C/S; thumbnail dùng source image với geometry/crop document hiện tại. Tool Bộ lọc lưới 2 cột chọn preset qua một history commit; Original giữ slider. Day 14 manual harness pass 6 nhóm trên Chrome 155 / Windows 10, viewport 579×806, DPR 1.1979; với ba fixture canvas tổng hợp, đủ 10 thumbnail khớp live filter và PNG export tại cùng kích thước; alpha/source và overlay giữ nguyên. UI smoke với PNG alpha 3×1 xác nhận Warm → brightness 20 → Original giữ slider → Undo phục hồi preset. `npm.cmd run typecheck` và `npm.cmd run build` pass; bundle 560.90 kB, cảnh báo Vite >500 kB. Không có dependency mới hoặc test runner.

**Đối chiếu AC và giới hạn:** AC-15 có bằng chứng engine về thứ tự filter khi slider khác 0 và Original giữ slider, cùng UI smoke chọn preset/Undo. AC-16 **chưa được xác nhận 100%**: các fixture dùng để so khớp chỉ có kích thước 32×48, 48×48 và 64×36, đều nhỏ hơn giới hạn thumbnail 96×72 trong `presetThumbnails.ts`; vì vậy harness chưa kiểm tra thumbnail được thu nhỏ so với export đầy đủ. Cần thêm nguồn lớn hơn giới hạn, áp cùng preset/version và so kết quả giữa hai độ phân giải. Đây là khoảng trống kiểm chứng; code thumbnail và export hiện dùng chung filter helper. Ảnh portrait/product/landscape là tổng hợp nên chưa xác nhận chất lượng preset trên ảnh thật. Day 13 AC-13/14 còn thiếu UI evidence; draft persistence chưa triển khai nên chưa có restore formula version. Gate 2 còn mở. Theo roadmap, bước tiếp theo là Day 15 — text/IME; AC-06/07/08/09/10 và cross-device/browser/export limits nêu trên vẫn cần evidence riêng. Không coi Day 14 harness là bằng chứng Gate 2 đạt.

**Checkpoint sau Day 17 (08/10/2026):** Day 15 text và Day 16 text properties đã được nối với Day 17 shape editor. Next step theo roadmap là Day 18 — Layers. Hình khối hiện có trong UI; Layers panel, draft persistence và các khoảng trống AC-03/13–19 vẫn còn.

## 8. Phase 0 — Day 1 (07/10/2026)

- Tạo nhánh `codex/phase-0-spike` trên local và GitHub; nhánh theo dõi `origin/codex/phase-0-spike`.
- Chọn stack MVP theo đề xuất PRD: React 19.3.0, TypeScript 7.0.2 strict, Vite 8.3.3, Fabric.js 7.4.0; Node 24 LTS/npm và CSS Modules khi cần. Chi tiết cùng các quyết định còn mở ở `docs/DECISION_LOG.md`.
- Khởi tạo `package.json`, lockfile, `.nvmrc`, Vite/TypeScript config và React shell. Đây chỉ là scaffold; chưa có chỉnh ảnh.
- Kiểm tra: `npm.cmd run typecheck` và `npm.cmd run build` pass trên Node 24.19.0/npm 11.17.0. Không chạy test hoặc dev server.
- Gate 0/AC: chưa đạt/chưa chạy; Day 2–3 cần kiểm tra fixture, export file và IndexedDB roundtrip.

## 9. Phase 0 — Day 2 (07/10/2026)

- Tạo `src/features/editor/engine/imageImport.ts` làm helper ứng viên decode, `tests/manual/day2-import.html` + `.ts` làm harness thủ công, và fixture tại `tests/fixtures/day2-import/`. WebP dùng ảnh “A Wild Cherry” của Benjamin Gimmel từ [Google WebP Gallery](https://developers.google.com/speed/webp/gallery1), license CC BY-SA 3.0; synthetic JPEG/PNG/error fixtures có mô tả trong README cùng thư mục.
- Trong Codex In-app Browser trên localhost, cả `FabricImage.fromURL(blob URL, { signal })` và `createImageBitmap` → canvas → FabricImage pass bộ JPEG EXIF 1–8 (kích thước và bốn vùng màu), PNG alpha 0/128/255, WebP tĩnh 1024×772. Hash source trước/sau không đổi. Corrupt JPEG bị từ chối và candidate trước vẫn dùng được. Fabric path hủy được và 13/13 Blob URL được revoke đúng một lần. ImageBitmap path pass nội dung nhưng không thể dừng decode đang chạy.
- `npm.cmd run typecheck` pass; `npm.cmd run build` pass. Không thêm dependency, test framework hoặc UI sản phẩm. Browser version/UA không được xác minh; kiểm tra này chưa bao quát browser khác, animation, giới hạn file, ICC/profile, mobile, geometry, export sản phẩm hoặc IndexedDB.
- Day 2 có bằng chứng decode spike, không đánh dấu AC sản phẩm hay Gate 0 đạt. Quyết định và các giới hạn được ghi trong `docs/DECISION_LOG.md`; roadmap chuyển bước tiếp theo sang Day 3.

## 10. Phase 0 — Day 3 và đánh giá lại Gate 0 (07/10/2026)

- Mở rộng harness `tests/manual/day3-spike.html`: kiểm tra pixel chữ và tương phản chi tiết trong PNG export, thêm fixture WebP tĩnh qua crop/rotate/preview/export, đồng thời lưu/restore source WebP và snapshot qua IndexedDB.
- Trên Codex In-app Browser, PNG tổng hợp 3072×1536 qua crop → resize → rotate thành 1920×3456; preview proxy 2048×1024; text anchor ra (1062,2424). PNG Blob `image/png` decode đúng dimensions; pixel overlay, alpha marker và hash source pass. Sọc nguồn được đo ở luminance 65–217 sau scale/rotate; tiêu chí dùng nhiều pixel sáng/tối và độ tương phản để tính đến nội suy.
- Fixture WebP 1024×772 qua crop 16 px và rotate tạo preview/export 740×992; overlay trong PNG và hash WebP nguồn pass. Sau reload, IndexedDB restore khớp hash/snapshot/transform; transaction abort giữ draft cũ.
- Gate 0 **đạt cho các nhánh spike đã chạy**. Đây không phải AC sản phẩm hay bằng chứng mọi browser; Blob chưa được tải/mở bằng ứng dụng ngoài. Browser version/UA, quota/schema/đa tab, giới hạn bộ nhớ và thiết bị khác chưa được kiểm tra.

## 11. Phase 1 — Day 4 (07/10/2026)

- Dựng route shell `/`, `/editor`, `/privacy` trong `src/App.tsx`; dùng token và responsive layout trong `src/app.css`. Home sáng và Editor tối theo lựa chọn đã duyệt; tablet có drawer thuộc tính, mobile có rail cuộn và panel gọn.
- Empty state là mặc định. Có thể xem loading/lỗi bằng `?preview=loading` hoặc `?preview=error` trong dev; bản production bỏ qua query preview. Chọn ảnh, undo/redo, tool và export vẫn disabled vì chưa thuộc Day 4.
- Dialog trợ giúp dùng `<dialog>.showModal()`, đóng bằng Escape và focus quay lại nút gọi. Privacy route nêu rõ app shell hiện chưa nhận/lưu ảnh; định hướng tương lai được đánh dấu riêng.
- `npm.cmd run build` pass (bao gồm typecheck). Route và bố cục được kiểm trong browser ở 360 px, 820 px và 1366 px; đã sửa overflow ngang ở Editor 360 px. Chưa có test framework hoặc test sản phẩm.
- Server fallback khi deploy production chưa được cấu hình/kiểm chứng; Vite local mở trực tiếp ba route. Tiếp theo là Day 5 canvas lifecycle, không coi shell này là Gate 1.

## 12. Phase 1 — Day 5 (07/10/2026)

- Thêm `src/features/editor/EditorCanvas.tsx` để tạo một Fabric `Canvas` cho mỗi component mount. Canvas instance ở ref; React StrictMode cleanup/replay được xử lý bằng hàng đợi chờ `dispose()` trước khi khởi tạo lại.
- ResizeObserver cập nhật kích thước vùng render; cleanup disconnect observer và gọi `dispose()` để Fabric gỡ canvas/listener. Khi document có kích thước hợp lệ, resize giữ zoom hiện tại và căn giữa; Fit tính tỷ lệ vừa khung, zoom giới hạn 10–400% còn Fit có thể thấp hơn 10%.
- `src/App.tsx` chuyển Editor sang component này; tại checkpoint Day 5, `.canvas-stage` có checkerboard/empty state và `documentSize` là `null`. Day 6 sau đó cấp image/dimensions cho Canvas.
- `npm.cmd run build` pass, gồm `tsc --noEmit` và `vite build`; Vite cảnh báo bundle JavaScript vượt 500 kB sau minify. Không thêm dependency hoặc test runner.
- Trong Codex In-app Browser tại `/editor`, StrictMode để lại một `.canvas-container` với hai canvas nội bộ và không hiện runtime error; viewport 360×800 cập nhật surface/wrapper về 339 px. Browser version không xác minh. Fit/zoom chưa kiểm tra trên document vì chưa có import; Day 5 acceptance và Gate 1 chưa đạt đầy đủ.

## 13. Phase 1 — Day 6 status review trước implementation (07/10/2026)

- Đây là snapshot khảo sát trước khi bắt đầu implementation Day 6; không phản ánh trạng thái hiện tại.
- Tại snapshot này, `src/App.tsx` render nút “Chọn ảnh” disabled; chưa có file input hoặc handler kéo/thả; Editor nhận `documentSize={null}`.
- `src/features/editor/engine/imageImport.ts` chỉ có hai decoder helper; `tests/manual/day2-import.html` và `.ts` là harness spike Day 2, không được gọi từ luồng app.
- AC-01–03 khi đó chưa có bằng chứng ở luồng sản phẩm; harness Day 2 không thay thế nghiệm thu này.

## 14. Phase 1 — Day 6 implementation và kiểm chứng (07/10/2026)

- `src/features/editor/engine/imageImport.ts` nhận dạng JPEG/PNG/WebP từ header, kiểm tra file rỗng và giới hạn 20 MiB, MIME được khai báo nếu xung đột, dimensions 1×1 đến 12 MP/cạnh 8192, APNG và animation WebP. Sau validation, `decodeWithFabricUrl` tạo candidate; kích thước sau decode được kiểm tra lại để chặn mismatch header/decode.
- `src/App.tsx` dùng một hidden input cho Home và Editor. Home hỗ trợ thả file; nhiều file được báo lỗi, không chọn file đầu. Khi có candidate, thay ảnh mở native dialog sau khi ảnh mới decode xong. Cancel hoặc lỗi giữ ảnh hiện tại; accept mới đổi active candidate. Hủy file picker không tạo lỗi vì app không nhận `change` khi không có file.
- `EditorCanvas` gắn candidate image như ảnh nền không chọn được, giữ alpha trên nền checkerboard và chạy Fit khi đổi candidate, cả khi kích thước không đổi. Canvas tháo image trước khi dispose Fabric để app có thể giữ candidate khi điều hướng về Home. Route dùng History API trong phiên; direct `/editor` không có candidate thay URL về `/`.
- `tests/manual/day2-import.ts` bổ sung assert cases cho JPEG/PNG/static WebP headers; file rỗng/quá lớn/MIME mismatch/header sai; 12 MP/8192 px boundary; APNG và animated WebP. Test header giới hạn/animation dùng dữ liệu tổng hợp, không có fixture động thật.
- `npm.cmd run typecheck` pass. `npm.cmd run build` pass; Vite ghi cảnh báo bundle JS 525.21 kB vượt 500 kB. Manual harness trên Codex In-app Browser pass các assert mới và các fixture cũ: JPEG EXIF 1–8, alpha PNG, WebP tĩnh, corrupt, abort và 13/13 Blob URLs revoke đúng một lần.
- Trong app localhost, JPEG EXIF 6 hiển thị 48×64 px; thay ảnh qua dialog được thử hủy và xác nhận; WebP 1024×772 Fit 69%, zoom 83%, thay bằng ảnh cùng kích thước trở về Fit 69%; corrupt replacement báo lỗi và vẫn giữ WebP cũ. Refresh `/editor` khi mất candidate về Home; back/forward trong cùng phiên vẫn giữ candidate. Canvas có một `.canvas-container` sau các lần thay ảnh.
- Người dùng xác nhận UI chỉ tải lên một ảnh; kênh/thao tác/browser không được ghi nhận, vì vậy chưa tính là kiểm tra thả nhiều file. Hủy picker, mobile viewport, screen reader, browser khác và network audit chưa kiểm; browser version không xác minh. AC-03 có bằng chứng UI một phần; Gate 1 chưa đạt do history/rotate/flip/export cũng chưa triển khai.

## 15. Phase 1 — Day 7 history core và kiểm chứng (08/10/2026)

- Thêm `snapshot.ts` với snapshot schema version 1 cho document W/H/source asset ID, baseline appearance và source-image dimensions/transform/visibility/opacity. `ImageImportCandidate` có asset ID riêng; source `File`, `FabricImage`, object URL và viewport không được serialize.
- Thêm `history.ts`: baseline, current snapshot, commit, no-op, undo/redo, availability, revision, giới hạn 50 undo step và 10 MiB theo UTF-8 JSON. Commit tạo nhánh mới sau undo; trim bỏ cũ nhất mà giữ current; snapshot không JSON hoặc đơn vượt budget bị từ chối trước khi state đổi.
- `App` giữ history ở cấp ứng dụng và reset về baseline chỉ trong `activateCandidate` sau khi ảnh mới được chấp nhận. Candidate pending/hủy không chạm history. `EditorCanvas` lấy document size và transform ảnh nền từ current snapshot. Toolbar Undo/Redo đọc availability, nhưng chưa có edit command để tạo bước mới nên baseline không undo được.
- Tạo `/tests/manual/day7-history.html` + `.ts`, thêm harness vào TypeScript config; không thêm dependency, test framework, persistence hay edit operation Day 8.
- `npm.cmd run typecheck` pass; `npm.cmd run build` pass. Vite cảnh báo bundle JS 527.12 kB vượt 500 kB (Day 6 ghi nhận 525.21 kB). Harness chạy trong Codex In-app Browser và pass 7 nhóm assert: baseline JSON, full snapshot/no-op, undo/redo/branch, giới hạn 50 bước, budget 10 MiB, reject invalid/oversized, baseline document mới. `git diff --check` pass.
- App localhost với fixture WebP 1024×772: Undo/Redo disabled tại baseline; route Home giữ candidate và browser back trở lại Editor với document còn nguyên. Hủy replacement bằng PNG giữ WebP 1024×772; xác nhận replacement tạo document PNG 3×1 và baseline mới, Undo/Redo tiếp tục disabled. Browser version, mobile, multi-file drop, file picker cancel, export, edit-command→canvas restore và lifecycle StrictMode trong phiên này chưa xác minh. AC-23–25 chỉ có bằng chứng core; AC-41 chưa xác minh; Gate 1 chưa đạt.

## 16. Phase 1 — Day 8 geometry, pan và export (08/10/2026)

- `snapshot.ts` thêm `documentTransform`, ma trận affine từ scene baseline tới document hiện tại. `geometry.ts` áp dụng quarter-turn trái/phải và flip ngang/dọc, cập nhật W/H khi xoay; `App` commit mỗi lệnh qua `commitHistory`. `EditorCanvas` dựng source-image từ snapshot rồi áp ma trận này, nên undo/redo khôi phục cả hình học và ảnh.
- Pan chỉ thay `Canvas.viewportTransform`, không commit vào history/document. Có toggle “Di chuyển” và giữ Space + kéo; pointer capture kết thúc an toàn khi thả/hủy con trỏ. Fit/zoom tiếp tục căn giữa theo viewport.
- `exportImage.ts` render bằng `StaticCanvas` với DPR scaling tắt, kích thước theo document, kiểm MIME/kích thước blob sau decode và dispose renderer. PNG giữ alpha; JPG nhận quality và nền. Dialog cho tên file/định dạng/quality/nền, tạo object URL cho link tải, thu hồi URL khi đổi tuỳ chọn/đóng dialog/unmount. Không thêm dependency.
- `/tests/manual/day8-transform-export.html` + `.ts` pass 6 nhóm assert trong Codex In-app Browser: right/left và 4 lần xoay, double flip, sample điểm hidden/off-canvas qua shared matrix, scene metadata giữ nguyên, undo/redo, PNG 3×1 alpha và 1×3 sau rotate, WebP 1024×772 export đúng kích thước, JPG MIME/dimensions/opaque red background. Đây là kiểm engine/matrix; fixture layer hidden/off-canvas là dữ liệu tổng hợp, không phải layer sản phẩm.
- `npm.cmd run typecheck` và `npm.cmd run build` pass; Vite cảnh báo bundle 536.20 kB vượt 500 kB. Trong app localhost: import PNG 3×1, nút xoay phải hiển thị 1×3, Undo khôi phục 3×1; dialog tạo PNG và JPG Blob, cho thấy link tải. Thay bằng WebP 1024×772 rồi kéo pan làm ảnh dịch trong stage, document vẫn 1024×772. Chưa bấm link tải nên chưa xác minh file trên đĩa.
- Không có overlay/layer text hoặc shape trong schema/ứng dụng; selection chưa có đối tượng sản phẩm để chọn. AC-11 chưa đạt; AC-12 chỉ có bằng chứng ma trận tổng hợp, chưa kiểm trên scene có nhiều object. AC-04 chưa so sánh đủ zoom/DPR; AC-30 chưa có proxy/text; AC-31 chưa kiểm encode/memory failure và retry. Gate 1 đạt ở vertical slice ảnh nguồn (import → rotate → undo → PNG/JPG blob), nhưng Day 8 chưa hoàn thành 100%. Không bấm link tải xuống đĩa; không kiểm browser version, viewport mobile riêng, screen reader, network audit hoặc mở file ngoài browser.

## 17. Phase 2 — Day 9 crop pending (08/10/2026)

- `src/features/editor/engine/crop.ts` chứa model rectangle/ratio, khởi tạo Free toàn tài liệu, fixed ratio lớn nhất ở giữa theo bội nguyên, kiểm tra số nguyên/bounds và kéo/move có clamp. Fixed ratio dùng bốn corner handle; Free có tám handle cạnh/góc.
- `src/App.tsx` giữ `PendingCrop`, field input và lỗi trong state của `EditorPage`; không gọi `commitHistory`, không sửa `EditorSnapshot`. Crop tool là tool duy nhất bật; Undo/Redo/export/thay ảnh/rotate/flip và tool khác bị khóa đến Cancel/Escape. Input không hợp lệ giữ rectangle hợp lệ cuối cùng và báo lỗi cạnh field.
- `src/features/editor/EditorCanvas.tsx` đổi screen pointer sang document scene bằng `Canvas.getScenePoint`; overlay lấy `viewportTransform` để bám zoom/pan. Chế độ pan giữ hoạt động và tạm dừng crop drag. `src/app.css` tạo mask tối, lưới 3×3 và handles.
- Thêm `tests/manual/day9-crop-pending.html` + `.ts` theo mẫu assert hiện có; thêm harness vào `tsconfig.json`, không thêm dependency. Bốn nhóm assert pass: tạo ratio/impossible ratio; clamp Free/fixed drag; validation integer/bounds/ratio; pending/discard không chạm snapshot/history.
- `npm.cmd run typecheck` pass; `npm.cmd run build` pass, Vite cảnh báo bundle 543.09 kB lớn hơn 500 kB. Trong Codex In-app Browser với PNG 3×1, ratio 4:3, 3:4, 16:9, 9:16 disabled kèm lý do. Với WebP tĩnh 1024×772, UI tạo 1:1/4:3 căn giữa, numeric X vượt bounds hiện lỗi và nhập lại thì hết lỗi, đổi 4:3 W/H hợp lệ, kéo góc tạo khung pending 820×615; document status vẫn 1024×772. Pan dịch ảnh và frame cùng 50×30 CSS px; zoom 63→75% tính lại overlay. Undo/Redo/export/replace/rotate/flip disable; Escape và Hủy cắt bỏ pending và mở khóa; không kiểm draft vì app chưa có draft.
- Ở viewport browser 391×845, `documentElement.scrollWidth` là 376 px (không overflow ngang); đây là browser viewport emulation, không phải thiết bị cảm ứng thật. Không kiểm screen reader, browser khác, DPR khác, keyboard resize handle hoặc phép crop Apply. **AC-07/08 chỉ có bằng chứng một phần; không đánh dấu đạt.** Day 10 vẫn chịu trách nhiệm commit và cập nhật hình học document.


## 18. Phase 2 — Day 10 crop apply (08/10/2026)

**Đánh giá:** implementation scope trong roadmap có đủ code; chưa xác nhận Day 10 hoàn thành 100% acceptance vì thiếu đo fit viewport sau Apply, UI fixed-ratio Apply end-to-end, scene overlay do người dùng tạo và draft cho AC-07.

- `src/features/editor/engine/geometry.ts` thêm `cropDocument`: kiểm rectangle/ratio ở command boundary, đổi document W/H và ghép dịch chuyển `T(-x,-y)` vào ma trận chung. Full-document crop trả snapshot nguyên dạng để không thêm history step; crop thật giữ scene và metadata overlay.
- `src/features/editor/engine/snapshot.ts` mở rộng scene union thành source image, text overlay và shape overlay (rectangle/circle/line). `src/features/editor/engine/scene.ts` chuyển fixture snapshot thành Fabric objects; `EditorCanvas` vẽ source trước overlays theo thứ tự snapshot, áp shared transform và clip theo bounds document. `exportImage.ts` render toàn scene theo cùng thứ tự/transform/clip. Code auto-fit/center chạy theo thay đổi W/H; browser smoke chưa đo zoom/vị trí viewport sau Apply.
- `src/App.tsx` nối Apply với crop command và commit một lần qua history; lỗi validation giữ pending crop. Cancel/Escape vẫn loại pending state. Apply bị khóa khi rectangle không hợp lệ.
- Thêm `/tests/manual/day10-crop-apply.html` + `.ts`, đưa harness vào `tsconfig.json`; không thêm dependency hoặc UI authoring overlay. Sáu nhóm assert pass: crop bounds/translation và scene giữ nguyên; rectangle/ratio sai bị từ chối; no-op và revision; một bước commit Undo/Redo; crop sau rotation; preview clip theo pan và PNG 40×32 với text/rectangle/circle/line, z-order, hidden/off-crop và source pixels bất biến. Đây là scene tổng hợp, chưa phải thao tác trên layer do người dùng tạo.
- Regression harness Day 7, Day 8, Day 9 lần lượt pass 7, 6, 4 nhóm assert. `npm.cmd run typecheck` và `npm.cmd run build` pass; Vite cảnh báo bundle minified 546.38 kB vượt 500 kB.
- App smoke localhost với fixture PNG 3×1: X=2 bị từ chối và khóa Apply; X=1/W=2 áp dụng thành 2×1; Undo trở lại 3×1; crop toàn khung sau Undo giữ Redo; Escape bỏ pending và không thêm history. Chưa kiểm tải file xuống đĩa, draft, browser/DPR khác, mobile thật, screen reader hoặc encode/memory failure.
- **Giới hạn AC:** AC-06 mới có fixture engine/export, chưa có overlay do người dùng tạo; AC-07 không thể kiểm draft vì app chưa có draft; AC-08 có xác minh engine nhưng chưa kiểm UI chọn ratio rồi Apply. Vì vậy chưa xác nhận Day 10 đạt 100% acceptance. Day 11 resize form được ghi ở mục 19; Day 12 apply resize được ghi ở mục 20.

## 19. Phase 2 — Day 11 resize form (08/10/2026)

- `src/features/editor/engine/resize.ts` tính cạnh còn lại từ kích thước document khi mở form, làm tròn số nguyên và dùng chung giới hạn `MAX_IMAGE_EDGE`/`MAX_IMAGE_PIXELS` với import. Helper từ chối document không hợp lệ, input trống/không nguyên/không dương, cạnh trên 8192 px và tổng trên 12 MP.
- `src/App.tsx` thêm tool Kích thước và form trong Properties. Tỷ lệ khóa; lỗi gắn đúng field và khóa Apply; upscale hiện cảnh báo “Phóng lớn không tạo thêm chi tiết ảnh”. Apply hợp lệ chỉ ghi dimensions vào state tạm và báo rõ document/canvas/history chưa đổi. Cancel hoặc Escape bỏ session. Undo/Redo, thay ảnh, export và transform bị khóa trong lúc form pending.
- Thêm `tests/manual/day11-resize.html` + `.ts`, đưa harness vào `tsconfig.json`. Harness pass 4 nhóm assert: tính ratio và rounding; input trống/NaN/infinity/thập phân/âm/0; exact edge/pixel boundary và overflow; scale direction cùng base dimensions lỗi.
- UI smoke trong Codex In-app Browser với `jpeg-orientation-1.jpg` (64×48): đổi rộng thành 32 cho 24 px cao; 12.5 hiện lỗi cạnh field và disable Apply; rộng 128 hiện cảnh báo upscale; Apply chỉ ghi “128 × 96 px đã chuẩn bị” và báo chưa đổi canvas/document/history; nút Hủy resize bỏ pending, document vẫn 64×48 và mở lại các lệnh. Escape cũng được kiểm ở smoke trước.
- Regression Day 9/10 harness pass lần lượt 4/6 nhóm. `npm.cmd run typecheck` và `npm.cmd run build` pass; build tạo JavaScript bundle 550.53 kB và cảnh báo vượt 500 kB. Đây là một browser localhost, chưa đo browser version, thiết bị thật, screen reader, DPR hoặc keyboard/mobile layout.
- **Đánh giá 100%:** Implementation scope Day 11 hoàn thành; chưa xác nhận acceptance 100%. AC-10 có bằng chứng helper/harness và UI smoke trong một Codex In-app Browser, nhưng chưa kiểm browser/device khác, mobile thật, screen reader, DPR hoặc keyboard/mobile layout. Tại checkpoint Day 11, Apply chỉ staging; Day 12 sau đó nối Apply với resize geometry/history.

## 20. Phase 2 — Day 12 apply resize (08/10/2026)

- `src/features/editor/engine/geometry.ts` thêm `resizeDocument`: xác thực dimensions trong giới hạn 8192 px/12 MP và scale khớp kết quả làm tròn; cùng kích thước trả snapshot nguyên dạng; resize thật ghép ma trận scale đồng đều trước shared document transform hiện tại. Document W/H thay đổi; ordered scene và ảnh nguồn không bị sửa/resample.
- `src/App.tsx` nối Apply của form Day 11 với `resizeDocument`, commit snapshot qua history rồi đóng form; lỗi command giữ form và hiển thị thông báo. Undo/Redo vẫn dùng history hiện có. `EditorCanvas` gọi `fitZoom`/`centerDocument` khi W/H thay đổi; lần rà soát này chưa đo viewport matrix/độ căn giữa ở trường hợp không chạm giới hạn zoom.
- Thêm `/tests/manual/day12-resize-apply.html` + `.ts`, đưa harness vào `tsconfig.json`. Harness chạy trong Codex In-app Browser, pass 4 nhóm: resize/no-op/validation và scene references; compose sau crop/rotate; một history commit cùng undo/redo; PNG 32×24 kiểm pixel source, text, rectangle, circle, line, hidden overlay và source pixel bất biến. Regression Day 7–11 pass 7/6/4/6/4 nhóm.
- `npm.cmd run typecheck` pass; `npm.cmd run build` pass, tạo JavaScript bundle 550.93 kB và cảnh báo vượt ngưỡng 500 kB. Không thêm dependency.
- Rà soát lại 08/10: Day 12 harness pass 4/4 nhóm trên Chrome 155; các harness Day 7–18 pass tổng cộng 68 nhóm. UI smoke đã import fixture JPEG 64×48 vào App, Apply 32×24, Undo về 64×48, Redo về 32×24; dialog tạo PNG Blob 134 byte đúng kích thước. Không tải Blob xuống đĩa. Browser/device khác, DPR/mobile thật, screen reader và encode/memory failure/retry chưa kiểm.
- **Đối chiếu kế hoạch Day 12:** chưa xác nhận hoàn thành 100%. Đã bổ sung smoke App import → Apply → Undo/Redo → tạo export Blob; còn thiếu đo fit/center thực tế sau resize ở trường hợp zoom không chạm giới hạn và kiểm file tải xuống. AC-09 có bằng chứng UI workflow nhưng chưa đủ evidence viewport/output file end-to-end trên thiết bị khác.
- Không thay đổi Gate 1; các giới hạn Day 8/10 và draft/layer còn mở.

## 21. Phase 2 — Day 13 adjust màu (08/10/2026)

- `src/features/editor/engine/adjustmentFilters.ts` tạo Fabric Brightness → Contrast → Saturation theo thứ tự và ánh xạ UI integer −100…100 sang −1…1; giá trị ngoài miền hoặc không nguyên bị từ chối. Ba giá trị trung tính tạo pipeline rỗng.
- `src/features/editor/engine/imageImport.ts` giữ `sourceElement` trước khi Fabric preview bị lọc. `EditorCanvas` áp filter mới nhất theo `requestAnimationFrame`, tránh dựng lại overlay scene khi chỉ đổi màu và bỏ callback đã lỗi thời theo ảnh hiện tại. Snapshot đã có ba trường adjust nên không đổi schema; preset ID/version và geometry được giữ nguyên.
- `src/App.tsx` thêm slider và numeric input cho Độ sáng, Tương phản, Bão hòa; nhập số hợp lệ commit khi Enter/blur, slider commit khi pointer/key gesture kết thúc, Escape hủy draft; reset từng giá trị hoặc cả nhóm chỉ sửa ba trường màu. Invalid/blank/non-integer/out-of-range không preview và hủy giao dịch đang chỉnh. `src/app.css` bổ sung kiểu cho Properties panel; Home/Help copy được cập nhật theo khả năng đang có.
- `src/features/editor/engine/exportImage.ts` dựng ảnh từ `candidate.sourceElement` và áp cùng helper trước khi render document, tránh đọc element preview đã lọc. Export PNG/JPG cùng geometry/overlay hiện có.
- Thêm `/tests/manual/day13-adjustments.html` + `.ts` và `tsconfig` include. Harness pass 4 nhóm: mapping/order/neutral/invalid; preview/filter giữ source và alpha; history commit/no-op/undo/redo; export dùng cùng kết quả một lần, giữ alpha/overlay/source. Regression Day 8/10/12 pass lần lượt 6/6/4 nhóm.
- `npm.cmd run typecheck` pass; `npm.cmd run build` pass, bundle JavaScript 555.87 kB và cảnh báo >500 kB. Không thêm package.
- Harness đo filter + `StaticCanvas.renderAll()` trên 2048×1536: p95 0.1 ms ở 12 lần (nearest-rank max). Môi trường: Chrome 155.0.0.0 trên Windows 10, viewport 1280×720, DPR 1.1979. Đây là thời gian pipeline đồng bộ của harness; không đo animation frame/compositor hoặc thiết bị mobile, nên chưa xác nhận target p95 sản phẩm.
- Home UI localhost xác nhận copy mới, nhưng Codex In-app Browser không cung cấp hộp thoại native để chọn fixture. Vì vậy chưa smoke UI import → Editor → slider/numeric/keyboard/reset → Undo/Redo → export; các tương tác UI AC-13 và reset UI AC-14 chưa được xác nhận. Cụ thể còn thiếu: 100 input events giữ giá trị cuối và đúng một Undo; keyboard gesture gộp một commit; Enter/blur commit, Escape và input invalid rollback; reset riêng/cả nhóm rồi Undo. Harness chỉ xác nhận engine/history/export.
- **Đối chiếu kế hoạch Day 13:** implementation và harness core đã hoàn thành; không đánh dấu AC-13/14 đạt 100%. Alpha và overlay giữ nguyên có bằng chứng trong export fixture, nhưng thay/reset trong product UI chưa được kiểm tra để chứng minh alpha/overlay/crop giữ nguyên. Preset chưa triển khai trước Day 14 nên AC-14 về giữ preset còn chờ. Cần UI end-to-end, responsive hẹp/device/browser bổ sung và benchmark preview thực tế trước khi khép AC. Không thay đổi Gate 2; preset vẫn là Day 14.

## 22. Phase 2 — Day 14 preset màu (08/10/2026)

- `src/features/editor/engine/snapshot.ts` đổi `presetId` thành union `PresetId` gồm Original và 9 preset. `adjustmentFilters.ts` lưu công thức theo preset/version (v1), áp filter theo thứ tự Mode → RGB gain → preset Brightness/Contrast/Saturation → ba slider người dùng. RGB gain dùng `ColorMatrix` với alpha 1/offset 0; preset không thêm intensity hoặc grain. `selectImagePreset` chỉ đổi ID/version, giữ slider/geometry/scene và trả snapshot cũ khi ID/version đã đang dùng.
- `src/features/editor/engine/presetThumbnails.ts` dựng nền thumbnail ở kích thước tối đa 96×72 từ `sourceElement` theo source transform và document transform/crop; sau đó dùng đúng shared filter factory với từng preset và sliders hiện tại. Thumbnail không đưa overlay vào. `PresetControls.tsx` hiển thị 10 lựa chọn dạng lưới hai cột, button có `aria-pressed`, focus-visible, tên preset và trạng thái thumbnail lỗi.
- `src/App.tsx` bật tool Bộ lọc và commit chọn preset qua history hiện có. Chuyển giữa Điều chỉnh/Bộ lọc kết thúc thao tác slider đang mở; Original giữ slider và mọi geometry/nội dung khác. `src/app.css` dùng cùng màu/surface tokens và responsive panel hiện có.
- Thêm `/tests/manual/day14-presets.html` + `.ts`; không thêm package hoặc test runner. Sáu nhóm pass: chọn/version/history/no-op/Original; pipeline và validation version; crop/rotate thumbnail; ba fixture tổng hợp portrait/product/landscape. Với từng fixture, đủ 10 thumbnail pixel-match PNG export và live filter khi canvas cùng kích thước; alpha/source không đổi. Overlay được kiểm riêng trên export.
- `npm.cmd run typecheck` pass. `npm.cmd run build` pass; JS bundle 560.90 kB và Vite cảnh báo vượt 500 kB. Không có script `test` riêng.
- UI smoke trong Codex In-app Browser trên localhost với `tests/fixtures/day2-import/png-alpha.png` (3×1): tool Bộ lọc bật; 10 preset và thumbnails hiện; chọn Warm mở history; chỉnh brightness = 20, chọn Original vẫn giữ 20; Undo phục hồi Warm và tiếp tục undo đưa về Original. Harness/UI ghi nhận Chrome 155 trên Windows 10, viewport 579×806, DPR 1.1979; console không có error/warning.
- **Giới hạn nghiệm thu:** portrait/product/landscape trong harness là canvas tổng hợp, không phải ảnh thật; chưa có đánh giá thẩm mỹ trên ảnh thật. UI smoke dùng PNG 3×1 và không kiểm tải file xuống đĩa, browser/device khác, mobile thật, screen reader hoặc DPR khác. Không có draft persistence nên chưa có luồng restore draft dùng formula version. Day 13 AC-13/14 vẫn thiếu UI evidence. Day 14 implementation và core harness pass nhưng không khẳng định AC-15/16 hoặc Gate 2 đạt 100%.

## 23. Phase 3 — Day 15 text và IME (08/10/2026)

- `src/features/editor/engine/snapshot.ts` chuẩn hóa CRLF/CR thành LF và giới hạn nội dung ở 2.000 Unicode code point. `engine/text.ts` tạo textbox mặc định giữa document (width 80%, size 6% cạnh ngắn, clamp 8–512, Noto Sans, fill `#111827`), serialize vị trí/scale/rotation ngược qua document transform, giới hạn tổng 50 overlay và kiểm readiness font.
- `EditorCanvas` render text selectable, inline-editable và kéo/scale đồng đều/xoay; textarea trong panel là nguồn nhập thứ hai. Mỗi phiên commit một snapshot qua history; text rỗng xóa overlay, text mới rỗng là no-op; Escape hủy. Khi IME composition đang chạy, finish bị hoãn và các thao tác history/export/tool phụ thuộc không tiếp tục trước compositionend. Crop/resize/rotate/flip vẫn dùng geometry hiện có và text giữ đúng tọa độ document.
- `App` bật rail/panel Chữ, nút thêm/xóa, textarea và bộ đếm; copy Home/Help đã cập nhật. `app.css` self-host Noto Sans và Noto Serif WOFF2 subset Vietnamese/Latin-ext/Latin, normal/italic, weight variable 400–700; có kèm OFL. `exportImage.ts` chờ font trước khi dựng PNG/JPG.
- Thêm `/tests/manual/day15-text.html` + `.ts`; harness pass 7 nhóm: newline/code point cap; font Noto Sans/Serif 4 kiểu và unknown family fail; default textbox; add sau crop/rotate/resize giữ tâm/upright; add/edit/delete/undo/redo và empty no-op; PNG text tiếng Việt giữ đúng dimensions; cap 50 overlay. HTML harness load `app.css` để dùng đúng `@font-face` của app.
- `npm.cmd run typecheck`, `npm.cmd run build`, `git diff --check` pass. Vite build thành công với JavaScript bundle 572.80 kB và cảnh báo >500 kB; không thêm package hoặc test runner.
- UI smoke trên Chrome 155 / Windows 10, viewport 1280×720, DPR 1.1979; import `tests/fixtures/day2-import/webp-static.webp` 1024×772, thêm và nhập text nhiều dòng có dấu bằng textarea, mở export và tạo PNG Blob 1024×772 (1,581,448 byte). Undo gỡ textbox; Redo khôi phục; chọn và xóa textbox rồi Undo khôi phục; xóa hết nội dung textbox hiện có làm panel bỏ selection và Undo khôi phục lớp; Escape hủy textbox mới pending, không tạo bước lịch sử. Ảnh được hiển thị trên canvas.
- **Giới hạn acceptance:** textarea/Playwright không mô phỏng Vietnamese IME thật; chưa kiểm Ctrl+Z native, desktop Fabric inline edit bằng gõ trực tiếp, mobile thật, screen reader, browser/DPR khác, tải file xuống đĩa hoặc UI retry khi font lỗi. Vì vậy AC-17/18/19 chưa được xác nhận 100%; Day 15 core đã implementation nhưng Gate 3 còn mở do IME/font failure QA, shapes/layers/keyboard và các ngày Phase 3 còn lại.

## 24. Phase 3 — Day 16 text properties (08/10/2026)

- `snapshot.ts` thêm `fontWeight`, `fontStyle`, `textAlign` vào text overlay và nâng editor snapshot lên schema 2. Chưa cần migration vì sản phẩm chưa lưu/khôi phục editor snapshot; Day 3 spike dùng model tách biệt.
- `engine/text.ts` định nghĩa typed patch, kiểm tra family/style/weight/alignment, finite X/Y/góc, width 1–8192, font size 8–512, opacity 0–100% và mã màu hex. X/Y, width/font size properties dùng tọa độ/kích thước hiệu dụng của document hiện tại; khi lưu, `serializeTextObject` chuyển geometry/style scale về snapshot base. Font readiness dedupe theo family/style/weight; thêm text vẫn dùng default Noto Sans.
- `EditorCanvas` áp thuộc tính lên Textbox sau khi font tương ứng tải; phiên property riêng commit theo action, input số/range gom theo một phiên. Cancel tái dựng đầy đủ baseline text/style/transform/visibility/opacity. Scene update và object transform cũng làm mới giá trị panel hiện tại.
- `App` thêm UI font family/size, bold/italic, alignment, fill, opacity, X/Y, angle và wrap width; validation báo lỗi, input số invalid hủy phiên khi blur, font lỗi giữ style cũ và có hành động retry/chọn font khác. `exportImage` dùng family/style/weight snapshot trước render; no fallback export.
- Thêm `/tests/manual/day16-text-properties.html` + `.ts`; 7 nhóm pass trong Chrome 155 trên Windows 10, viewport 579×806, DPR 1.1979: schema/defaults; ranh giới/validation; full property round-trip sau crop/rotate/resize; cancel khôi phục cả state; discrete/no-op/gesture history; PNG export full-size với Noto Serif bold italic; thiếu font bị từ chối. Regression Day 10/12/15 pass 6/4/7 nhóm. Day 10/12 manual HTML được nối `app.css` để dùng Noto self-host sau khi fixtures đổi từ Arial sang schema font được hỗ trợ.
- `npm.cmd run typecheck` và `npm.cmd run build` pass; Vite build tạo JS 581.45 kB và cảnh báo chunk >500 kB. Không thêm dependency/test runner; chỉ có manual harness.
- Tại checkpoint Day 16, product UI chưa smoke vì browser session không mở native file picker; khi đó AC-19 UI retry/export failure còn thiếu. Follow-up Day 20 bên dưới đã chạy luồng font lỗi/retry trong product UI. IME thật, Ctrl+Z cùng IME composition, lỗi export font trên UI, cross-browser/mobile, screen reader và các tiêu chí còn lại vẫn chưa xác minh; Gate 3 còn mở.

## 25. Phase 3 — Day 17 shapes (08/10/2026)

- `src/features/editor/engine/shapes.ts` thêm tạo mặc định, style patch có validate atomic, serialize/restore và giới hạn 50 overlay cho rectangle, circle, line. Giá trị style ở command boundary: hex color hoặc fill trong suốt, stroke 0–50 px (line >0), opacity 0–1; kích thước/đầu mút phải hữu hạn và khác zero. Circle khóa scale đồng đều. Line lưu vector hai đầu quanh tâm, để vị trí/transform không nhập nhằng với endpoint.
- `scene.ts` bật Fabric selection, controls và eventing cho shape; cùng factory được dùng bởi preview/export. `EditorCanvas` đăng ký/đồng bộ selection, thêm shape mới gần tâm tài liệu, commit trực tiếp thao tác geometry và gom property edit vào history với Undo/Redo. `App` mở panel Hình khối với add rectangle/circle/line, fill màu/trong suốt, màu/độ rộng stroke và opacity; nút add khóa tại 50 overlay. Home/Help copy đã cập nhật; không thêm dependency hoặc test runner.
- Thêm `/tests/manual/day17-shapes.html` + `.ts` và đưa TS harness vào `tsconfig.json`. 8 nhóm pass trên Chrome 155 / Windows 10, viewport 1280×720, DPR 1.1979: default/giới hạn 1×1; validation style/geometry; property patch atomic; circle round-trip; line translation/scale/rotation sau crop/rotate/resize; history/no-op/cap 50; PNG pixel/export preview cho ba shape. Regressions Day 7/10/12/15/16 lần lượt pass 7/6/4/7/7 nhóm.
- UI smoke Chrome 155/Windows 10, viewport 1280×720, DPR 1.1979: trên PNG alpha 3×1 đã thêm rectangle, đổi stroke, kiểm Undo/Redo và fill trong suốt, thêm circle/line; trên JPEG fixture `jpeg-orientation-1.jpg` 64×48 đã kéo/scale circle, xác nhận vẫn tròn và Undo/Redo; smoke hiện tại import JPEG, thêm/kéo Line, Undo/Redo trả vị trí đúng, đổi stroke width 1→4 rồi Undo về 1 và tạo PNG Blob 64×48 (355 byte). Console không có lỗi; dọn thay đổi thử nghiệm bằng Undo về snapshot ảnh gốc. Chưa tải file xuống đĩa.
- `npm.cmd run typecheck`, `npm.cmd run build`, `git diff --check` pass; Vite build JS 594.31 kB và cảnh báo vượt 500 kB. **AC-20 có bằng chứng core trong engine/preview/export và một phần UI, nhưng Day 17 chưa hoàn thành 100% checklist giao diện.** Còn thiếu: xác nhận thêm/chọn/vị trí gần tâm cho cả ba shape; opacity và Undo một bước cho từng loại thuộc tính; rectangle scale/rotate; line handle đổi độ dài/góc; nút UI khóa và scene không đổi ở giới hạn 50; crop clip trong editor và kiểm pixel/màu/opacity/kích thước trên file tải thật. Harness đã kiểm pixel PNG engine cho ba shape; UI mới xác nhận Blob được tạo, chưa kiểm file tải xuống. Browser/device/DPR khác, mobile và screen reader chưa kiểm. Gate 3 còn mở vì Layers, IME/Ctrl+Z/font failure QA và các AC creative liên quan chưa hoàn tất.

## 26. Phase 3 — Day 19 layers và keyboard (08/10/2026)

- `engine/layers.ts` thêm reorder đúng một bậc trong scene bottom-to-top và nudge theo delta document; source-image không reorder/nudge được, delta không hợp lệ/no-op giữ nguyên snapshot. Nudge đổi delta ngược qua ma trận document transform để Arrow luôn di chuyển theo trục hiện tại sau rotate/resize.
- `LayersPanel.tsx` thêm nút lên/xuống có accessible label, tooltip và disable ở biên; ảnh nền vẫn cố định dưới cùng. `EditorCanvas` sync order qua snapshot/history; preview nudge cập nhật ngay và commit một lần khi nhả mọi phím mũi tên, đổi focus, blur cửa sổ hoặc bắt đầu action khác.
- `App.tsx` nối Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl+Y; Delete/Backspace chỉ trong canvas/layers; Arrow/Shift+Arrow trên canvas hoặc row đã chọn. Input, textarea, select, contenteditable, open dialog, IME và phím có Alt không bị editor lấy. Reorder/delete/keyboard đi qua callback/history hiện có.
- Thêm `engine/nudgeInput.ts` làm phần dùng chung cho UI và harness: cộng delta theo từng keydown (kể cả lặp), giữ tập phím đang nhấn và chỉ báo hoàn tất sau keyup cuối. `EditorCanvas` dùng accumulator này để serialize cả phiên nudge vào một snapshot/history commit.
- Thêm `/tests/manual/day19-layers-keyboard.html` + `.ts`, đưa TS harness vào `tsconfig.json`. Bốn nhóm assert pass: scene order/boundary/background/no-op; history Undo/Redo; 1/10 px, inverse transform sau rotate/2× resize, nhiều keydown/multi-key release và một bước Undo; PNG pixel theo topmost z-order.
- Chạy đủ 15 trang manual Day 2, 3, 7–19: tổng 93 nhóm PASS trong Chrome 155 / Windows 10, viewport 579×806, DPR 1.1979; gồm Day 19 bốn nhóm. `npm.cmd run typecheck`, `npm.cmd run build`, `git diff --check` pass; Vite tạo JS bundle 604.29 kB và cảnh báo chunk >500 kB. Không có test script/framework riêng.
- UI smoke Codex In-app Browser, localhost, Chrome 155 / Windows 10, viewport 579×806, DPR 1.1979; import JPEG fixture 64×48, thêm rectangle, Shift+ArrowRight, Ctrl+Z/ Ctrl+Shift+Z và xác nhận trạng thái Undo/Redo; Delete xóa layer và Ctrl+Z khôi phục; ArrowUp trong ô độ rộng viền tăng 0→1 và focus vẫn ở input. UI smoke trước đó đã xác nhận reorder + Enter, Ctrl+Y, dialog export Tab/Escape. Không tải Blob xuống đĩa.
- **Giới hạn nghiệm thu:** harness kiểm logic nhiều keydown/key-up và gom một history step; CUA không mô phỏng auto-repeat vật lý của OS. Chưa kiểm IME tiếng Việt thật, Cmd trên macOS, screen reader, browser/device/DPR khác hoặc file export tải xuống. **Day 19 có bằng chứng implementation/harness/UI trong phạm vi trên; không tuyên bố AC-21/22/39 hay Gate 3 hoàn tất 100%.** Day 20 cần smoke chuỗi geometry → adjust → text/shape → reorder → undo/redo → export theo roadmap.

## 27. Phase 3 — Day 20 creative integration (08/10/2026)

- Thêm `tests/manual/day20-creative-integration.html` và `.ts`, rồi đăng ký harness trong `tsconfig.json`. Harness dùng ảnh nguồn tổng hợp 64×48; không thêm package, product API hay test runner. Năm nhóm assert kiểm crop → resize 2× → rotate; preset + sliders + text nhiều dòng tiếng Việt + rectangle/circle/line; delete/reorder theo pixel z-order và giữ background cố định; hidden layer, alpha và kích thước export; full-snapshot Undo/Redo, no-op và redo-branch invalidation.
- Chạy lại bộ 16 trang manual Day 2, 3, 7–20: 98 nhóm PASS (93 nhóm trước Day 20 + 5 Day 20). Môi trường harness: Chrome 155 / Windows 10, viewport 1280×720, DPR 1.1979. Day 3 bổ sung reload/restore WebP source hash + snapshot và transaction-abort rollback; tạo draft trên origin riêng 5175 rồi xóa sạch. Origin 5173 có nút restore đang bật trước lượt này nên không chạm/xóa database đó. `npm.cmd run typecheck`, `npm.cmd run build` và `git diff --check` pass; JS bundle 604.29 kB, Vite cảnh báo >500 kB.
- Product UI smoke localhost với `tests/fixtures/day2-import/jpeg-orientation-1.jpg` (64×48): brightness +20, text hai dòng, thêm đủ rectangle/circle/line, reorder circle lên trên, crop Apply về 56×40, Undo/Redo. Ẩn circle, chọn lại từ Layers, sửa stroke width và xác nhận nút vẫn là “Hiện Hình tròn 1”; layer không tự hiện. Thêm text ở X=100 px, ẩn layer, chọn lại từ Layers; properties giữ X=100 và visibility vẫn ẩn. Ctrl+Z trong textarea xóa ký tự cuối vừa được Playwright nhập và Undo editor vẫn còn. Sau zoom + mở/đóng export, Undo đưa stroke width 2→0, nên hai thao tác đó không thêm bước history trong smoke này. Console không có lỗi.
- Tạo PNG qua hộp thoại app và tải file thật về `C:\Users\khanh\Downloads\jpeg-orientation-1-edited.png`. Kích thước file 2,321 byte; PNG signature hợp lệ; IHDR 56×40 khớp dialog. Engine harness đã kiểm pixel màu/z-order, alpha và geometry; file tải thật ở lượt UI này mới kiểm signature/dimensions và xem nội dung ảnh, không so từng pixel.
- AC-19 fix: `ensureTextFontReady` nhận cờ retry tường minh; retry làm mới `src` của các `@font-face` cùng origin bằng query cache-busting rồi chạy lại kiểm tra tải font. Export và các lần tải thường vẫn fail-closed. `EditorCanvas.setTextProperties` chuyển cờ retry; `App` có nút retry sau lỗi Add Text và lỗi đổi font, giữ textbox/kiểu cũ khi lỗi properties. Day 16 harness thêm explicit repeated-retry assert.
- Sau cập nhật, Day 15/16/20 harness pass lần lượt 7/8/5 nhóm trong Chrome 155 / Windows 10, viewport 1280×720, DPR 1.1979. Build/typecheck pass; JS bundle 605.41 kB và Vite cảnh báo >500 kB. Proxy UI kiểm Add Text font Noto Sans thất bại khi bị chặn → bỏ chặn → Retry tạo textbox; tiếp đó đổi Noto Sans sang Noto Serif khi bị chặn giữ selection/kiểu cũ → bỏ chặn → Retry áp dụng Noto Serif và bỏ alert. Console proxy không có error/warning sau retry.
- **Audit 100% kế hoạch Day 20: chưa đạt.** Danh sách kiểm tra bổ sung trong harness còn thiếu IME thật và giữ dấu sau blur/export; Ctrl+Z native trong lúc composition; export lỗi font trên UI rồi retry thành công; đối chiếu pixel/nội dung của PNG tải thật với output mong đợi. Các smoke đã có trước đó chỉ xác nhận Ctrl+Z với text do Playwright nhập, Add Text/properties retry qua proxy, hidden/off-canvas, zoom/export history và PNG signature/kích thước; không nâng chúng thành bằng chứng cho IME hoặc pixel equality.
- **Trạng thái UI tại lần audit này:** Codex In-app Browser đang ở trang đầu `http://127.0.0.1:5173/`, nút “Chọn ảnh” focus, chưa có ảnh được nhập và chưa có input IME mới. AC-17/18 vì vậy vẫn chưa nghiệm thu; cần chọn fixture `tests/fixtures/day2-import/jpeg-orientation-1.jpg`, nhập `Tiếng Việt: Ắ ễ đ ộ`, Enter, `Mùa hè` bằng IME thật, rồi kiểm sau blur/export.
- Day 15/16/20 harness được chạy lại trên Chrome 155 / Windows 10, viewport 1280×720, DPR 1.1979; lần lượt 7/8/5 nhóm PASS. `npm.cmd run build` gồm typecheck pass, bundle 605.41 kB với cảnh báo Vite >500 kB; `git diff --check` pass. Full 98 nhóm được chạy trước fix font; chưa chạy lại toàn bộ sau fix.
- AC-19 UI Add Text và properties failure/retry đã được kiểm qua proxy; export failure với font asset lỗi mới có bằng chứng fail-closed từ engine harness, chưa kiểm UI. AC-20/21/23 có core/harness evidence và chuỗi UI một phần; toàn bộ properties và pixel output trên file tải chưa được lặp hết qua product UI. AC-22 có UI evidence cho hidden layer giữ hidden sau khi sửa style và properties đúng với text off-canvas tại X=100. AC-24 có harness no-op/redo-branch và UI smoke zoom/export không thêm history; redo/no-op đầy đủ trong product UI còn thiếu. **Day 20 có integration harness và phần lớn smoke, nhưng chưa đạt 100%; Gate 3 chưa đạt.** Bước roadmap tiếp theo là Day 21: IndexedDB asset/draft/meta, transaction save atomic và trạng thái save (AC-32–33); chưa triển khai ở task này.

## 28. Phase 4 — Day 21 draft persistence và save status (09/10/2026)

- `src/features/editor/engine/draftStore.ts` mở database `miniphoto-local`, version 1, với object stores `assets`, `drafts` và `meta`. `meta` ghi schema version 1; draft duy nhất có key `current`. Asset lưu source `Blob`, MIME đã validate lúc import, byte size, dimensions sau orientation, tên file và import time. Draft lưu snapshot hiện tại, asset ID, revision từ `HistoryState`, thumbnail, `updatedAt`, schema/preset/app/renderer versions. App/renderer versions được lấy lúc build từ manifest: `0.1.0` và Fabric `7.4.0`.
- `saveCurrentDraft` render thumbnail từ source, adjustment filters, document transform, scene overlays và font trong snapshot. Thumbnail có cạnh dài tối đa 256 px, JPEG quality 0.8, nền trắng và cap 256 KiB. API chỉ resolve sau `transaction.complete`. Lần đầu/thay asset ghi asset và draft cùng transaction; khi thay, asset cũ được xóa trong transaction đó. Cùng asset chỉ ghi draft/thumbnail, không put lại Blob. `readCurrentDraft` đọc asset+snapshot để harness xác minh; App chưa dùng để restore. `miniphoto-day3-spike` vẫn riêng và không đổi.
- `draftAutosave.ts` coalesce request 800 ms, không chạy chồng save; khi save cũ đang chạy, revision mới nhất được xử lý kế tiếp và kết quả cũ không đánh dấu SAVED. `App.tsx` đặt DIRTY lúc import và mỗi lần history/revision đổi, hiển thị NOT_SAVED/DIRTY/SAVING/SAVED/SAVE_ERROR ở statusbar với live region, và thử flush khi document visibility thành hidden. Error không khóa thao tác editor/export. Không có bảo đảm flush bằng `beforeunload`.
- Thêm `/tests/manual/day21-draft-save.html` + `.ts` và `/tests/manual/day21-save-error.html` + `.ts`; đăng ký hai file TypeScript trong `tsconfig.json`. Harness IndexedDB chạy tại `http://127.0.0.1:5175`, pass 5 nhóm: schema/metadata/source Blob/snapshot/thumbnail, debounce + revision + source write-once, stale completion, transaction abort rollback + SAVE_ERROR, successful replacement. Reload harness rồi mở kết nối database mới vẫn đọc được draft và Blob đã lưu. Không cài package hoặc thêm test runner.
- Product UI smoke trên Codex In-app Browser, origin cô lập `http://127.0.0.1:5175`: import fixture WebP 1024×772 và `jpeg-orientation-1.jpg` đã qua orientation, statusbar ghi nhận DIRTY → SAVING → SAVED. `/tests/manual/day21-save-error.html` dùng `armNextDraftSaveAbortForManualCheck()` chỉ trong dev để abort transaction của App thật. Thay ảnh B bị abort hiện SAVE_ERROR; đọc lại IndexedDB vẫn thấy WebP A và revision cũ. Tạo PNG qua export dialog thành công, status vẫn SAVE_ERROR; xoay B rồi ghi nhận DIRTY → SAVING → SAVED, draft mới là JPEG B revision 1. Harness lưu chuỗi statusbar để bắt trạng thái SAVING ngắn.
- Cùng lần UI smoke, zoom, pan và export sau khi lưu đều giữ status SAVED và không đổi revision/`updatedAt` đọc từ IndexedDB. Export khi SAVE_ERROR cũng hoàn tất, nhưng không tải Blob xuống đĩa. Trước đó thao tác hủy thay ảnh trên PNG alpha 3×1 cũng giữ document đang mở và draft cũ. Dữ liệu thử nghiệm vẫn nằm riêng ở origin 5175; không xóa database của origin khác.
- `npm.cmd run typecheck`, `npm.cmd run build` và `git diff --check` pass; production bundle 611.05 kB, Vite cảnh báo chunk vượt 500 kB. UI chạy trong Codex In-app Browser; không xác minh trên browser hoặc thiết bị khác.
- **Audit:** hoàn thành 100% phạm vi kế hoạch Day 21: lưu thành công, lỗi transaction/rollback, status UI, export và chỉnh sửa tiếp, stale completion, write-once asset, revision, thumbnail, typecheck/build đều có evidence. AC-32 toàn sản phẩm chưa hoàn tất tới khi Day 22 xác minh app khôi phục source và snapshot sau reload; restore không thuộc phạm vi ngày này. Chưa kiểm quota/private mode/eviction thật, mobile, screen reader hoặc browser khác. Day 22 giữ restore/recovery, Day 23 giữ lease nhiều tab.

## 29. Phase 4 — Day 22 draft restore/recovery (09/10/2026)

- engine/draftValidation.ts kiểm cấu trúc snapshot schema 2, khóa/ID, document geometry, transform, preset/adjustments và overlay; tạo thử Fabric objects trước khi chấp nhận. draftStore.ts kiểm Blob/MIME/dimensions/metadata rồi phân loại ready, source-only hoặc unrecoverable. Draft hỏng không bị xóa khi đọc. deleteCurrentDraft xóa draft và asset liên kết trong một IndexedDB transaction.
- imageImport.ts giải mã asset đã lưu và kiểm MIME/dimensions; restore giữ asset ID và thời điểm import. history.ts nhận revision khôi phục nhưng khởi tạo một history entry, vì vậy không khôi phục các bước Undo cũ. App kiểm tra draft trước khi vào Editor, hiển thị card trên Home, chỉ restore sau lựa chọn “Tiếp tục chỉnh”, và xác nhận trước khi mở riêng ảnh nguồn hoặc bỏ draft. Mở ảnh mới không xóa record cũ cho tới khi lần autosave đầu tiên của ảnh mới thành công; lỗi/hủy giữ draft trước. /editor trực tiếp vẫn chờ người dùng chọn khi có draft.
- Thêm /tests/manual/day22-draft-restore.html + .ts vào tsconfig.json; không thêm dependency/test runner. Năm nhóm pass: snapshot có Warm/adjustments/text/shape ẩn, source identity/dimensions/revision; thay draft bị hủy giữ record trước; schema không hỗ trợ vẫn giữ được source-only; bỏ draft xóa record và asset liên kết; asset thiếu không tự xóa draft cho tới khi được xác nhận bỏ.
- Product UI smoke trên origin tách biệt http://127.0.0.1:5176: JPEG fixture 64×48 → rotate 90° → lưu và reload khôi phục document 48×64; sau đó xác nhận Warm, brightness +12, text, shape ẩn và Undo ban đầu disabled (history mới bắt đầu từ snapshot được restore). Hủy thay ảnh giữ nguyên draft cũ; xác nhận bỏ xóa draft/asset và direct /editor trở về Home. Schema lạ hiện cảnh báo source-only; xác nhận mở ảnh nguồn tạo baseline DIRTY rồi SAVED. Xóa asset của fixture xác nhận trạng thái unrecoverable và draft chỉ mất sau xác nhận bỏ. Console không có warning/error.
- Responsive smoke với viewport override 390×844 (browser báo 391×845 CSS px): thẻ cảnh báo asset thiếu và dialog bỏ draft vừa khung, document không tràn ngang (scroll width 376 px). Sau smoke đã xác nhận bỏ fixture, tải lại Home sạch và reset viewport mặc định; đây không phải kiểm tra trên điện thoại thật.
- npm.cmd run typecheck, npm.cmd run build, git diff --check pass. Build có cảnh báo Vite về chunk JavaScript lớn hơn 500 kB. Không có test runner; harness Day 22 là trang thủ công. Origin 5176 đã dọn dữ liệu smoke; origin Day 21 127.0.0.1:5175 không bị chạm. bt12-edited.png untracked có sẵn được giữ nguyên.
- **Giới hạn:** evidence xác nhận phạm vi Day 22 trên một Codex In-app Browser/profile; chưa kiểm browser/device khác, responsive hardware, screen reader, quota/private mode/eviction, crash khi đóng tab hoặc nhiều-tab lease. Day 23 vẫn cần lease. Vì vậy kết luận chỉ giới hạn ở Day 22 implementation/harness/UI smoke; không tuyên bố toàn bộ AC-32/34/36 hoặc Gate 4 hoàn tất.
