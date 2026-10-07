# MiniPhoto Editor — Roadmap triển khai theo ngày

> Roadmap đề xuất dựa trên PRD, chưa phải cam kết lịch hay bằng chứng tính năng đã hoàn thành. Tham chiếu: [PRD MiniPhoto Editor](../PRD_MINIPHOTO_EDITOR.md), mục 1, 6, 27–36 và 38.

## Cơ sở lập kế hoạch

- **Kế hoạch cơ sở:** 30 ngày công, chia thành 6 phase; nằm trong ước lượng 24–36 ngày công của PRD.
- **Nhịp làm việc giả định:** một developer đã biết React/TypeScript, làm 5 ngày mỗi tuần; chưa có deadline được xác nhận.
- **Dự phòng:** giữ thêm 15–25% thời lượng ngoài 30 ngày cơ sở nếu spike engine, bộ nhớ, mobile hoặc trình duyệt phát sinh vấn đề.
- **Phạm vi:** P0 của PRD; không thêm backend, cloud sync, tài khoản, AI, analytics hoặc tính năng P1.
- **Quyết định:** Day 1 chọn D07 theo stack đề xuất của PRD. D08–D11 vẫn là đề xuất/giả định; các giới hạn cần đo ở spike, D12 (mục đích, đội ngũ, deadline, kỹ năng) còn mở. Không coi phần chưa chốt là đã xác nhận.
- **Nguyên tắc triển khai:** responsive skeleton và undo/history bắt đầu từ phase nền tảng; preview dùng proxy nhưng export dùng nguồn đủ độ phân giải; chỉ qua gate khi có bằng chứng phù hợp từ fixture/file thật.

## Lịch 30 ngày công

