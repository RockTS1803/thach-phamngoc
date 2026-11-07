# thach-phamngoc

Website giới thiệu bản thân — **Phạm Ngọc Thạch**, Nhân viên dựng video Ban Tin Tức.
Node.js (Express) phục vụ một trang tĩnh: HTML/CSS/JS thuần, không cần bước build.

## Chạy trên máy

```bash
npm install
npm start          # http://localhost:3000
npm run dev        # tự khởi động lại khi sửa server.js
```

Khi chạy ở `localhost`, những ảnh còn thiếu sẽ hiện nhãn **"Thêm ảnh: …"** để biết cần thêm file nào.
Trên website thật nhãn này bị ẩn, chỉ còn nền gradient.

## Cấu trúc

```
server.js                  Express server (PORT lấy từ biến môi trường, mặc định 3000)
public/
  index.html               Toàn bộ nội dung trang
  css/style.css            Giao diện (màu sắc ở đầu file, trong :root)
  js/main.js               Menu, hiệu ứng cuộn, đếm số, trình phát video
  assets/
    images/
      avatar.jpg                     Ảnh đại diện (hero)
      gala-performance-poster.jpg    Ảnh bìa video tiết mục Gala
      tools/                         Icon 3D công cụ dựng video (hero)
      activities/                    Ảnh 4 thẻ "Hoạt động công ty"
      videos/<videoId>.jpg           Ảnh bìa video TikTok (tạo tự động, xem bên dưới)
    videos/
      gala-performance.mp4           Video tiết mục văn nghệ độc lạ
      tiktok/<videoId>.mp4           Video triệu view tải sẵn (tạo tự động, xem bên dưới)
scripts/tiktok-media.js    Tải sẵn video TikTok + tạo ảnh bìa từ frame đầu
video-goc/                 (tuỳ chọn, không lên GitHub) file xuất gốc để nén thay vì tải từ TikTok
```

## Thêm / thay ảnh

| File | Dùng cho | Gợi ý kích thước |
|---|---|---|
| `images/hero-bg.jpg` *(tuỳ chọn)* | Thay nền phong cảnh hero | Ngang, ~1920×1080 |
| `images/future-bg.jpg` *(tuỳ chọn)* | Nền khối "Định hướng tương lai" | Ngang, ~1600×700 |
| `videos/showreel.mp4` *(tuỳ chọn)* | Có file này thì nút **"Xem showreel"** tự hiện ở hero | MP4 H.264, < 20 MB |

## Video triệu view: tải sẵn + ảnh bìa (tự động)

Bấm vào một video triệu view sẽ **phát file đã tải sẵn trên server của website** (nhanh, không phải chờ TikTok).
Rê chuột / chạm vào thẻ là trình duyệt bắt đầu tải trước. Video nào chưa có file thì tự dùng trình phát TikTok.

```bash
npm run tiktok             # tải video + ảnh bìa còn thiếu
npm run tiktok -- --force  # làm lại tất cả
npm run covers             # chỉ ảnh bìa
```

Script đọc mọi link `https://www.tiktok.com/@…/video/<id>` trong `public/index.html`, rồi với mỗi video:

- **Video** → nén H.264 720p (bật faststart để phát ngay khi mới tải một phần) → `public/assets/videos/tiktok/<id>.mp4`
- **Ảnh bìa** → frame đầu tiên → `public/assets/images/videos/<id>.jpg` (rộng 540px)

**Nguồn video:** script ưu tiên file xuất gốc trong thư mục `video-goc/` (đặt tên `1.mp4` … `7.mp4` theo thứ tự trên trang,
hoặc `<id>.mp4`; nhận .mp4 .mov .mkv .webm .m4v). Không có thì tải từ TikTok. TikTok đôi khi chặn tạm thời
("Please wait…") — script sẽ tự nghỉ và thử lại; nếu vẫn lỗi thì chạy lại sau ít phút, hoặc đặt file gốc vào `video-goc/`.

**Thêm video mới:** copy một khối `<li class="reveal">…</li>` trong mục Video nổi bật, đổi link, tiêu đề, số view
và `src` ảnh thành `/assets/images/videos/<id>.jpg` → chạy `npm run tiktok` → commit file mới.

> Script chạy **trên máy bạn**, file được commit lên GitHub. Không chạy trên Hostinger vì TikTok hay chặn IP
> máy chủ và link ảnh/video của TikTok hết hạn sau vài giờ.

## Ghi chú về ảnh

**Thay ảnh nhưng giữ nguyên tên file?** Trình duyệt người xem lưu ảnh 7 ngày, nên hãy tăng số phiên bản trong link ảnh ở `index.html` (vd. `clapper.webp?v=2` → `?v=3`) để ai cũng thấy ảnh mới ngay.


Nên nén ảnh (vd. [squoosh.app](https://squoosh.app)) xuống dưới ~200 KB mỗi ảnh.

Ảnh/video gốc đặt ở thư mục gốc dự án đã được `.gitignore` bỏ qua — chỉ bản tối ưu trong `public/assets` được đưa lên GitHub.

## Đưa lên GitHub

```bash
git add .
git commit -m "Website giới thiệu bản thân"
git push origin main
```

## Deploy lên Hostinger (Node.js Web App)

1. Vào **hPanel → Websites → Add website → Node.js Apps** (hoặc mục **Node.js** của website có sẵn).
2. Chọn **Import Git repository** → kết nối GitHub → chọn repo `RockTS1803/thach-phamngoc`, nhánh `main`.
3. Cấu hình build:
   - **Framework**: Express / Other
   - **Node version**: 20.x hoặc 22.x
   - **Root directory**: `./`
   - **Install / Build command**: `npm install`
   - **Start command**: `npm start` (file chạy: `server.js`)
   - Không cần đặt `PORT` — Hostinger tự cấp, `server.js` đã đọc `process.env.PORT`.
4. Bấm **Deploy**. Sau khi xong, gắn tên miền ở mục **Domains** và bật **SSL**.
5. Mỗi lần `git push` lên `main`, Hostinger tự deploy lại (nếu bật auto-deploy); hoặc bấm **Redeploy** trong hPanel.

Kiểm tra server sống: `https://<tên-miền>/healthz` → `{"ok":true}`.

## Nguồn tài nguyên

- Icon 3D công cụ dựng video ở phần đầu trang (`public/assets/images/tools/`): [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji) — giấy phép MIT, © Microsoft Corporation.
