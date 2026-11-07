#!/usr/bin/env node
/**
 * Tải sẵn media cho các video TikTok có trong public/index.html:
 *   - Ảnh bìa = FRAME ĐẦU TIÊN  -> public/assets/images/videos/<id>.jpg
 *   - File video (nén H.264)     -> public/assets/videos/tiktok/<id>.mp4
 *
 *   npm run tiktok                  -> tạo những gì còn thiếu
 *   npm run tiktok -- --force       -> tạo lại tất cả
 *   npm run covers                  -> chỉ ảnh bìa
 *
 * Nguồn video (ưu tiên theo thứ tự):
 *   1. File gốc bạn tự đặt trong thư mục video-goc/ (không đưa lên GitHub), đặt tên
 *      theo số thứ tự trên trang (1.mp4 … 7.mp4) hoặc theo ID video (<id>.mp4).
 *      Hỗ trợ .mp4 .mov .mkv .webm .m4v
 *   2. Tải từ TikTok (có thể bị TikTok chặn tạm thời).
 *
 * Trên trang, bấm vào video sẽ phát file đã tải sẵn; nếu thiếu file thì
 * tự chuyển sang trình phát nhúng của TikTok.
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
const COVER_DIR = path.join(ROOT, 'public', 'assets', 'images', 'videos');
const VIDEO_DIR = path.join(ROOT, 'public', 'assets', 'videos', 'tiktok');
const SOURCE_DIR = path.join(ROOT, 'video-goc');
const SOURCE_EXT = ['.mp4', '.mov', '.mkv', '.webm', '.m4v'];
const FORCE = process.argv.includes('--force');
const COVERS_ONLY = process.argv.includes('--covers-only');
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const COVER_WIDTH = 540;

/** Danh sách video TikTok (không trùng, theo thứ tự) trong index.html */
function findVideos() {
  const html = fs.readFileSync(HTML, 'utf8');
  const re = /https:\/\/www\.tiktok\.com\/@([\w.-]+)\/video\/(\d+)/g;
  const seen = new Map();
  for (const m of html.matchAll(re)) if (!seen.has(m[2])) seen.set(m[2], m[0]);
  return [...seen].map(([id, url], i) => ({ id, url, index: i + 1 }));
}

/** File gốc trong video-goc/ (theo ID hoặc số thứ tự), nếu có */
function findSource({ id, index }) {
  if (!fs.existsSync(SOURCE_DIR)) return null;
  for (const name of [id, String(index)]) {
    for (const ext of SOURCE_EXT) {
      for (const e of [ext, ext.toUpperCase()]) {
        const f = path.join(SOURCE_DIR, name + e);
        if (fs.existsSync(f)) return f;
      }
    }
  }
  return null;
}

function cookieHeader(res) {
  const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  return list.map((c) => c.split(';')[0]).join('; ');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Đọc dữ liệu video; TikTok đôi khi trả trang "Please wait" -> nghỉ rồi thử lại (tối đa 4 lần) */
async function getVideoInfo(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetchVideoInfo(url);
    } catch (err) {
      if (attempt >= 4) throw err;
      await sleep(8000 * attempt);
    }
  }
}

