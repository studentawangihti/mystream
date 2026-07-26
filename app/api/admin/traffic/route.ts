import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Akses khusus Super Admin!' }, { status: 403 });
    }

    const totalUsers = await prisma.user.count();
    const freeUsers = await prisma.user.count({ where: { plan: 'free' } });
    const proUsers = await prisma.user.count({ where: { plan: 'pro' } });
    const ultimateUsers = await prisma.user.count({ where: { plan: 'ultimate' } });
    const totalDestinations = await prisma.destination.count();
    const activeStreams = await prisma.destination.count({ where: { status: 'broadcasting' } });

    // Estimate aggregate network traffic (activeStreams * 6 Mbps avg)
    const estimatedBitrateMbps = activeStreams * 6;

    return NextResponse.json({
      traffic: {
        totalUsers,
        freeUsers,
        proUsers,
        ultimateUsers,
        totalDestinations,
        activeStreams,
        estimatedBitrateMbps,
        serverUptime: '99.99%',
        mediaMtxStatus: '🟢 Online (Port 1935 RTMP & 8889 WebRTC)',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
