import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    // Check 24-hour rate limit quota
    const now = new Date();
    if (user.lastResetAt) {
      const hoursDiff = (now.getTime() - new Date(user.lastResetAt).getTime()) / (1000 * 60 * 60);
      if (hoursDiff < 24) {
        const hoursRemaining = Math.ceil(24 - hoursDiff);
        return NextResponse.json({
          error: `Kuota acak Stream Key telah digunakan hari ini. Anda dapat mengacak key lagi dalam ${hoursRemaining} jam.`,
          hoursRemaining,
        }, { status: 429 });
      }
    }

    // Generate new unique permanent stream key
    const newIngestKey = 'awg_live_' + crypto.randomBytes(6).toString('hex');

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ingestKey: newIngestKey,
        lastResetAt: now,
      },
    });

    return NextResponse.json({
      success: true,
      ingestKey: updatedUser.ingestKey,
      lastResetAt: updatedUser.lastResetAt?.toISOString(),
      message: 'Stream Key berhasil diacak! Silakan perbarui Stream Key di OBS Studio Anda.',
    });
  } catch (error: any) {
    console.error('Reset Ingest Key Error:', error);
    return NextResponse.json({ error: error.message || 'Gagal mereset Stream Key' }, { status: 500 });
  }
}
