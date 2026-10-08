# MiniPhoto Editor — Context Summary

Ngày ghi nhận: **08/10/2026**, múi giờ Asia/Saigon. Đây là bản bàn giao bối cảnh tại thời điểm cập nhật; kiểm tra lại Git và cây tệp trước khi tiếp tục.

**Checkpoint sau triển khai Day 16 (08/10/2026):** Panel chữ hiện có font Noto Sans/Serif, cỡ 8–512 px, đậm/nghiêng, căn lề, màu, opacity, X/Y document hiện tại, góc và chiều rộng wrap 1–8192 px. Mỗi thao tác rời rạc commit riêng; input số/opacity coalesce theo phiên; Escape phục hồi đủ text/style/geometry. Snapshot editor lên schema 2; export tải đúng family/style/weight và fail closed nếu font thiếu. Day 16 harness pass 7 nhóm trên Chrome 155/Windows 10, viewport 579×806, DPR 1.1979; regression Day 10/12/15 pass 6/4/7 nhóm. `npm.cmd run typecheck` và `npm.cmd run build` pass; bundle 581.45 kB, cảnh báo >500 kB. Product UI chưa smoke vì browser session không mở native file picker. Chưa xác nhận AC-17/18/19 đủ 100%: IME thật, Ctrl+Z native, font-load failure/retry trên UI còn cần kiểm; Gate 3 còn mở. `bt12-edited.png` untracked có sẵn, được giữ nguyên.

**Checkpoint triển khai và rà soát Day 14 (08/10/2026):** task bắt đầu ở nhánh `codex/phase-2-editing`, base `d380bc2` (`feat(editor): implement Day 13 adjustments`). File untracked `bt12-edited.png` đã có trước task và được giữ nguyên. Day 14 thêm `PresetId`, registry công thức v1 theo ID/version, shared filter pipeline Mode → RGB gain → preset B/C/S → user B/C/S, tool Bộ lọc với lưới thumbnail 2 cột từ source và document geometry hiện tại; chọn preset commit history một lần, cùng preset là no-op, Original giữ sliders. `/tests/manual/day14-presets.html` pass 6 nhóm: version/history, thứ tự filter, crop/rotate, và đủ 10 preset trên ba ảnh canvas tổng hợp portrait/product/landscape với thumbnail = preview = PNG export tại cùng kích thước; alpha/source được giữ, overlay export vẫn nguyên. UI smoke localhost với `tests/fixtures/day2-import/png-alpha.png` xác nhận chọn Warm, brightness 20, Original giữ 20 và Undo phục hồi preset. Môi trường harness/UI: Chrome 155 trên Windows 10, viewport 579×806, DPR 1.1979. `npm.cmd run typecheck` và `npm.cmd run build` pass; bundle 560.90 kB còn cảnh báo vượt 500 kB. **Chưa hoàn thành 100% AC-16:** các fixture so khớp đều nhỏ hơn giới hạn thumbnail 96×72, nên thumbnail và export đang được so cùng độ phân giải; cần thêm case nguồn lớn hơn giới hạn và kiểm tra cùng preset/version giữa thumbnail đã thu nhỏ với export đầy đủ. AC-15 có bằng chứng engine/UI trong phạm vi đã kiểm. Ảnh QA là tổng hợp, chưa đánh giá màu trên ảnh thật; Gate 2 còn mở, Day 13 AC-13/14 chưa đủ UI evidence, draft persistence chưa có.

**Checkpoint trước khi xuất bản Day 13 (08/10/2026):** Tại thời điểm rà soát, nhánh `codex/phase-2-editing` ở HEAD `b3883fd` (`feat(editor): apply Day 12 resize`) và thay đổi Day 13 chưa commit/push. Brightness/Contrast/Saturation đã được nối vào Properties, snapshot/history, preview Fabric và export từ source element gốc; Day 13 harness pass, regression Day 8/10/12 pass, `npm.cmd run build` pass. Bundle 555.87 kB còn cảnh báo >500 kB. Harness đo đồng bộ filter + `StaticCanvas.renderAll()` p95 0.1 ms trên Chrome 155 / Windows 10, viewport 1280×720, DPR 1.1979; đây không phải độ trễ UI/compositor hay thiết bị mobile. Browser không cung cấp hộp thoại chọn file nên luồng App import → Editor → adjust/undo/export chưa được smoke. AC-13/14 chưa được xác nhận đủ 100%; Gate 2 còn mở. Bước kế tiếp theo roadmap là Day 14 — preset màu.

