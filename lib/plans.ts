import { prisma } from './prisma';

export interface PlanConfig {
  maxPlatforms: number;
  maxResolution: number; // e.g. 720, 1080, 2160
  maxStorageMb: number;
  maxLiveHours: number; // 0 means unlimited
  price: string;
  adsLabel: string;
}

export const defaultPlans: Record<string, PlanConfig> = {
  free: {
    maxPlatforms: 2,
    maxResolution: 720,
    maxStorageMb: 200,
    maxLiveHours: 4,
    price: '0',
    adsLabel: 'Ad-Supported (100% Iklan & Watermark)',
  },
  pro: {
    maxPlatforms: 4,
    maxResolution: 1080,
    maxStorageMb: 5000,
    maxLiveHours: 0,
    price: '49.000',
    adsLabel: 'Minimal Ads (25% Minimal Iklan)',
  },
  ultimate: {
    maxPlatforms: 8,
    maxResolution: 2160,
    maxStorageMb: 25000,
    maxLiveHours: 0,
    price: '99.000',
    adsLabel: '100% Ad-Free & Watermark-Free',
  },
};

export async function getPlanConfigs(): Promise<Record<string, PlanConfig>> {
  try {
    const dbSettings = await prisma.systemSetting.findMany({
      where: {
        key: {
          startsWith: 'plan_',
        },
      },
    });

    const configs = JSON.parse(JSON.stringify(defaultPlans)) as Record<string, PlanConfig>;

    for (const setting of dbSettings) {
      // key format: plan_[tier]_[property], e.g. plan_free_maxPlatforms
      const parts = setting.key.split('_');
      if (parts.length === 3 && parts[0] === 'plan') {
        const planName = parts[1];
        const field = parts[2] as keyof PlanConfig;
        const planObj = configs[planName] as any;
        if (planObj && field in planObj) {
          const val = setting.value;
          if (typeof planObj[field] === 'number') {
            planObj[field] = Number(val);
          } else {
            planObj[field] = val;
          }
        }
      }
    }

    return configs;
  } catch (error) {
    console.error('Error fetching plan configs from database, using defaults:', error);
    return defaultPlans;
  }
}
