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
  Users
} from 'lucide-react';

interface Telemetry {
  fps: number;
  bitrate: string;
  speed: string;
  duration: string;
  networkStatus: 'excellent' | 'good' | 'warning' | 'offline';
}

interface Destination {
  id: string;
  name: string;
  rtmpUrl: string;
  streamKey: string;
  status: 'idle' | 'streaming' | 'error';
  errorMsg?: string;
  startedAt?: string;
  telemetry?: Telemetry;
}

interface FAQItem {
  q: string;
  a: string;
}

const faqData: FAQItem[] = [
  {
    q: "Kenapa video preview loading hitam atau menampilkan error 'peer connection closed'?",
    a: "WebRTC didesain untuk real-time video (< 0.5s delay) dan tidak mendukung H.264 video streams yang memiliki B-frames. Pada OBS Studio Anda, buka Settings > Output > ubah Output Mode ke Advanced. Pada tab Streaming, ubah 'Max B-frames' menjadi 0 (untuk encoder NVENC/AMD) atau ketik 'bframes=0' / 'tune=zerolatency' di kolom x264 Options."
  },
  {
    q: "Apakah saya harus merestart MediaMTX ketika mengganti/merandomize Ingest Stream Key?",
    a: "Tidak perlu. MediaMTX dikonfigurasi dengan path dinamis (all_others). Ketika Anda merandomize key di dashboard web, MediaMTX secara otomatis membuat jalur penyiaran baru secara realtime tanpa memerlukan restart server."
  },
  {
    q: "Bagaimana cara melakukan konfigurasi OBS Studio ke sistem restreaming ini?",
    a: "Buka OBS Settings > Stream. Pilih Service ke 'Custom...'. Isi Server URL dengan 'rtmp://127.0.0.1:1935/live' dan isi Stream Key dengan key acak yang tertera di panel 'Konfigurasi Ingest Stream Key' di dashboard ini. Tekan Apply, lalu klik Start Streaming."
  },
  {
    q: "Berapa banyak platform tujuan (multistreaming) yang didukung?",
    a: "Dashboard ini mendukung hingga 3 platform tujuan secara bersamaan (misal YouTube, Twitch, dan Facebook). Proses restreaming ini sangat hemat CPU (< 5% penggunaan CPU) karena backend Next.js memicu proses FFmpeg menggunakan parameter '-c copy' yang menyalin data stream video langsung tanpa melakukan re-encoding."
  },
  {
    q: "Bagaimana cara melihat logs atau status dari proses restreaming?",
    a: "Di dashboard bagian bawah terdapat modul 'FFmpeg Output Logs'. Anda dapat memilih platform tujuan dari dropdown di sebelah kanan judul log untuk memantau status upload data stream secara real-time."
  },
  {
    q: "Bagaimana cara membuat gambar live stream di YouTube terlihat super tajam dan jernih (VP09 / AV1 Codec Trick)?",
    a: "Jebakan 1080p (AVC1 Codec YouTube): Jika Anda mengirim resolusi 1920x1080 ke YouTube, YouTube secara default mengompresnya menggunakan codec AVC1 (kompresi lama yang agak buram pada gerakan cepat).\n\nTrik Ketajaman Maksimal (VP09 / AV1 Codec): Di OBS Settings > Video > ubah Output (Scaled) Resolution menjadi 2560x1440 (2K) atau 3840x2160 (4K). Naikkan Bitrate OBS ke 12.000 - 15.000 Kbps. Hasilnya: YouTube secara otomatis akan memberikan codec premium VP09 / AV1 untuk live stream Anda. Gambar di YouTube akan menjadi super tajam, bening, dan crystal-clear!"
  }
];