**Mốc Git trước khi xuất bản Day 5 (07/10/2026):** checkout ở nhánh `codex/phase-1-foundation`, HEAD `54fd8b1` (`feat(app): add responsive Day 4 shell and Gate 0 evidence`), tracking `origin/codex/phase-1-foundation`. Tại checkpoint này, thay đổi Day 5 còn chưa commit ở `src/App.tsx`, `src/app.css`, `src/features/editor/EditorCanvas.tsx` và các tài liệu. Fabric Canvas lifecycle và ResizeObserver đã được triển khai; build/typecheck pass, browser local xác nhận một wrapper sau StrictMode replay và canvas resize theo viewport. Fit/zoom trên document chưa được xác minh vì chưa có import sản phẩm. Đây là mốc lịch sử; kiểm tra Git để biết trạng thái mới nhất.

**Mốc trước khi xuất bản Day 7 (08/10/2026):** nhánh `codex/phase-1-foundation`, HEAD `43ed4bb` (`feat(editor): implement Day 6 image import`). Task Day 7 bắt đầu với working tree sạch; phần triển khai Day 7 sau đó gồm `src/App.tsx`, `src/features/editor/EditorCanvas.tsx`, `src/features/editor/engine/history.ts`, `src/features/editor/engine/imageImport.ts`, `src/features/editor/engine/snapshot.ts`, `tests/manual/day7-history.html`, `tests/manual/day7-history.ts`, `tsconfig.json`, `docs/roadmap.md`, `docs/WALKTHROUGH.md` và `docs/CONTEXT_SUMMARY.md`. Đây là mốc lịch sử; xem Git để xác nhận trạng thái xuất bản hiện tại.

## 1. Mục tiêu sản phẩm

Website chỉnh sửa một ảnh tại trình duyệt, giúp người dùng nhập ảnh, chỉnh sửa và tải kết quả. Desktop là trải nghiệm chính, mobile dùng giao diện responsive. MVP không yêu cầu tài khoản, backend xử lý ảnh hoặc AI.

Nguồn đặc tả: [PRD_MINIPHOTO_EDITOR.md](../PRD_MINIPHOTO_EDITOR.md). Kế hoạch: [docs/roadmap.md](roadmap.md). Quy trình làm việc: [AGENT.md](../AGENT.md).

## 2. Checkout và Git — mốc trước khi tổ chức tài liệu

| Thuộc tính | Giá trị ghi nhận |
|---|---|
| Thư mục | `D:\Documents\126\HocKyDoanhNghiep\MiniPhoto Editor` |
| Nhánh | `main`, theo dõi `origin/main` |
| HEAD | `9675f2b3cc8052730a1a7bbb19948a4cd204477c` |
| Commit | `docs: add MiniPhoto Editor PRD` |
| Tệp tracked trước task này | `PRD_MINIPHOTO_EDITOR.md` |
| Thay đổi tracked trước task này | Không có theo `git diff --name-only` |
| Untracked trước task này | `AGENT.md`, `docs/` chứa roadmap |

Hai tệp ban đầu được tạo tại gốc. Theo yêu cầu tiếp theo, đã chuyển vào `docs/CONTEXT_SUMMARY.md` và `docs/WALKTHROUGH.md`, sửa liên kết tương đối và bổ sung hướng dẫn đọc trong `AGENT.md`. Người dùng đã yêu cầu commit/push bộ tài liệu gồm agent, roadmap, context và walkthrough. PRD không đổi. Trước khi commit, truy vấn `git ls-remote origin refs/heads/main` xác nhận remote vẫn ở HEAD PRD nêu trên. SHA của commit tài liệu và kết quả push phải đối chiếu trực tiếp Git; không suy từ bảng mốc lịch sử này.

## 3. Hiện trạng hoàn thành

