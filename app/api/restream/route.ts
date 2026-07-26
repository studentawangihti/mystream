import { NextRequest, NextResponse } from 'next/server';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// Memory map for running FFmpeg child processes and in-memory log buffer
const globalForRestream = global as typeof globalThis & {
  activeProcesses?: Map<string, ChildProcess>;
  logBuffers?: Map<string, string[]>;
};

if (!globalForRestream.activeProcesses) {
  globalForRestream.activeProcesses = new Map();
}
if (!globalForRestream.logBuffers) {
  globalForRestream.logBuffers = new Map();
}

const activeProcesses = globalForRestream.activeProcesses;
const logBuffers = globalForRestream.logBuffers;

function getFfmpegPath(): string {
  const paths = [
    'C:\\ffmpeg\\ffmpeg-master-latest-win64-gpl-shared\\bin\\ffmpeg.exe',
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\ffmpeg\\ffmpeg.exe',
    'ffmpeg'
  ];

  for (const p of paths) {
    if (p === 'ffmpeg' || fs.existsSync(p)) {
      return p;
    }
  }
  return 'ffmpeg';
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch or seed default destinations for user
  let userDestinations = await prisma.destination.findMany({
    where: { userId },
  });

  if (userDestinations.length === 0) {
    userDestinations = await prisma.$transaction([
      prisma.destination.create({
        data: {
          userId,
          name: 'YouTube Live',
          rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
          streamKey: '',
          status: 'idle',
        },
      }),
      prisma.destination.create({
        data: {
          userId,
          name: 'Twitch TV',
          rtmpUrl: 'rtmp://live.twitch.tv/app',
          streamKey: '',
          status: 'idle',
        },
      }),
    ]);
  }

  // Sync process running state
  const formatted = userDestinations.map((d) => {
    const isRunning = activeProcesses.has(d.id);
    return {
      id: d.id,
      name: d.name,
      rtmpUrl: d.rtmpUrl,
      streamKey: d.streamKey,
      status: isRunning ? 'streaming' : (d.status === 'streaming' ? 'idle' : d.status),
      errorMsg: d.errorMsg || '',
      logs: logBuffers.get(d.id) || [],
    };
  });

  return NextResponse.json({
    destinations: formatted,
    ffmpegPath: getFfmpegPath(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, id, destinations } = body;

    // 1. SAVE DESTINATIONS
    if (action === 'save_destinations' && Array.isArray(destinations)) {
      // Upsert user destinations in database
      const updatedList = [];
      
      for (const d of destinations) {
        let saved;
        if (d.id && !d.id.startsWith('custom_')) {
          saved = await prisma.destination.update({
            where: { id: d.id },
            data: {
              name: d.name || 'Unnamed Platform',
              rtmpUrl: d.rtmpUrl || '',
              streamKey: d.streamKey || '',
            },
          });
        } else {
          saved = await prisma.destination.create({
            data: {
              userId,
              name: d.name || 'Platform Kustom',
              rtmpUrl: d.rtmpUrl || '',
              streamKey: d.streamKey || '',
              status: 'idle',
            },
          });
        }
        
        const isRunning = activeProcesses.has(saved.id);
        updatedList.push({
          id: saved.id,
          name: saved.name,
          rtmpUrl: saved.rtmpUrl,
          streamKey: saved.streamKey,
          status: isRunning ? 'streaming' : saved.status,
          errorMsg: saved.errorMsg || '',
          logs: logBuffers.get(saved.id) || [],
        });
      }

      return NextResponse.json({ success: true, destinations: updatedList });
    }

    // 2. START RESTREAMING
    if (action === 'start') {
      const { ingestKey } = body;
      const finalIngestKey = ingestKey || 'test';
      const ffmpegPath = getFfmpegPath();

      const userDestinations = await prisma.destination.findMany({
        where: { userId },
      });

      let startedCount = 0;
      const errors: string[] = [];

      for (const dest of userDestinations) {
        if (!dest.rtmpUrl || !dest.streamKey) continue;
        if (activeProcesses.has(dest.id)) continue;

        try {
          let targetUrl = dest.rtmpUrl;
          if (!targetUrl.endsWith('/')) targetUrl += '/';
          targetUrl += dest.streamKey;

          const args = [
            '-i', `rtmp://localhost:1935/live/${finalIngestKey}`,
            '-c', 'copy',
            '-f', 'flv',
            targetUrl
          ];

          const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

          if (!logBuffers.has(dest.id)) {
            logBuffers.set(dest.id, []);
          }
          const currentLogs = logBuffers.get(dest.id)!;
          currentLogs.push(`[System] Spawned FFmpeg process for ${dest.name} (PID: ${proc.pid})`);

          proc.stdout?.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach((line: string) => {
              if (line.trim()) {
                currentLogs.push(`[STDOUT] ${line.trim()}`);
                if (currentLogs.length > 50) currentLogs.shift();
              }
            });
          });

          proc.stderr?.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach((line: string) => {
              if (line.trim()) {
                currentLogs.push(line.trim());
                if (currentLogs.length > 50) currentLogs.shift();
              }
            });
          });

          proc.on('close', async (code) => {
            activeProcesses.delete(dest.id);
            const status = code === 0 || code === null ? 'idle' : 'error';
            await prisma.destination.update({
              where: { id: dest.id },
              data: {
                status,
                errorMsg: code !== 0 && code !== null ? `FFmpeg exited with code ${code}` : null,
              },
            });
            currentLogs.push(`[System] FFmpeg exited with code ${code}`);
          });

          proc.on('error', async (err) => {
            activeProcesses.delete(dest.id);
            await prisma.destination.update({
              where: { id: dest.id },
              data: { status: 'error', errorMsg: err.message },
            });
            currentLogs.push(`[Error] ${err.message}`);
          });

          activeProcesses.set(dest.id, proc);
          await prisma.destination.update({
            where: { id: dest.id },
            data: { status: 'streaming', errorMsg: null },
          });

          startedCount++;
        } catch (err: any) {
          errors.push(`${dest.name}: ${err.message}`);
        }
      }

      const refreshed = await prisma.destination.findMany({ where: { userId } });
      const formatted = refreshed.map((d) => ({
        id: d.id,
        name: d.name,
        rtmpUrl: d.rtmpUrl,
        streamKey: d.streamKey,
        status: activeProcesses.has(d.id) ? 'streaming' : d.status,
        errorMsg: d.errorMsg || '',
        logs: logBuffers.get(d.id) || [],
      }));

      return NextResponse.json({
        success: errors.length === 0,
        startedCount,
        errors,
        destinations: formatted,
      });
    }

    // 3. STOP RESTREAMING
    if (action === 'stop') {
      const { targetId } = body;
      const userDestinations = await prisma.destination.findMany({ where: { userId } });

      if (targetId) {
        const proc = activeProcesses.get(targetId);
        if (proc) {
          proc.kill('SIGTERM');
          activeProcesses.delete(targetId);
        }
        await prisma.destination.update({
          where: { id: targetId },
          data: { status: 'idle' },
        });
      } else {
        for (const dest of userDestinations) {
          const proc = activeProcesses.get(dest.id);
          if (proc) {
            proc.kill('SIGTERM');
            activeProcesses.delete(dest.id);
          }
        }
        await prisma.destination.updateMany({
          where: { userId },
          data: { status: 'idle' },
        });
      }

      const refreshed = await prisma.destination.findMany({ where: { userId } });
      const formatted = refreshed.map((d) => ({
        id: d.id,
        name: d.name,
        rtmpUrl: d.rtmpUrl,
        streamKey: d.streamKey,
        status: activeProcesses.has(d.id) ? 'streaming' : 'idle',
        errorMsg: d.errorMsg || '',
        logs: logBuffers.get(d.id) || [],
      }));

      return NextResponse.json({ success: true, destinations: formatted });
    }

    // 4. GET LOGS
    if (action === 'get_logs' && id) {
      const dest = await prisma.destination.findUnique({ where: { id } });
      const logs = logBuffers.get(id) || [];
      const isRunning = activeProcesses.has(id);

      return NextResponse.json({
        id,
        logs,
        status: isRunning ? 'streaming' : (dest?.status || 'idle'),
        errorMsg: dest?.errorMsg || '',
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Restream API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
