# MiniPhoto Editor — Walkthrough

Ngày ghi nhận: **07/10/2026**, Asia/Saigon.

Tài liệu ghi lại kết quả khảo sát và các bước đã triển khai. Repository hiện có app shell Day 4 và phần lifecycle/viewport canvas Day 5; chưa có luồng import hoặc chỉnh sửa ảnh sản phẩm. Walkthrough phân biệt shell, spike cô lập, implementation và hành vi đã kiểm chứng.

## 1. Kết quả hiện có

| Tệp | Vai trò |
|---|---|
| [PRD_MINIPHOTO_EDITOR.md](../PRD_MINIPHOTO_EDITOR.md) | Đặc tả sản phẩm, FR, dữ liệu, kiến trúc, 42 AC và release gate |
| [docs/roadmap.md](roadmap.md) | Kế hoạch triển khai theo từng ngày công, phase và gate |
| [docs/DECISION_LOG.md](DECISION_LOG.md) | Quyết định stack, phạm vi MVP, tiêu chí và kết quả spike Day 1–3 |
| [AGENT.md](../AGENT.md) | Hướng dẫn làm việc, invariants, quy trình kiểm chứng/Git/bàn giao |
| [CONTEXT_SUMMARY.md](CONTEXT_SUMMARY.md) | Bối cảnh ngắn để tiếp tục task, hiện trạng và các quyết định còn mở |
| `WALKTHROUGH.md` | Giải thích đầu ra, quá trình và ranh giới bằng chứng |

Sau Day 5, repository có các màn hình shell và Fabric Canvas rỗng được gắn vào Editor. Helper và harness Day 2–3 vẫn tách khỏi app; chưa có document ảnh để điều khiển hoặc xuất.

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

## 5. Luồng sản phẩm dự kiến — chưa triển khai

### Nhập ảnh và chỉnh sửa

Home → chọn/kéo thả một JPG/PNG/WebP tĩnh → validate file/decode → tạo source asset bất biến và document baseline → mở Editor → thao tác geometry, màu, text hoặc shapes → commit snapshot → cập nhật history và đánh dấu draft cần lưu.

Điểm kiểm chứng khi có implementation: file lỗi/hủy không thay document; geometry giữ toàn scene; adjust không đổi overlay; undo phục hồi snapshot; zoom không đổi output dimensions. Tham chiếu PRD mục 11–21.

### Autosave và restore

Snapshot commit → debounce autosave → kiểm lease/revision → transaction IndexedDB → báo đã lưu sau complete. Reload → validate draft/schema/source → người dùng chọn resume hoặc bỏ draft → khôi phục document và baseline history.

Điểm kiểm chứng: quota/schema lỗi phải có recovery, draft cũ được giữ an toàn, tab mất lease không ghi đè. Tham chiếu PRD mục 24, 30–31.

### Compare và export

Compare dùng render tạm theo geometry hiện tại, bỏ màu/filter và ẩn overlay; không đổi history. Export lấy source đủ độ phân giải → áp dụng geometry/màu/scene → chờ font → encode định dạng → kiểm MIME/dimensions → tải file và dọn tài nguyên.

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

**Hiện trạng:** Gate 0 được đánh giá lại bằng manual harness mở rộng; Day 4 app shell có các route `/`, `/editor`, `/privacy`, responsive layout, states và dialog native. Day 5 đã nối Fabric Canvas lifecycle, resize và viewport controls; build và spot-check StrictMode/resize pass, còn Fit/zoom trên document chưa xác minh. Chi tiết ở mục 12 và [Decision Log](DECISION_LOG.md).

**Bước kế tiếp theo roadmap:** triển khai Day 6 import. Rà soát hiện trạng ở mục 13 xác nhận Day 6 chưa hoàn thành; Day 5 acceptance cần runtime kiểm tra trên document fixture. Gate 1 chưa đạt, import, history, rotate/flip và export sản phẩm chưa được triển khai.

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
- `src/App.tsx` chuyển Editor sang component này; `.canvas-stage` giữ checkerboard/empty state. Vì import thuộc Day 6, `documentSize` hiện là `null`, kích thước hiển thị là placeholder và Fit/zoom vẫn disabled.
- `npm.cmd run build` pass, gồm `tsc --noEmit` và `vite build`; Vite cảnh báo bundle JavaScript vượt 500 kB sau minify. Không thêm dependency hoặc test runner.
- Trong Codex In-app Browser tại `/editor`, StrictMode để lại một `.canvas-container` với hai canvas nội bộ và không hiện runtime error; viewport 360×800 cập nhật surface/wrapper về 339 px. Browser version không xác minh. Fit/zoom chưa kiểm tra trên document vì chưa có import; Day 5 acceptance và Gate 1 chưa đạt đầy đủ.

## 13. Phase 1 — Day 6 status review (07/10/2026)

- **Kết luận: chưa hoàn thành.** `src/App.tsx` vẫn render nút “Chọn ảnh” disabled; chưa có file input hoặc handler kéo/thả. Editor nhận `documentSize={null}`, nên chưa có document ảnh để fit/zoom.
- `src/features/editor/engine/imageImport.ts` chỉ có hai decoder helper; `tests/manual/day2-import.html` và `.ts` là harness spike Day 2, không được gọi từ luồng app.
- Chưa thấy luồng sản phẩm kiểm tra một file, kích thước byte, MIME/header, dimensions/animation, decode, hủy picker hoặc xác nhận thay ảnh. Do đó AC-01–03 chưa có bằng chứng đạt; harness Day 2 không thay thế nghiệm thu này.
- Đây là rà soát tĩnh theo source và tài liệu; không chạy build/test/app trong lần kiểm tra Day 6 này.