| Hạng mục | Trạng thái và bằng chứng |
|---|---|
| PRD | Có tài liệu mục 1–43, FR-01–15, AC-01–42; đã được commit |
| Roadmap | Có kế hoạch 30 ngày công, 6 phase; Day 6–17 đã có implementation/harness cục bộ. Day 17 thêm rectangle/circle/line và history/preview/export; AC-20 có bằng chứng core nhưng chưa xác nhận đủ acceptance. Day 16 cần IME thật, Ctrl+Z native, UI retry/failure. Day 14 AC-16 thiếu kiểm thumbnail thu nhỏ so với export. Day 10 còn AC-06/07/08 một phần; Gate 2 còn mở và Gate 3 chưa đạt do các AC creative/layers còn thiếu |
| Hướng dẫn agent | Có `AGENT.md`, quy tắc triển khai, 42 AC và hướng dẫn đọc hai tài liệu trong `docs/` |
| Ứng dụng | Home/Editor/Privacy dùng History API trong phiên. Import một ảnh và history trong RAM; Day 8 xoay/lật, pan và PNG/JPG export; Day 9–12 crop/resize; Day 13 adjust màu; Day 14 10 preset v1; Day 15 textbox tiếng Việt; Day 16 properties chữ/font; Day 17 thêm/chọn/kéo/scale/rotate hình chữ nhật, tròn, đường thẳng và sửa fill/stroke/opacity. Chưa có panel Layers hoặc draft persistence |
| Toolchain | Có `package.json`, `package-lock.json`, Vite và TypeScript strict; `dev`, `typecheck`, `build`, `preview` |
| Lưu trữ, export, dịch vụ | IndexedDB draft còn ở Day 3 harness; sản phẩm tạo PNG/JPG blob cục bộ với MIME/dimensions đã kiểm. Không có backend xử lý ảnh |
| Kiểm thử/triển khai | Mới nhất: `npm.cmd run typecheck`, `npm.cmd run build`, `git diff --check` pass; JavaScript bundle 594.31 kB, Vite cảnh báo >500 kB. Day 17 manual harness pass 8 nhóm: defaults/giới hạn nhỏ, validation, property atomicity, circle và line transform round-trip, history/cap 50, PNG export pixel của ba shape. Regression Day 7/10/12/15/16 pass 7/6/4/7/7 nhóm. Chrome 155 / Windows 10, viewport 1280×720, DPR 1.1979; UI smoke import JPEG 64×48, add/move line, Undo/Redo, sửa stroke rồi Undo và tạo PNG Blob 355 byte; không có console error. Không có `test` script; harness là trang thủ công. Chưa tải file xuống đĩa, chưa kiểm mobile, screen reader, browser/DPR khác, line handle scale/rotate trong UI, IME thật/Ctrl+Z native/font retry UI, network audit hoặc draft; Gate 2 AC-13/14 và Gate 3 còn mở |

Wireframe ASCII, ví dụ TypeScript, cây thư mục và API nội bộ trong PRD là thiết kế đề xuất. Không coi chúng là mã ứng dụng hoặc dữ liệu mô phỏng đang chạy.

## 4. Phạm vi P0 và phần loại trừ

P0 gồm nhập JPG/PNG/WebP tĩnh; crop, resize giữ tỷ lệ, rotate/flip; Brightness/Contrast/Saturation; filters; text tiếng Việt; rectangle/circle/line; layers; undo/redo; compare; export PNG/JPG/WebP; một draft local có restore; responsive và accessibility.

Không tự thêm native app, nhiều ảnh/project, cloud sync, login, AI, rich text, vẽ tay, batch export, HEIC/RAW/GIF/SVG hoặc PWA. Exposure, Temperature, Blur, Sharpness thuộc phiên bản sau. Chi tiết tại PRD mục 6, 11–25 và 39.

## 5. Quyết định và giả định

