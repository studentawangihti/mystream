import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak! Hanya Super Admin yang diizinkan.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const fileName = searchParams.get('file');

    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Direct download of requested backup file
    if (fileName) {
      const safeName = path.basename(fileName);
      const filePath = path.join(backupDir, safeName);

      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: 'File backup tidak ditemukan.' }, { status: 404 });
      }

      const fileBuffer = fs.readFileSync(filePath);
      return new Response(fileBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${safeName}"`,
        },
      });
    }

    // List all backup files
    const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.db'));
    const backups = files.map((name) => {
      const filePath = path.join(backupDir, name);
      const stat = fs.statSync(filePath);
      return {
        filename: name,
        sizeBytes: stat.size,
        createdAt: stat.birthtime.toISOString(),
      };
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Database stats
    const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
    let dbSizeBytes = 0;
    if (fs.existsSync(dbPath)) {
      dbSizeBytes = fs.statSync(dbPath).size;
    }

    const [userCount, videoCount, destCount] = await Promise.all([
      prisma.user.count(),
      prisma.video.count(),
      prisma.destination.count(),
    ]);

    return NextResponse.json({
      backups,
      dbStats: {
        dbSizeBytes,
        userCount,
        videoCount,
        destCount,
      },
    });
  } catch (error: any) {
    console.error('Backup GET API error:', error);
    return NextResponse.json({ error: error.message || 'Gagal memuat data backup.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak! Hanya Super Admin yang diizinkan.' }, { status: 403 });
    }

    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ error: 'File database SQLite dev.db tidak ditemukan.' }, { status: 404 });
    }

    const now = new Date();
    const dateStr = now.toISOString().replace(/T/, '_').replace(/:/g, '-').slice(0, 19);
    const backupFileName = `backup_dev_${dateStr}.db`;
    const destinationPath = path.join(backupDir, backupFileName);

    // Copy SQLite database snapshot
    fs.copyFileSync(dbPath, destinationPath);

    const stat = fs.statSync(destinationPath);

    return NextResponse.json({
      success: true,
      message: `Snapshot database SQLite (${backupFileName}) berhasil dibuat!`,
      backup: {
        filename: backupFileName,
        sizeBytes: stat.size,
        createdAt: stat.birthtime.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Backup POST API error:', error);
    return NextResponse.json({ error: error.message || 'Gagal membuat backup database.' }, { status: 500 });
  }
}