async function fetchVideoInfo(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'vi,en;q=0.8' }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Trang TikTok trả về ${res.status}`);
  const html = await res.text();
  const m = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('Không tìm thấy dữ liệu video trong trang');
  const video = JSON.parse(m[1])?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct?.video;
  if (!video) throw new Error('Video không còn hoặc bị giới hạn');
  return {
    playAddr: video.playAddr || video.downloadAddr,
    cover: video.originCover || video.cover,
    cookie: cookieHeader(res),
    referer: url,
  };
}

async function download(url, file, headers) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(120000) });
  if (!res.ok) throw new Error(`Tải thất bại (${res.status})`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

const ffmpeg = (args) => run(ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', ...args], { maxBuffer: 1 << 26 });

async function saveCover(input, outFile) {
  await sharp(input).resize({ width: COVER_WIDTH, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(outFile);
}

/** Nén sang H.264 720p, bật faststart để phát được ngay khi mới tải một phần */
async function encodeVideo(input, outFile) {
  const tmpOut = `${outFile}.tmp.mp4`;
  await ffmpeg([
    '-i', input,
    '-vf', "scale='min(720,iw)':-2",
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '96k', '-ac', '2',
    '-movflags', '+faststart',
    tmpOut,
  ]);
  fs.renameSync(tmpOut, outFile);
}

const sizeMB = (f) => (fs.statSync(f).size / 1048576).toFixed(1) + ' MB';

async function processVideo(v) {
  const { id, url } = v;
  const coverFile = path.join(COVER_DIR, `${id}.jpg`);
  const videoFile = path.join(VIDEO_DIR, `${id}.mp4`);
  const needCover = FORCE || !fs.existsSync(coverFile);
  const needVideo = !COVERS_ONLY && (FORCE || !fs.existsSync(videoFile));
  if (!needCover && !needVideo) return 'bỏ qua (đã có)';

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tiktok-'));
  const done = [];
  try {
    let raw = findSource(v);
    let info = {};
    if (raw) done.push(`nguồn: video-goc/${path.basename(raw)}`);
    else info = await getVideoInfo(url);
    if (!raw && info.playAddr) {
      try {
        raw = path.join(tmp, 'raw.mp4');
        await download(info.playAddr, raw, { 'User-Agent': UA, Referer: info.referer, Cookie: info.cookie, Range: 'bytes=0-' });
      } catch (err) {
        console.warn(`   ! Không tải được video: ${err.message}`);
        raw = null;
      }
    }

    if (needCover) {
      if (raw) {
        const png = path.join(tmp, 'f.png');
        await ffmpeg(['-i', raw, '-frames:v', '1', png]);
        await saveCover(png, coverFile);
        done.push('ảnh bìa (frame đầu)');
      } else if (info.cover) {
        const img = path.join(tmp, 'c.img');
        await download(info.cover, img, { 'User-Agent': UA, Referer: 'https://www.tiktok.com/' });
        await saveCover(img, coverFile);
        done.push('ảnh bìa (bìa TikTok, dự phòng)');
      }
    }

    if (needVideo) {
      if (!raw) throw new Error('không có file video để lưu');
      await encodeVideo(raw, videoFile);
      done.push(`video ${sizeMB(raw)} → ${sizeMB(videoFile)}`);
    }
    return done.join(', ');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/* ---------- Đoạn cắt (clip) ----------
 * Một đoạn của video TikTok, giữ nguyên âm thanh gốc. Trang web phát đoạn này:
 * tự chạy không tiếng, và nút "Xem video" phát lại có tiếng.
 * Sửa start/end (giây) rồi chạy: npm run tiktok -- --force-clips
 * (đặt file gốc vào video-goc/<id>.mp4 nếu TikTok chặn tải) */
const CLIPS = [
  {
    name: 'hien-truong-vu-an',
    url: 'https://www.tiktok.com/@thuvienphapluat.vn/video/7700922333413887253',
    start: 29, // 0:29
    end: 76, //   1:16
  },
];
const CLIP_DIR = path.join(ROOT, 'public', 'assets', 'videos', 'clips');
const CLIP_POSTER_DIR = path.join(ROOT, 'public', 'assets', 'images', 'clips');
const FORCE_CLIPS = FORCE || process.argv.includes('--force-clips');

async function processClip(clip) {
  const id = clip.url.match(/\/video\/(\d+)/)[1];
  const out = path.join(CLIP_DIR, `${clip.name}.mp4`);
  const poster = path.join(CLIP_POSTER_DIR, `${clip.name}.jpg`);
  if (!FORCE_CLIPS && fs.existsSync(out) && fs.existsSync(poster)) return 'bỏ qua (đã có)';

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clip-'));
  try {
    let raw = findSource({ id, index: -1 });
    if (!raw) {
      const info = await getVideoInfo(clip.url);
      if (!info.playAddr) throw new Error('không có link video');
      raw = path.join(tmp, 'raw.mp4');
      await download(info.playAddr, raw, { 'User-Agent': UA, Referer: info.referer, Cookie: info.cookie, Range: 'bytes=0-' });
    }
    // -ss/-to after -i = cắt chính xác tới từng khung hình
    const tmpOut = `${out}.tmp.mp4`;
    await ffmpeg([
      '-i', raw, '-ss', String(clip.start), '-to', String(clip.end),
      '-vf', "scale='min(720,iw)':-2",
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
      '-movflags', '+faststart', tmpOut,
    ]);
    fs.renameSync(tmpOut, out);
    const png = path.join(tmp, 'p.png');
    await ffmpeg(['-i', out, '-frames:v', '1', png]);
    await sharp(png).resize({ width: 720, withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toFile(poster);
    return `đoạn ${clip.start}s–${clip.end}s → ${sizeMB(out)}`;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

(async () => {
  fs.mkdirSync(COVER_DIR, { recursive: true });
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
  fs.mkdirSync(CLIP_DIR, { recursive: true });
  fs.mkdirSync(CLIP_POSTER_DIR, { recursive: true });
  const videos = findVideos();
  console.log(`Tìm thấy ${videos.length} video TikTok trong index.html, ${CLIPS.length} đoạn cắt\n`);
  let failed = 0;
  if (!COVERS_ONLY) {
    for (const clip of CLIPS) {
      try {
        console.log(`✓ đoạn "${clip.name}": ${await processClip(clip)}`);
      } catch (err) {
        failed++;
        console.error(`✗ đoạn "${clip.name}": ${err.message}`);
      }
    }
  }
  for (const v of videos) {
    try {
      const result = await processVideo(v);
      console.log(`✓ ${v.id}: ${result}`);
      if (!result.startsWith('bỏ qua')) await sleep(3000); // spread requests out
    } catch (err) {
      failed++;
      console.error(`✗ ${v.id}: ${err.message}`);
    }
  }
  if (failed) {
    console.error(`\n${failed} video lỗi — chạy lại sau. Trang sẽ dùng trình phát TikTok cho các video này.`);
    process.exitCode = 1;
  }
})();
