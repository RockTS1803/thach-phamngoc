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
      activities/                    Ảnh 4 thẻ "Hoạt động công ty"
      videos/<videoId>.jpg           Ảnh bìa video TikTok (tạo tự động, xem bên dưới)
    videos/
      gala-performance.mp4           Video tiết mục văn nghệ độc lạ
scripts/tiktok-covers.js   Tạo ảnh bìa TikTok từ frame đầu tiên
```

## Thêm / thay ảnh

| File | Dùng cho | Gợi ý kích thước |
|---|---|---|
| `images/hero-bg.jpg` *(tuỳ chọn)* | Thay nền phong cảnh hero | Ngang, ~1920×1080 |
| `images/future-bg.jpg` *(tuỳ chọn)* | Nền khối "Định hướng tương lai" | Ngang, ~1600×700 |
| `videos/showreel.mp4` *(tuỳ chọn)* | Có file này thì nút **"Xem showreel"** tự hiện ở hero | MP4 H.264, < 20 MB |

## Ảnh bìa video TikTok (tự động)

Ảnh bìa các video triệu view được lấy **tự động từ frame đầu tiên** của video:

```bash
npm run covers             # tạo ảnh cho video mới (bỏ qua ảnh đã có)
npm run covers -- --force  # tạo lại toàn bộ
```

Script đọc mọi link `https://www.tiktok.com/@…/video/<id>` trong `public/index.html`, tải video, cắt frame đầu
bằng ffmpeg và lưu thành `public/assets/images/videos/<id>.jpg` (rộng 540px). Nếu không tải được video,
script dùng ảnh bìa gốc của TikTok thay thế.

**Thêm video mới:** copy một khối `<li class="reveal">…</li>` trong mục Video nổi bật, đổi link, tiêu đề, số view
và `src` ảnh thành `/assets/images/videos/<id>.jpg` → chạy `npm run covers` → commit ảnh mới.

> Script chạy **trên máy bạn**, ảnh được commit lên GitHub. Không chạy trên Hostinger vì TikTok hay chặn IP
> máy chủ và link ảnh/video của TikTok hết hạn sau vài giờ.

## Ghi chú về ảnh

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
