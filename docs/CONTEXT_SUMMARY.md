# MiniPhoto Editor — Context Summary

Ngày ghi nhận: **07/10/2026**, múi giờ Asia/Saigon. Đây là bản bàn giao bối cảnh tại thời điểm tạo tài liệu; kiểm tra lại Git và cây tệp trước khi tiếp tục.

**Mốc Git trước khi xuất bản Day 5 (07/10/2026):** checkout ở nhánh `codex/phase-1-foundation`, HEAD `54fd8b1` (`feat(app): add responsive Day 4 shell and Gate 0 evidence`), tracking `origin/codex/phase-1-foundation`. Tại checkpoint này, thay đổi Day 5 còn chưa commit ở `src/App.tsx`, `src/app.css`, `src/features/editor/EditorCanvas.tsx` và các tài liệu. Fabric Canvas lifecycle và ResizeObserver đã được triển khai; build/typecheck pass, browser local xác nhận một wrapper sau StrictMode replay và canvas resize theo viewport. Fit/zoom trên document chưa được xác minh vì chưa có import sản phẩm. Đây là mốc lịch sử; kiểm tra Git để biết trạng thái mới nhất.

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
| Roadmap | Có kế hoạch 30 ngày công, 6 phase; Day 5 implementation được ghi nhận, acceptance còn pending |
| Hướng dẫn agent | Có `AGENT.md`, quy tắc triển khai, 42 AC và hướng dẫn đọc hai tài liệu trong `docs/` |
| Ứng dụng | Day 4 có route shell Home/Editor/Privacy; Day 5 nối Fabric Canvas lifecycle, ResizeObserver và Fit/zoom viewport controls vào Editor. Day 6 import chưa triển khai: nút chọn ảnh disabled, không có file input/drop handler; helper Day 2 chỉ decode và chưa được app gọi. Chưa có import/chỉnh sửa/export/lưu sản phẩm |
| Toolchain | Có `package.json`, `package-lock.json`, Vite và TypeScript strict; `dev`, `typecheck`, `build`, `preview` |
| Lưu trữ, export, dịch vụ | IndexedDB draft và PNG export chỉ có trong Day 3 harness; chưa có lưu/export của sản phẩm |
| Kiểm thử/triển khai | Day 5 `npm.cmd run build` (bao gồm typecheck) pass; local browser xác nhận một Fabric wrapper sau StrictMode replay và ResizeObserver cập nhật canvas ở viewport 360×800. Gate 0 reassessment pass trong manual harness; route/layout/dialog được xem ở 360, 820 và 1366 px. Chưa có test sản phẩm tự động; Fit/zoom trên document và Day 5 acceptance đầy đủ vẫn pending |

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

**Day 1–3 hoàn thành ở mức decision log/toolchain và spike; Gate 0 được đánh giá lại là đạt trong phạm vi harness đã chạy; Day 4 hoàn thành app shell responsive; Day 5 canvas lifecycle/viewport đã được triển khai và spot-check runtime một phần, còn Fit/zoom trên document chưa xác minh.** Gate 0 không đồng nghĩa AC sản phẩm đạt. Ngày là ngày công tương đối, không phải lịch đã cam kết. Roadmap giả định một developer biết React/TypeScript, thêm dự phòng 15–25%. Không tự publish production dựa trên ngày 30.

## 8. Kiểm tra và giới hạn bằng chứng

Day 1: `npm.cmd install --no-audit --no-fund` hoàn tất và tạo lockfile; `npm.cmd run build` pass. Day 2: `npm.cmd run typecheck` và `npm.cmd run build` pass; chạy lại manual harness tại `/tests/manual/day2-import.html` trên localhost với cả Fabric URL và ImageBitmap decoder. Hai đường đều pass JPEG EXIF 1–8, PNG alpha, static WebP 1024×772, source hash bất biến và lỗi giữ candidate trước; Fabric path cũng pass abort và 13/13 Blob URL revoke đúng một lần. Phiên bản browser không xác minh được.

