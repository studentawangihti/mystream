import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;

    // Refresh user plan from DB
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });

    const userPlan = dbUser?.plan || 'free';

    const videos = await prisma.video.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const usedStorageBytes = videos.reduce((acc, v) => acc + BigInt(v.sizeBytes), BigInt(0));

    let maxStorageBytes = BigInt(209715200); // 200 MB for Free
    let maxStorageLabel = '200 MB';

    if (userPlan === 'pro') {
      maxStorageBytes = BigInt(5368709120); // 5 GB for Pro
      maxStorageLabel = '5 GB';
    } else if (userPlan === 'ultimate') {
      maxStorageBytes = BigInt(26843545600); // 25 GB for Ultimate
      maxStorageLabel = '25 GB';
    }

    const formattedVideos = videos.map((v) => ({
      ...v,
      sizeBytes: v.sizeBytes.toString(),
    }));

    return NextResponse.json({
      videos: formattedVideos,
      storage: {
        usedBytes: usedStorageBytes.toString(),
        maxBytes: maxStorageBytes.toString(),
        maxLabel: maxStorageLabel,
        plan: userPlan,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { videoId } = await req.json();

    if (!videoId) {
      return NextResponse.json({ error: 'Video ID wajib diisi.' }, { status: 400 });
    }

    const video = await prisma.video.findFirst({
      where: { id: videoId, userId },
    });

    if (!video) {
      return NextResponse.json({ error: 'Video tidak ditemukan.' }, { status: 404 });
    }

    // Delete file from disk if exists
    const fullPath = path.join(process.cwd(), video.filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    // Delete database entry
    await prisma.video.delete({
      where: { id: videoId },
    });

    return NextResponse.json({
      success: true,
      message: 'Video berhasil dihapus dari Cloud Library.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