| Nhóm | Nội dung | Trạng thái theo PRD mục 1 |
|---|---|---|
| D01–D04 | Web responsive; ba adjust P0; adjust nâng cao để sau; một draft local | Người dùng xác nhận |
| D05–D06 | Bộ công cụ chỉnh ảnh; xử lý browser, không login/AI | Kế thừa ý tưởng gốc |
| D07 | React, TypeScript, Vite, Fabric.js, CSS Modules | Đã chọn làm stack MVP; Gate 0 reassessment hỗ trợ tiếp tục với stack trong các nhánh spike, chưa chứng minh mọi browser |
| D08 | Một document, một ảnh nền, tối đa 50 overlay | Đề xuất giới hạn |
| D09–D11 | Tiếng Việt và Home sáng/Editor tối đã dùng theo lựa chọn người dùng cho Day 4; bottom sheet mobile và không tracking ngoài vẫn là giả định/đề xuất |
| D12 | Mục đích, đội ngũ, deadline, kỹ năng | Chưa có câu trả lời |

Decision log của Phase 0/Day 1 tại [docs/DECISION_LOG.md](DECISION_LOG.md) chọn D07 cho MVP; D08–D11 vẫn là đề xuất/giả định cần đo hoặc xác nhận.

Việc chọn D07 chỉ áp dụng cho stack MVP sau Day 1; D08–D11 vẫn là giả định/đề xuất. Phiên bản và môi trường đã khởi tạo được ghi trong `docs/DECISION_LOG.md`; các giới hạn vẫn phải qua spike/QA.

## 6. Kiến trúc và các quy tắc cần giữ

Luồng thiết kế: UI → command → trạng thái document/scene → snapshot/history → autosave hoặc export. React quản lý UI; engine quản lý scene tương tác; IndexedDB dự kiến lưu source asset, draft và metadata. Xem PRD mục 28–32 và agent mục 7–14.

- Giữ source image bất biến; preview có thể dùng proxy, export dùng nguồn đủ độ phân giải.
- Geometry tác động toàn composition, kể cả overlay hidden/off-canvas; adjust/filter chỉ tác động ảnh nền.
- Zoom/pan/selection không đổi document hoặc tạo history. Một gesture/phiên edit là một commit; no-op không tạo bước undo.
- History dùng snapshot JSON, tối đa 50 bước và giới hạn 10 MiB; không lưu bitmap mỗi bước.
- Snapshot không chứa viewport/runtime handles. Validate schema/version trước restore.
- Autosave theo revision, transaction atomic; chỉ báo đã lưu sau transaction complete. Bảo vệ draft bằng lease khi nhiều tab.
- Export kiểm tra MIME thật, dimensions, alpha, font và lỗi encode; không xuất proxy hoặc âm thầm đổi định dạng.
- Lỗi/hủy import, crop, export hoặc draft không được làm mất document hiện tại.
- Local storage không phải backup vĩnh viễn; chưa có cam kết reload offline hay chuyển draft giữa thiết bị/origin.

## 7. Kế hoạch và gate

| Phase | Ngày công | Gate dự kiến |
|---|---:|---|
| 0 — Spike | 1–3 | Engine/source-proxy/export/draft roundtrip bằng file thật |
| 1 — Nền tảng | 4–8 | App shell, import, history, rotate/flip, PNG/JPG export |
| 2 — Chỉnh ảnh | 9–14 | Crop/resize, adjust và filters đúng |
| 3 — Creative | 15–20 | Text, shapes, layers, keyboard, history/export |
| 4 — Hoàn thiện | 21–25 | Draft/lease, WebP, compare, mobile |
| 5 — QA/release | 26–30 | AC có evidence, QA/performance/privacy/pilot |

**Day 1–3 hoàn thành ở mức decision log/toolchain và spike; Gate 0 đạt trong phạm vi harness; Day 4 hoàn thành app shell; Day 5 canvas lifecycle/viewport đã được kiểm Fit/zoom trên document trong Day 6; Day 6 import đã implementation và kiểm một phần.** Người dùng xác nhận UI chỉ tải một ảnh, nhưng không ghi nhận kênh/thao tác hoặc browser; hủy picker chưa xác minh và chưa coi là đã kiểm thả nhiều file. AC-03 còn bằng chứng một phần; Gate 1 chưa đạt vì history, rotate/flip và export sản phẩm chưa có. Ngày là ngày công tương đối, không phải lịch đã cam kết. Roadmap giả định một developer biết React/TypeScript, thêm dự phòng 15–25%. Không tự publish production dựa trên ngày 30.

