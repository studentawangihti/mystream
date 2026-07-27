import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email dan password wajib diisi.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email sudah terdaftar. Silakan gunakan email lain atau login.' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const generateKey = () => {
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let segments = [];
      for (let i = 0; i < 4; i++) {
        let segment = '';
        for (let j = 0; j < 5; j++) {
          segment += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        segments.push(segment);
      }
      return segments.join('-');
    };

    const ingestKey = generateKey();

    const user = await prisma.user.create({
      data: {
        name: name || normalizedEmail.split('@')[0],
        email: normalizedEmail,
        password: hashedPassword,
        plan: 'free',
        ingestKey,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Registrasi berhasil! Silakan login.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        ingestKey: user.ingestKey,
      },
    });
  } catch (error: any) {
    console.error('Registration Error:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal mendaftar user baru.' },
      { status: 500 }
    );
  }
}