Day 3 ban đầu: `npm.cmd run typecheck` và `npm.cmd run build` pass; PNG tổng hợp 3072×1536 qua crop → resize → rotate thành 1920×3456, proxy 2048×1024; alpha marker/hash nguồn/IndexedDB reload/abort đều pass. Reassessment Gate 0 mở rộng harness xác minh pixel text trong PNG, chi tiết sọc full-resolution và geometry/export với fixture WebP tĩnh. Sau reload, IndexedDB khôi phục WebP source hash, snapshot, transform và preview 740×992; transaction abort vẫn giữ draft/source cũ. PNG là Blob thật được decode và kiểm MIME/dimensions/pixel trong browser, nhưng chưa tải/mở bằng ứng dụng ngoài. Kết quả chỉ áp dụng cho một origin/browser profile; browser version/UA không xác minh được. `canvas` native install script chưa được cho phép; Node-backed canvas chưa được kiểm chứng.

Day 4: app shell có `/`, `/editor`, `/privacy`; query `?preview=loading|error` chỉ hoạt động ở dev; Editor dùng drawer thuộc tính tablet và shell mobile; dialog native đóng bằng Escape và focus trở lại trigger. Bố cục được xem tại 360 px, 820 px và 1366 px; đã sửa overflow ngang trên Editor ở 360 px. Đây là bằng chứng giao diện shell, không chứng minh import, canvas engine, persistence hay export của sản phẩm.

Day 5 implementation: `src/features/editor/EditorCanvas.tsx` tạo một Fabric Canvas theo vòng đời component; cleanup ngắt ResizeObserver và tuần tự hóa `dispose()` để chịu React StrictMode cleanup/replay. Resize đồng bộ dimensions canvas rồi giữ zoom và căn giữa document bằng viewport transform; Fit/zoom chỉ đổi viewport, không đổi document size. `src/App.tsx` nối component vào Editor, còn trạng thái chưa có ảnh và controls disabled được giữ nguyên cho tới Day 6. `npm.cmd run build` (typecheck + Vite build) pass; bundle cảnh báo vượt 500 kB. Trong Codex In-app Browser tại `/editor`, StrictMode để lại một `.canvas-container` với hai canvas nội bộ, không hiện runtime error; viewport 360×800 cập nhật surface và wrapper về 339 px. Browser version không được xác minh. Fit/zoom chưa kiểm tra được trên document vì chưa có import; Day 5 acceptance còn pending phần đó.

Day 6 status review (07/10/2026): chưa hoàn thành. Trong `src/App.tsx`, nút “Chọn ảnh” vẫn disabled và không có file input/drag-drop handler; Editor truyền `documentSize={null}`. `src/features/editor/engine/imageImport.ts` chỉ cung cấp decoder helper; `tests/manual/day2-import.*` là harness spike Day 2, không phải luồng sản phẩm. Chưa thấy tích hợp validation size/header/dimensions/animation, candidate state, xác nhận thay ảnh hoặc giữ document khi hủy/lỗi. AC-01–03 còn pending; không chạy test/build trong lần rà soát trạng thái này.

Bằng chứng lịch sử trong hội thoại: PRD từng được commit/push và SHA remote được đối chiếu ở task trước; agent từng được kiểm đủ 42 AC. Với thay đổi Day 5, đã đối chiếu remote SHA trước commit và sẽ xác nhận lại sau push theo quy trình mục 2; vẫn chưa có nghiệm thu ứng dụng. Xem [WALKTHROUGH.md](WALKTHROUGH.md).

## 9. Rủi ro và bước tiếp theo

Rủi ro chính còn lại là geometry/export ngoài các fixture đã chạy, giới hạn bộ nhớ, draft lỗi/quota/đa tab, browser/thiết bị khác và hành vi tải file bằng ứng dụng ngoài. Day 2/3 engine vẫn chưa được app gọi; import limits/animation chưa triển khai; deadline chưa rõ. Gate 0 chỉ là spike evidence và không chứng minh AC sản phẩm.

Bước tiếp theo theo roadmap là triển khai Day 6 import; Day 6 hiện chưa bắt đầu ở mức luồng sản phẩm và AC-01–03 chưa đạt. StrictMode replay và resize đã được spot-check; để chốt Day 5 acceptance cần kiểm tra thêm mount/unmount lặp và Fit/zoom trên document fixture sau khi có luồng import sản phẩm. Gate 1 còn phụ thuộc import, history, rotate/flip và PNG/JPG export; chưa đạt.

## 10. Cách cập nhật

Cập nhật ngày, HEAD, tệp thay đổi, gate/AC có evidence và blocker sau task thực tế. Giữ phân biệt đề xuất, implementation, kiểm tra mới và lịch sử. Không chép secret, nội dung `.env`, token, mật khẩu hoặc log nhạy cảm. Không đánh dấu hoàn thành theo ngày đã trôi qua.
