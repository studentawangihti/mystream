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
    const videos = await prisma.video.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const formattedVideos = videos.map((v) => ({
      ...v,
      sizeBytes: v.sizeBytes.toString(),
    }));

    return NextResponse.json({ videos: formattedVideos });
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
