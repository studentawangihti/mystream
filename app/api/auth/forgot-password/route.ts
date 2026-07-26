import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email wajib diisi.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Email tidak ditemukan di sistem kami.' },
        { status: 404 }
      );
    }

    // Generate secure 64-char hex reset token valid for 1 hour
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 3600 * 1000); // 1 hour expiry

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: token,
        resetTokenExpiry: expiry,
      },
    });

    const resetUrl = `http://localhost:3000/reset-password?token=${token}`;

    return NextResponse.json({
      success: true,
      message: 'Token reset password berhasil dibuat.',
      token,
      resetUrl,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
