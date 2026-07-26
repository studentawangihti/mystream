import { NextResponse } from 'next/server';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// Map of user processes: userId -> Map<destinationId, ChildProcess>
const userProcesses = new Map<string, Map<string, ChildProcess>>();

// Map of live stream telemetry: userId -> TelemetryData
interface TelemetryData {
  fps: number;
  bitrate: number;
  speed: string;
  duration: string;
  durationSeconds: number;
  resolution: string;
  plan: string;
  adStatus: string;
  status: string;
  errorMsg?: string;
}

const telemetryMap = new Map<string, TelemetryData>();

const FFMPEG_PATH = path.join(
  'C:',
  'ffmpeg',
  'ffmpeg-master-latest-win64-gpl-shared',
  'bin',
  'ffmpeg.exe'
);

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const userPlan = (session.user as any).plan || 'free';

    const destinations = await prisma.destination.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const activeMap = userProcesses.get(userId) || new Map<string, ChildProcess>();

    const updatedDestinations = destinations.map((dest) => {
      const isRunning = activeMap.has(dest.id);
      return {
        ...dest,
        status: isRunning ? 'broadcasting' : dest.status === 'error' ? 'error' : 'idle',
      };
    });

    const defaultAdStatus =
      userPlan === 'ultimate'
        ? '👑 100% Ad-Free (VIP Non-Stop)'
        : userPlan === 'pro'
        ? '✨ Minimal Ads (25% Iklan)'
        : '📢 Ad-Supported Stream (100% Iklan & Watermark)';

    const telemetry = telemetryMap.get(userId) || {
      fps: 0,
      bitrate: 0,
      speed: '0x',
      duration: '00:00:00',
      durationSeconds: 0,
      resolution: 'N/A',
      plan: userPlan,
      adStatus: defaultAdStatus,
      status: activeMap.size > 0 ? 'broadcasting' : 'idle',
    };

    return NextResponse.json({
      destinations: updatedDestinations,
      telemetry: {
        ...telemetry,
        plan: userPlan,
        adStatus: defaultAdStatus,
      },
      ffmpegPath: FFMPEG_PATH,
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
      where: { id: userId },
      select: { plan: true, ingestKey: true },
    });

    const userPlan = dbUser?.plan || 'free';
    const userIngestKey = dbUser?.ingestKey || (session.user as any).ingestKey;

    const { action, destinationId } = await req.json();

    let activeMap = userProcesses.get(userId);
    if (!activeMap) {
      activeMap = new Map<string, ChildProcess>();
      userProcesses.set(userId, activeMap);
    }

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

        // Initialize telemetry
        telemetryMap.set(userId, {
          fps: 0,
          bitrate: 0,
          speed: '1.0x',
          duration: '00:00:00',
          durationSeconds: 0,
          resolution: 'Mendeteksi...',
          plan: userPlan,
          adStatus:
            userPlan === 'ultimate'
              ? '👑 100% Ad-Free (VIP Non-Stop)'
              : userPlan === 'pro'
              ? '✨ Minimal Ads (25% Iklan)'
              : '📢 Ad-Supported Stream (100% Iklan & Watermark)',
          status: 'broadcasting',
        });

        // Parse FFmpeg real-time stderr logs for telemetry & resolution auto-reject
        ffmpegProc.stderr.on('data', async (chunk: Buffer) => {
          const logText = chunk.toString();

          // 1. Detect Video Resolution
          const resMatch = logText.match(/(\d{3,4})x(\d{3,4})/);
          if (resMatch) {
            const width = parseInt(resMatch[1], 10);
            const height = parseInt(resMatch[2], 10);
            const resString = `${width}x${height}`;

            const currentTelem = telemetryMap.get(userId);
            if (currentTelem) {
              currentTelem.resolution = resString;
            }

            // AUTO-REJECT RESOLUTION PROTECTION
            let isRejected = false;
            let rejectReason = '';

            if (userPlan === 'free' && height > 720) {
              isRejected = true;
              rejectReason = `❌ AUTO-REJECT: Resolusi OBS Anda (${width}x${height} / >720p) melebihi batas Free Plan (Maksimal 720p HD). Silakan ubah Output Resolution di OBS ke 720p (1280x720) atau upgrade ke Pro/Ultimate Plan!`;
            } else if (userPlan === 'pro' && height > 1080) {
              isRejected = true;
              rejectReason = `❌ AUTO-REJECT: Resolusi OBS Anda (${width}x${height} / 4K) melebihi batas Pro Plan (Maksimal 1080p Full HD). Upgrade ke Ultimate VIP untuk menyiarkan 4K!`;
            }

            if (isRejected) {
              console.error(`[AUTO-REJECT] ${rejectReason}`);
              ffmpegProc.kill('SIGKILL');
              activeMap?.delete(dest.id);

              telemetryMap.set(userId, {
                fps: 0,
                bitrate: 0,
                speed: '0x',
                duration: '00:00:00',
                durationSeconds: 0,
                resolution: resString,
                plan: userPlan,
                adStatus: 'AUTO-REJECTED',
                status: 'error',
                errorMsg: rejectReason,
              });

              await prisma.destination.update({
                where: { id: dest.id },
                data: { status: 'error', errorMsg: rejectReason },
              });
              return;
            }
          }

          // 2. Parse Telemetry (fps, bitrate, duration, speed)
          const fpsMatch = logText.match(/fps=\s*([\d.]+)/);
          const bitrateMatch = logText.match(/bitrate=\s*([\d.]+)kbits\/s/);
          const timeMatch = logText.match(/time=\s*([\d{2}:.]+)/);
          const speedMatch = logText.match(/speed=\s*([\d.]+x)/);

          const currentTelem = telemetryMap.get(userId) || {
            fps: 0,
            bitrate: 0,
            speed: '1.0x',
            duration: '00:00:00',
            durationSeconds: 0,
            resolution: 'Mendeteksi...',
            plan: userPlan,
            adStatus: 'Broadcasting',
            status: 'broadcasting',
          };

          if (fpsMatch) currentTelem.fps = parseFloat(fpsMatch[1]);
          if (bitrateMatch) currentTelem.bitrate = Math.round(parseFloat(bitrateMatch[1]));
          if (speedMatch) currentTelem.speed = speedMatch[1];
          if (timeMatch) {
            currentTelem.duration = timeMatch[1].split('.')[0];
            const parts = currentTelem.duration.split(':').map(Number);
            if (parts.length === 3) {
              const totalSecs = parts[0] * 3600 + parts[1] * 60 + parts[2];
              currentTelem.durationSeconds = totalSecs;

              // AUTO-STOP 4-HOUR LIMIT FOR FREE USERS
              if (userPlan === 'free' && totalSecs >= 14400) { // 4 hours
                console.log(`[AUTO-STOP] Free user hit 4-hour limit.`);
                ffmpegProc.kill('SIGTERM');
                activeMap?.delete(dest.id);
                currentTelem.status = 'idle';
                currentTelem.errorMsg = '⏳ Sesi 4 Jam Free Plan telah selesai. Silakan upgrade ke Pro/Ultimate untuk live 24/7 non-stop!';
              }
            }
          }

          telemetryMap.set(userId, currentTelem);
        });

        ffmpegProc.on('close', async () => {
          activeMap?.delete(dest.id);
          await prisma.destination.update({
            where: { id: dest.id },
            data: { status: 'idle' },
          });

          if (activeMap?.size === 0) {
            const t = telemetryMap.get(userId);
            if (t) {
              t.status = 'idle';
              t.fps = 0;
              t.bitrate = 0;
            }
          }
        });

        results.push(`Proses restream ke ${dest.name} berhasil dimulai.`);
      }

      return NextResponse.json({ success: true, message: results.join(' ') });
    }

    if (action === 'stop_all') {
      if (activeMap.size === 0) {
        return NextResponse.json({ message: 'Tidak ada proses restream yang berjalan.' });
      }

      for (const [id, proc] of activeMap.entries()) {
        proc.kill('SIGTERM');
        activeMap.delete(id);
        await prisma.destination.update({
          where: { id },
          data: { status: 'idle' },
        });
      }

      telemetryMap.set(userId, {
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

      return NextResponse.json({ success: true, message: 'Semua proses restream dihentikan.' });
    }

    return NextResponse.json({ error: 'Aksi tidak dikenal.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
