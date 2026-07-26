import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Akses khusus Super Admin!' }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        plan: true,
        ingestKey: true,
        createdAt: true,
        destinations: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ users });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Akses khusus Super Admin!' }, { status: 403 });
    }

    const { action, userId, plan } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID wajib diisi.' }, { status: 400 });
    }

    if (action === 'change_plan') {
      if (!['free', 'pro', 'ultimate'].includes(plan)) {
        return NextResponse.json({ error: 'Plan tidak valid.' }, { status: 400 });
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { plan },
      });

      return NextResponse.json({
        success: true,
        message: `Plan user ${updatedUser.email} berhasil diubah ke ${plan.toUpperCase()}!`,
        user: updatedUser,
      });
    }

    if (action === 'reset_key') {
      const newIngestKey = `awg_live_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ingestKey: newIngestKey,
          lastResetAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: `Stream Key user ${updatedUser.email} berhasil direset!`,
        user: updatedUser,
      });
    }

    return NextResponse.json({ error: 'Aksi tidak dikenal.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
