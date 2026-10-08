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

Gate 0 chỉ đạt khi các tiêu chí có bằng chứng bằng file thật. Các mục Day 2/Day 3 bên dưới ghi nhận kết quả tại thời điểm ban đầu; đánh giá lại Gate 0 và giới hạn hiện tại được ghi ở cuối tài liệu.

## Kết quả spike — Phase 0, Day 2 (07/10/2026)

- Thêm helper ứng viên import tại `src/features/editor/engine/imageImport.ts` và harness thủ công tại `tests/manual/day2-import.html`; đây là spike cô lập, chưa được gọi bởi app shell và chưa phải luồng import sản phẩm.
- Trong Codex In-app Browser, cả `FabricImage.fromURL(blobUrl, { signal })` và `createImageBitmap(file, { imageOrientation: 'from-image' })` → `HTMLCanvasElement` → `FabricImage` đều decode đúng 8 fixture JPEG EXIF (dimensions và bốn vùng màu), PNG alpha 0/128/255 và WebP tĩnh 1024×772. Source bytes hash không đổi; JPEG lỗi bị từ chối; candidate trước vẫn đọc được sau lỗi; dispose lặp không gây lỗi.
- Đường Fabric blob URL được chọn làm mặc định cho bước tích hợp sau: hỗ trợ AbortSignal trong khi load và đã kiểm tra 13 URL được revoke đúng một lần, gồm thành công, lỗi và hủy. Fallback ImageBitmap cũng pass nhưng `createImageBitmap` không nhận AbortSignal; hủy giữa lúc decode chỉ có thể bỏ kết quả và đóng bitmap sau khi hoàn tất.
- Phiên bản/UA cụ thể của Codex In-app Browser không đọc được trong phiên này; không suy kết quả thành tương thích mọi browser. Chưa kiểm giới hạn kích thước, animation, màu/ICC, hiệu năng hoặc thiết bị mobile.
- Typecheck và build pass; harness kiểm tra thủ công trên localhost. Không thêm dependency. Kết quả chỉ đạt tiêu chí decode Day 2; không chứng minh geometry/export/IndexedDB của Gate 0 và không đánh dấu AC sản phẩm đạt.

## Kết quả spike — Phase 0, Day 3 (07/10/2026)

- Thêm `src/features/editor/engine/day3Pipeline.ts` và `day3DraftStore.ts`, cùng harness thủ công `tests/manual/day3-spike.html` + `.ts`. Spike không nối vào app shell và không thêm dependency.
- Trên PNG tổng hợp 3072×1536: crop 2304×1280 → resize 3456×1920 → xoay chiều kim đồng hồ ra 1920×3456; proxy preview là 2048×1024. Anchor text (2000,700) chuyển thành (1062,2424).
- PNG export tạo Blob MIME `image/png`, decode trong browser đúng 1920×3456; alpha marker giữ nguyên và hash source không đổi. Preview sau restore hiển thị text; chưa tải file xuống/mở bằng ứng dụng ngoài hoặc kiểm pixel riêng cho glyph trong PNG export.
- IndexedDB roundtrip sau reload giữ Blob hash, snapshot và transform. Thử transaction abort sau khi xếp các lệnh ghi thay thế xác nhận draft/source cũ còn nguyên. Bỏ handler `transaction.onerror` vì nó làm lời hứa trả lỗi chung trong đường abort chủ ý thay vì nhận AbortError từ `onabort`.
- `npm.cmd run typecheck` và `npm.cmd run build` pass. Chạy lại cả hai decoder Day 2: fixture checks pass; Fabric path cũng pass abort và 13/13 URL cleanup. Chỉ Codex In-app Browser; browser version/UA không xác minh được.
- Giới hạn: geometry/export mới thử một PNG tổng hợp và PNG output; chưa kiểm tra glyph trong file export theo pixel, nhiều nguồn/định dạng, lỗi quota/schema/đa tab hoặc browser/thiết bị khác. Kết quả này không đủ để đánh dấu Gate 0 hay AC sản phẩm đạt.

## Đánh giá lại Gate 0 và Phase 1 — Day 4 (07/10/2026)

### Gate 0 reassessment

- Mở rộng `tests/manual/day3-spike.ts` để kiểm tra pixel text trong PNG export, chi tiết tần số cao từ PNG 3072×1536, fixture WebP tĩnh qua crop/rotate/preview/export, và IndexedDB save/restore với source WebP.
- PNG tổng hợp crop 2304×1280 → resize 3456×1920 → rotate thành 1920×3456. Preview proxy 2048×1024, anchor text (1062,2424). Blob PNG decode đúng MIME/dimensions; pixel text, alpha marker, stripe detail và SHA-256 source pass. Luminance sọc đo được 65–217 sau phép scale/rotate; harness kiểm tra số pixel sáng/tối và độ tương phản thay vì đòi pixel sáng >220.
- Fixture WebP 1024×772 qua crop 16 px và xoay chiều kim đồng hồ cho preview/export 740×992; overlay pixel và hash nguồn pass. IndexedDB restore sau reload khớp source hash, snapshot và transform; transaction abort giữ nguyên draft/source cũ.
- **Kết luận:** Gate 0 đạt cho các nhánh spike được kiểm tra. Đây không phải AC sản phẩm: các helper vẫn chưa được app gọi; mới có một Codex In-app Browser/origin; chưa tải/mở PNG bằng ứng dụng ngoài, chưa thử browser khác, quota/schema lỗi, đa tab hoặc biên bộ nhớ.

### Phase 1 — Day 4 app shell

- `src/App.tsx` dựng route `/`, `/editor`, `/privacy`, trạng thái rỗng và preview loading/error chỉ trong dev bằng `?preview=loading|error`; không thêm router/dependency. Route navigation dùng link trình duyệt; route được mở trực tiếp qua Vite local server.
- `src/app.css` đặt tokens Home sáng/Editor tối, layout desktop, tablet drawer thuộc tính và mobile rail/panel. Native `<dialog>.showModal()` đóng bằng Escape và trả focus cho nút mở.
- Privacy page phân biệt hiện trạng (chưa nhận/lưu ảnh) với định hướng sản phẩm tương lai. Import, canvas, tool, history và export ở shell đang disabled; chưa thuộc Day 4.
- Browser review ở viewport 360×800, 820×1024 và 1366×768 xác nhận bố cục Home/Editor/Privacy; một overflow ngang tại Editor 360 px đã được sửa. Dialog được mở/đóng bằng Escape và focus return được quan sát.
- `npm.cmd run build` pass (bao gồm typecheck); không thêm dependency hoặc test framework. Production host fallback cho `/editor` và `/privacy` chưa cấu hình/kiểm chứng; browser version/UA chưa xác minh.
