'use client';

import React, { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ShieldCheck, 
  Users, 
  Radio, 
  Activity, 
  BarChart3, 
  Tv, 
  RotateCw, 
  Search, 
  ArrowLeft, 
  Crown, 
  Sparkles, 
  Zap, 
  KeyRound, 
  Check, 
  LogOut,
  RefreshCw,
  Sliders,
  CheckCircle,
  AlertCircle,
  HardDrive,
  Database,
  Download,
  Trash2,
  Undo2,
  XCircle,
  Lock,
  Server,
  Cpu,
  FileCode,
  Layers,
  HelpCircle,
  Clock
} from 'lucide-react';

interface VideoRecord {
  id: string;
  title: string;
  sizeBytes: string;
}

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  plan: string;
  ingestKey: string;
  deletedAt?: string | null;
  createdAt: string;
  destinations: { id: string; name: string; status: string }[];
  videos: VideoRecord[];
}

interface TrafficData {
  totalUsers: number;
  freeUsers: number;
  proUsers: number;
  ultimateUsers: number;
  totalDestinations: number;
  activeStreams: number;
  estimatedBitrateMbps: number;
  serverUptime: string;
  mediaMtxStatus: string;
}

interface BackupFile {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

interface DbStats {
  dbSizeBytes: number;
  userCount: number;
  videoCount: number;
  destCount: number;
}

export default function AdminDashboard() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [users, setUsers] = useState<UserData[]>([]);
  const [traffic, setTraffic] = useState<TrafficData | null>(null);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [dbStats, setDbStats] = useState<DbStats | null>(null);

  const [loading, setLoading] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'database' | 'traffic'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [showRecycleBin, setShowRecycleBin] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Change Password Modal state for Admin override
  const [passModalUser, setPassModalUser] = useState<UserData | null>(null);
  const [newAdminPasswordInput, setNewAdminPasswordInput] = useState('');
  const [passLoading, setPassLoading] = useState(false);

