import { NextRequest, NextResponse } from 'next/server';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';

// Define structures
interface Destination {
  id: string;
  name: string;
  rtmpUrl: string;
  streamKey: string;
  status: 'idle' | 'streaming' | 'error';
  errorMsg?: string;
  startedAt?: string;
  logs: string[];
}

// Global persistence in development
const globalForRestream = global as typeof globalThis & {
  activeProcesses?: Map<string, ChildProcess>;
  streamConfigs?: Destination[];
};

if (!globalForRestream.activeProcesses) {
  globalForRestream.activeProcesses = new Map();
}
if (!globalForRestream.streamConfigs) {
  // Seed with default placeholder configuration
  globalForRestream.streamConfigs = [
    {
      id: 'youtube',
      name: 'YouTube Live',
      rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
      streamKey: '',
      status: 'idle',
      logs: []
    },
    {
      id: 'twitch',
      name: 'Twitch TV',
      rtmpUrl: 'rtmp://live.twitch.tv/app',
      streamKey: '',
      status: 'idle',
      logs: []
    }
  ];
}

const activeProcesses = globalForRestream.activeProcesses;
const streamConfigs = globalForRestream.streamConfigs;

// Detect local FFmpeg path
function getFfmpegPath(): string {
  const paths = [
    'C:\\ffmpeg\\ffmpeg-master-latest-win64-gpl-shared\\bin\\ffmpeg.exe',
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\ffmpeg\\ffmpeg.exe',
    'ffmpeg' // fallback to PATH
  ];

  for (const p of paths) {
    if (p === 'ffmpeg' || fs.existsSync(p)) {
      return p;
    }
  }
  return 'ffmpeg';
}

export async function GET() {
  // Sync status
  for (const config of streamConfigs) {
    if (config.status === 'streaming') {
      const proc = activeProcesses.get(config.id);
      if (!proc || proc.killed) {
        config.status = 'idle';
      }
    }
  }

  return NextResponse.json({
    destinations: streamConfigs,
    ffmpegPath: getFfmpegPath()
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, id, destinations, name, rtmpUrl, streamKey } = body;

    // 1. UPDATE/SAVE Configurations
    if (action === 'save_destinations' && Array.isArray(destinations)) {
      // Clear existing configuration items that are not active
      const runningIds = new Set(activeProcesses.keys());
      
      // Update or replace configurations
      // Keep running ones unchanged status-wise, merge values
      const newConfigs = destinations.map((d: any) => {
        const existing = streamConfigs.find(c => c.id === d.id);
        const isRunning = runningIds.has(d.id);

        return {
          id: d.id,
          name: d.name || 'Unnamed Platform',
          rtmpUrl: d.rtmpUrl || '',
          streamKey: d.streamKey || '',
          status: isRunning ? 'streaming' : (existing ? existing.status : 'idle'),
          errorMsg: existing?.errorMsg || '',
          startedAt: existing?.startedAt,
          logs: existing?.logs || []
        } as Destination;
      });

      streamConfigs.length = 0;
      streamConfigs.push(...newConfigs);

      return NextResponse.json({ success: true, destinations: streamConfigs });
    }

    // 2. START RESTREAMING
    if (action === 'start') {
      const { ingestKey } = body;
      const finalIngestKey = ingestKey || 'test';
      const ffmpegPath = getFfmpegPath();
      console.log(`Starting restream with FFmpeg: ${ffmpegPath} (Ingest Key: ${finalIngestKey})`);

      let startedCount = 0;
      const errors: string[] = [];

      for (const config of streamConfigs) {
        // Skip if empty URL/key, or if already streaming
        if (!config.rtmpUrl || !config.streamKey) {
          continue;
        }

        if (activeProcesses.has(config.id)) {
          console.log(`Platform ${config.id} is already streaming.`);
          continue;
        }

        try {
          // Construct target URL
          let targetUrl = config.rtmpUrl;
          if (!targetUrl.endsWith('/')) {
            targetUrl += '/';
          }
          targetUrl += config.streamKey;

          // Spawn FFmpeg process
          // Command: ffmpeg -i rtmp://localhost:1935/live/<ingestKey> -c copy -f flv <destination>
          const args = [
            '-i', `rtmp://localhost:1935/live/${finalIngestKey}`,
            '-c', 'copy',
            '-f', 'flv',
            targetUrl
          ];

          console.log(`Spawning FFmpeg for ${config.name}: ${ffmpegPath} ${args.join(' ')}`);
          
          const proc = spawn(ffmpegPath, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: false
          });

          config.status = 'streaming';
          config.startedAt = new Date().toISOString();
          config.errorMsg = undefined;
          config.logs = [`[System] Spawned FFmpeg process for ${config.name} (PID: ${proc.pid})`];

          // Capture stdout
          proc.stdout?.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach((line: string) => {
              if (line.trim()) {
                config.logs.push(`[STDOUT] ${line.trim()}`);
                if (config.logs.length > 50) config.logs.shift();
              }
            });
          });

          // Capture stderr (FFmpeg outputs statistics and status here)
          proc.stderr?.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach((line: string) => {
              if (line.trim()) {
                config.logs.push(line.trim());
                if (config.logs.length > 50) config.logs.shift();
              }
            });
          });

          // Handle process exit
          proc.on('close', (code) => {
            console.log(`FFmpeg for ${config.name} exited with code ${code}`);
            activeProcesses.delete(config.id);
            config.status = code === 0 || code === null ? 'idle' : 'error';
            if (code !== 0 && code !== null) {
              config.errorMsg = `FFmpeg exited with code ${code}`;
            }
            config.logs.push(`[System] FFmpeg exited with code ${code}`);
          });

          proc.on('error', (err) => {
            console.error(`FFmpeg error for ${config.name}:`, err);
            activeProcesses.delete(config.id);
            config.status = 'error';
            config.errorMsg = err.message;
            config.logs.push(`[Error] ${err.message}`);
          });

          activeProcesses.set(config.id, proc);
          startedCount++;
        } catch (err: any) {
          console.error(`Failed to start FFmpeg for ${config.name}:`, err);
          config.status = 'error';
          config.errorMsg = err.message;
          config.logs.push(`[Error] Failed to spawn process: ${err.message}`);
          errors.push(`${config.name}: ${err.message}`);
        }
      }

      return NextResponse.json({
        success: errors.length === 0,
        startedCount,
        errors,
        destinations: streamConfigs
      });
    }

    // 3. STOP RESTREAMING
    if (action === 'stop') {
      const { targetId } = body; // Optional: stop specific, or stop all if not provided

      if (targetId) {
        const proc = activeProcesses.get(targetId);
        if (proc) {
          proc.kill('SIGTERM');
          activeProcesses.delete(targetId);
        }
        const config = streamConfigs.find(c => c.id === targetId);
        if (config) {
          config.status = 'idle';
          config.logs.push('[System] Stream stopped manually by user');
        }
      } else {
        // Stop all
        for (const [id, proc] of activeProcesses.entries()) {
          proc.kill('SIGTERM');
          activeProcesses.delete(id);
        }
        for (const config of streamConfigs) {
          if (config.status === 'streaming') {
            config.status = 'idle';
            config.logs.push('[System] Stream stopped manually by user');
          }
        }
      }

      return NextResponse.json({ success: true, destinations: streamConfigs });
    }

    // 4. GET LOGS
    if (action === 'get_logs' && id) {
      const config = streamConfigs.find(c => c.id === id);
      return NextResponse.json({
        id,
        logs: config ? config.logs : [],
        status: config ? config.status : 'idle',
        errorMsg: config ? config.errorMsg : ''
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in restream API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
