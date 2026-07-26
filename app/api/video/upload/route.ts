import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

// FFprobe helper to extract video duration in seconds
async function getVideoDuration(filePath: string): Promise<number> {
  try {
    const ffprobePath = 'C:\\ffmpeg\\ffmpeg-master-latest-win64-gpl-shared\\bin\\ffprobe.exe';
    const cmd = `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
    const { stdout } = await execPromise(cmd);
    const duration = parseFloat(stdout.trim());
    return isNaN(duration) ? 0 : Math.round(duration);
  } catch (error) {
    console.error('FFprobe duration extraction error:', error);
    return 0;
  }
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

    // 1. Enforce MP4 format strictly
    const originalName = file.name;
    const isMp4Extension = originalName.toLowerCase().endsWith('.mp4');
    const isMp4Mime = file.type === 'video/mp4';

    if (!isMp4Extension && !isMp4Mime) {
      return NextResponse.json(
        { error: 'Format file tidak valid. Hanya file video .MP4 yang diizinkan!' },
        { status: 400 }
      );
    }

    // 2. Enforce File Size Limits per Plan
    // Free: 75MB (78,643,200 bytes)
    // Pro: 1GB (1,073,741,824 bytes)
    // Ultimate: 3GB (3,221,225,472 bytes)
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
          error: `Ukuran file Anda (${(fileSize / (1024 * 1024)).toFixed(1)} MB) melebihi batas plan ${userPlan.toUpperCase()} (Maksimal ${maxMBLabel}). Silakan upgrade plan Anda!` 
        },
        { status: 400 }
      );
    }

    // Save temporary file to disk to measure duration & verify
    const uploadDir = path.join(process.cwd(), 'uploads', 'videos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const safeFilename = `${Date.now()}_${userId.slice(0, 8)}_${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const destinationPath = path.join(uploadDir, safeFilename);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.promises.writeFile(destinationPath, buffer);

    // 3. Enforce Video Duration Limits per Plan
    // Free: 20 Min (1,200s)
    // Pro: 60 Min (3,600s)
    // Ultimate: 300 Min / 5h (18,000s)
    const durationSecs = await getVideoDuration(destinationPath);
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
      // Remove invalid uploaded file from disk
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
      message: 'Video MP4 berhasil diunggah ke Cloud Library!',
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