**Cập nhật hiện trạng 08/10/2026:** Day 7 history core, Day 8 source-image vertical slice, Day 9 crop pending, Day 10 crop apply, Day 11 resize form và Day 12 apply resize đã được triển khai; harness/build/typecheck chạy trong task Day 12. Day 10 có code commit crop một bước, cập nhật bounds/translation toàn document, giữ z-order/scene, clip preview/export và effect fit/center khi đổi W/H. Day 11 có form ratio lock, helper rounding/limits, error inline và upscale warning. Day 12 dùng `resizeDocument` để ghép scale vào shared transform, giữ source/scene, commit một bước; manual harness pass 4 nhóm kiểm tra về geometry, history và export. UI product flow chưa được smoke với ảnh thật; auto-fit/center sau resize chỉ được xác nhận ở code hiện có, chưa đo runtime. Chưa xác nhận Day 10 đạt 100% acceptance: browser smoke chưa đo viewport sau Apply; fixed-ratio Apply chưa được kiểm end-to-end; AC-06 chỉ có scene fixture, còn AC-07 không thể kiểm draft vì draft chưa tồn tại. Day 11 AC-10 và Day 12 AC-09 chưa được kiểm browser/device khác. Chưa có UI tạo/chỉnh/chọn overlay. Không đánh dấu các AC đạt. Day 8 vẫn thiếu cross-zoom/DPR, proxy/text và encode/memory failure/retry evidence. Gate 1 đạt cho source-image flow.

## 8. Kiểm tra và giới hạn bằng chứng

Day 1: `npm.cmd install --no-audit --no-fund` hoàn tất và tạo lockfile; `npm.cmd run build` pass. Day 2: `npm.cmd run typecheck` và `npm.cmd run build` pass; chạy lại manual harness tại `/tests/manual/day2-import.html` trên localhost với cả Fabric URL và ImageBitmap decoder. Hai đường đều pass JPEG EXIF 1–8, PNG alpha, static WebP 1024×772, source hash bất biến và lỗi giữ candidate trước; Fabric path cũng pass abort và 13/13 Blob URL revoke đúng một lần. Phiên bản browser không xác minh được.

Day 3 ban đầu: `npm.cmd run typecheck` và `npm.cmd run build` pass; PNG tổng hợp 3072×1536 qua crop → resize → rotate thành 1920×3456, proxy 2048×1024; alpha marker/hash nguồn/IndexedDB reload/abort đều pass. Reassessment Gate 0 mở rộng harness xác minh pixel text trong PNG, chi tiết sọc full-resolution và geometry/export với fixture WebP tĩnh. Sau reload, IndexedDB khôi phục WebP source hash, snapshot, transform và preview 740×992; transaction abort vẫn giữ draft/source cũ. PNG là Blob thật được decode và kiểm MIME/dimensions/pixel trong browser, nhưng chưa tải/mở bằng ứng dụng ngoài. Kết quả chỉ áp dụng cho một origin/browser profile; browser version/UA không xác minh được. `canvas` native install script chưa được cho phép; Node-backed canvas chưa được kiểm chứng.

Day 4: app shell có `/`, `/editor`, `/privacy`; query `?preview=loading|error` chỉ hoạt động ở dev; Editor dùng drawer thuộc tính tablet và shell mobile; dialog native đóng bằng Escape và focus trở lại trigger. Bố cục được xem tại 360 px, 820 px và 1366 px; đã sửa overflow ngang trên Editor ở 360 px. Đây là bằng chứng giao diện shell, không chứng minh import, canvas engine, persistence hay export của sản phẩm.

Day 5 implementation: `src/features/editor/EditorCanvas.tsx` tạo một Fabric Canvas theo vòng đời component; cleanup ngắt ResizeObserver và tuần tự hóa `dispose()` để chịu React StrictMode cleanup/replay. Resize đồng bộ dimensions canvas rồi giữ zoom và căn giữa document bằng viewport transform; Fit/zoom chỉ đổi viewport, không đổi document size. Runtime ở 360×800 và StrictMode được kiểm tại task Day 5; Day 6 đã kiểm Fit/zoom trên WebP 1024×772. Browser version không xác minh.

