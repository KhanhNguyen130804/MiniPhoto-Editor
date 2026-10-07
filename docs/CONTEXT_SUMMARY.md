# MiniPhoto Editor — Context Summary

Ngày ghi nhận: **07/10/2026**, múi giờ Asia/Saigon. Đây là bản bàn giao bối cảnh tại thời điểm tạo tài liệu; kiểm tra lại Git và cây tệp trước khi tiếp tục.

**Mốc hiện tại — Phase 0/Day 3:** checkout ở nhánh `codex/phase-0-spike`, theo dõi `origin/codex/phase-0-spike`, HEAD `50837f6e7e3b9510f43a4e546afe4f7713fe0daa`. Thay đổi Day 3 chưa stage/commit: `tsconfig.json`, bốn tài liệu trong `docs/`, hai engine spike và hai harness thủ công; `main` không bị thay đổi. Spike Day 3 vẫn tách khỏi app shell.

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
| Roadmap | Có kế hoạch 30 ngày công, 6 phase; là đề xuất, chưa triển khai |
| Hướng dẫn agent | Có `AGENT.md`, quy tắc triển khai, 42 AC và hướng dẫn đọc hai tài liệu trong `docs/` |
| Ứng dụng | React shell vẫn chỉ là tiêu đề; Day 2 có helper decode, Day 3 có pipeline geometry/preview/PNG và IndexedDB spike cô lập; chưa được app gọi |
| Toolchain | Có `package.json`, `package-lock.json`, Vite và TypeScript strict; `dev`, `typecheck`, `build`, `preview` |
| Lưu trữ, export, dịch vụ | IndexedDB draft và PNG export chỉ có trong Day 3 harness; chưa có lưu/export của sản phẩm |
| Kiểm thử/triển khai | Typecheck/build pass; harness Day 2 được chạy lại; Day 3 geometry, PNG, reload/restore và abort rollback pass trong Codex In-app Browser; chưa có test sản phẩm hoặc AC được đánh dấu đạt |

Wireframe ASCII, ví dụ TypeScript, cây thư mục và API nội bộ trong PRD là thiết kế đề xuất. Không coi chúng là mã ứng dụng hoặc dữ liệu mô phỏng đang chạy.

## 4. Phạm vi P0 và phần loại trừ

P0 gồm nhập JPG/PNG/WebP tĩnh; crop, resize giữ tỷ lệ, rotate/flip; Brightness/Contrast/Saturation; filters; text tiếng Việt; rectangle/circle/line; layers; undo/redo; compare; export PNG/JPG/WebP; một draft local có restore; responsive và accessibility.

Không tự thêm native app, nhiều ảnh/project, cloud sync, login, AI, rich text, vẽ tay, batch export, HEIC/RAW/GIF/SVG hoặc PWA. Exposure, Temperature, Blur, Sharpness thuộc phiên bản sau. Chi tiết tại PRD mục 6, 11–25 và 39.

## 5. Quyết định và giả định

| Nhóm | Nội dung | Trạng thái theo PRD mục 1 |
|---|---|---|
| D01–D04 | Web responsive; ba adjust P0; adjust nâng cao để sau; một draft local | Người dùng xác nhận |
| D05–D06 | Bộ công cụ chỉnh ảnh; xử lý browser, không login/AI | Kế thừa ý tưởng gốc |
| D07 | React, TypeScript, Vite, Fabric.js, CSS Modules | Đã chọn làm stack MVP trong Day 1; Gate 0 còn quyền đổi nếu spike không đạt |
| D08 | Một document, một ảnh nền, tối đa 50 overlay | Đề xuất giới hạn |
| D09–D11 | Tiếng Việt, Home sáng/Editor tối, mobile bottom sheet, không tracking ngoài | Giả định/đề xuất |
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

**Day 1 hoàn thành ở mức decision log/toolchain; Day 2 kiểm chứng decode fixtures; Day 3 có spike giới hạn cho geometry, PNG và một draft IndexedDB. Gate 0 vẫn chưa đạt.** Ngày là ngày công tương đối, không phải lịch đã cam kết. Roadmap giả định một developer biết React/TypeScript, thêm dự phòng 15–25%. Không tự publish production dựa trên ngày 30.

## 8. Kiểm tra và giới hạn bằng chứng

Day 1: `npm.cmd install --no-audit --no-fund` hoàn tất và tạo lockfile; `npm.cmd run build` pass. Day 2: `npm.cmd run typecheck` và `npm.cmd run build` pass; chạy lại manual harness tại `/tests/manual/day2-import.html` trên localhost với cả Fabric URL và ImageBitmap decoder. Hai đường đều pass JPEG EXIF 1–8, PNG alpha, static WebP 1024×772, source hash bất biến và lỗi giữ candidate trước; Fabric path cũng pass abort và 13/13 Blob URL revoke đúng một lần. Phiên bản browser không xác minh được.

Day 3: `npm.cmd run typecheck` và `npm.cmd run build` pass. Harness `/tests/manual/day3-spike.html` tạo PNG tổng hợp 3072×1536; crop → resize → rotate ra document/PNG 1920×3456, preview proxy 2048×1024, anchor text chuyển tới (1062,2424), marker alpha trong PNG được giữ và source hash không đổi. Sau reload, IndexedDB khôi phục Blob hash, snapshot, transform và dimensions; transaction abort giữ draft/source cũ. Kết quả này chỉ áp dụng cho đường PNG tổng hợp và một origin/browser profile. Export Blob được decode trong browser nhưng không được tải/mở bằng ứng dụng ngoài; text nhìn thấy trong preview, song chưa có kiểm tra pixel riêng cho text trong PNG export. Browser version/UA không xác minh được. `canvas` native install script chưa được cho phép; Node-backed canvas chưa được kiểm chứng.

Bằng chứng lịch sử trong hội thoại: PRD từng được commit/push và SHA remote được đối chiếu ở task trước; agent từng được kiểm đủ 42 AC. Lần tổ chức/xuất bản tài liệu tiếp theo có kiểm tra remote trước commit như mục 2; vẫn chưa có nghiệm thu ứng dụng. Xem [WALKTHROUGH.md](WALKTHROUGH.md).

## 9. Rủi ro và bước tiếp theo

Rủi ro chính là chưa có bằng chứng rộng cho geometry/export fidelity trên nhiều định dạng/fixtures, nội dung text trong PNG export, giới hạn bộ nhớ và draft lỗi/quota/đa tab; các giới hạn vẫn là mục tiêu đề xuất; deadline chưa rõ. Hai spike chưa được app gọi; input limits/animation và browser/thiết bị khác chưa kiểm tra.

Bước tiếp theo là bổ sung bằng chứng còn thiếu cho Gate 0: xác minh overlay trong PNG export bằng pixel/output file và mở rộng geometry/export fixtures, sau đó quyết định có đủ cơ sở cho Gate 0 hay cần thêm spike. Không đánh dấu Gate 0 hoặc AC sản phẩm đạt từ kết quả harness giới hạn này.

## 10. Cách cập nhật

Cập nhật ngày, HEAD, tệp thay đổi, gate/AC có evidence và blocker sau task thực tế. Giữ phân biệt đề xuất, implementation, kiểm tra mới và lịch sử. Không chép secret, nội dung `.env`, token, mật khẩu hoặc log nhạy cảm. Không đánh dấu hoàn thành theo ngày đã trôi qua.
