'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  Tv, 
  Plus, 
  Trash, 
  RotateCw, 
  Play, 
  Square, 
  Save, 
  Terminal, 
  Settings, 
  Activity, 
  AlertTriangle, 
  Video,
  ExternalLink,
  ChevronDown,
  HelpCircle,
  Cpu,
  Radio,
  Copy,
  Check,
  Compass,
  Layers,
  FileText,
  X,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  BarChart3,
  Wifi,
  Clock,
  Gauge,
  Crown,
  Sparkles,
  Zap
} from 'lucide-react';

interface Telemetry {
  fps: number;
  bitrate: number;
  speed: string;
  duration: string;
  durationSeconds: number;
  resolution: string;
  plan: string;
  adStatus: string;
  status: string;
  errorMsg?: string;
}

interface Destination {
  id: string;
  name: string;
  rtmpUrl: string;
  streamKey: string;
  status: 'idle' | 'broadcasting' | 'error';
  errorMsg?: string;
}

interface FAQItem {
  q: string;
  a: string;
}

const faqData: FAQItem[] = [
  {
    q: "Apa perbedaan antara Free Plan, Pro Member, dan Ultimate VIP?",
    a: "Free Plan mendukung hingga 2 platform target pada resolusi 720p HD dengan iklan & watermark. Pro Member (Rp 49rb/bln) mendukung hingga 4 platform target pada resolusi 1080p Full HD dengan 25% minimal iklan. Ultimate VIP (Rp 99rb/bln) mendukung hingga 8 platform target pada resolusi 4K Ultra HD 100% ad-free & watermark-free serta siaran 24/7 non-stop!"
  },
  {
    q: "Kenapa siaran live saya langsung terhenti otomatis (Auto-Reject)?",
    a: "Jika Anda menggunakan Free Plan dan mengirim resolusi di atas 720p (seperti 1080p atau 4K dari OBS), server backend MyStream secara otomatis melakukan Auto-Reject (Auto-Kill) dalam 0.5 detik untuk menjaga kapasitas bandwidth server. Silakan ubah Output Resolution di OBS ke 720p (1280x720) atau upgrade plan Anda."
  },
  {
    q: "Kenapa video preview loading hitam atau menampilkan error 'peer connection closed'?",
    a: "WebRTC didesain untuk real-time video (< 0.5s delay) dan tidak mendukung H.264 video streams yang memiliki B-frames. Pada OBS Studio Anda, buka Settings > Output > ubah Output Mode ke Advanced. Pada tab Streaming, ubah 'Max B-frames' menjadi 0 (untuk encoder NVENC/AMD) atau ketik 'bframes=0' / 'tune=zerolatency' di kolom x264 Options."
  },
  {
    q: "Bagaimana cara melakukan konfigurasi OBS Studio ke sistem restreaming ini?",
    a: "Buka OBS Settings > Stream. Pilih Service ke 'Custom...'. Isi Server URL dengan 'rtmp://restream.awgverse.io/live' dan isi Stream Key dengan key unik akun Anda (contoh: awg_live_xxx). Tekan Apply, lalu klik Start Streaming."
  },
  {
    q: "Berapa banyak platform tujuan yang didukung?",
    a: "Free Plan mendukung hingga 2 platform. Pro Member mendukung hingga 4 platform. Ultimate VIP mendukung hingga 8 platform sekaligus secara bersamaan (YouTube, Twitch, Facebook, TikTok, dsb)."
  }
];

