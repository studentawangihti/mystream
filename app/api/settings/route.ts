import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const dbSettings = await prisma.systemSetting.findMany();
    const settings = dbSettings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    // Define defaults
    const defaults = {
      siteTitle: 'MyStream Studio',
      logoUrl: '',
      primaryColor: '#6366f1', // default indigo
      ingestUrl: 'rtmp://restream.awgverse.site/live',
      enableCloudUpload: 'true',
      enableWebRtcPlayer: 'true',
    };

    const finalSettings = { ...defaults, ...settings };

    return NextResponse.json({ settings: finalSettings });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
