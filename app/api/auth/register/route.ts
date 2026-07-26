import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email dan password wajib diisi.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password minimal 6 karakter.' },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email sudah terdaftar. Silakan login.' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const ingestKey = 'awg_live_' + crypto.randomBytes(6).toString('hex');

    const user = await prisma.user.create({
      data: {
        name: name || email.split('@')[0],
        email: email.toLowerCase(),
        password: hashedPassword,
        ingestKey,
      },
    });

    return NextResponse.json(
      { 
        success: true, 
        message: 'Registrasi berhasil!', 
        user: { id: user.id, name: user.name, email: user.email, ingestKey: user.ingestKey } 
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Registration Error:', error);
    return NextResponse.json(
      { error: 'Gagal mendaftar akun: ' + (error.message || 'Error Server') },
      { status: 500 }
    );
  }
}
