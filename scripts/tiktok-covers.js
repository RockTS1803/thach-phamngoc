#!/usr/bin/env node
/**
 * Tự tạo ảnh bìa cho các video TikTok có trong public/index.html
 * bằng FRAME ĐẦU TIÊN của video.
 *
 *   npm run covers            -> chỉ tạo ảnh còn thiếu
 *   npm run covers -- --force -> tạo lại tất cả
 *
 * Kết quả: public/assets/images/videos/<videoId>.jpg
 * Nếu không tải được video, dùng ảnh bìa gốc (originCover) của TikTok thay thế.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const sharp = require('sharp');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

const run = promisify(execFile);
const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'public', 'index.html');
const OUT_DIR = path.join(ROOT, 'public', 'assets', 'images', 'videos');
const FORCE = process.argv.includes('--force');
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const WIDTH = 540; // 9:16 thumbnail width

/** Lấy danh sách URL video TikTok (không trùng, theo thứ tự) trong index.html */
function findVideos() {
  const html = fs.readFileSync(HTML, 'utf8');
  const re = /https:\/\/www\.tiktok\.com\/@([\w.-]+)\/video\/(\d+)/g;
  const seen = new Map();
  for (const m of html.matchAll(re)) if (!seen.has(m[2])) seen.set(m[2], m[0]);
  return [...seen].map(([id, url]) => ({ id, url }));
}

/** Gộp Set-Cookie thành header Cookie để tải được file video */
function cookieHeader(res) {
  const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  return list.map((c) => c.split(';')[0]).join('; ');
}

/** Đọc dữ liệu video từ trang TikTok */
async function getVideoInfo(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'vi,en;q=0.8' }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Trang TikTok trả về ${res.status}`);
  const html = await res.text();
  const m = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('Không tìm thấy dữ liệu video trong trang');
  const data = JSON.parse(m[1]);
  const video = data?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct?.video;
  if (!video) throw new Error('Video không còn hoặc bị giới hạn');
  return {
    playAddr: video.playAddr || video.downloadAddr,
    cover: video.originCover || video.cover,
    cookie: cookieHeader(res),
    referer: url,
  };
}

async function download(url, file, headers) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`Tải thất bại (${res.status})`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

async function saveJpeg(input, outFile) {
  await sharp(input).resize({ width: WIDTH, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(outFile);
}

async function makeCover({ id, url }) {
  const outFile = path.join(OUT_DIR, `${id}.jpg`);
  if (!FORCE && fs.existsSync(outFile)) return `bỏ qua (đã có)`;

  const info = await getVideoInfo(url);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ttcover-'));
  try {
    // 1) Frame đầu tiên của video
    if (info.playAddr) {
      try {
        const mp4 = path.join(tmp, 'v.mp4');
        const png = path.join(tmp, 'f.png');
        await download(info.playAddr, mp4, { 'User-Agent': UA, Referer: info.referer, Cookie: info.cookie, Range: 'bytes=0-' });
        await run(ffmpegPath, ['-y', '-loglevel', 'error', '-i', mp4, '-frames:v', '1', png]);
        await saveJpeg(png, outFile);
        return 'frame đầu tiên';
      } catch (err) {
        console.warn(`   ! Không lấy được frame (${err.message}), dùng ảnh bìa TikTok`);
      }
    }
    // 2) Dự phòng: ảnh bìa gốc
    if (!info.cover) throw new Error('Không có ảnh bìa');
    const img = path.join(tmp, 'c.img');
    await download(info.cover, img, { 'User-Agent': UA, Referer: 'https://www.tiktok.com/' });
    await saveJpeg(img, outFile);
    return 'ảnh bìa TikTok (dự phòng)';
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const videos = findVideos();
  console.log(`Tìm thấy ${videos.length} video TikTok trong index.html\n`);
  let failed = 0;
  for (const v of videos) {
    try {
      console.log(`✓ ${v.id}: ${await makeCover(v)}`);
    } catch (err) {
      failed++;
      console.error(`✗ ${v.id}: ${err.message}`);
    }
  }
  if (failed) {
    console.error(`\n${failed} video lỗi — chạy lại sau, hoặc tự đặt ảnh vào public/assets/images/videos/<id>.jpg`);
    process.exitCode = 1;
  }
})();