  // Redirect if unauthenticated or not an admin
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/login');
    } else if (sessionStatus === 'authenticated') {
      const role = (session?.user as any)?.role;
      if (role !== 'admin') {
        alert('Akses khusus Super Admin!');
        router.push('/');
      }
    }
  }, [sessionStatus, session, router]);

  const fetchAdminData = async () => {
    try {
      const [usersRes, trafficRes, backupRes] = await Promise.all([
        fetch(`/api/admin/users?includeDeleted=${showRecycleBin ? 'true' : 'false'}`),
        fetch('/api/admin/traffic'),
        fetch('/api/admin/backup'),
      ]);

      const usersData = await usersRes.json();
      const trafficData = await trafficRes.json();
      const backupData = await backupRes.json();

      if (usersData.users) setUsers(usersData.users);
      if (trafficData.traffic) setTraffic(trafficData.traffic);
      if (backupData.backups) setBackups(backupData.backups);
      if (backupData.dbStats) setDbStats(backupData.dbStats);
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionStatus === 'authenticated' && (session?.user as any)?.role === 'admin') {
      fetchAdminData();
      const interval = setInterval(fetchAdminData, 4000);
      return () => clearInterval(interval);
    }
  }, [sessionStatus, session, showRecycleBin]);

  // Handle Plan Override
  const handlePlanChange = async (userId: string, newPlan: string) => {
    setActionLoadingId(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change_plan', userId, plan: newPlan }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Gagal mengubah plan.');
      } else {
        setNotification(data.message);
        setTimeout(() => setNotification(null), 3500);
        fetchAdminData();
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Role Change
  const handleRoleChange = async (userId: string, newRole: string) => {
    setActionLoadingId(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change_role', userId, role: newRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Gagal mengubah role.');
      } else {
        setNotification(data.message);
        setTimeout(() => setNotification(null), 3500);
        fetchAdminData();
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Soft-Delete User
  const handleSoftDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`Apakah Anda yakin ingin men-Soft Delete akun "${email}"? Akun akan dipindahkan ke Recycle Bin.`)) return;

    setActionLoadingId(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'soft_delete', userId }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Gagal men-soft delete user.');
      } else {
        setNotification(data.message);
        setTimeout(() => setNotification(null), 3500);
        fetchAdminData();
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Restore Soft-Deleted User
  const handleRestoreUser = async (userId: string, email: string) => {
    setActionLoadingId(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', userId }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Gagal memulihkan user.');
      } else {
        setNotification(data.message);
        setTimeout(() => setNotification(null), 3500);
        fetchAdminData();
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Hard Delete User
  const handleHardDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`⚠️ PERINGATAN: Apakah Anda yakin ingin MENGHAPUS PERMANEN akun "${email}" dari database? Data tidak akan dapat dikembalikan!`)) return;

    setActionLoadingId(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'hard_delete', userId }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Gagal menghapus user permanen.');
      } else {
        setNotification(data.message);
        setTimeout(() => setNotification(null), 3500);
        fetchAdminData();
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Admin Password Change Override
  const handleAdminSubmitPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passModalUser) return;

    setPassLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_password',
          userId: passModalUser.id,
          newPassword: newAdminPasswordInput,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Gagal merubah password user.');
      } else {
        setNotification(data.message);
        setPassModalUser(null);
        setNewAdminPasswordInput('');
        setTimeout(() => setNotification(null), 3500);
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi.');
    } finally {
      setPassLoading(false);
    }
  };

  // Handle Reset Stream Key
  const handleResetStreamKey = async (userId: string) => {
    if (!confirm('Apakah Anda yakin ingin mereset Stream Key user ini secara paksa?')) return;

    setActionLoadingId(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_key', userId }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Gagal mereset key.');
      } else {
        setNotification(data.message);
        setTimeout(() => setNotification(null), 3500);
        fetchAdminData();
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Create Database Snapshot Backup
  const handleCreateDatabaseBackup = async () => {
    setBackupLoading(true);
    try {
      const res = await fetch('/api/admin/backup', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Gagal membuat backup database.');
      } else {
        setNotification(data.message);
        setTimeout(() => setNotification(null), 3500);
        fetchAdminData();
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi saat membuat backup.');
    } finally {
      setBackupLoading(false);
    }
  };

  if (sessionStatus === 'loading' || loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <RotateCw style={{ animation: 'spin 1s linear infinite', width: '36px', height: '36px', color: 'var(--primary)' }} />
          <p style={{ marginTop: '16px', fontSize: '15px', fontWeight: 600 }}>Memuat Dedicated Admin Panel...</p>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter((u) => {
    const isSoftDeleted = !!u.deletedAt;
    if (showRecycleBin && !isSoftDeleted) return false;
    if (!showRecycleBin && isSoftDeleted) return false;

    const matchesSearch = u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlan = planFilter === 'all' || u.plan === planFilter;
    return matchesSearch && matchesPlan;
  });

  return (
    <div className="app-container">
      {/* Admin Header */}
      <header className="app-header">
        <div className="logo-section">
          <div className="logo-icon-wrapper" style={{ background: 'linear-gradient(135deg, #eab308 0%, #d97706 100%)' }}>
            <ShieldCheck size={20} color="#ffffff" />
          </div>
          <span className="logo-title">MyStream Admin Panel</span>
          <span className="logo-badge" style={{ backgroundColor: 'rgba(234,179,8,0.15)', color: '#eab308', borderColor: 'rgba(234,179,8,0.3)' }}>DEDICATED CONTROL CENTER</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600 }}>
            <ArrowLeft size={14} />
            <span>Kembali Ke Studio Feed</span>
          </Link>

          <button 
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            <LogOut size={13} />
            <span>Keluar</span>
          </button>
        </div>
      </header>

      {/* Notification Toast */}
      {notification && (
        <div style={{ position: 'fixed', top: '80px', right: '28px', zIndex: 300, background: 'rgba(16,185,129,0.95)', color: '#fff', padding: '12px 20px', borderRadius: '10px', fontWeight: 700, fontSize: '0.85rem', boxShadow: '0 10px 30px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={16} />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Workspace */}
      <main className="main-content">
        
        {/* System Overview Telemetry Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={22} color="#6366f1" />
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL USER AKTIF</span>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '2px 0 0 0', color: 'var(--text-primary)' }}>{dbStats?.userCount || traffic?.totalUsers || 0} <small style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>User</small></h3>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Radio size={22} color="#10b981" />
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>SIARAN LIVE AKTIF</span>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '2px 0 0 0', color: '#10b981' }}>{traffic?.activeStreams || 0} <small style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Session</small></h3>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Database size={22} color="#f59e0b" />
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>UKURAN DATABASE SQLITE</span>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '2px 0 0 0', color: '#f59e0b' }}>
                  {dbStats?.dbSizeBytes ? (dbStats.dbSizeBytes / (1024 * 1024)).toFixed(2) : 0} <small style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>MB</small>
                </h3>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'rgba(236,72,153,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <HardDrive size={22} color="#ec4899" />
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>SNAPSHOT BACKUP DB</span>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '2px 0 0 0', color: 'var(--text-primary)' }}>{backups.length} <small style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Snapshot</small></h3>
              </div>
            </div>
          </div>
        </div>

        {/* Dedicated Admin Navigation Tabs */}
        <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '4px', margin: '24px 0 16px 0' }}>
          <button
            style={{ background: activeTab === 'users' ? 'var(--primary)' : 'transparent', color: activeTab === 'users' ? '#fff' : 'var(--text-secondary)', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={() => setActiveTab('users')}
          >
            <Users size={16} />
            <span>Manajemen User & Recycle Bin</span>
          </button>

          <button
            style={{ background: activeTab === 'database' ? 'var(--primary)' : 'transparent', color: activeTab === 'database' ? '#fff' : 'var(--text-secondary)', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={() => setActiveTab('database')}
          >
            <Database size={16} />
            <span>Database & Snapshot Backup</span>
          </button>

          <button
            style={{ background: activeTab === 'traffic' ? 'var(--primary)' : 'transparent', color: activeTab === 'traffic' ? '#fff' : 'var(--text-secondary)', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={() => setActiveTab('traffic')}
          >
            <BarChart3 size={16} />
            <span>System Traffic & Engine Stats</span>
          </button>
        </div>

        {/* TAB 1: User Control Matrix & Soft-Delete Recycle Bin */}
        {activeTab === 'users' && (
          <div className="card">
            <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
              <div className="card-title">
                <Users size={18} color="var(--primary)" />
                <span>{showRecycleBin ? 'Recycle Bin (Akun Ter-Soft Delete)' : 'Daftar Akun Pengguna Aktif'}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {/* Search Box */}
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="input-text"
                    style={{ paddingLeft: '34px', padding: '6px 12px 6px 34px', fontSize: '0.82rem', width: '220px' }}
                    placeholder="Cari Nama / Email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Plan Filter */}
                <select
                  className="input-text"
                  style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value)}
                >
                  <option value="all">Semua Plan</option>
                  <option value="free">Free Plan</option>
                  <option value="pro">Pro Member</option>
                  <option value="ultimate">Ultimate VIP</option>
                </select>

                {/* Recycle Bin Toggle */}
                <button
                  style={{ background: showRecycleBin ? 'rgba(244,63,94,0.15)' : 'rgba(255,255,255,0.05)', border: showRecycleBin ? '1px solid rgba(244,63,94,0.3)' : '1px solid var(--border)', color: showRecycleBin ? '#fb7185' : 'var(--text-secondary)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => setShowRecycleBin(!showRecycleBin)}
                >
                  <Trash2 size={13} />
                  <span>{showRecycleBin ? 'Tampilkan Akun Aktif' : 'Buka Recycle Bin'}</span>
                </button>

                <button
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={fetchAdminData}
                >
                  <RefreshCw size={13} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* User Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 16px' }}>USER & EMAIL</th>
                    <th style={{ padding: '12px 16px' }}>ROLE ACCESS</th>
                    <th style={{ padding: '12px 16px' }}>PLAN MEMBERSHIP OVERRIDE</th>
                    <th style={{ padding: '12px 16px' }}>CLOUD MP4 STORAGE</th>
                    <th style={{ padding: '12px 16px' }}>INGEST KEY</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>AKSI CONTROL ADMIN</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                        {showRecycleBin ? 'Recycle Bin kosong. Tidak ada akun ter-soft delete.' : 'Tidak ditemukan akun pengguna yang sesuai.'}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isSoftDeleted = !!u.deletedAt;
                      const totalVideoSizeBytes = u.videos?.reduce((acc, v) => acc + BigInt(v.sizeBytes || '0'), BigInt(0)) || BigInt(0);
                      const usedMB = (Number(totalVideoSizeBytes) / (1024 * 1024)).toFixed(1);

                      return (
                        <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', opacity: isSoftDeleted ? 0.6 : 1, transition: 'background 0.2s' }}>
                          {/* Name & Email */}
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: u.role === 'admin' ? '#eab308' : 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', color: '#fff' }}>
                                {u.name ? u.name[0].toUpperCase() : 'U'}
                              </div>
                              <div>
                                <span style={{ fontWeight: 700, display: 'block' }}>{u.name || 'No Name'} {isSoftDeleted && <span style={{ color: '#f43f5e', fontSize: '0.7rem' }}>(SOFT DELETED)</span>}</span>
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{u.email}</span>
                              </div>
                            </div>
                          </td>

                          {/* Role Switcher */}
                          <td style={{ padding: '14px 16px' }}>
                            <select
                              className="input-text"
                              style={{ padding: '4px 8px', fontSize: '0.78rem', fontWeight: 800, color: u.role === 'admin' ? '#eab308' : 'var(--text-secondary)' }}
                              value={u.role}
                              disabled={actionLoadingId === u.id || isSoftDeleted}
                              onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            >
                              <option value="user">👤 USER</option>
                              <option value="admin">⚙️ SUPER ADMIN</option>
                            </select>
                          </td>

                          {/* Plan Dropdown Selector */}
                          <td style={{ padding: '14px 16px' }}>
                            <select
                              className="input-text"
                              style={{ padding: '6px 12px', fontSize: '0.82rem', fontWeight: 700, color: u.plan === 'ultimate' ? '#eab308' : u.plan === 'pro' ? '#6366f1' : 'var(--text-primary)' }}
                              value={u.plan}
                              disabled={actionLoadingId === u.id || isSoftDeleted}
                              onChange={(e) => handlePlanChange(u.id, e.target.value)}
                            >
                              <option value="free">⚡ FREE PLAN</option>
                              <option value="pro">💎 PRO MEMBER</option>
                              <option value="ultimate">👑 ULTIMATE VIP</option>
                            </select>
                          </td>

                          {/* Cloud MP4 Storage */}
                          <td style={{ padding: '14px 16px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <span>💾 <strong>{usedMB} MB</strong> ({u.videos?.length || 0} File MP4)</span>
                          </td>

                          {/* Ingest Stream Key */}
                          <td style={{ padding: '14px 16px' }}>
                            <code style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--text-terminal)', background: 'var(--bg-input)', padding: '4px 8px', borderRadius: '6px' }}>
                              {u.ingestKey}
                            </code>
                          </td>

                          {/* Action Buttons */}
                          <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                              {isSoftDeleted ? (
                                <>
                                  <button
                                    style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399', padding: '6px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                    onClick={() => handleRestoreUser(u.id, u.email)}
                                    disabled={actionLoadingId === u.id}
                                    title="Pulihkan Akun dari Recycle Bin"
                                  >
                                    <Undo2 size={12} />
                                    <span>Restore</span>
                                  </button>
                                  <button
                                    style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)', color: '#fb7185', padding: '6px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                    onClick={() => handleHardDeleteUser(u.id, u.email)}
                                    disabled={actionLoadingId === u.id}
                                    title="Hapus Permanen Akun Ini dari DB"
                                  >
                                    <XCircle size={12} />
                                    <span>Delete DB</span>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '6px 8px', borderRadius: '6px', fontSize: '0.78rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                    onClick={() => setPassModalUser(u)}
                                    title="Ubah Password User"
                                  >
                                    <KeyRound size={12} />
                                    <span>Pass</span>
                                  </button>
                                  <button
                                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '6px 8px', borderRadius: '6px', fontSize: '0.78rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                    onClick={() => handleResetStreamKey(u.id)}
                                    disabled={actionLoadingId === u.id}
                                    title="Acak Stream Key"
                                  >
                                    <RotateCw size={12} />
                                    <span>Key</span>
                                  </button>
                                  <button
                                    style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)', color: '#fb7185', padding: '6px 8px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                    onClick={() => handleSoftDeleteUser(u.id, u.email)}
                                    disabled={actionLoadingId === u.id}
                                    title="Pindahkan Akun ke Recycle Bin"
                                  >
                                    <Trash2 size={12} />
                                    <span>Soft Delete</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: Database Snapshot & Backup Control Center */}
        {activeTab === 'database' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="card">
              <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
                <div className="card-title">
                  <Database size={18} color="var(--primary)" />
                  <span>SQLite Database Health & Snapshot Backup System</span>
                </div>

                <button
                  style={{ background: 'linear-gradient(135deg, var(--primary) 0%, #4f46e5 100%)', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 0 20px rgba(99,102,241,0.3)' }}
                  onClick={handleCreateDatabaseBackup}
                  disabled={backupLoading}
                >
                  {backupLoading ? <RotateCw className="spin" size={16} /> : <HardDrive size={16} />}
                  <span>{backupLoading ? 'Membuat Snapshot...' : '💾 Buat Snapshot Backup Database (1-Click)'}</span>
                </button>
              </div>

              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0 0 20px 0' }}>
                Sistem secara otomatis menduplikasi snapshot database SQLite <code style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>prisma/dev.db</code> ke direktori fisik <code style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>backups/</code> dengan stempel waktu (timestamp). File backup dapat diunduh kapan saja.
              </p>

              {/* Database Table Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', padding: '16px', borderRadius: '12px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL REKORD USER</span>
                  <h4 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '4px 0 0 0', color: 'var(--text-primary)' }}>{dbStats?.userCount || 0} Pengguna</h4>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', padding: '16px', borderRadius: '12px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL REKORD MP4 VIDEO</span>
                  <h4 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '4px 0 0 0', color: 'var(--text-primary)' }}>{dbStats?.videoCount || 0} File</h4>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', padding: '16px', borderRadius: '12px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL PLATFORM TARGET</span>
                  <h4 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '4px 0 0 0', color: 'var(--text-primary)' }}>{dbStats?.destCount || 0} Target</h4>
                </div>
              </div>

              {/* Backup History Table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>RIWAYAT SNAPSHOT BACKUP ({backups.length})</span>

                {backups.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.88rem', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    Belum ada snapshot backup terdeteksi. Klik tombol 'Buat Snapshot Backup Database' di atas untuk membuat backup pertama Anda!
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                          <th style={{ padding: '12px 16px' }}>NAMA FILE SNAPSHOT</th>
                          <th style={{ padding: '12px 16px' }}>UKURAN FILE</th>
                          <th style={{ padding: '12px 16px' }}>WAKTU PEMBUATAN</th>
                          <th style={{ padding: '12px 16px', textAlign: 'right' }}>DOWNLOAD</th>
                        </tr>
                      </thead>
                      <tbody>
                        {backups.map((b) => (
                          <tr key={b.filename} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '14px 16px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Database size={16} color="var(--primary)" />
                                <span>{b.filename}</span>
                              </div>
                            </td>
                            <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                              {(b.sizeBytes / (1024 * 1024)).toFixed(2)} MB
                            </td>
                            <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                              {new Date(b.createdAt).toLocaleString('id-ID')}
                            </td>
                            <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                              <a
                                href={`/api/admin/backup?file=${encodeURIComponent(b.filename)}`}
                                download
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--primary)', padding: '6px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                              >
                                <Download size={13} />
                                <span>Unduh DB</span>
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: System Traffic & Engine Telemetry */}
        {activeTab === 'traffic' && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <BarChart3 size={18} color="var(--primary)" />
                <span>MediaMTX Ingest & System Hardware Metrics</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', padding: '20px', borderRadius: '12px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>ENGINE STATUS</span>
                <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981', margin: '6px 0 0 0' }}>🟢 {traffic?.mediaMtxStatus || 'Online & Broadcasting'}</h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>RTMP Ingest Port: 1935 | WHEP Port: 8889</p>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', padding: '20px', borderRadius: '12px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>SYSTEM UPTIME</span>
                <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: '6px 0 0 0' }}>{traffic?.serverUptime || '99.98% Operational'}</h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Zero Packet Loss Pass-Through</p>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', padding: '20px', borderRadius: '12px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>TARGET RESTREAM DIHUBUNGKAN</span>
                <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#6366f1', margin: '6px 0 0 0' }}>{traffic?.totalDestinations || 0} Target Endpoint</h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Multi-platform distribution</p>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Admin Override Password Change Modal */}
      {passModalUser && (
        <div className="modal-backdrop">
          <div className="plan-modal-card" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KeyRound size={20} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>Override Password: {passModalUser.email}</h3>
              </div>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setPassModalUser(null)}>
                <XCircle size={18} />
              </button>
            </div>

            <form onSubmit={handleAdminSubmitPasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
              <div className="form-group">
                <label className="form-label">MASUKKAN PASSWORD BARU UNTUK USER INI</label>
                <input
                  type="password"
                  required
                  className="input-text"
                  placeholder="Minimal 6 karakter"
                  value={newAdminPasswordInput}
                  onChange={(e) => setNewAdminPasswordInput(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={passLoading}
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }}
              >
                {passLoading ? 'Memperbarui...' : 'Simpan Password Baru User'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