| Ngày | Phase | Công việc | Đầu ra / điều kiện kết thúc |
|---:|---|---|---|
| 1 | 0 — Spike | Chốt phạm vi P0, quyết định stack và môi trường tối thiểu; ghi lại các quyết định còn mở, giới hạn đề xuất và tiêu chí spike. | **Hoàn thành 07/10/2026:** `docs/DECISION_LOG.md`, React/Vite/TypeScript shell, Node 24 LTS/npm lockfile; typecheck/build pass. Chưa có editor feature; Gate 0 chưa đạt. Không mở rộng sang backend/AI. |
| 2 | 0 — Spike | Thử engine với JPEG, PNG alpha, WebP tĩnh, EXIF orientation và nguồn ảnh bất biến; kiểm tra decode và cleanup tài nguyên. | **Hoàn thành 07/10/2026:** harness trên Codex In-app Browser xác nhận JPEG EXIF 1–8, PNG alpha, WebP tĩnh, byte nguồn bất biến, lỗi/hủy và revoke URL đúng một lần. Fabric blob URL và `createImageBitmap` → canvas đều pass; ưu tiên Fabric vì hỗ trợ abort trực tiếp, còn ImageBitmap không hủy được khi đang decode. `docs/DECISION_LOG.md` ghi evidence. Gate 0 vẫn chưa đạt. |
| 3 | 0 — Spike | Prototype crop → resize → rotate có text; chuẩn hóa snapshot từ preview/proxy, export từ nguồn đầy đủ; roundtrip source Blob và snapshot qua IndexedDB. | Tệp export mở được, đúng pixel/kích thước và overlay; draft roundtrip đọc lại được. **Gate 0:** xác nhận engine/đường dữ liệu đủ tin cậy hoặc dừng để đổi hướng/ước lượng. |
| 4 | 1 — Nền tảng | Tạo app shell, route Home/Editor/Privacy, token và bố cục desktop/tablet/mobile; dựng empty/loading/error states và dialog accessible nền tảng. | Các route mở được; responsive skeleton không làm canvas mất vùng làm việc; trạng thái chính có cấu trúc hiển thị. |
| 5 | 1 — Nền tảng | Tạo lifecycle canvas/editor một lần mỗi mount; xử lý cleanup, resize observer, viewport, Fit và zoom. | Mount/unmount lặp không nhân đôi canvas/listener; Fit/zoom không đổi document hay export dimensions. |
| 6 | 1 — Nền tảng | Làm import chọn/kéo thả một file; kiểm tra size, MIME/header, kích thước, animation và decode; xử lý hủy/thay ảnh. | File lỗi, nhiều file hoặc hủy picker không làm mất document hiện tại; nguồn mới chỉ thay sau xác nhận. (AC-01–03) |
| 7 | 1 — Nền tảng | Xây snapshot baseline và commit boundary; undo/redo, no-op, nhánh redo và giới hạn 50 bước/10 MiB history. | Chuỗi lệnh và undo/redo khôi phục toàn snapshot; zoom, pan, selection, export không sinh history. (AC-23–25, AC-41) |
| 8 | 1 — Nền tảng | Thêm rotate/flip toàn composition, viewport pan/selection và export PNG/JPG ở full resolution. | Overlay hidden/off-canvas biến đổi đúng; bốn lần xoay hoặc hai lần flip trả hình học về trạng thái ban đầu; file đúng W×H, không phụ thuộc zoom/DPR. (AC-04, AC-11–12, AC-28, AC-30–31) **Gate 1:** vertical slice dùng được và undo đúng. |
| 9 | 2 — Chỉnh ảnh | Xây trạng thái crop pending, Free và các tỷ lệ cố định; hiển thị crop frame/grid, thông số số học và kiểm tra bounds. | Cancel/Escape không thay snapshot/history/draft; tỷ lệ không thể chứa bị disable và có lý do. (AC-07–08) |
| 10 | 2 — Chỉnh ảnh | Áp dụng crop lên document và toàn scene; dịch overlay, clipping, giữ layer/z-order; fit lại viewport. | Crop có text/shape đúng hình học; undo phục hồi chính xác; crop no-op không commit. (AC-06–08) |
| 11 | 2 — Chỉnh ảnh | Làm form resize giữ tỷ lệ, Apply/Cancel và kiểm tra số nguyên, NaN, số âm, field trống, cạnh/MP tối đa. | Input lỗi không thay document; báo lỗi cạnh field; hiển thị cảnh báo upscale. (AC-10) |
| 12 | 2 — Chỉnh ảnh | Áp dụng resize cho source và mọi overlay bằng transform đồng đều; giữ nguồn gốc để không resample lặp. | Text/circle/line scale đúng; undo phục hồi; export đúng kích thước mới. (AC-09) |
| 13 | 2 — Chỉnh ảnh | Thêm Brightness, Contrast, Saturation với slider và numeric input; preview live, gom một gesture thành một commit, reset riêng/cả nhóm. | Giá trị cuối đúng; một thao tác kéo tạo một bước undo; alpha và overlay không đổi; kết quả async cũ không ghi đè mới. (AC-13–14) |
| 14 | 2 — Chỉnh ảnh | Thêm 9 preset + Original, phiên bản công thức, thumbnails và pipeline preset → sliders. | Thumbnail/export dùng cùng công thức; Original chỉ tắt preset; thử ảnh chân dung, sản phẩm, phong cảnh và PNG alpha. (AC-15–16) **Gate 2:** hình học, màu và độ trung thực nguồn đạt trên fixtures. |
| 15 | 3 — Creative | Thêm textbox, nhiều dòng, giới hạn ký tự, font tiếng Việt self-host và phiên chỉnh sửa IME có một nguồn nhập active. | Có thể thêm/sửa/xóa text mà không mất dấu; một phiên edit thành một commit; Escape/undo đúng ngữ cảnh. (AC-17–18) |
| 16 | 3 — Creative | Thêm properties text: font, size, màu, căn lề, opacity, X/Y, góc, wrap; chờ font trước đo/render/export. | Font chưa tải/lỗi được xử lý rõ; không âm thầm export bằng font fallback; text export đúng. (AC-17–19) |
| 17 | 3 — Creative | Thêm rectangle, circle, line với fill/stroke/opacity và điều khiển hình học; validate giá trị ở ranh giới command. | Circle không méo ngoài chủ ý; không tạo kích thước 0/NaN; preview và output khớp. (AC-20) |
| 18 | 3 — Creative | Làm Layers panel: chọn overlay, ẩn/hiện, xóa; background cố định dưới cùng và có thể ẩn nhưng không xóa/reorder. | Layer hidden không nhận hit test/không xuất; chọn hidden/off-canvas từ panel vẫn mở properties mà không tự hiện layer. (AC-21–22) |
| 19 | 3 — Creative | Thêm reorder một bậc, phím tắt, di chuyển bằng phím, focus/label cho controls và dialog. | Layer order, selection và keyboard-only controls hoạt động; không chặn phím khi focus input hoặc IME. (AC-21–22, AC-39) |
| 20 | 3 — Creative | Tích hợp text + shape + layers + history + export; kiểm tra font, z-order, hidden/off-canvas và thao tác hỗn hợp. | Chuỗi geometry → adjust → text → reorder → undo/redo phục hồi scene; output đúng. (AC-17–24) **Gate 3:** công cụ creative có thể thao tác và xuất file kiểm chứng được. |
| 21 | 4 — Hoàn thiện | Cài schema IndexedDB cho asset/draft/meta; save source Blob một lần, snapshot/thumbnail theo revision, transaction atomic và trạng thái save. | Chỉ báo SAVED sau transaction complete; lỗi quota giữ draft cũ và editor dùng được. (AC-32–33) |
| 22 | 4 — Hoàn thiện | Thêm restore validation, recovery cho asset thiếu/schema lạ, resume/bỏ draft và thay ảnh an toàn. | Không tự xóa draft hỏng; thao tác thay ảnh lỗi/hủy không để draft trỏ asset bị xóa. (AC-32, AC-34, AC-36) |
| 23 | 4 — Hoàn thiện | Thêm draft lease giữa nhiều tab, heartbeat, mất quyền và takeover bằng transaction; BroadcastChannel chỉ dùng thông báo. | Tab cũ không ghi đè draft mới sau khi mất lease; xử lý crash/lease hết hạn được kiểm tra. (AC-35) |
| 24 | 4 — Hoàn thiện | Hoàn thiện Export: WebP capability, MIME thật, quality, tên file, nền JPG, preview, fallback link và lỗi encode/font/bộ nhớ. | Không đổi đuôi khi MIME sai; PNG/WebP alpha và JPG background đúng; lỗi giữ document/draft và cho retry. (AC-27–31) |
| 25 | 4 — Hoàn thiện | Làm Compare theo đúng PRD và hoàn thiện thao tác mobile: bottom sheet, touch, safe area, bàn phím/viewport; chạy lại restore/export trên responsive layout. | Compare không đổi scene/history và thoát khi cancel/mất focus; các công cụ chính dùng được ở 360 px. (AC-26, AC-32, AC-38) **Gate 4:** restore, export, compare và touch có bằng chứng. |
| 26 | 5 — QA/pilot/release | Bổ sung unit/core checks cho geometry, ratio/rounding, history/no-op, limits, snapshot normalization và preset version. | Các invariants trọng yếu được kiểm tự động; không thay test logic bằng screenshot. |
| 27 | 5 — QA/pilot/release | Bổ sung integration/E2E cho import → crop/resize/màu → export; text/shape/layer/undo/export; autosave/reload/restore. | Mở file download để kiểm pixel dimensions, MIME, alpha và nội dung; lưu kết quả và lỗi. (AC-01–37) |
| 28 | 5 — QA/pilot/release | QA thủ công trên thiết bị/browser mục tiêu: touch, keyboard, font/IME, screen reader, dialog focus, download và WebGL/CPU fallback. | Ghi chính xác browser/OS/thiết bị đã kiểm; không dùng emulation thay cho thiết bị thật. (AC-38–39, AC-41–42) |
| 29 | 5 — QA/pilot/release | Đo hiệu năng fixtures 3 MP và biên 12 MP; kiểm network/privacy, quota, memory, import/restore/export races; sửa lỗi nghiêm trọng và chạy regression. | Có số đo kèm thiết bị/runtime; xác nhận không gửi pixel/Blob/text/snapshot; cập nhật giới hạn nếu gate không đạt. (AC-31–42) |
| 30 | 5 — QA/pilot/release | Pilot 8–12 người theo tác vụ PRD; tổng hợp vướng mắc, hoàn thiện README/QA_RELEASE, release checklist và deploy candidate static HTTPS. | Tất cả AC P0 có evidence hoặc trạng thái chưa đạt rõ ràng; ghi lỗi còn lại và quyết định release. **Không production publish nếu chưa có yêu cầu/ủy quyền riêng.** |

