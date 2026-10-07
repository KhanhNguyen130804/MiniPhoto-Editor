# MiniPhoto Editor — Walkthrough

Ngày ghi nhận: **07/10/2026**, Asia/Saigon.

Tài liệu mô tả công việc tài liệu đã thực hiện và cách đọc dự án hiện tại. Chưa có ứng dụng để hướng dẫn demo thao tác thực tế. Luồng sử dụng phía dưới là thiết kế dự kiến, không phải kết quả chạy thành công.

## 1. Kết quả hiện có

| Tệp | Vai trò |
|---|---|
| [PRD_MINIPHOTO_EDITOR.md](../PRD_MINIPHOTO_EDITOR.md) | Đặc tả sản phẩm, FR, dữ liệu, kiến trúc, 42 AC và release gate |
| [docs/roadmap.md](roadmap.md) | Kế hoạch triển khai theo từng ngày công, phase và gate |
| [AGENT.md](../AGENT.md) | Hướng dẫn làm việc, invariants, quy trình kiểm chứng/Git/bàn giao |
| [CONTEXT_SUMMARY.md](CONTEXT_SUMMARY.md) | Bối cảnh ngắn để tiếp tục task, hiện trạng và các quyết định còn mở |
| `WALKTHROUGH.md` | Giải thích đầu ra, quá trình và ranh giới bằng chứng |

Repository đang ở giai đoạn tài liệu; chưa có source app, dependency manifest, lockfile hoặc script thực thi.

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
| Build/test/runtime | Không chạy; chưa có manifest/source để xác nhận |
| AC và release gate | Chưa có evidence đạt cho sản phẩm |

Không sử dụng screenshot, mock, wireframe hoặc đọc tài liệu làm bằng chứng runtime. Kết quả kiểm tra văn bản chỉ chứng minh đầu ra tài liệu, không chứng minh tính đúng của engine, export hoặc IndexedDB.

## 7. Hạng mục tiếp theo

Chờ người dùng giao task tiếp theo. Hướng hợp lý là Phase 0/ngày 1: ghi quyết định D07–D12, phạm vi spike và tiêu chí bằng chứng; sau đó mới khởi tạo toolchain theo phạm vi được giao. Tiếp tục gate kỹ thuật ngày 2–3 trước khi mở rộng tính năng.

Khi ứng dụng có implementation, bổ sung walkthrough bằng thao tác thật, tệp bị tác động, lệnh đã chạy, browser/thiết bị, output và AC tương ứng. Ghi rõ lỗi/chưa chạy; không thay phần lịch sử bằng tuyên bố đã đạt.