Day 6 implementation (07/10/2026): `src/App.tsx` dùng một hidden file input cho Home/Editor, dropzone Home nhận đúng một file, cập nhật route bằng History API trong phiên và chuyển direct `/editor` không có candidate về `/`. `src/features/editor/engine/imageImport.ts` kiểm tra file rỗng, >20 MiB, định dạng theo header, MIME được khai báo khi xung đột, 12 MP/8192 px và APNG/WebP animation trước `decodeWithFabricUrl`; candidate được kiểm tra kích thước lần nữa sau decode. `EditorCanvas` render FabricImage không chọn được trên nền checkerboard, fit lại khi candidate mới đến kể cả cùng kích thước, tháo ảnh khỏi Canvas trước khi dispose candidate. Thay ảnh chỉ commit sau xác nhận; lỗi/hủy giữ candidate đang mở.

Kiểm tra task Day 6: `npm.cmd run typecheck` pass; `npm.cmd run build` pass, Vite cảnh báo bundle JavaScript 525.21 kB vượt 500 kB. Manual harness `/tests/manual/day2-import.html` pass synthetic header/limits/animation cases và bộ fixture hiện có (JPEG EXIF 1–8, PNG alpha, WebP tĩnh, corrupt, abort, 13/13 URL revoke). Codex In-app Browser trên localhost xác nhận JPEG EXIF 6 thành 48×64, cancel/confirm replacement, WebP 1024×772 Fit 69% → zoom 83% → thay cùng kích thước Fit 69%, corrupt replacement giữ WebP cũ, refresh `/editor` về Home và back/forward giữ candidate trong phiên. Người dùng xác nhận UI chỉ tải một ảnh, nhưng không ghi nhận kênh/thao tác/browser; hủy picker chưa xác minh và lời xác nhận không được tính là kiểm tra thả nhiều file. AC-03 có bằng chứng một phần. Browser version, mobile view, screen reader và network audit không xác minh.

Bằng chứng lịch sử trong hội thoại: PRD từng được commit/push và SHA remote được đối chiếu ở task trước; agent từng được kiểm đủ 42 AC. Day 6 đã được commit tại `43ed4bb`; Day 7 được mô tả ở mục dưới. Đối chiếu Git trực tiếp để biết trạng thái commit/push sau mốc lịch sử này. Xem [WALKTHROUGH.md](WALKTHROUGH.md).

### Day 7 implementation (08/10/2026)

`src/features/editor/engine/snapshot.ts` định nghĩa baseline JSON hiện tại; `history.ts` triển khai các entry JSON bất biến, no-op, cắt nhánh redo, revision tăng đơn điệu, tối đa 50 bước undo và budget UTF-8 10 MiB. `App` chỉ reset history sau khi chấp nhận ảnh mới và giữ state qua các route; `EditorCanvas` đọc dimensions/transform từ snapshot hiện tại. Browser harness Day 7 pass 7 nhóm assert. `npm.cmd run typecheck`, `npm.cmd run build` và `git diff --check` pass; build cảnh báo JavaScript 527.12 kB vượt ngưỡng 500 kB của Vite. UI chưa có edit command, nên commit qua lệnh chỉnh sửa sản phẩm và đầy đủ AC-23–25 chưa được xác minh; AC-41 và Gate 1 còn pending.

### Day 8 implementation (08/10/2026)

`geometry.ts` lưu phép xoay/lật toàn document bằng affine matrix trong snapshot; `App` commit lệnh vào history và `EditorCanvas` áp transform lên source image. Pan dùng viewport transform riêng. `exportImage.ts` render PNG/JPG đúng document size với alpha, quality và nền JPG; UI tạo link tải qua Blob URL. Manual harness pass sáu nhóm kiểm tra, gồm geometry inverse, sample layer points, undo/redo, alpha PNG, output WebP 1024×772 và nền JPG. Typecheck/build pass; Vite cảnh báo bundle 536.22 kB vượt ngưỡng 500 kB. Browser app xác nhận PNG 3×1 xoay thành 1×3 rồi Undo về baseline, cả hai định dạng tạo Blob, pan ảnh WebP không đổi document dimensions. **Day 8 chưa hoàn thành 100%:** AC-04 chưa so sánh output ở zoom 50%/200% và DPR khác; AC-11 chưa đạt vì app/schema không có overlay; AC-12 chỉ có ma trận tổng hợp, chưa có scene nhiều object; AC-28 pass; AC-30 thiếu proxy/text; AC-31 chưa kiểm encode/memory failure và retry. Gate 1 đạt cho vertical slice chỉ có ảnh nguồn. Sample hidden/off-canvas không phải kiểm thử sản phẩm. Download xuống đĩa, mobile riêng, browser version, screen reader và network audit chưa xác minh.

