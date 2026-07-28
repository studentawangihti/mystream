import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { getPlanConfigs } from '@/lib/plans';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

// FFprobe helper to extract video duration & format name
async function getVideoInfo(filePath: string): Promise<{ duration: number; formatName: string }> {
  try {
    const ffprobePath = 'C:\\ffmpeg\\ffmpeg-master-latest-win64-gpl-shared\\bin\\ffprobe.exe';
    const cmd = `"${ffprobePath}" -v error -show_entries format=duration,format_name -of default=noprint_wrappers=1 "${filePath}"`;
    const { stdout } = await execPromise(cmd);

    let duration = 0;
    let formatName = '';

    const lines = stdout.split('\n');
    for (const line of lines) {
      if (line.startsWith('duration=')) {
        const durVal = parseFloat(line.split('=')[1]);
        duration = isNaN(durVal) ? 0 : Math.round(durVal);
      } else if (line.startsWith('format_name=')) {
        formatName = line.split('=')[1].trim();
      }
    }

    return { duration, formatName };
  } catch (error) {
    console.error('FFprobe info extraction error:', error);
    return { duration: 0, formatName: '' };
  }
}

// Function to check MP4 Magic Bytes (ftyp container marker)
function isMp4Buffer(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  // MP4 files contain 'ftyp' at offset 4..7 (Hex: 66 74 79 70)
  const ftypMarker = buffer.slice(4, 8).toString('ascii');
  return ftypMarker === 'ftyp';
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const userPlan = (session.user as any).plan || 'free';

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const customTitle = formData.get('title') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'File video MP4 wajib diunggah.' }, { status: 400 });
    }

    // 1. Strict File Extension & MIME Type Check
    const originalName = file.name;
    const isMp4Extension = originalName.toLowerCase().endsWith('.mp4');

    if (!isMp4Extension) {
      return NextResponse.json(
        { error: 'Format file tidak diizinkan! File wajib memiliki ekstensi .MP4' },
        { status: 400 }
      );
    }

    // 2. Enforce File Size Limits per Plan
    // Free: 75MB per file
    // Pro: 1GB per file
    // Ultimate: 3GB per file
    const fileSize = file.size;
    let maxSize = 78643200; // 75MB for Free
    let maxMBLabel = '75 MB';

    if (userPlan === 'pro') {
      maxSize = 1073741824; // 1GB for Pro
      maxMBLabel = '1 GB (1,024 MB)';
    } else if (userPlan === 'ultimate') {
      maxSize = 3221225472; // 3GB for Ultimate
      maxMBLabel = '3 GB (3,072 MB)';
    }

    if (fileSize > maxSize) {
      return NextResponse.json(
        { 
          error: `Ukuran file (${(fileSize / (1024 * 1024)).toFixed(1)} MB) melebihi batas per-file plan ${userPlan.toUpperCase()} (Maksimal ${maxMBLabel}). Silakan upgrade plan Anda!` 
        },
        { status: 400 }
      );
    }

    // 3. Enforce Cumulative Cloud Storage Quotas per Plan
    // Free: 200 MB Total Storage (209,715,200 bytes)
    // Pro: 5 GB Total Storage (5,368,709,120 bytes)
    // Ultimate: 25 GB Total Storage (26,843,545,600 bytes)
    const existingVideos = await prisma.video.findMany({
      where: { userId },
      select: { sizeBytes: true },
    });

    const currentUsedBytes = existingVideos.reduce((acc, curr) => acc + BigInt(curr.sizeBytes), BigInt(0));

    const planConfigs = await getPlanConfigs();
    const currentPlanConfig = planConfigs[userPlan] || planConfigs.free;

    const maxStorageMb = currentPlanConfig.maxStorageMb;
    const maxTotalStorage = BigInt(maxStorageMb) * BigInt(1024 * 1024);
    const maxStorageLabel = maxStorageMb >= 1000 ? `${(maxStorageMb / 1000).toFixed(0)} GB` : `${maxStorageMb} MB`;

    if (currentUsedBytes + BigInt(fileSize) > maxTotalStorage) {
      const usedMB = (Number(currentUsedBytes) / (1024 * 1024)).toFixed(1);
      return NextResponse.json(
        {
          error: `Kapasitas Cloud Storage Anda melebihi kuota plan ${userPlan.toUpperCase()} (Terpakai ${usedMB} MB dari total ${maxStorageLabel}). Silakan hapus beberapa video lama atau upgrade plan Anda!`,
        },
        { status: 400 }
      );
    }

    // Read buffer to verify MP4 Magic Bytes (ftyp container marker)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!isMp4Buffer(buffer)) {
      return NextResponse.json(
        { error: 'Gagal mengunggah! File yang diunggah bukan merupakan struktur container MP4 asli (Magic Bytes ftyp mismatch).' },
        { status: 400 }
      );
    }

    // Save temporary file to disk
    const uploadDir = path.join(process.cwd(), 'uploads', 'videos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const safeFilename = `${Date.now()}_${userId.slice(0, 8)}_${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const destinationPath = path.join(uploadDir, safeFilename);

    await fs.promises.writeFile(destinationPath, buffer);

    // 4. Verify Video Container with FFprobe
    const { duration: durationSecs, formatName } = await getVideoInfo(destinationPath);

    if (!formatName.includes('mp4') && !formatName.includes('mov') && !formatName.includes('3gp') && !formatName.includes('isom')) {
      if (fs.existsSync(destinationPath)) {
        fs.unlinkSync(destinationPath);
      }
      return NextResponse.json(
        { error: 'FFprobe menolak file! Stream container bukan merupakan format MP4 yang valid.' },
        { status: 400 }
      );
    }

    // 5. Enforce Video Duration Limits per Plan
    // Free: 20 Min (1,200s)
    // Pro: 60 Min (3,600s)
    // Ultimate: 300 Min / 5h (18,000s)
    let maxDurationSecs = 1200; // 20 mins
    let maxDurLabel = '20 Menit';

    if (userPlan === 'pro') {
      maxDurationSecs = 3600; // 1 Hour
      maxDurLabel = '1 Jam (60 Menit)';
    } else if (userPlan === 'ultimate') {
      maxDurationSecs = 18000; // 5 Hours
      maxDurLabel = '5 Jam (300 Menit)';
    }

    if (durationSecs > maxDurationSecs) {
      if (fs.existsSync(destinationPath)) {
        fs.unlinkSync(destinationPath);
      }
      return NextResponse.json(
        {
          error: `Durasi video (${Math.floor(durationSecs / 60)}m ${durationSecs % 60}s) melebihi batas plan ${userPlan.toUpperCase()} (Maksimal ${maxDurLabel}). Silakan potong video atau upgrade plan Anda!`
        },
        { status: 400 }
      );
    }

    // Save video record into Database
    const title = customTitle || originalName.replace('.mp4', '');
    const videoRecord = await prisma.video.create({
      data: {
        userId,
        title,
        filename: safeFilename,
        filePath: `uploads/videos/${safeFilename}`,
        sizeBytes: BigInt(fileSize),
        durationSecs,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Video MP4 berhasil diverifikasi dan diunggah ke Cloud Library!',
      video: {
        ...videoRecord,
        sizeBytes: videoRecord.sizeBytes.toString(),
      },
    });
  } catch (error: any) {
    console.error('Video upload error:', error);
    return NextResponse.json({ error: error.message || 'Gagal mengunggah video.' }, { status: 500 });
  }
}
