import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPlanConfigs } from '@/lib/plans';

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
    const plans = await getPlanConfigs();

    return NextResponse.json({ settings: finalSettings, plans });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