## 9. Rủi ro và bước tiếp theo

Rủi ro chính còn lại là AC-03 picker cancel/multi-file drop chưa kiểm UI, Layers panel/ẩn-hiện/xóa/reorder chưa có, giới hạn bộ nhớ gần 12 MP, draft lỗi/quota/đa tab, browser/thiết bị khác và hành vi tải file bằng ứng dụng ngoài. Harness parser dùng synthetic headers cho giới hạn/animation; app decode fixture thật cho JPEG/PNG/WebP, nhưng không có fixture động thật. Gate 0 chỉ là spike evidence và không chứng minh AC sản phẩm.

Bước tiếp theo theo roadmap là Day 18 — Layers. Hủy picker và thả nhiều file vẫn cần spot-check AC-03; mount/unmount Canvas lặp cũng chưa xác minh lại khi có ảnh. Day 16 còn cần kiểm UI/IME/Ctrl+Z/font retry; Day 17 còn thiếu kiểm UI line handle scale/rotate và QA browser/device khác.

**Cập nhật sau Day 12 (08/10/2026):** Day 12 đã nối Apply resize với shared geometry transform và history; manual harness tổng hợp pass, nhưng kế hoạch chưa xác nhận 100% vì chưa smoke luồng App import → Apply → Undo → export và chưa đo fit/center canvas sau resize. AC-09 có bằng chứng core, chưa có UI end-to-end evidence. Browser/device QA bổ sung cũng còn mở. Day 10 chưa xác nhận 100% acceptance; AC-06/07/08 còn một phần. AC-10 cần browser/device QA bổ sung. Draft, UI authoring/selection/layers, AC-03 picker cancel/multi-file drop, download xuống đĩa và Canvas mount/unmount lặp trên ảnh vẫn cần xác minh.

**Cập nhật sau Day 13 (08/10/2026):** `adjustmentFilters.ts` dùng filter Fabric theo Brightness → Contrast → Saturation; `EditorCanvas` gom update qua `requestAnimationFrame` và giữ scene geometry tách khỏi màu. `ImageImportCandidate.sourceElement` giữ phần tử ảnh gốc để preview không làm export lọc hai lần. Day 13 harness pass bốn nhóm assert và phép đo filter + `StaticCanvas.renderAll()` p95 0.1 ms trên Chrome 155 / Windows 10, viewport 1280×720, DPR 1.1979 (12 lần; max nearest-rank). Đây là số đo đồng bộ trong harness, chưa tính animation frame/compositor, và không xác minh target trên mobile. Day 8/10/12 regressions pass; typecheck/build pass, bundle 555.87 kB >500 kB. Home/Help copy phản ánh các công cụ hiện có. Product editor UI chưa smoke vì Codex In-app Browser không cung cấp native file-picker selection. Còn mở: AC-13 100 input events giữ giá trị cuối và tạo đúng một Undo; keyboard gesture, Enter/blur, Escape, invalid rollback, reset riêng/cả nhóm và undo cần kiểm trong UI. AC-14 cần kiểm UI rằng thay/reset adjust không làm đổi alpha, overlay, crop; preset chưa được triển khai trước Day 14. Cần responsive hẹp/device/browser QA và benchmark preview thực tế. AC-13/14 chưa được xác nhận 100%; Gate 2 còn mở. Tại checkpoint trước khi xuất bản, thay đổi chưa commit/push.