export default function Dashboard() {
  const { data: session, status: sessionStatus, update: updateSession } = useSession();
  const router = useRouter();

  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [selectedDestId, setSelectedDestId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [resetKeyLoading, setResetKeyLoading] = useState<boolean>(false);
  const [ffmpegPath, setFfmpegPath] = useState<string>('');
  const [ingestKey, setIngestKey] = useState<string>('awg_live_default');
  const [playerKey, setPlayerKey] = useState<number>(0);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [isFaqOpen, setIsFaqOpen] = useState<boolean>(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState<boolean>(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [copiedServer, setCopiedServer] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  
  // Live Telemetry state
  const [telemetry, setTelemetry] = useState<Telemetry>({
    fps: 0,
    bitrate: 0,
    speed: '0x',
    duration: '00:00:00',
    durationSeconds: 0,
    resolution: 'N/A',
    plan: 'free',
    adStatus: 'Standby',
    status: 'idle',
  });

  // Auto-hiding header scroll states & sidebar minimize state
  const [showHeader, setShowHeader] = useState<boolean>(true);
  const [lastScrollY, setLastScrollY] = useState<number>(0);
  const [activeNav, setActiveNav] = useState<string>('studio');
  const [isSidebarMinimized, setIsSidebarMinimized] = useState<boolean>(false);

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/login');
    }
  }, [sessionStatus, router]);

  // Set user's permanent ingestKey & plan from NextAuth session
  useEffect(() => {
    const sessionKey = (session?.user as any)?.ingestKey;
    if (sessionKey) {
      setIngestKey(sessionKey);
    }
  }, [session]);

  // Auto-hide header when scrolling down
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > 60 && currentScrollY > lastScrollY) {
        setShowHeader(false);
      } else {
        setShowHeader(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // Load initial theme from localStorage on client mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('mystream_theme') as 'light' | 'dark' | 'system' || 'system';
    setTheme(savedTheme);
  }, []);

  // Apply theme attributes
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const applyTheme = (currentTheme: 'light' | 'dark' | 'system') => {
      if (currentTheme === 'system') {
        const systemTheme = mediaQuery.matches ? 'dark' : 'light';
        root.setAttribute('data-theme', systemTheme);
      } else {
        root.setAttribute('data-theme', currentTheme);
      }
    };

    applyTheme(theme);
    localStorage.setItem('mystream_theme', theme);

    const handleSystemThemeChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, [theme]);

  // Fetch Stream Data & Telemetry
  const fetchData = async () => {
    if (sessionStatus !== 'authenticated') return;
    try {
      const res = await fetch('/api/restream');
      const data = await res.json();
      if (data.destinations) {
        setDestinations(data.destinations);
        if (data.destinations.length > 0 && !data.destinations.find((d: any) => d.id === selectedDestId)) {
          setSelectedDestId(data.destinations[0].id);
        }
      }
      if (data.telemetry) {
        setTelemetry(data.telemetry);
      }
      if (data.ffmpegPath) {
        setFfmpegPath(data.ffmpegPath);
      }
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch stream data:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [sessionStatus, selectedDestId]);

  // Handle Stream Key Reset
  const handleRandomizeIngestKey = async () => {
    if (telemetry.status === 'broadcasting') {
      alert('Tidak dapat mengacak Stream Key saat siaran live sedang aktif.');
      return;
    }

    if (!confirm('Apakah Anda yakin ingin mengacak Stream Key akun Anda? (Kuota: 1x per 24 jam). Anda harus memperbarui Stream Key di OBS Studio setelah ini.')) {
      return;
    }

    setResetKeyLoading(true);
    try {
      const res = await fetch('/api/user/reset-ingest-key', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Gagal mereset Stream Key');
        return;
      }

      if (data.ingestKey) {
        setIngestKey(data.ingestKey);
        await updateSession({ ingestKey: data.ingestKey, lastResetAt: data.lastResetAt });
        setPlayerKey(prev => prev + 1);
        alert(data.message);
      }
    } catch (err) {
      console.error('Reset Ingest Key error:', err);
      alert('Terjadi kesalahan saat mengacak Stream Key');
    } finally {
      setResetKeyLoading(false);
    }
  };

  // Switch Plan (Free, Pro, Ultimate)
  const handleSwitchPlan = async (newPlan: 'free' | 'pro' | 'ultimate') => {
    try {
      const res = await fetch('/api/user/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: newPlan }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Gagal merubah plan membership');
        return;
      }

      await updateSession({ plan: newPlan });
      fetchData();
      setIsPlanModalOpen(false);
      alert(`Selamat! Akun Anda kini berstatus ${newPlan.toUpperCase()}!`);
    } catch (err) {
      console.error('Switch plan error:', err);
      alert('Terjadi kesalahan saat merubah plan');
    }
  };

  // Add Target Platform
  const handleAddDestination = () => {
    const currentPlan = (session?.user as any)?.plan || 'free';
    const maxPlatforms = currentPlan === 'ultimate' ? 8 : currentPlan === 'pro' ? 4 : 2;

    if (destinations.length >= maxPlatforms) {
      alert(`Plan Anda (${currentPlan.toUpperCase()}) dibatasi maksimal ${maxPlatforms} platform target. Silakan upgrade plan Anda untuk menambah lebih banyak platform!`);
      setIsPlanModalOpen(true);
      return;
    }

    const newId = Date.now().toString();
    setDestinations([
      ...destinations,
      {
        id: newId,
        name: `Platform Baru ${destinations.length + 1}`,
        rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
        streamKey: '',
        status: 'idle',
      },
    ]);
  };

  // Remove Target Platform
  const handleRemoveDestination = (id: string) => {
    if (destinations.length <= 1) {
      alert('Minimal harus ada 1 platform tujuan.');
      return;
    }
    setDestinations(destinations.filter((d) => d.id !== id));
  };

  // Handle Start / Stop Restream
  const handleToggleRestream = async () => {
    const isRunning = telemetry.status === 'broadcasting';
    const action = isRunning ? 'stop_all' : 'start_all';

    setActionLoading(true);
    try {
      const res = await fetch('/api/restream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Gagal menjalankan aksi restream.');
        if (data.error?.includes('dibatasi')) {
          setIsPlanModalOpen(true);
        }
      } else {
        alert(data.message);
        fetchData();
      }
    } catch (err) {
      console.error('Toggle restream error:', err);
      alert('Terjadi kesalahan saat memproses permintaan restream.');
    } finally {
      setActionLoading(false);
    }
  };

  // Copy Clipboard Helper
  const copyToClipboard = (text: string, type: 'server' | 'key') => {
    navigator.clipboard.writeText(text);
    if (type === 'server') {
      setCopiedServer(true);
      setTimeout(() => setCopiedServer(false), 2000);
    } else {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  if (sessionStatus === 'loading' || loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <RotateCw style={{ animation: 'spin 1s linear infinite', width: '36px', height: '36px', color: 'var(--primary)' }} />
          <p style={{ marginTop: '16px', fontSize: '15px', fontWeight: 600 }}>Memuat Studio Dashboard...</p>
        </div>
      </div>
    );
  }

  const userPlan = (session?.user as any)?.plan || 'free';
  const isCurrentlyRestreaming = telemetry.status === 'broadcasting';

  return (
    <div className="app-container">
      {/* Auto-Hiding Top Header */}
      <header className={`app-header ${!showHeader ? 'header-hidden' : ''}`}>
        <div className="logo-section">
          <div className="logo-icon-wrapper">
            <Radio size={20} color="#ffffff" />
          </div>
          <span className="logo-title">MyStream Studio</span>
          <span className="logo-badge">BROADCAST ENGINE</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Hardware CPU Chip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', padding: '6px 14px', borderRadius: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <Cpu size={14} color="#10b981" />
            <span>Pass-through: <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>-c copy (Zero CPU)</strong></span>
          </div>

          {/* Active Target Count Pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', padding: '6px 14px', borderRadius: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <Radio size={14} color="#6366f1" />
            <span>Target Active: <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{destinations.length} / {userPlan === 'ultimate' ? 8 : userPlan === 'pro' ? 4 : 2}</strong></span>
          </div>

          {/* Plan Badge Button */}
          <button 
            className={`plan-badge-btn ${userPlan}`}
            onClick={() => setIsPlanModalOpen(true)}
            title="Klik untuk ubah/upgrade plan membership"
          >
            {userPlan === 'ultimate' ? <Crown size={14} /> : userPlan === 'pro' ? <Sparkles size={14} /> : <Zap size={14} />}
            <span style={{ textTransform: 'uppercase' }}>{userPlan} PLAN</span>
          </button>

          {/* User Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '12px', borderLeft: '1px solid var(--border)' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', color: '#fff' }}>
              {session?.user?.name ? session.user.name[0].toUpperCase() : 'U'}
            </div>
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {session?.user?.name || 'Studio User'}
            </span>
            <button 
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
              onClick={() => signOut({ callbackUrl: '/login' })}
              title="Keluar / Sign Out"
            >
              <LogOut size={13} />
              <span>Keluar</span>
            </button>
          </div>

          {/* Theme Toggle Buttons */}
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <button 
              style={{ background: theme === 'light' ? 'var(--primary)' : 'transparent', color: theme === 'light' ? '#fff' : 'var(--text-secondary)', border: 'none', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
              onClick={() => setTheme('light')}
            >
              ☀️ Light
            </button>
            <button 
              style={{ background: theme === 'dark' ? 'var(--primary)' : 'transparent', color: theme === 'dark' ? '#fff' : 'var(--text-secondary)', border: 'none', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
              onClick={() => setTheme('dark')}
            >
              🌙 Dark
            </button>
            <button 
              style={{ background: theme === 'system' ? 'var(--primary)' : 'transparent', color: theme === 'system' ? '#fff' : 'var(--text-secondary)', border: 'none', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
              onClick={() => setTheme('system')}
            >
              💻 System
            </button>
          </div>
        </div>
      </header>

      {/* App Body Wrapper (Sidebar + Main Content) */}
      <div className="app-body-wrapper">
        {/* Vertical Collapsible Sidebar */}
        <aside className={`app-sidebar ${isSidebarMinimized ? 'minimized' : ''}`}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span className="sidebar-section-title">NAVIGATION</span>
            <button 
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
              onClick={() => setIsSidebarMinimized(!isSidebarMinimized)}
              title={isSidebarMinimized ? "Expand Sidebar" : "Minimize Sidebar"}
            >
              {isSidebarMinimized ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>

          <ul className="sidebar-nav-list">
            <li>
              <a 
                className={`sidebar-nav-item ${activeNav === 'studio' ? 'active' : ''}`}
                onClick={() => setActiveNav('studio')}
              >
                <Tv size={18} />
                <span className="sidebar-nav-text">Studio Feed</span>
              </a>
            </li>
            <li>
              <a 
                className={`sidebar-nav-item ${activeNav === 'analytics' ? 'active' : ''}`}
                onClick={() => setActiveNav('analytics')}
              >
                <BarChart3 size={18} />
                <span className="sidebar-nav-text">Analitik Live</span>
              </a>
            </li>
            <li>
              <a 
                className={`sidebar-nav-item ${activeNav === 'ingest' ? 'active' : ''}`}
                onClick={() => setActiveNav('ingest')}
              >
                <Radio size={18} />
                <span className="sidebar-nav-text">Ingest OBS</span>
              </a>
            </li>
            <li>
              <a 
                className={`sidebar-nav-item ${activeNav === 'destinations' ? 'active' : ''}`}
                onClick={() => setActiveNav('destinations')}
              >
                <Layers size={18} />
                <span className="sidebar-nav-text">Platform Target</span>
              </a>
            </li>
            <li>
              <a 
                className="sidebar-nav-item"
                onClick={() => setIsFaqOpen(true)}
              >
                <HelpCircle size={18} />
                <span className="sidebar-nav-text">Buka FAQ</span>
              </a>
            </li>
          </ul>

          {!isSidebarMinimized && (
            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span className="sidebar-section-title" style={{ padding: 0 }}>SYSTEM DATA</span>
              <div>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>FFmpeg Path:</span>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', wordBreak: 'break-all', margin: '2px 0 0 0' }}>{ffmpegPath}</p>
              </div>
              <div>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>Ingest Server:</span>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', margin: '2px 0 0 0' }}>rtmp://restream.awgverse.io/live</p>
              </div>
            </div>
          )}
        </aside>

        {/* Main Content Workspace */}
        <main className="main-content">

          {/* Auto-Reject Alert Banner if Resolution Exceeded */}
          {telemetry.status === 'error' && telemetry.errorMsg && (
            <div className="auto-reject-banner">
              <AlertTriangle size={24} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <h4 style={{ fontWeight: 700, margin: '0 0 4px 0', fontSize: '15px' }}>Auto-Reject Proteksi Bandwidth Aktif!</h4>
                <p style={{ margin: 0, fontSize: '13.5px', opacity: 0.95 }}>{telemetry.errorMsg}</p>
              </div>
              <button className="upgrade-now-btn" onClick={() => setIsPlanModalOpen(true)}>
                <Crown size={14} /> Upgrade Plan Sekarang
              </button>
            </div>
          )}

          {/* Master Control Card */}
          <div className="card master-control-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', backgroundColor: isCurrentlyRestreaming ? 'rgba(244,63,94,0.15)' : 'rgba(148,163,184,0.12)', color: isCurrentlyRestreaming ? '#fb7185' : 'var(--text-secondary)', border: isCurrentlyRestreaming ? '1px solid rgba(244,63,94,0.3)' : '1px solid rgba(148,163,184,0.2)' }}>
                  <span className="pulse-dot"></span>
                  <span>{isCurrentlyRestreaming ? 'LIVE BROADCASTING' : 'STANDBY'}</span>
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '12px 0 4px 0', color: 'var(--text-primary)' }}>
                  {isCurrentlyRestreaming ? 'Sistem Sedang Menyiarkan Feed Live' : 'Sistem Siap Menyiarkan'}
                </h2>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0 }}>
                  {isCurrentlyRestreaming ? `Restreaming aktif ke ${destinations.length} platform target.` : 'Hubungkan OBS Studio dan tekan Mulai Restreaming'}
                </p>
              </div>

              <button
                style={{
                  padding: '14px 28px',
                  borderRadius: '12px',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: isCurrentlyRestreaming ? 'var(--danger)' : 'var(--secondary)',
                  color: '#ffffff',
                  boxShadow: isCurrentlyRestreaming ? '0 0 25px rgba(244,63,94,0.4)' : '0 0 25px rgba(16,185,129,0.4)',
                  transition: 'all 0.2s ease',
                }}
                onClick={handleToggleRestream}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <RotateCw className="spin" size={18} />
                ) : isCurrentlyRestreaming ? (
                  <>
                    <Square size={18} />
                    <span>Hentikan Restreaming</span>
                  </>
                ) : (
                  <>
                    <Play size={18} />
                    <span>Mulai Restreaming</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Telemetry Analytics Card */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <BarChart3 size={18} color="var(--primary)" />
                <span>Analitik Broadcast & Kualitas Jaringan Live</span>
              </div>
              <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: userPlan === 'ultimate' ? 'rgba(234, 179, 8, 0.15)' : userPlan === 'pro' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(148, 163, 184, 0.15)', color: userPlan === 'ultimate' ? '#eab308' : userPlan === 'pro' ? '#6366f1' : '#94a3b8' }}>
                {telemetry.adStatus}
              </span>
            </div>

            <div className="telemetry-grid">
              <div className="telemetry-card-item">
                <Clock size={24} color="#6366f1" />
                <div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block' }}>DURASI LIVE</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{telemetry.duration}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                    {userPlan === 'free' ? 'Max 4 Jam per Sesi (Free)' : 'Unlimited 24/7 Non-Stop'}
                  </span>
                </div>
              </div>

              <div className="telemetry-card-item">
                <Gauge size={24} color="#10b981" />
                <div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block' }}>INGEST BITRATE</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{telemetry.bitrate} <small style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Kbps</small></span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                    {userPlan === 'free' ? 'Max 4.500 Kbps Limit' : userPlan === 'pro' ? 'Max 10.000 Kbps' : 'Max 35.000 Kbps (4K)'}
                  </span>
                </div>
              </div>

              <div className="telemetry-card-item">
                <Activity size={24} color="#f59e0b" />
                <div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block' }}>FPS | RESOLUSI</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{telemetry.fps} FPS <small style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>| {telemetry.resolution}</small></span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                    Target: {userPlan === 'free' ? '720p HD' : userPlan === 'pro' ? '1080p FHD' : '4K Ultra HD'}
                  </span>
                </div>
              </div>

              <div className="telemetry-card-item">
                <Wifi size={24} color={isCurrentlyRestreaming ? "#10b981" : "#64748b"} />
                <div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block' }}>KUALITAS JARINGAN</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: isCurrentlyRestreaming ? '#10b981' : '#64748b' }}>
                    {isCurrentlyRestreaming ? '🟢 Sempurna' : '⚪ Offline'}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>⚡ Zero Packet Loss</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2-Column Dashboard Grid */}
          <div className="dashboard-grid">

            {/* Left Column: Player & Quick Setup */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Live Preview Player Card */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <Video size={18} color="var(--primary)" />
                    <span>Live Monitor Feed (WebRTC Low Latency)</span>
                  </div>
                  <button
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => setPlayerKey((prev) => prev + 1)}
                    title="Reload Player Feed"
                  >
                    <RotateCw size={13} />
                    <span>Reload Feed</span>
                  </button>
                </div>

                <div className="video-wrapper">
                  <iframe
                    key={playerKey}
                    src={`http://localhost:8889/live/${ingestKey}`}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    allow="autoplay; fullscreen"
                    title="Live WebRTC Preview Player"
                  />
                  <div className="video-overlay-badge">
                    <span className="pulse-dot" style={{ backgroundColor: '#10b981' }}></span>
                    <span>WHEP WebRTC (&lt;0.5s)</span>
                  </div>
                </div>
              </div>

              {/* Quick Setup Guide Card */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <Radio size={18} color="var(--primary)" />
                    <span>Quick Setup OBS Studio</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'rgba(99,102,241,0.15)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0 }}>1</span>
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                      Buka OBS Studio &gt; <strong>Settings</strong> &gt; <strong>Stream</strong>. Pilih Service: <strong>Custom...</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'rgba(99,102,241,0.15)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0 }}>2</span>
                    <div style={{ flex: 1, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                      <p style={{ margin: '0 0 6px 0' }}>Salin Server URL berikut ke kolom <strong>Server</strong>:</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-input)', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: '8px' }}>
                        <code style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-terminal)', fontFamily: 'monospace' }}>rtmp://restream.awgverse.io/live</code>
                        <button 
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                          onClick={() => copyToClipboard('rtmp://restream.awgverse.io/live', 'server')}
                        >
                          {copiedServer ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'rgba(99,102,241,0.15)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0 }}>3</span>
                    <div style={{ flex: 1, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                      <p style={{ margin: '0 0 6px 0' }}>Salin Stream Key permanen akun Anda ke kolom <strong>Stream Key</strong>:</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-input)', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: '8px' }}>
                        <code style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-terminal)', fontFamily: 'monospace' }}>{ingestKey}</code>
                        <button 
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                          onClick={() => copyToClipboard(ingestKey, 'key')}
                        >
                          {copiedKey ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                        </button>
                      </div>

                      <div style={{ marginTop: '10px' }}>
                        <button
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                          onClick={handleRandomizeIngestKey}
                          disabled={resetKeyLoading || isCurrentlyRestreaming}
                        >
                          {resetKeyLoading ? <RotateCw className="spin" size={13} /> : <RotateCw size={13} />}
                          <span>Acak Stream Key (1x/24 jam)</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column: Target Platform Manager */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <Tv size={18} color="var(--primary)" />
                    <span>Target Platform (Max {userPlan === 'ultimate' ? 8 : userPlan === 'pro' ? 4 : 2})</span>
                  </div>
                  <button
                    style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={handleAddDestination}
                  >
                    <Plus size={14} />
                    <span>Tambah Platform</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {destinations.map((dest, idx) => (
                    <div 
                      key={dest.id} 
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', padding: '16px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: dest.status === 'broadcasting' ? '#10b981' : '#64748b' }}></span>
                          <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{dest.name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                            {dest.status.toUpperCase()}
                          </span>
                          <button
                            style={{ background: 'transparent', border: 'none', color: '#f43f5e', cursor: 'pointer', padding: '4px' }}
                            onClick={() => handleRemoveDestination(dest.id)}
                            title="Hapus Platform"
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">NAMA PLATFORM / LABEL</label>
                        <input
                          type="text"
                          className="input-text"
                          value={dest.name}
                          onChange={(e) => {
                            const newDestArr = [...destinations];
                            newDestArr[idx].name = e.target.value;
                            setDestinations(newDestArr);
                          }}
                          placeholder="misal YouTube Utama / Twitch TV"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">RTMP SERVER URL</label>
                        <input
                          type="text"
                          className="input-text"
                          value={dest.rtmpUrl}
                          onChange={(e) => {
                            const newDestArr = [...destinations];
                            newDestArr[idx].rtmpUrl = e.target.value;
                            setDestinations(newDestArr);
                          }}
                          placeholder="rtmp://a.rtmp.youtube.com/live2"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">STREAM KEY TARGET</label>
                        <input
                          type="password"
                          className="input-text"
                          value={dest.streamKey}
                          onChange={(e) => {
                            const newDestArr = [...destinations];
                            newDestArr[idx].streamKey = e.target.value;
                            setDestinations(newDestArr);
                          }}
                          placeholder="Masukkan Stream Key Anda"
                        />
                      </div>
                    </div>
                  ))}

                  <button 
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '12px', borderRadius: '10px', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', marginTop: '8px' }}
                  >
                    <Save size={16} />
                    <span>Simpan Semua Konfigurasi Target</span>
                  </button>
                </div>
              </div>
            </div>

          </div>

        </main>
      </div>

      {/* Plan Switcher & Pricing Modal */}
      {isPlanModalOpen && (
        <div className="modal-backdrop">
          <div className="plan-modal-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Crown size={22} color="#eab308" />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Pilih Tier Membership MyStream Studio</h3>
              </div>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setIsPlanModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="plan-grid">
              {/* Free Plan Card */}
              <div className={`plan-card ${userPlan === 'free' ? 'active-plan' : ''}`}>
                <div className="plan-header">
                  <Zap size={24} color="#94a3b8" />
                  <h4>FREE PLAN</h4>
                  <span className="price">Rp 0 <small>/ bulan</small></span>
                </div>
                <ul className="plan-features">
                  <li>✅ Maksimal 2 Target Platform</li>
                  <li>✅ Batas Resolusi 720p HD</li>
                  <li>⏱️ Max 4 Jam per Sesi Live</li>
                  <li>📢 Ad-Supported (100% Iklan & Watermark)</li>
                </ul>
                <button 
                  className={`select-plan-btn ${userPlan === 'free' ? 'current' : ''}`}
                  onClick={() => handleSwitchPlan('free')}
                  disabled={userPlan === 'free'}
                >
                  {userPlan === 'free' ? 'Plan Saat Ini' : 'Pilih Free Plan'}
                </button>
              </div>

              {/* Pro Member Card */}
              <div className={`plan-card pro ${userPlan === 'pro' ? 'active-plan' : ''}`}>
                <div className="popular-badge">RECOMMENDED</div>
                <div className="plan-header">
                  <Sparkles size={24} color="#6366f1" />
                  <h4>PRO MEMBER</h4>
                  <span className="price">Rp 49.000 <small>/ bulan</small></span>
                </div>
                <ul className="plan-features">
                  <li>✅ Maksimal 4 Target Platform</li>
                  <li>✅ Batas Resolusi 1080p Full HD</li>
                  <li>♾️ Unlimited Live Stream 24/7</li>
                  <li>✨ Minimal Ads (25% Minimal Iklan)</li>
                </ul>
                <button 
                  className={`select-plan-btn pro ${userPlan === 'pro' ? 'current' : ''}`}
                  onClick={() => handleSwitchPlan('pro')}
                  disabled={userPlan === 'pro'}
                >
                  {userPlan === 'pro' ? 'Plan Saat Ini' : 'Aktifkan Pro Member'}
                </button>
              </div>

              {/* Ultimate VIP Card */}
              <div className={`plan-card ultimate ${userPlan === 'ultimate' ? 'active-plan' : ''}`}>
                <div className="plan-header">
                  <Crown size={24} color="#eab308" />
                  <h4>ULTIMATE VIP</h4>
                  <span className="price">Rp 99.000 <small>/ bulan</small></span>
                </div>
                <ul className="plan-features">
                  <li>✅ Maksimal 8 Target Platform</li>
                  <li>✅ Super Ultra HD 4K60 (3840x2160)</li>
                  <li>♾️ Unlimited Live Stream 24/7</li>
                  <li>👑 100% Ad-Free & Watermark-Free</li>
                </ul>
                <button 
                  className={`select-plan-btn ultimate ${userPlan === 'ultimate' ? 'current' : ''}`}
                  onClick={() => handleSwitchPlan('ultimate')}
                  disabled={userPlan === 'ultimate'}
                >
                  {userPlan === 'ultimate' ? 'Plan Saat Ini' : 'Aktifkan Ultimate VIP'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FAQ Locker Modal */}
      {isFaqOpen && (
        <div className="modal-backdrop">
          <div className="plan-modal-card" style={{ maxWidth: '720px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HelpCircle size={20} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Pertanyaan Sering Diajukan (FAQ)</h3>
              </div>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setIsFaqOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {faqData.map((faq, idx) => (
                <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                  <button
                    style={{ width: '100%', padding: '14px 16px', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.9rem', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                  >
                    <span>{faq.q}</span>
                    <ChevronDown size={16} style={{ transform: openFaqIndex === idx ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                  </button>
                  {openFaqIndex === idx && (
                    <div style={{ padding: '0 16px 16px 16px', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                      <p style={{ margin: 0 }}>{faq.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer Section */}
      <footer style={{ background: 'var(--bg-footer)', borderTop: '1px solid var(--border)', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        <div>
          <span>Copyright by <strong>awgxidn © 2026</strong>. All Rights Reserved.</span>
        </div>
        <div>
          <a
            href="https://github.com/studentawangihti/mystream"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
          >
            <Terminal size={14} />
            <span>GitHub Repository: studentawangihti/mystream</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </footer>
    </div>
  );
}
