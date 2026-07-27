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

    const generateKey = () => {
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let key = '';
      for (let i = 0; i < 20; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return key;
    };

    const now = new Date();
    const newIngestKey = generateKey();

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