## Gate và điều kiện điều chỉnh

1. **Gate 0 — Spike:** chưa mở rộng feature nếu chưa chứng minh source/proxy transform, full-resolution export và draft Blob roundtrip bằng file thật.
2. **Gate 1 — Nền tảng:** Home/Editor responsive, import, baseline history, rotate/flip và PNG/JPG export dùng được; undo đúng.
3. **Gate 2 — Chỉnh ảnh:** crop/resize và pipeline màu đúng với source fidelity, overlay, alpha và history.
4. **Gate 3 — Creative:** text tiếng Việt/IME/font, shapes, layers, keyboard và output đã kiểm.
5. **Gate 4 — Hoàn thiện:** IndexedDB restore/lease, export WebP/MIME/error, compare và touch đạt các luồng chính.
6. **Gate 5 — Release:** theo PRD mục 34.4: toàn bộ AC P0 có evidence; unit/typecheck/build/lint/E2E trọng yếu pass; không lỗi mất dữ liệu/sai pixel/sai font; privacy network audit và thông tin thiết bị/browser được ghi nhận; hiệu năng đạt mục tiêu hoặc điều chỉnh giới hạn minh bạch.

Nếu một gate thất bại, dừng phần phụ thuộc, ghi nguyên nhân và cập nhật thời lượng/giới hạn trước khi tiếp tục. Nếu phải rút lịch, chỉ chốt demo trung gian import/crop/resize/3 adjust/export và công khai phần P0 còn thiếu; không gọi demo là MVP hoàn chỉnh.

## Ranh giới bằng chứng

Roadmap này là kế hoạch. Day 1 tạo app shell và build pass; điều đó không kiểm tra file export. Chưa chạy test sản phẩm, chưa có AC nào đạt và Gate 0 vẫn chưa qua. Playwright mobile emulation không thay QA trên thiết bị thật; mock quota không chứng minh quota thật. `canvas` native install script chưa được cho phép, nên Node-backed canvas chưa được kiểm chứng.
