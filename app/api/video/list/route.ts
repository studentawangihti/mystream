import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { getPlanConfigs } from '@/lib/plans';
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
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    const usedStorageBytes = videos.reduce((acc, v) => acc + BigInt(v.sizeBytes), BigInt(0));

    const planConfigs = await getPlanConfigs();
    const currentPlanConfig = planConfigs[userPlan] || planConfigs.free;

    const maxStorageMb = currentPlanConfig.maxStorageMb;
    const maxStorageBytes = BigInt(maxStorageMb) * BigInt(1024 * 1024);
    const maxStorageLabel = maxStorageMb >= 1000 ? `${(maxStorageMb / 1000).toFixed(0)} GB` : `${maxStorageMb} MB`;

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
      where: { id: videoId, userId, deletedAt: null },
    });

    if (!video) {
      return NextResponse.json({ error: 'Video tidak ditemukan di database.' }, { status: 404 });
    }

    // Attempt to delete physical file from disk safely
    try {
      const fullPath = path.join(process.cwd(), video.filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (fsErr) {
      console.warn('Physical file deletion warning (possibly locked):', fsErr);
    }

    // Soft delete database entry
    await prisma.video.update({
      where: { id: videoId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: `Video "${video.title}" berhasil dihapus dari Cloud Storage!`,
    });
  } catch (error: any) {
    console.error('Video DELETE API error:', error);
    return NextResponse.json({ error: error.message || 'Gagal menghapus video.' }, { status: 500 });
  }
}

