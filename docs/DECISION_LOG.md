# MiniPhoto Editor — Decision Log

Ngày: 07/10/2026 (Asia/Saigon)

Phạm vi: Phase 0, Day 1. Đây là quyết định khởi tạo cho MVP; không phải bằng chứng tính năng chỉnh ảnh đã hoạt động.

## Phạm vi MVP

- Một ảnh JPG/JPEG, PNG hoặc WebP tĩnh; xử lý trong trình duyệt.
- P0 theo PRD: hình học, ba điều chỉnh màu, preset, text/shapes/layers, history, compare, export và một draft cục bộ.
- Không thêm backend, tài khoản, AI, analytics, nhiều ảnh, cloud sync hoặc P1.
- Giữ các giới hạn 20 MiB, 12 MP, cạnh 8192 px, tối đa 50 overlay như **mục tiêu đề xuất**; điều chỉnh sau spike/QA, không coi là benchmark.

## Stack và môi trường

Chọn đề xuất stack D07 của PRD làm stack MVP cho Phase 0: React 19.3.0, TypeScript 7.0.2 strict, Vite 8.3.3, Fabric.js 7.4.0 và CSS Modules khi cần style theo component. Dùng IndexedDB native cho draft; không thêm state manager, wrapper Fabric hay framework CSS.

- Runtime tối thiểu: Node.js 24 LTS; `.nvmrc` dùng major `24`, `package.json` giới hạn Node `>=24 <25`. Môi trường hiện tại có Node 24.19.0 và npm 11.17.0.
- Package manager: npm với phiên bản dependency được ghim và `package-lock.json`.
- Hiện khởi tạo `dev`, `typecheck`, `build`, `preview`. Chưa thêm lint/test/E2E tooling vì Day 1 chưa có logic/test hoặc luồng UI để dùng các lệnh đó.
- Không cài engine/framework khác ngoài stack đã chọn. Fabric được cài nhưng chưa có editor engine; Day 2 phải thử API/version trước khi dùng.
- `npm install` cảnh báo script native của dependency tùy chọn `canvas@3.2.3` chưa được cho phép; không bật script này trong Day 1. Node-backed canvas chưa xác minh, còn build trình duyệt của app shell đã pass.

Versions checked 07/10/2026: [Node.js downloads](https://nodejs.org/en/download/), [Vite 8 release notes](https://vite.dev/blog/announcing-vite8.html), [React versions](https://react.dev/versions), [Fabric package](https://www.npmjs.com/package/fabric), [TypeScript package](https://www.npmjs.com/package/typescript), [Vite React plugin](https://www.npmjs.com/package/@vitejs/plugin-react).

## Quyết định/giả định còn mở

| Mục | Trạng thái sau Day 1 |
|---|---|
| D01–D04 | Người dùng xác nhận theo PRD: web responsive, ba adjust P0, adjust nâng cao để sau, một draft local. |
| D05–D06 | Kế thừa concept gốc theo PRD. |
| D07 | Đã chọn stack nêu trên cho MVP; có thể đổi nếu Gate 0 chứng minh không phù hợp. |
| D08 | Một document/một ảnh nền/tối đa 50 overlay là giới hạn đề xuất, cần kiểm chứng. |
| D09–D11 | Tiếng Việt, home sáng/editor tối, bottom sheet mobile, không tracking ngoài vẫn là mặc định/đề xuất thiết kế. |
| D12 | Mục đích cuối, đội ngũ, deadline và kinh nghiệm stack chưa rõ; roadmap 30 ngày công không phải lịch cam kết. |

## Tiêu chí spike trước khi mở rộng

1. Import/decode fixture JPEG có EXIF, PNG alpha và WebP tĩnh; source giữ nguyên, orientation đúng.
2. Crop → resize → rotate với text/overlay không lệch; snapshot proxy chuẩn hóa được transform.
3. Export từ source đầy đủ độ phân giải tạo file mở/đọc được, đúng W×H và overlay; không dùng preview làm nguồn.
4. Source Blob + snapshot roundtrip qua IndexedDB; restore đúng và lỗi không làm mất document cũ.

Gate 0 chỉ đạt khi các tiêu chí có bằng chứng bằng file thật. Day 1 mới ghi phạm vi/quyết định và dựng toolchain; chưa chạy spike hoặc đánh dấu AC nào đạt.
