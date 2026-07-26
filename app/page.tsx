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
  Users,
  ShieldCheck,
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
  const [logs, setLogs] = useState<string[]>([]);
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
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <RotateCw style={{ animation: 'spin 1s linear infinite', width: '36px', height: '36px', color: 'var(--accent-color)' }} />
          <p style={{ marginTop: '16px', fontSize: '15px', fontWeight: 500 }}>Memuat Studio Dashboard...</p>
        </div>
      </div>
    );
  }

  const userPlan = (session?.user as any)?.plan || 'free';
  const isCurrentlyRestreaming = telemetry.status === 'broadcasting';

  return (
    <div className="studio-layout">
      {/* Sidebar Section */}
      <aside className={`studio-sidebar ${isSidebarMinimized ? 'minimized' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-logo">
            <Radio size={20} color="#ffffff" />
          </div>
          {!isSidebarMinimized && (
            <div className="brand-text">
              <span className="brand-title">MyStream Studio</span>
              <span className="brand-badge">BROADCAST ENGINE</span>
            </div>
          )}
          <button 
            className="sidebar-toggle-btn"
            onClick={() => setIsSidebarMinimized(!isSidebarMinimized)}
            title={isSidebarMinimized ? "Expand Sidebar" : "Minimize Sidebar"}
          >
            {isSidebarMinimized ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="sidebar-menu">
          {!isSidebarMinimized && <span className="menu-category">NAVIGATION</span>}
          <button 
            className={`menu-item ${activeNav === 'studio' ? 'active' : ''}`}
            onClick={() => setActiveNav('studio')}
            title="Studio Feed"
          >
            <Tv size={18} />
            {!isSidebarMinimized && <span>Studio Feed</span>}
          </button>
          
          <button 
            className={`menu-item ${activeNav === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveNav('analytics')}
            title="Analitik Live"
          >
            <BarChart3 size={18} />
            {!isSidebarMinimized && <span>Analitik Live</span>}
          </button>

          <button 
            className={`menu-item ${activeNav === 'ingest' ? 'active' : ''}`}
            onClick={() => setActiveNav('ingest')}
            title="Ingest OBS"
          >
            <Radio size={18} />
            {!isSidebarMinimized && <span>Ingest OBS</span>}
          </button>

          <button 
            className={`menu-item ${activeNav === 'destinations' ? 'active' : ''}`}
            onClick={() => setActiveNav('destinations')}
            title="Platform Target"
          >
            <Layers size={18} />
            {!isSidebarMinimized && <span>Platform Target</span>}
          </button>

          <button 
            className={`menu-item ${activeNav === 'faq' ? 'active' : ''}`}
            onClick={() => setIsFaqOpen(true)}
            title="Buka FAQ"
          >
            <HelpCircle size={18} />
            {!isSidebarMinimized && <span>Buka FAQ</span>}
          </button>
        </nav>

        {!isSidebarMinimized && (
          <div className="sidebar-telemetry">
            <span className="telemetry-title">TELEMETRY</span>
            <div className="telemetry-item">
              <span className="label">FFmpeg Path:</span>
              <span className="value truncate" title={ffmpegPath}>{ffmpegPath}</span>
            </div>
            <div className="telemetry-item">
              <span className="label">Ingest Server:</span>
              <span className="value">rtmp://restream.awgverse.io/live</span>
            </div>
            <div className="telemetry-item">
              <span className="label">Plan Membership:</span>
              <span className="value uppercase font-bold" style={{ color: userPlan === 'ultimate' ? '#eab308' : userPlan === 'pro' ? '#6366f1' : '#94a3b8' }}>
                {userPlan} PLAN
              </span>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="studio-container">
        {/* Auto-Hiding Top Header */}
        <header className={`studio-header ${!showHeader ? 'header-hidden' : ''}`}>
          <div className="header-left">
            <div className="header-logo">
              <Radio size={22} color="#ffffff" />
            </div>
            <span className="header-title">MyStream Studio</span>
            <span className="header-version">BROADCAST ENGINE</span>
          </div>

          <div className="header-right">
            <div className="server-status-pill">
              <Cpu size={14} color="#10b981" />
              <span>Pass-through: <strong>-c copy (Zero CPU)</strong></span>
            </div>

            <div className="server-status-pill">
              <Radio size={14} color="#6366f1" />
              <span>Active Targets: <strong>{destinations.length} / {userPlan === 'ultimate' ? 8 : userPlan === 'pro' ? 4 : 2}</strong></span>
            </div>

            {/* Plan Badge & Switcher Button */}
            <button 
              className={`plan-badge-btn ${userPlan}`}
              onClick={() => setIsPlanModalOpen(true)}
              title="Klik untuk ubah/upgrade plan membership"
            >
              {userPlan === 'ultimate' ? <Crown size={14} /> : userPlan === 'pro' ? <Sparkles size={14} /> : <Zap size={14} />}
              <span className="uppercase font-bold">{userPlan} PLAN</span>
            </button>

            {/* Profile Menu */}
            <div className="user-profile-menu">
              <div className="user-avatar">
                {session?.user?.name ? session.user.name[0].toUpperCase() : 'U'}
              </div>
              <span className="user-name">{session?.user?.name || 'Studio User'}</span>
              <button 
                className="logout-btn" 
                onClick={() => signOut({ callbackUrl: '/login' })}
                title="Keluar / Sign Out"
              >
                <LogOut size={14} />
                <span>Keluar</span>
              </button>
            </div>

            {/* Theme Toggle Buttons */}
            <div className="theme-toggle-group">
              <button 
                className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                onClick={() => setTheme('light')}
                title="Mode Terang (Light Mode)"
              >
                ☀️ Light
              </button>
              <button 
                className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => setTheme('dark')}
                title="Mode Gelap (Dark Mode)"
              >
                🌙 Dark
              </button>
              <button 
                className={`theme-btn ${theme === 'system' ? 'active' : ''}`}
                onClick={() => setTheme('system')}
                title="Ikuti Tema Sistem Windows"
              >
                💻 System
              </button>
            </div>
          </div>
        </header>

        {/* Main Dashboard Content */}
        <main className="studio-content">

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

          {/* Top Master Restream Bar */}
          <div className="master-control-bar card">
            <div className="control-bar-info">
              <div className={`status-indicator ${isCurrentlyRestreaming ? 'live' : 'standby'}`}>
                <span className="pulse-dot"></span>
                <span>{isCurrentlyRestreaming ? 'LIVE BROADCASTING' : 'STANDBY'}</span>
              </div>
              <div className="control-bar-text">
                <h3>{isCurrentlyRestreaming ? 'Sistem Sedang Menyiarkan Feed Live' : 'Sistem Siap Menyiarkan'}</h3>
                <p>{isCurrentlyRestreaming ? `Restreaming aktif ke ${destinations.length} platform target.` : 'Hubungkan OBS Studio dan tekan Mulai Restreaming'}</p>
              </div>
            </div>

            <button
              className={`master-stream-btn ${isCurrentlyRestreaming ? 'stop' : 'start'}`}
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

          {/* Live Telemetry Module Card */}
          <div className="card telemetry-module-card">
            <div className="card-header">
              <div className="card-title">
                <BarChart3 size={18} color="var(--accent-color)" />
                <span>Analitik Broadcast & Kualitas Jaringan Live</span>
              </div>
              <span className="ad-status-badge" style={{ backgroundColor: userPlan === 'ultimate' ? 'rgba(234, 179, 8, 0.15)' : userPlan === 'pro' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(148, 163, 184, 0.15)', color: userPlan === 'ultimate' ? '#eab308' : userPlan === 'pro' ? '#6366f1' : '#94a3b8' }}>
                {telemetry.adStatus}
              </span>
            </div>

            <div className="telemetry-grid">
              <div className="telemetry-card">
                <div className="card-metric-icon">
                  <Clock size={20} color="#6366f1" />
                </div>
                <div className="card-metric-data">
                  <span className="metric-label">DURASI LIVE</span>
                  <span className="metric-value font-mono">{telemetry.duration}</span>
                  <span className="metric-subtext">
                    {userPlan === 'free' ? 'Max 4 Jam per Sesi (Free)' : 'Unlimited 24/7 Non-Stop'}
                  </span>
                </div>
              </div>

              <div className="telemetry-card">
                <div className="card-metric-icon">
                  <Gauge size={20} color="#10b981" />
                </div>
                <div className="card-metric-data">
                  <span className="metric-label">INGEST BITRATE</span>
                  <span className="metric-value">{telemetry.bitrate} <small>Kbps</small></span>
                  <span className="metric-subtext">
                    {userPlan === 'free' ? 'Max 4.500 Kbps Limit' : userPlan === 'pro' ? 'Max 10.000 Kbps' : 'Max 35.000 Kbps (4K)'}
                  </span>
                </div>
              </div>

              <div className="telemetry-card">
                <div className="card-metric-icon">
                  <Activity size={20} color="#f59e0b" />
                </div>
                <div className="card-metric-data">
                  <span className="metric-label">FRAME RATE / RESOLUSI</span>
                  <span className="metric-value">{telemetry.fps} <small>FPS</small> | <small style={{ fontSize: '13px', fontWeight: 600 }}>{telemetry.resolution}</small></span>
                  <span className="metric-subtext">
                    Target Max: {userPlan === 'free' ? '720p HD' : userPlan === 'pro' ? '1080p FHD' : '4K Ultra HD'}
                  </span>
                </div>
              </div>

              <div className="telemetry-card">
                <div className="card-metric-icon">
                  <Wifi size={20} color={isCurrentlyRestreaming ? "#10b981" : "#64748b"} />
                </div>
                <div className="card-metric-data">
                  <span className="metric-label">KUALITAS JARINGAN</span>
                  <span className="metric-value" style={{ color: isCurrentlyRestreaming ? '#10b981' : '#64748b' }}>
                    {isCurrentlyRestreaming ? '🟢 Sempurna' : '⚪ Offline'}
                  </span>
                  <span className="metric-subtext">⚡ Zero Packet Loss</span>
                </div>
              </div>
            </div>
          </div>

          {/* Grid Layout: Live Preview Player & Destinations Manager */}
          <div className="dashboard-grid">

            {/* Left Column: Live Monitor Feed (WebRTC Low Latency) */}
            <div className="grid-left">
              <div className="card preview-card">
                <div className="card-header">
                  <div className="card-title">
                    <Video size={18} color="var(--accent-color)" />
                    <span>Live Monitor Feed (WebRTC Low Latency)</span>
                  </div>
                  <button
                    className="icon-btn"
                    onClick={() => setPlayerKey((prev) => prev + 1)}
                    title="Reload Player Feed"
                  >
                    <RotateCw size={14} />
                    <span>Reload Feed</span>
                  </button>
                </div>

                <div className="player-wrapper">
                  <iframe
                    key={playerKey}
                    src={`http://localhost:8889/live/${ingestKey}`}
                    className="webrtc-iframe"
                    allow="autoplay; fullscreen"
                    title="Live WebRTC Preview Player"
                  />
                  <div className="player-overlay-tag">
                    <span className="tag-dot"></span>
                    <span>WHEP WebRTC (&lt;0.5s)</span>
                  </div>
                </div>
              </div>

              {/* Quick Setup Guide Card */}
              <div className="card setup-guide-card">
                <div className="card-header">
                  <div className="card-title">
                    <Radio size={18} color="var(--accent-color)" />
                    <span>Quick Setup OBS Studio</span>
                  </div>
                </div>

                <div className="setup-steps">
                  <div className="step-item">
                    <span className="step-num">1</span>
                    <div className="step-content">
                      <p>Buka OBS Studio &gt; <strong>Settings</strong> &gt; <strong>Stream</strong>.</p>
                      <p>Pilih Service: <strong>Custom...</strong></p>
                    </div>
                  </div>

                  <div className="step-item">
                    <span className="step-num">2</span>
                    <div className="step-content">
                      <p>Salin Server URL berikut ke kolom <strong>Server</strong>:</p>
                      <div className="copy-field">
                        <code>rtmp://restream.awgverse.io/live</code>
                        <button 
                          className="copy-btn" 
                          onClick={() => copyToClipboard('rtmp://restream.awgverse.io/live', 'server')}
                        >
                          {copiedServer ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="step-item">
                    <span className="step-num">3</span>
                    <div className="step-content">
                      <p>Salin Stream Key permanen akun Anda ke kolom <strong>Stream Key</strong>:</p>
                      <div className="copy-field">
                        <code>{ingestKey}</code>
                        <button 
                          className="copy-btn" 
                          onClick={() => copyToClipboard(ingestKey, 'key')}
                        >
                          {copiedKey ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                        </button>
                      </div>

                      <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          className="reset-key-btn"
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

            {/* Right Column: Platform Destinations Configurator */}
            <div className="grid-right">
              <div className="card destinations-card">
                <div className="card-header">
                  <div className="card-title">
                    <Tv size={18} color="var(--accent-color)" />
                    <span>Target Platform (Maksimal {userPlan === 'ultimate' ? 8 : userPlan === 'pro' ? 4 : 2})</span>
                  </div>
                  <button
                    className="add-dest-btn"
                    onClick={handleAddDestination}
                  >
                    <Plus size={14} />
                    <span>Tambah Platform</span>
                  </button>
                </div>

                <div className="destinations-list">
                  {destinations.map((dest, idx) => (
                    <div className="destination-item" key={dest.id}>
                      <div className="dest-header">
                        <div className="dest-title">
                          <span className={`dest-status-dot ${dest.status}`}></span>
                          <span className="dest-name font-bold">{dest.name}</span>
                        </div>
                        <div className="dest-actions">
                          <span className="dest-status-tag">{dest.status.toUpperCase()}</span>
                          <button
                            className="delete-btn"
                            onClick={() => handleRemoveDestination(dest.id)}
                            title="Hapus Platform"
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="form-group">
                        <label>NAMA PLATFORM / LABEL</label>
                        <input
                          type="text"
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
                        <label>RTMP SERVER URL</label>
                        <input
                          type="text"
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
                        <label>STREAM KEY TARGET</label>
                        <input
                          type="password"
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

                  <button className="save-all-btn">
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
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Crown size={22} color="#eab308" />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Pilih Tier Membership MyStream Studio</h3>
              </div>
              <button className="close-modal-btn" onClick={() => setIsPlanModalOpen(false)}>
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
          <div className="faq-modal-card">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HelpCircle size={20} color="var(--accent-color)" />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Pertanyaan Sering Diajukan (FAQ)</h3>
              </div>
              <button className="close-modal-btn" onClick={() => setIsFaqOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="faq-accordion-container">
              {faqData.map((faq, idx) => (
                <div className="faq-accordion-item" key={idx}>
                  <button
                    className={`faq-question-btn ${openFaqIndex === idx ? 'expanded' : ''}`}
                    onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                  >
                    <span>{faq.q}</span>
                    <ChevronDown size={16} className={`chevron-icon ${openFaqIndex === idx ? 'rotate' : ''}`} />
                  </button>
                  {openFaqIndex === idx && (
                    <div className="faq-answer-content">
                      <p style={{ whiteSpace: 'pre-line' }}>{faq.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer Section */}
      <footer className="studio-footer">
        <div className="footer-left">
          <span>Copyright by <strong>awgxidn © 2026</strong>. All Rights Reserved.</span>
        </div>
        <div className="footer-right">
          <a
            href="https://github.com/studentawangihti/mystream"
            target="_blank"
            rel="noopener noreferrer"
            className="github-footer-link"
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
