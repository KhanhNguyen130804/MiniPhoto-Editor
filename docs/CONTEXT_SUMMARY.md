# MiniPhoto Editor — Context Summary

Ngày ghi nhận: **08/10/2026**, múi giờ Asia/Saigon. Đây là bản bàn giao bối cảnh tại thời điểm cập nhật; kiểm tra lại Git và cây tệp trước khi tiếp tục.

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
| Roadmap | Có kế hoạch 30 ngày công, 6 phase; Day 6 import, Day 7 history và Day 8 source-image geometry/pan/export đã implementation/kiểm tra cục bộ; Day 8 chưa đủ 100% (AC-11/30/31 và evidence AC-04 còn thiếu); Gate 1 đạt cho vertical slice ảnh nguồn |
| Hướng dẫn agent | Có `AGENT.md`, quy tắc triển khai, 42 AC và hướng dẫn đọc hai tài liệu trong `docs/` |
| Ứng dụng | Home/Editor/Privacy dùng History API trong phiên. Import một ảnh và history trong RAM; Day 8 thêm xoay/lật có undo, pan viewport và PNG/JPG export. Chưa có overlay text/shape, draft hoặc chỉnh màu/crop sản phẩm |
| Toolchain | Có `package.json`, `package-lock.json`, Vite và TypeScript strict; `dev`, `typecheck`, `build`, `preview` |
| Lưu trữ, export, dịch vụ | IndexedDB draft còn ở Day 3 harness; sản phẩm tạo PNG/JPG blob cục bộ với MIME/dimensions đã kiểm. Không có backend xử lý ảnh |
| Kiểm thử/triển khai | Day 8 typecheck/build pass, bundle cảnh báo 536.22 kB >500 kB; manual Day 8 harness pass geometry/history, PNG alpha/rotation, WebP 1024×772 output và JPG nền. Browser localhost: PNG 3×1 → rotate 1×3 → Undo về 3×1; PNG/JPG blob link sẵn sàng; pan WebP 1024×772 giữ document dimensions. Day 8 chưa đủ 100%: AC-04 chưa so sánh zoom/DPR; AC-11 thiếu overlay; AC-30 thiếu proxy/text; AC-31 failure/retry chưa kiểm. Download xuống đĩa, browser version, mobile riêng, screen reader, network audit, picker cancel/multi-file drop và overlay selection chưa xác minh |

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

**Cập nhật hiện trạng 08/10/2026:** Day 7 history core và Day 8 vertical slice ảnh nguồn đã được triển khai, kiểm tra cục bộ; mô tả cũ ngay phía trên là mốc trước Day 7. History có lệnh geometry trong UI và Undo đã kiểm; AC-23–25 còn thiếu thao tác edit khác. Day 8 chưa đủ 100%: AC-04 chưa kiểm cross-zoom/DPR; AC-11 thiếu overlay; AC-12 chỉ có geometry matrix evidence; AC-28 pass; AC-30 thiếu proxy/text; AC-31 chưa kiểm failure/retry. Gate 1 đạt cho source-image flow, không bao gồm overlay/selection.

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

Rủi ro chính còn lại là AC-03 picker cancel/multi-file drop chưa kiểm UI, overlay/selection chưa có trong sản phẩm, giới hạn bộ nhớ gần 12 MP, draft lỗi/quota/đa tab, browser/thiết bị khác và hành vi tải file bằng ứng dụng ngoài. Harness parser dùng synthetic headers cho giới hạn/animation; app decode fixture thật cho JPEG/PNG/WebP, nhưng không có fixture động thật. Gate 0 chỉ là spike evidence và không chứng minh AC sản phẩm.

Bước tiếp theo theo roadmap là Day 7 baseline/history. Hủy picker và thả nhiều file vẫn cần spot-check AC-03; mount/unmount Canvas lặp cũng chưa xác minh lại khi có ảnh. Gate 1 chưa đạt, còn phụ thuộc history, rotate/flip và PNG/JPG export. Đây là ghi nhận trước Day 7.

**Cập nhật sau Day 8 (08/10/2026):** bước kế tiếp theo roadmap là Day 9 crop pending. Gate 1 đạt cho source-image vertical slice. AC-03 picker cancel/multi-file drop, overlay selection, download xuống đĩa, kiểm thử mobile/browser bổ sung và Canvas mount/unmount lặp trên ảnh vẫn cần xác minh; draft chưa được triển khai.

## 10. Cách cập nhật

Cập nhật ngày, HEAD, tệp thay đổi, gate/AC có evidence và blocker sau task thực tế. Giữ phân biệt đề xuất, implementation, kiểm tra mới và lịch sử. Không chép secret, nội dung `.env`, token, mật khẩu hoặc log nhạy cảm. Không đánh dấu hoàn thành theo ngày đã trôi qua.