**Cập nhật sau Day 15 (08/10/2026):** `snapshot.ts` chuẩn hóa newline và chặn 2.000 Unicode code point; `text.ts` tạo textbox mặc định ở tâm document, đặt width 80%, size 6% cạnh ngắn (clamp 8–512), xác thực font, giới hạn tổng overlay 50 và serialize transform ngược qua shared document matrix. `EditorCanvas` bật selection/inline editing, textarea làm nguồn nhập thay thế, commit mỗi phiên qua history, xóa overlay khi nội dung rỗng, Escape rollback và trì hoãn commit trong lúc IME composition. `App` nối Chữ vào history, panel và export; fonts Noto Sans/Serif self-host WOFF2 Latin/Latin-ext/Vietnamese với normal/italic và variable weight 400–700, license OFL; export đợi font trước render. Day 15 manual harness pass 7 nhóm, bao gồm từ chối tạo textbox thứ 51 trước preview. Product smoke trên Chrome 155/Windows 10 với WebP fixture 1024×772 nhập/hiện text nhiều dòng tiếng Việt, tạo PNG Blob 1024×772 (1,581,448 byte), Undo/Redo, xóa/Undo, xóa hết nội dung làm textbox bị bỏ selection và Undo khôi phục, cùng Escape pending không thêm bước. `npm.cmd run typecheck`, `npm.cmd run build`, `git diff --check` pass; JS bundle 572.80 kB cảnh báo Vite >500 kB; không thêm dependency/test runner.

**Giới hạn:** smoke nhập bằng textarea/Playwright không xác nhận composition bằng Vietnamese IME thật, Ctrl+Z native, desktop Fabric inline editing, mobile, screen reader hoặc browser khác. Chưa tải PNG xuống đĩa. AC-17/18 chưa được xác nhận 100%; AC-19 font-load failure có harness unknown-family reject nhưng chưa kiểm UI retry; shapes/layers và các thiếu hụt Day 13/14 vẫn mở. Gate 3 chưa đạt.

**Cập nhật sau Day 17 (08/10/2026):** Thêm `engine/shapes.ts` để tạo/validate/serialize rectangle, circle và line; line lưu vector hai đầu quanh tâm riêng vị trí để giữ drag/scale/rotate qua crop/rotate/resize. Circle khóa scale đồng đều. `EditorCanvas` bật select/manipulate và commit qua history; `App` bật panel hình khối với fill trong suốt/màu, stroke, độ rộng, opacity và giới hạn 50 overlay. Scene dùng chung cho preview và export; chưa có persistence hoặc Layers panel.

Day 17 manual harness pass 8 nhóm trong Chrome 155 / Windows 10, viewport 1280×720, DPR 1.1979; regressions Day 7/10/12/15/16 pass 7/6/4/7/7 nhóm. UI smoke: trên PNG alpha 3×1 đã thêm rectangle, đổi stroke, kiểm Undo/Redo và fill trong suốt, thêm circle/line; trên JPEG 64×48 đã kéo/scale circle và xác nhận vẫn tròn, Undo/Redo; smoke hiện tại thêm/kéo line, Undo/Redo, sửa stroke width 1→4 rồi Undo và tạo PNG Blob 355 byte ở 64×48; console không có lỗi. `npm.cmd run typecheck`, `npm.cmd run build` và `git diff --check` pass; bundle 594.31 kB, Vite cảnh báo >500 kB. **AC-20 có bằng chứng core trong engine/export và một phần UI nhưng chưa xác nhận đủ 100%; Day 17 chưa hoàn tất toàn bộ checklist UI.** Còn thiếu: xác nhận thêm/chọn/vị trí gần tâm cho cả ba shape; opacity và Undo một bước cho từng loại thuộc tính; rectangle scale/rotate và line handle đổi độ dài/góc; nút UI khóa cùng scene không đổi ở giới hạn 50; crop clip và kiểm pixel/màu/opacity/kích thước trên file tải thật. Chưa kiểm browser/DPR khác, mobile hoặc screen reader. Gate 3 còn mở; bước tiếp theo là Day 18 — Layers; AC-03, Day 13/14 và Day 16 còn các khoảng trống nêu trên.

## 10. Cách cập nhật

Cập nhật ngày, HEAD, tệp thay đổi, gate/AC có evidence và blocker sau task thực tế. Giữ phân biệt đề xuất, implementation, kiểm tra mới và lịch sử. Không chép secret, nội dung `.env`, token, mật khẩu hoặc log nhạy cảm. Không đánh dấu hoàn thành theo ngày đã trôi qua.
