import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { plan } = await req.json();

    if (!['free', 'pro', 'ultimate'].includes(plan)) {
      return NextResponse.json({ error: 'Plan tidak valid.' }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { plan },
    });

    return NextResponse.json({
      success: true,
      message: `Berhasil beralih ke plan ${plan.toUpperCase()}!`,
      plan: updatedUser.plan,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
