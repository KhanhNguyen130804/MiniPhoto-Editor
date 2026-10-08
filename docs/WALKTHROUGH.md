# MiniPhoto Editor — Walkthrough

Ngày ghi nhận: **08/10/2026**, Asia/Saigon.

Tài liệu ghi lại kết quả khảo sát và các bước đã triển khai. Repository hiện có app shell Day 4, canvas lifecycle/viewport Day 5, import Day 6, history Day 7, geometry/pan/export Day 8, crop Day 9–10, resize Day 11–12, adjust Day 13 và preset màu Day 14. Draft và UI tạo/chọn/chỉnh overlay text/shape chưa triển khai. Walkthrough phân biệt phần đã triển khai, bằng chứng harness và hành vi UI đã kiểm.

## 1. Kết quả hiện có

| Tệp | Vai trò |
|---|---|
| [PRD_MINIPHOTO_EDITOR.md](../PRD_MINIPHOTO_EDITOR.md) | Đặc tả sản phẩm, FR, dữ liệu, kiến trúc, 42 AC và release gate |
| [docs/roadmap.md](roadmap.md) | Kế hoạch triển khai theo từng ngày công, phase và gate |
| [docs/DECISION_LOG.md](DECISION_LOG.md) | Quyết định stack, phạm vi MVP, tiêu chí và kết quả spike Day 1–3 |
| [AGENT.md](../AGENT.md) | Hướng dẫn làm việc, invariants, quy trình kiểm chứng/Git/bàn giao |
| [CONTEXT_SUMMARY.md](CONTEXT_SUMMARY.md) | Bối cảnh ngắn để tiếp tục task, hiện trạng và các quyết định còn mở |
| `WALKTHROUGH.md` | Giải thích đầu ra, quá trình và ranh giới bằng chứng |

Trong app hiện tại, Home và Editor dùng chung luồng chọn ảnh; dropzone Home nhận một file. Candidate hợp lệ được giải mã vào Fabric Canvas và fit viewport. Khi candidate được chấp nhận, `App` tạo baseline snapshot/history trong RAM; rotate/flip, crop Apply, resize Apply, adjust và chọn preset commit snapshot vào history. Preset/slider chỉ áp lên ảnh nền; thumbnail dựng từ source và transform hiện tại, còn preview/export dùng shared filter helper từ `sourceElement` gốc để tránh lọc lặp. Export PNG/JPG dùng document dimensions. Crop pending vẫn tách khỏi snapshot cho tới Apply. Harness Day 2/7/8/9/10/11/12/13/14 kiểm import, history, geometry/export và filter core. Draft và UI tạo/chọn overlay chưa có.

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

Snapshot commit → debounce autosave → kiểm lease/revision → transaction IndexedDB → báo đã lưu sau complete. Reload → validate draft/schema/source → người dùng chọn resume hoặc bỏ draft → khôi phục document và baseline history.

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
- `src/App.tsx` nối Apply của form Day 11 với `resizeDocument`, commit snapshot qua history rồi đóng form; lỗi command giữ form và hiển thị thông báo. Undo/Redo vẫn dùng history hiện có. `EditorCanvas` hiện có effect fit/center theo W/H, nhưng chưa đo trạng thái viewport runtime sau resize.
- Thêm `/tests/manual/day12-resize-apply.html` + `.ts`, đưa harness vào `tsconfig.json`. Harness chạy trong Codex In-app Browser, pass 4 nhóm: resize/no-op/validation và scene references; compose sau crop/rotate; một history commit cùng undo/redo; PNG 32×24 kiểm pixel source, text, rectangle, circle, line, hidden overlay và source pixel bất biến. Regression Day 7–11 pass 7/6/4/6/4 nhóm.
- `npm.cmd run typecheck` pass; `npm.cmd run build` pass, tạo JavaScript bundle 550.93 kB và cảnh báo vượt ngưỡng 500 kB. Không thêm dependency.
- Product route được mở để kiểm, nhưng không import fixture và không smoke luồng Apply/Undo/Export trong UI; browser/device khác, DPR, mobile thật, screen reader, tải file xuống đĩa và encode/memory failure/retry chưa kiểm.
- **Đối chiếu kế hoạch Day 12:** phần implementation và core harness đã pass, nhưng chưa xác nhận hoàn thành 100%. Còn thiếu smoke App import → Apply → Undo → export và đo fit/center canvas sau resize. AC-09 hiện có bằng chứng engine/history/export trên scene tổng hợp, chưa có UI end-to-end evidence; browser/device khác chưa kiểm.
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
