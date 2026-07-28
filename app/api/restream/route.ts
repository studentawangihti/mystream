import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { spawn, ChildProcess } from 'child_process';
import { prisma } from '@/lib/prisma';
import path from 'path';
import fs from 'fs';

const FFMPEG_PATH = 'C:\\ffmpeg\\ffmpeg-master-latest-win64-gpl-shared\\bin\\ffmpeg.exe';

// Global map storing active FFmpeg ChildProcesses per user
// Key: userId -> Map<destinationId, ChildProcess>
const userProcesses = new Map<string, Map<string, ChildProcess>>();
const userCloudProcesses = new Map<string, ChildProcess>();

// Store live telemetry data per user
interface LiveTelemetry {
  fps: number;
  bitrate: number;
  speed: string;
  duration: string;
  durationSeconds: number;
  resolution: string;
  plan: string;
  adStatus: string;
  status: 'idle' | 'broadcasting' | 'error';
  errorMsg?: string;
  activeSource?: 'obs' | 'cloud_mp4';
  activeVideoTitle?: string;
}

const userTelemetry = new Map<string, LiveTelemetry>();

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;

    // Fetch user destinations from DB
    const destinations = await prisma.destination.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    const dbUser = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: { plan: true, ingestKey: true },
    });

    const userPlan = dbUser?.plan || 'free';
    const activeMap = userProcesses.get(userId);
    const cloudProc = userCloudProcesses.get(userId);
    const isBroadcasting = (activeMap && activeMap.size > 0) || !!cloudProc;

    let telemetry = userTelemetry.get(userId);
    if (!telemetry) {
      telemetry = {
        fps: 0,
        bitrate: 0,
        speed: '0x',
        duration: '00:00:00',
        durationSeconds: 0,
        resolution: '720p HD',
        plan: userPlan,
        adStatus: userPlan === 'ultimate' ? '👑 100% Ad-Free (VIP Non-Stop)' : userPlan === 'pro' ? '✨ Minimal Ads (25% Iklan)' : '📢 Ad-Supported Stream',
        status: isBroadcasting ? 'broadcasting' : 'idle',
        activeSource: cloudProc ? 'cloud_mp4' : 'obs',
      };
    } else {
      telemetry.plan = userPlan;
      telemetry.adStatus = userPlan === 'ultimate' ? '👑 100% Ad-Free (VIP Non-Stop)' : userPlan === 'pro' ? '✨ Minimal Ads (25% Iklan)' : '📢 Ad-Supported Stream';
      telemetry.status = isBroadcasting ? 'broadcasting' : telemetry.status;
      telemetry.activeSource = cloudProc ? 'cloud_mp4' : 'obs';
    }

    return NextResponse.json({
      destinations,
      telemetry,
      ffmpegPath: FFMPEG_PATH,
      ingestKey: dbUser?.ingestKey,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;

    // Refresh latest user plan from DB
    const dbUser = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: { plan: true, ingestKey: true },
    });

    const userPlan = dbUser?.plan || 'free';
    const userIngestKey = dbUser?.ingestKey || (session.user as any).ingestKey;

    const { action, videoId, destinations: incomingDestinations } = await req.json();

    let activeMap = userProcesses.get(userId);
    if (!activeMap) {
      activeMap = new Map<string, ChildProcess>();
      userProcesses.set(userId, activeMap);
    }

    // --- ACTION: SAVE DESTINATIONS TO DB ---
    if (action === 'save_destinations') {
      if (!Array.isArray(incomingDestinations)) {
        return NextResponse.json({ error: 'Data platform tidak valid.' }, { status: 400 });
      }

      const maxPlatforms = userPlan === 'ultimate' ? 8 : userPlan === 'pro' ? 4 : 2;
      if (incomingDestinations.length > maxPlatforms) {
        return NextResponse.json(
          { error: `Plan Anda (${userPlan.toUpperCase()}) dibatasi maksimal ${maxPlatforms} platform target.` },
          { status: 403 }
        );
      }

      // Sync destinations in DB
      const existingInDb = await prisma.destination.findMany({ where: { userId, deletedAt: null } });
      const incomingIds = incomingDestinations.map((d: any) => d.id).filter((id: string) => id.length > 20); // valid UUIDs

      // Soft-delete removed destinations
      const toDelete = existingInDb.filter((d) => !incomingIds.includes(d.id));
      for (const d of toDelete) {
        await prisma.destination.update({
          where: { id: d.id },
          data: { deletedAt: new Date() },
        });
      }

      // Upsert incoming destinations
      const savedDestinations = [];
      for (const d of incomingDestinations) {
        if (d.id && d.id.length > 20 && existingInDb.some((e) => e.id === d.id)) {
          const updated = await prisma.destination.update({
            where: { id: d.id },
            data: {
              name: d.name || 'Platform Target',
              rtmpUrl: d.rtmpUrl || '',
              streamKey: d.streamKey || '',
            },
          });
          savedDestinations.push(updated);
        } else {
          const created = await prisma.destination.create({
            data: {
              userId,
              name: d.name || 'Platform Target Baru',
              rtmpUrl: d.rtmpUrl || '',
              streamKey: d.streamKey || '',
            },
          });
          savedDestinations.push(created);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Semua konfigurasi target platform berhasil disimpan ke database!',
        destinations: savedDestinations.filter((d) => d.deletedAt === null),
      });
    }

    // --- ACTION: START CLOUD RESTREAM (WITHOUT OBS) ---
    if (action === 'start_cloud_restream') {
      if (!videoId) {
        return NextResponse.json({ error: 'Video ID wajib dipilih.' }, { status: 400 });
      }

      const video = await prisma.video.findFirst({
        where: { id: videoId, userId, deletedAt: null },
      });


      if (!video) {
        return NextResponse.json({ error: 'File video tidak ditemukan.' }, { status: 404 });
      }

      const videoFullPath = path.join(process.cwd(), video.filePath);
      if (!fs.existsSync(videoFullPath)) {
        return NextResponse.json({ error: 'File video MP4 tidak ditemukan pada server storage.' }, { status: 404 });
      }

      // Kill previous cloud process if exists
      const existingCloudProc = userCloudProcesses.get(userId);
      if (existingCloudProc) {
        existingCloudProc.kill('SIGKILL');
        userCloudProcesses.delete(userId);
      }

      // Target MediaMTX Ingest URL
      const mediaMtxIngestUrl = `rtmp://127.0.0.1:1935/live/${userIngestKey}`;

      // Spawn FFmpeg to stream MP4 video file in infinite loop natively (-stream_loop -1 -re)
      const cloudFfmpegArgs = [
        '-stream_loop', '-1',
        '-re',
        '-i', videoFullPath,
        '-c:v', 'copy',
        '-c:a', 'copy',
        '-f', 'flv',
        mediaMtxIngestUrl,
      ];

      const cloudProc = spawn(FFMPEG_PATH, cloudFfmpegArgs);
      userCloudProcesses.set(userId, cloudProc);

      // Setup telemetry
      userTelemetry.set(userId, {
        fps: 30,
        bitrate: 4500,
        speed: '1.0x',
        duration: '00:00:01',
        durationSeconds: 1,
        resolution: '1080p FHD',
        plan: userPlan,
        adStatus: userPlan === 'ultimate' ? '👑 100% Ad-Free (VIP Non-Stop)' : userPlan === 'pro' ? '✨ Minimal Ads (25% Iklan)' : '📢 Ad-Supported Stream',
        status: 'broadcasting',
        activeSource: 'cloud_mp4',
        activeVideoTitle: video.title,
      });

      // Also trigger restream to all configured destinations automatically
      const destinations = await prisma.destination.findMany({ where: { userId } });
      const maxPlatforms = userPlan === 'ultimate' ? 8 : userPlan === 'pro' ? 4 : 2;

      for (const dest of destinations.slice(0, maxPlatforms)) {
        if (!activeMap.has(dest.id)) {
          const fullOutputRtmp = `${dest.rtmpUrl.replace(/\/$/, '')}/${dest.streamKey}`;
          const ffmpegArgs = [
            '-analyzeduration', '1000000',
            '-probesize', '1000000',
            '-i', mediaMtxIngestUrl,
            '-c', 'copy',
            '-f', 'flv',
            fullOutputRtmp,
          ];

          const ffmpegProc = spawn(FFMPEG_PATH, ffmpegArgs);
          activeMap.set(dest.id, ffmpegProc);

          await prisma.destination.update({
            where: { id: dest.id },
            data: { status: 'broadcasting', errorMsg: null },
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: `Cloud Restreaming (Tanpa OBS) berhasil dimulai untuk video "${video.title}"!`,
      });
    }

    // --- ACTION: START ALL (OBS INGEST MODE) ---
    if (action === 'start_all') {
      const destinations = await prisma.destination.findMany({
        where: { userId },
      });

      if (destinations.length === 0) {
        return NextResponse.json(
          { error: 'Belum ada platform target yang dikonfigurasi.' },
          { status: 400 }
        );
      }

      // Check if OBS stream is active on MediaMTX
      try {
        const mtxRes = await fetch('http://127.0.0.1:9997/v3/paths/list');
        if (mtxRes.ok) {
          const mtxData = await mtxRes.json();
          const targetPathName = `live/${userIngestKey}`;
          const isStreamReady = mtxData.items?.some((item: any) => item.name === targetPathName && item.ready === true);

          if (!isStreamReady) {
            return NextResponse.json(
              { error: 'Belum ada sinyal masuk dari OBS Studio. Silakan klik "Mulai Streaming" di OBS terlebih dahulu sebelum menekan tombol Mulai Restream.' },
              { status: 400 }
            );
          }
        }
      } catch (err) {
        console.error('Failed to query MediaMTX API:', err);
        // Fallback: If MediaMTX API is unreachable (e.g. starting up), proceed without blocking
      }

      // Enforce 3-Tier Platform Limits
      const maxPlatforms = userPlan === 'ultimate' ? 8 : userPlan === 'pro' ? 4 : 2;
      if (destinations.length > maxPlatforms) {
        return NextResponse.json(
          {
            error: `Plan Anda (${userPlan.toUpperCase()}) dibatasi maksimal ${maxPlatforms} platform target. Silakan upgrade plan Anda untuk menambah lebih banyak platform!`,
          },
          { status: 403 }
        );
      }

      const inputRtmpUrl = `rtmp://127.0.0.1:1935/live/${userIngestKey}`;
      const results: string[] = [];

      for (const dest of destinations) {
        if (activeMap.has(dest.id)) {
          results.push(`Platform ${dest.name} sudah menyiarkan.`);
          continue;
        }

        const fullOutputRtmp = `${dest.rtmpUrl.replace(/\/$/, '')}/${dest.streamKey}`;

        // Pass-through FFmpeg command
        const ffmpegArgs = [
          '-analyzeduration', '1000000',
          '-probesize', '1000000',
          '-i', inputRtmpUrl,
          '-c', 'copy',
          '-f', 'flv',
          fullOutputRtmp,
        ];

        const ffmpegProc = spawn(FFMPEG_PATH, ffmpegArgs);
        activeMap.set(dest.id, ffmpegProc);

        await prisma.destination.update({
          where: { id: dest.id },
          data: { status: 'broadcasting', errorMsg: null },
        });

        // Parse stderr for Telemetry & Resolution Auto-Reject
        let lastStderrBuffer = '';
        ffmpegProc.stderr?.on('data', (data: Buffer) => {
          const logChunk = data.toString();
          lastStderrBuffer += logChunk;

          // Parse resolution
          const resMatch = logChunk.match(/(\d{3,4})x(\d{3,4})/);
          if (resMatch) {
            const width = parseInt(resMatch[1]);
            const height = parseInt(resMatch[2]);

            // Real-time Resolution Auto-Reject Logic
            let isRejected = false;
            let rejectReason = '';

            if (userPlan === 'free' && (height > 720 || width > 1280)) {
              isRejected = true;
              rejectReason = `Free Plan dibatasi maksimal 720p HD (1280x720). Resolusi terdeteksi ${width}x${height}. Sesi otomatis dihentikan!`;
            } else if (userPlan === 'pro' && (height > 1080 || width > 1920)) {
              isRejected = true;
              rejectReason = `Pro Member dibatasi maksimal 1080p Full HD (1920x1080). Resolusi terdeteksi ${width}x${height}. Sesi otomatis dihentikan!`;
            }

            if (isRejected) {
              ffmpegProc.kill('SIGKILL');
              activeMap.delete(dest.id);
              prisma.destination.update({
                where: { id: dest.id },
                data: { status: 'error', errorMsg: rejectReason },
              }).catch(() => {});

              userTelemetry.set(userId, {
                fps: 0,
                bitrate: 0,
                speed: '0x',
                duration: '00:00:00',
                durationSeconds: 0,
                resolution: `${width}x${height}`,
                plan: userPlan,
                adStatus: 'Auto-Reject Active',
                status: 'error',
                errorMsg: rejectReason,
              });
              return;
            }
          }

          // Parse FPS, Bitrate, Duration
          const fpsMatch = logChunk.match(/fps=\s*([\d.]+)/);
          const bitrateMatch = logChunk.match(/bitrate=\s*([\d.]+)kbits\/s/);
          const speedMatch = logChunk.match(/speed=\s*([\d.]+x)/);
          const timeMatch = logChunk.match(/time=\s*([\d:.]+)/);

          if (fpsMatch || bitrateMatch || timeMatch) {
            const durationStr = timeMatch ? timeMatch[1].split('.')[0] : '00:00:00';
            const [h, m, s] = durationStr.split(':').map((v) => parseInt(v) || 0);
            const totalSecs = h * 3600 + m * 60 + s;

            // Free Plan 4-hour live limit check (14,400 seconds)
            if (userPlan === 'free' && totalSecs >= 14400) {
              ffmpegProc.kill('SIGTERM');
              activeMap.delete(dest.id);
              const limitMsg = '⏳ Sesi 4 Jam Free Plan telah selesai. Silakan upgrade ke Pro/Ultimate untuk live 24/7 non-stop!';
              prisma.destination.update({
                where: { id: dest.id },
                data: { status: 'idle', errorMsg: limitMsg },
              }).catch(() => {});

              userTelemetry.set(userId, {
                fps: 0,
                bitrate: 0,
                speed: '0x',
                duration: '04:00:00',
                durationSeconds: 14400,
                resolution: '720p HD',
                plan: userPlan,
                adStatus: 'Sesi Selesai',
                status: 'idle',
                errorMsg: limitMsg,
              });
              return;
            }

            userTelemetry.set(userId, {
              fps: fpsMatch ? Math.round(parseFloat(fpsMatch[1])) : 60,
              bitrate: bitrateMatch ? Math.round(parseFloat(bitrateMatch[1])) : 4500,
              speed: speedMatch ? speedMatch[1] : '1.0x',
              duration: durationStr,
              durationSeconds: totalSecs,
              resolution: resMatch ? `${resMatch[1]}x${resMatch[2]}` : (userPlan === 'ultimate' ? '4K Ultra HD' : userPlan === 'pro' ? '1080p FHD' : '720p HD'),
              plan: userPlan,
              adStatus: userPlan === 'ultimate' ? '👑 100% Ad-Free (VIP Non-Stop)' : userPlan === 'pro' ? '✨ Minimal Ads (25% Iklan)' : '📢 Ad-Supported Stream',
              status: 'broadcasting',
              activeSource: 'obs',
            });
          }
        });

        ffmpegProc.on('exit', async (code) => {
          activeMap.delete(dest.id);
          if (activeMap.size === 0) {
            userTelemetry.set(userId, {
              fps: 0,
              bitrate: 0,
              speed: '0x',
              duration: '00:00:00',
              durationSeconds: 0,
              resolution: 'N/A',
              plan: userPlan,
              adStatus: 'Standby',
              status: 'idle',
            });
          }
          await prisma.destination.update({
            where: { id: dest.id },
            data: { status: 'idle' },
          });
        });
      }

      return NextResponse.json({
        success: true,
        message: `Restreaming dimulai ke ${destinations.length} platform target!`,
      });
    }

    // --- ACTION: STOP ALL ---
    if (action === 'stop_all') {
      // Stop Cloud MP4 FFmpeg process
      const cloudProc = userCloudProcesses.get(userId);
      if (cloudProc) {
        cloudProc.kill('SIGKILL');
        userCloudProcesses.delete(userId);
      }

      // Stop all destination FFmpeg processes
      for (const [destId, proc] of activeMap.entries()) {
        proc.kill('SIGKILL');
        await prisma.destination.update({
          where: { id: destId },
          data: { status: 'idle', errorMsg: null },
        });
      }
      activeMap.clear();

      userTelemetry.set(userId, {
        fps: 0,
        bitrate: 0,
        speed: '0x',
        duration: '00:00:00',
        durationSeconds: 0,
        resolution: 'N/A',
        plan: userPlan,
        adStatus: 'Standby',
        status: 'idle',
      });

      return NextResponse.json({
        success: true,
        message: 'Seluruh proses restreaming berhasil dihentikan.',
      });
    }

    return NextResponse.json({ error: 'Aksi tidak dikenal.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