export default function Dashboard() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [selectedDestId, setSelectedDestId] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [ffmpegPath, setFfmpegPath] = useState<string>('');
  const [ingestKey, setIngestKey] = useState<string>('test');
  const [playerKey, setPlayerKey] = useState<number>(0);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [isFaqOpen, setIsFaqOpen] = useState<boolean>(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [copiedServer, setCopiedServer] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  
  // Auto-hiding header scroll states & sidebar minimize state
  const [showHeader, setShowHeader] = useState<boolean>(true);
  const [lastScrollY, setLastScrollY] = useState<number>(0);
  const [activeNav, setActiveNav] = useState<string>('studio');
  const [isSidebarMinimized, setIsSidebarMinimized] = useState<boolean>(false);

  const logContainerRef = useRef<HTMLDivElement>(null);

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/login');
    }
  }, [sessionStatus, router]);

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

  // Initialize Ingest Key per authenticated user from localStorage
  useEffect(() => {
    if (!session?.user?.email) return;
    const storageKey = `mystream_ingest_key_${session.user.email}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      setIngestKey(saved);
    } else {
      const generated = 'stream_' + Math.random().toString(36).substring(2, 10);
      setIngestKey(generated);
      localStorage.setItem(storageKey, generated);
    }
  }, [session]);

  const handleRandomizeIngestKey = () => {
    if (!session?.user?.email) return;
    const storageKey = `mystream_ingest_key_${session.user.email}`;
    const generated = 'stream_' + Math.random().toString(36).substring(2, 10);
    setIngestKey(generated);
    localStorage.setItem(storageKey, generated);
    setPlayerKey(prev => prev + 1);
  };

  // 1. Fetch Configuration & Status
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
  }, [sessionStatus]);

  // 2. Poll Logs & Telemetry for the selected destination if streaming/error
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (sessionStatus !== 'authenticated' || !selectedDestId) return;

    const fetchLogs = async () => {
      try {
        const res = await fetch('/api/restream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_logs', id: selectedDestId })
        });
        const data = await res.json();
        if (data.logs) {
          setLogs(data.logs);
          setDestinations(prev => prev.map(d => {
            if (d.id === data.id) {
              return { 
                ...d, 
                status: data.status, 
                errorMsg: data.errorMsg,
                telemetry: data.telemetry
              };
            }
            return d;
          }));
        }
      } catch (err) {
        console.error('Error fetching logs:', err);
      }
    };

    fetchLogs();
    interval = setInterval(fetchLogs, 1500);

    return () => {
      clearInterval(interval);
    };
  }, [selectedDestId, sessionStatus]);

  // Scroll to bottom of logs safely without moving whole window
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const reloadPlayer = () => {
    setPlayerKey(prev => prev + 1);
  };

  // 4. Save Configurations
  const handleSave = async (updatedDests = destinations) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/restream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_destinations',
          destinations: updatedDests
        })
      });
      const data = await res.json();
      if (data.destinations) {
        setDestinations(data.destinations);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      alert('Gagal menyimpan konfigurasi');
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Add / Delete Destinations
  const handleAddDestination = () => {
    if (destinations.length >= 3) {
      alert('Maksimal 3 destinasi multistreaming diizinkan.');
      return;
    }
    const newId = `custom_${Date.now()}`;
    const newDest: Destination = {
      id: newId,
      name: 'Platform Kustom',
      rtmpUrl: '',
      streamKey: '',
      status: 'idle'
    };
    const updated = [...destinations, newDest];
    setDestinations(updated);
    setSelectedDestId(newId);
  };

  const handleDeleteDestination = (id: string) => {
    const updated = destinations.filter(d => d.id !== id);
    setDestinations(updated);
    if (selectedDestId === id && updated.length > 0) {
      setSelectedDestId(updated[0].id);
    }
    handleSave(updated);
  };

  const handleFieldChange = (id: string, field: keyof Destination, value: string) => {
    setDestinations(prev => prev.map(d => {
      if (d.id === id) {
        return { ...d, [field]: value };
      }
      return d;
    }));
  };

  const handleGenerateKey = (id: string) => {
    const randomKey = 'live_' + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    handleFieldChange(id, 'streamKey', randomKey);
  };

  // 6. Restream Control (Start / Stop)
  const handleStartRestream = async () => {
    await handleSave();
    setActionLoading(true);
    try {
      const res = await fetch('/api/restream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'start',
          ingestKey: ingestKey
        })
      });
      const data = await res.json();
      if (data.destinations) {
        setDestinations(data.destinations);
      }
      if (data.errors && data.errors.length > 0) {
        alert(`Beberapa platform gagal start:\n${data.errors.join('\n')}`);
      }
    } catch (err) {
      console.error('Failed to start restream:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStopRestream = async (targetId?: string) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/restream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop', targetId })
      });
      const data = await res.json();
      if (data.destinations) {
        setDestinations(data.destinations);
      }
    } catch (err) {
      console.error('Failed to stop restream:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(prev => (prev === index ? null : index));
  };

  const isCurrentlyRestreaming = destinations.some(d => d.status === 'streaming');
  const activeStreamsCount = destinations.filter(d => d.status === 'streaming').length;
  
  // Aggregate live telemetry stats
  const activeDest = destinations.find(d => d.id === selectedDestId);
  const activeBitrate = activeDest?.telemetry?.bitrate || '0kbits/s';
  const activeFps = activeDest?.telemetry?.fps || (isCurrentlyRestreaming ? 60 : 0);
  const activeDuration = activeDest?.telemetry?.duration || '00:00:00';
  const activeNetworkStatus = activeDest?.telemetry?.networkStatus || (isCurrentlyRestreaming ? 'excellent' : 'offline');

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

  const getPlatformType = (dest: Destination) => {
    const url = (dest.rtmpUrl || '').toLowerCase();
    const name = (dest.name || '').toLowerCase();
    if (url.includes('youtube') || name.includes('youtube')) return 'youtube';
    if (url.includes('twitch') || name.includes('twitch')) return 'twitch';
    if (url.includes('facebook') || name.includes('facebook')) return 'facebook';
    return 'custom';
  };

  const scrollToSection = (id: string) => {
    setActiveNav(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (sessionStatus === 'loading' || (sessionStatus === 'authenticated' && loading)) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#06060a' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <RotateCw className="animate-spin" style={{ animation: 'spin 1.5s linear infinite', color: '#6366f1' }} size={44} />
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', fontWeight: 600 }}>Memuat Command Center Studio...</p>
        </div>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}} />
      </div>
    );
  }

  if (sessionStatus === 'unauthenticated') {
    return null;
  }

  return (
    <div className="app-container">
      {/* Auto-Hiding Header Bar */}
      <header className={`app-header ${!showHeader ? 'header-hidden' : ''}`}>
        <div className="logo-section">
          <div className="logo-icon-wrapper">
            <Radio size={22} style={{ color: '#fff' }} />
          </div>
          <span>MyStream Studio</span>
          <span className="logo-badge">Broadcast Engine</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Telemetry Chips */}
          <div className="telemetry-bar">
            <div className="telemetry-chip">
              <Cpu size={14} style={{ color: 'var(--primary)' }} />
              <span>Pass-through:</span>
              <span className="telemetry-chip-val" style={{ color: 'var(--secondary)' }}>-c copy (Zero CPU)</span>
            </div>
            
            <div className="telemetry-chip">
              <Activity size={14} style={{ color: 'var(--primary)' }} />
              <span>Active Targets:</span>
              <span className="telemetry-chip-val">{activeStreamsCount} / {destinations.length}</span>
            </div>
          </div>

          {/* User Profile Pill & Sign Out */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.04)', padding: '4px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '700', fontSize: '0.8rem' }}>
                {session?.user?.name ? session.user.name[0].toUpperCase() : 'U'}
              </div>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                {session?.user?.name || 'Studio User'}
              </span>
            </div>

            <button
              className="btn btn-secondary"
              onClick={() => signOut({ callbackUrl: '/login' })}
              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              title="Keluar / Sign Out"
            >
              <LogOut size={14} /> Keluar
            </button>
          </div>

          {/* Theme Selector */}
          <div className="theme-toggle-group">
            <button 
              className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
              onClick={() => setTheme('light')}
              title="Tema Terang"
            >
              ☀️ Light
            </button>
            <button 
              className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => setTheme('dark')}
              title="Tema Gelap"
            >
              🌙 Dark
            </button>
            <button 
              className={`theme-btn ${theme === 'system' ? 'active' : ''}`}
              onClick={() => setTheme('system')}
              title="Ikuti Sistem OS"
            >
              💻 System
            </button>
          </div>
        </div>
      </header>

      {/* Body Wrapper with Minimizable Left Sidebar */}
      <div className="app-body-wrapper">
        {/* Left Vertical Navigation Sidebar */}
        <aside className={`app-sidebar ${isSidebarMinimized ? 'minimized' : ''}`}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: isSidebarMinimized ? 'center' : 'space-between', padding: '0 2px' }}>
            {!isSidebarMinimized && <span className="sidebar-section-title">Navigation</span>}
            <button 
              className="btn btn-secondary" 
              onClick={() => setIsSidebarMinimized(!isSidebarMinimized)}
              style={{ padding: '6px', borderRadius: '6px' }}
              title={isSidebarMinimized ? "Expand Sidebar" : "Minimize Sidebar"}
            >
              {isSidebarMinimized ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
          
          <ul className="sidebar-nav-list">
            <li>
              <a 
                className={`sidebar-nav-item ${activeNav === 'studio' ? 'active' : ''}`}
                onClick={() => scrollToSection('sec-monitor')}
                title="Studio Feed"
              >
                <Tv size={18} />
                <span className="sidebar-nav-text">Studio Feed</span>
              </a>
            </li>
            <li>
              <a 
                className={`sidebar-nav-item ${activeNav === 'analytics' ? 'active' : ''}`}
                onClick={() => scrollToSection('sec-analytics')}
                title="Analitik Live"
              >
                <BarChart3 size={18} />
                <span className="sidebar-nav-text">Analitik Live</span>
              </a>
            </li>
            <li>
              <a 
                className={`sidebar-nav-item ${activeNav === 'ingest' ? 'active' : ''}`}
                onClick={() => scrollToSection('sec-ingest')}
                title="Ingest OBS"
              >
                <Settings size={18} />
                <span className="sidebar-nav-text">Ingest OBS</span>
              </a>
            </li>
            <li>
              <a 
                className={`sidebar-nav-item ${activeNav === 'destinations' ? 'active' : ''}`}
                onClick={() => scrollToSection('sec-destinations')}
                title="Platform Target"
              >
                <Layers size={18} />
                <span className="sidebar-nav-text">Platform Target</span>
              </a>
            </li>
            <li>
              <a 
                className={`sidebar-nav-item ${activeNav === 'logs' ? 'active' : ''}`}
                onClick={() => scrollToSection('sec-logs')}
                title="Process Logs"
              >
                <Terminal size={18} />
                <span className="sidebar-nav-text">Process Logs</span>
              </a>
            </li>
            <li>
              <a 
                className="sidebar-nav-item"
                onClick={() => setIsFaqOpen(true)}
                title="FAQ & Guide"
              >
                <HelpCircle size={18} />
                <span className="sidebar-nav-text">Buka FAQ</span>
              </a>
            </li>
          </ul>

          {!isSidebarMinimized && (
            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="sidebar-section-title">Telemetry</div>
              <div className="sidebar-telemetry-text" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '0 12px' }}>
                FFmpeg Path:<br/>
                <code style={{ fontSize: '0.72rem', color: 'var(--text-primary)' }}>{ffmpegPath || 'detecting...'}</code>
              </div>
            </div>
          )}
        </aside>

        {/* Main Grid Content */}
        <main className="main-content">
          {/* Left Column: Live Monitor, Analytics & Logs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            
            {/* Master Control Card */}
            <div className="card master-control-card">
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span className={`status-live-badge ${isCurrentlyRestreaming ? 'status-live-active' : 'status-live-idle'}`}>
                    <span className={isCurrentlyRestreaming ? "live-pulse" : ""} style={{
                      width: '10px', height: '10px', 
                      borderRadius: '50%', 
                      backgroundColor: isCurrentlyRestreaming ? 'var(--danger)' : '#64748b'
                    }} />
                    {isCurrentlyRestreaming ? "LIVE BROADCASTING" : "STANDBY"}
                  </span>

                  <div>
                    <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {isCurrentlyRestreaming ? "Master Multistreaming Aktif" : "Sistem Siap Menyiarkan"}
                    </h1>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {isCurrentlyRestreaming 
                        ? `Menyalurkan sinyal ke ${activeStreamsCount} destinasi platform serentak` 
                        : "Hubungkan OBS Studio dan tekan Mulai Restreaming"}
                    </p>
                  </div>
                </div>

                <div>
                  {isCurrentlyRestreaming ? (
                    <button 
                      className="btn btn-danger" 
                      onClick={() => handleStopRestream()} 
                      disabled={actionLoading}
                    >
                      <Square size={16} /> Hentikan Semua Stream
                    </button>
                  ) : (
                    <button 
                      className="btn btn-primary" 
                      onClick={handleStartRestream} 
                      disabled={actionLoading || destinations.length === 0 || !destinations.some(d => d.rtmpUrl && d.streamKey)}
                    >
                      <Play size={16} /> Mulai Restreaming
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Live Analytics Module (Real-Time Metrics) */}
            <div id="sec-analytics" className="card">
              <div className="card-title">
                <BarChart3 size={18} style={{ color: 'var(--primary)' }} />
                <span>Analitik Broadcast & Kualitas Jaringan Live</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                {/* Duration Gauge */}
                <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: '700' }}>
                    <Clock size={16} style={{ color: 'var(--primary)' }} />
                    DURASI LIVE
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: '800', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    {activeDuration}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {isCurrentlyRestreaming ? '⏱️ Sesi streaming berjalan' : '⏸️ Standby'}
                  </div>
                </div>

                {/* Bitrate Gauge */}
                <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: '700' }}>
                    <Gauge size={16} style={{ color: 'var(--secondary)' }} />
                    INGEST BITRATE
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: '800', fontFamily: 'var(--font-mono)', color: 'var(--secondary)' }}>
                    {activeBitrate}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    📊 Transfer data real-time
                  </div>
                </div>

                {/* FPS Gauge */}
                <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: '700' }}>
                    <Activity size={16} style={{ color: 'var(--primary)' }} />
                    FRAME RATE (FPS)
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: '800', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    {activeFps} FPS
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    🎯 Target: 60.0 FPS
                  </div>
                </div>

                {/* Network Quality Gauge */}
                <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: '700' }}>
                    <Wifi size={16} style={{ color: activeNetworkStatus === 'excellent' ? 'var(--secondary)' : (activeNetworkStatus === 'warning' ? 'var(--danger)' : 'var(--text-muted)') }} />
                    KUALITAS JARINGAN
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '800', color: activeNetworkStatus === 'excellent' ? 'var(--secondary)' : (activeNetworkStatus === 'warning' ? 'var(--danger)' : 'var(--text-muted)') }}>
                    {activeNetworkStatus === 'excellent' ? '🟢 Sempurna (0% Drop)' : (activeNetworkStatus === 'good' ? '🟡 Stabil' : (activeNetworkStatus === 'warning' ? '🔴 Sinyal Terganggu' : '⚪ Offline'))}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    ⚡ Zero Packet Loss
                  </div>
                </div>
              </div>
            </div>

            {/* Live Stream Video Monitor */}
            <div id="sec-monitor" className="card">
              <div className="card-title">
                <Video size={18} style={{ color: 'var(--primary)' }} />
                <span>Live Monitor Feed (WebRTC Low Latency)</span>
                <button 
                  className="btn btn-secondary" 
                  onClick={reloadPlayer} 
                  style={{ marginLeft: 'auto', padding: '6px 12px', fontSize: '0.78rem' }}
                >
                  <RotateCw size={12} /> Reload Feed
                </button>
              </div>

              <div className="video-wrapper">
                <div className="video-overlay-badge">
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--secondary)' }} />
                  WHEP WebRTC (&lt; 0.5s)
                </div>
                <iframe 
                  key={playerKey}
                  src={`http://localhost:8889/live/${ingestKey}/`}
                  style={{ width: '100%', height: '100%', border: 'none', background: '#000' }}
                  allow="autoplay; fullscreen"
                />
              </div>

              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Video codec: <code style={{ color: 'var(--text-primary)' }}>H.264 / AAC (Pass-through)</code></span>
                <span>MediaMTX WebRTC Port: <code style={{ color: 'var(--text-primary)' }}>8889</code></span>
              </div>
            </div>

            {/* Ingest Key Credentials Card */}
            <div id="sec-ingest" className="card">
              <div className="card-title">
                <Settings size={18} style={{ color: 'var(--primary)' }} />
                <span>Konfigurasi Ingest Stream OBS</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Server URL (OBS)</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      readOnly 
                      className="input-text" 
                      style={{ flex: 1, fontFamily: 'var(--font-mono)' }}
                      value="rtmp://127.0.0.1:1935/live"
                    />
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => copyToClipboard("rtmp://127.0.0.1:1935/live", 'server')}
                      style={{ padding: '0 14px' }}
                      title="Copy Server URL"
                    >
                      {copiedServer ? <Check size={14} style={{ color: 'var(--secondary)' }} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Stream Key Acak (OBS)</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      readOnly 
                      className="input-text" 
                      style={{ flex: 1, fontWeight: '700', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}
                      value={ingestKey}
                    />
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => copyToClipboard(ingestKey, 'key')}
                      style={{ padding: '0 14px' }}
                      title="Copy Stream Key"
                    >
                      {copiedKey ? <Check size={14} style={{ color: 'var(--secondary)' }} /> : <Copy size={14} />}
                    </button>
                    <button 
                      className="btn btn-primary" 
                      onClick={handleRandomizeIngestKey}
                      disabled={isCurrentlyRestreaming}
                      style={{ padding: '0 14px' }}
                      title="Ganti Acak Stream Key"
                    >
                      🎲 Acak Key
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Logs Terminal */}
            <div id="sec-logs" className="card">
              <div className="card-title">
                <Terminal size={18} style={{ color: 'var(--primary)' }} />
                <span>FFmpeg Process Output Logs</span>
                
                <select 
                  className="select-box" 
                  value={selectedDestId} 
                  onChange={(e) => setSelectedDestId(e.target.value)}
                  style={{ marginLeft: 'auto' }}
                >
                  {destinations.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.status})</option>
                  ))}
                </select>
              </div>

              <div ref={logContainerRef} className="log-container">
                {logs.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '80px' }}>
                    Belum ada log output. {isCurrentlyRestreaming ? "Menunggu status..." : "Klik Mulai Restreaming untuk memulai."}
                  </div>
                ) : (
                  logs.map((log, idx) => {
                    let isErr = log.toLowerCase().includes('error') || log.toLowerCase().includes('failed');
                    let isSys = log.startsWith('[System]') || log.startsWith('[STDOUT]');
                    let className = "log-line";
                    if (isErr) className += " log-line-err";
                    else if (isSys) className += " log-line-sys";
                    
                    return (
                      <div key={idx} className={className}>
                        {log}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          {/* Right Column: Platform Destinations Control */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            
            {/* Destinations Stack */}
            <div id="sec-destinations" className="card">
              <div className="card-title">
                <Tv size={18} style={{ color: 'var(--primary)' }} />
                <span>Target Platform (Maksimal 3)</span>
                
                <button 
                  className="btn btn-secondary" 
                  onClick={handleAddDestination}
                  disabled={destinations.length >= 3}
                  style={{ marginLeft: 'auto', padding: '6px 12px', fontSize: '0.78rem' }}
                >
                  <Plus size={14} /> Tambah Platform
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {destinations.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>
                    Belum ada platform destinasi dikonfigurasi. Klik tombol "+ Tambah Platform" di atas.
                  </div>
                ) : (
                  destinations.map((dest) => {
                    const platformType = getPlatformType(dest);
                    return (
                      <div 
                        key={dest.id} 
                        className="dest-item" 
                        data-platform={platformType}
                        style={{
                          borderColor: selectedDestId === dest.id ? 'var(--primary)' : 'var(--border)'
                        }}
                      >
                        <div className="dest-header" onClick={() => setSelectedDestId(dest.id)} style={{ cursor: 'pointer' }}>
                          <div className="dest-name">
                            <span style={{ 
                              width: '10px', height: '10px', 
                              borderRadius: '50%',
                              backgroundColor: dest.status === 'streaming' ? 'var(--secondary)' : (dest.status === 'error' ? 'var(--danger)' : '#64748b')
                            }} />
                            {dest.name}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span className={`status-indicator status-${dest.status}`}>
                              {dest.status}
                            </span>
                            
                            <button 
                              className="btn" 
                              style={{ padding: '6px', background: 'transparent', color: 'var(--text-secondary)' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (dest.status === 'streaming') {
                                  handleStopRestream(dest.id);
                                } else {
                                  handleDeleteDestination(dest.id);
                                }
                              }}
                              title={dest.status === 'streaming' ? "Hentikan Stream Platform Ini" : "Hapus Platform"}
                            >
                              {dest.status === 'streaming' ? <Square size={14} style={{ color: 'var(--danger)' }} /> : <Trash size={14} />}
                            </button>
                          </div>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Nama Platform / Label</label>
                          <input 
                            type="text" 
                            className="input-text" 
                            value={dest.name} 
                            onChange={(e) => handleFieldChange(dest.id, 'name', e.target.value)}
                            placeholder="Contoh: YouTube Live Utama"
                            disabled={dest.status === 'streaming'}
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">RTMP Server URL</label>
                          <input 
                            type="text" 
                            className="input-text" 
                            value={dest.rtmpUrl} 
                            onChange={(e) => handleFieldChange(dest.id, 'rtmpUrl', e.target.value)}
                            placeholder="Contoh: rtmp://a.rtmp.youtube.com/live2"
                            disabled={dest.status === 'streaming'}
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Stream Key Target</label>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input 
                              type="password" 
                              className="input-text" 
                              style={{ flex: 1, fontFamily: 'var(--font-mono)' }}
                              value={dest.streamKey} 
                              onChange={(e) => handleFieldChange(dest.id, 'streamKey', e.target.value)}
                              placeholder="Masukkan Stream Key Anda"
                              disabled={dest.status === 'streaming'}
                            />
                            <button 
                              className="btn btn-secondary"
                              onClick={() => handleGenerateKey(dest.id)}
                              disabled={dest.status === 'streaming'}
                              title="Auto Generate Key Test"
                              style={{ padding: '0 12px' }}
                            >
                              🎲
                            </button>
                          </div>
                        </div>

                        {dest.errorMsg && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--danger)', padding: '8px 12px', background: 'rgba(244, 63, 94, 0.1)', borderRadius: '6px', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
                            <strong>Error:</strong> {dest.errorMsg}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {destinations.length > 0 && (
                <button 
                  className="btn btn-secondary" 
                  onClick={() => handleSave()}
                  disabled={actionLoading || isCurrentlyRestreaming}
                  style={{ width: '100%', marginTop: '8px' }}
                >
                  <Save size={16} /> Simpan Semua Konfigurasi Target
                </button>
              )}
            </div>

            {/* OBS Quick Setup Guide Card */}
            <div className="card" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              <h3 style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.92rem', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                <Activity size={14} style={{ color: 'var(--primary)' }} /> Quick Setup OBS Studio
              </h3>
              <ol style={{ paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                <li>OBS Settings &gt; Stream &gt; Service: <strong>Custom...</strong></li>
                <li>Server: <code style={{ color: 'var(--text-primary)', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px' }}>rtmp://127.0.0.1:1935/live</code></li>
                <li>Stream Key: <code style={{ color: 'var(--text-primary)', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px' }}>{ingestKey}</code></li>
                <li>Output &gt; Streaming &gt; Keyframe Interval: <strong>2s</strong></li>
                <li>Output &gt; Streaming &gt; Max B-frames: <strong>0</strong> (Wajib WebRTC).</li>
              </ol>
            </div>

          </div>
        </main>
      </div>

      {/* FAQ Modal Component (Vertical downward stacking layout) */}
      {isFaqOpen && (
        <div className="faq-modal-overlay" onClick={() => setIsFaqOpen(false)}>
          <div className="faq-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="faq-modal-header">
              <h2 className="faq-title">
                <HelpCircle size={22} style={{ color: 'var(--primary)' }} />
                FAQ & Support Guide
              </h2>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                onClick={() => setIsFaqOpen(false)}
              >
                <X size={16} /> Tutup FAQ
              </button>
            </div>

            <div className="faq-modal-body">
              <div className="faq-grid">
                {faqData.map((faq, index) => (
                  <div 
                    key={index} 
                    className={`faq-item ${openFaqIndex === index ? 'open' : ''}`}
                  >
                    <div className="faq-header" onClick={() => toggleFaq(index)}>
                      <span>{faq.q}</span>
                      <span className="faq-chevron" style={{ fontSize: '0.75rem' }}>▼</span>
                    </div>
                    <div className="faq-content">
                      <p>{faq.a}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compact Clean Footer */}
      <footer className="app-footer">
        <div className="footer-inner" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={() => setIsFaqOpen(true)}>
              <HelpCircle size={16} /> Buka FAQ & Guide
            </button>
            <a 
              href="https://github.com/studentawangihti/mystream" 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{ textDecoration: 'none' }}
            >
              <ExternalLink size={16} /> GitHub Repository
            </a>
          </div>

          <div className="footer-copy">
            <p>Copyright by <strong>awgxidn</strong> &copy; {new Date().getFullYear()}. All Rights Reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
