import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Akses khusus Super Admin!' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const includeDeleted = searchParams.get('includeDeleted') === 'true';

    const whereCondition = includeDeleted ? {} : { deletedAt: null };

    const users = await prisma.user.findMany({
      where: whereCondition,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        plan: true,
        ingestKey: true,
        deletedAt: true,
        createdAt: true,
        destinations: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        videos: {
          select: {
            id: true,
            title: true,
            sizeBytes: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedUsers = users.map((u) => ({
      ...u,
      videos: u.videos.map((v) => ({
        ...v,
        sizeBytes: v.sizeBytes.toString(),
      })),
    }));

    return NextResponse.json({ users: formattedUsers });
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

    const { action, userId, plan, role, newPassword } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID wajib diisi.' }, { status: 400 });
    }

    const adminId = (session.user as any).id;

    if (action === 'soft_delete') {
      if (userId === adminId) {
        return NextResponse.json({ error: 'Anda tidak dapat menghapus akun Anda sendiri!' }, { status: 400 });
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { deletedAt: new Date() },
      });

      return NextResponse.json({
        success: true,
        message: `Akun user ${updatedUser.email} berhasil di-soft delete (masuk ke Sampah/Recycle Bin)!`,
        user: updatedUser,
      });
    }

    if (action === 'restore') {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { deletedAt: null },
      });

      return NextResponse.json({
        success: true,
        message: `Akun user ${updatedUser.email} berhasil dipulihkan (Restored)!`,
        user: updatedUser,
      });
    }

    if (action === 'hard_delete') {
      if (userId === adminId) {
        return NextResponse.json({ error: 'Anda tidak dapat menghapus akun Anda sendiri!' }, { status: 400 });
      }

      await prisma.user.delete({
        where: { id: userId },
      });

      return NextResponse.json({
        success: true,
        message: 'Akun user berhasil dihapus secara permanen dari database.',
      });
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

    if (action === 'change_role') {
      if (!['user', 'admin'].includes(role)) {
        return NextResponse.json({ error: 'Role tidak valid.' }, { status: 400 });
      }

      if (userId === adminId && role !== 'admin') {
        return NextResponse.json({ error: 'Anda tidak dapat mencabut akses admin Anda sendiri!' }, { status: 400 });
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { role },
      });

      return NextResponse.json({
        success: true,
        message: `Role user ${updatedUser.email} berhasil diubah ke ${role.toUpperCase()}!`,
        user: updatedUser,
      });
    }

    if (action === 'change_password') {
      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json({ error: 'Password baru minimal 6 karakter.' }, { status: 400 });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      return NextResponse.json({
        success: true,
        message: `Password user ${updatedUser.email} berhasil diperbarui!`,
      });
    }

    if (action === 'reset_key') {
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

      const newIngestKey = generateKey();
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
