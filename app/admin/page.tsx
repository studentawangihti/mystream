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
  AlertCircle
} from 'lucide-react';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  plan: string;
  ingestKey: string;
  createdAt: string;
  destinations: { id: string; name: string; status: string }[];
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

export default function AdminDashboard() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [users, setUsers] = useState<UserData[]>([]);
  const [traffic, setTraffic] = useState<TrafficData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

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
      const [usersRes, trafficRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/traffic'),
      ]);

      const usersData = await usersRes.json();
      const trafficData = await trafficRes.json();

      if (usersData.users) setUsers(usersData.users);
      if (trafficData.traffic) setTraffic(trafficData.traffic);
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
  }, [sessionStatus, session]);

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
        setTimeout(() => setNotification(null), 3000);
        fetchAdminData();
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi.');
    } finally {
      setActionLoadingId(null);
    }
  };

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
        setTimeout(() => setNotification(null), 3000);
        fetchAdminData();
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi.');
    } finally {
      setActionLoadingId(null);
    }
  };

  if (sessionStatus === 'loading' || loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <RotateCw style={{ animation: 'spin 1s linear infinite', width: '36px', height: '36px', color: 'var(--primary)' }} />
          <p style={{ marginTop: '16px', fontSize: '15px', fontWeight: 600 }}>Memuat Admin Dashboard...</p>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter((u) => {
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
          <span className="logo-title">MyStream Control Center</span>
          <span className="logo-badge" style={{ backgroundColor: 'rgba(234,179,8,0.15)', color: '#eab308', borderColor: 'rgba(234,179,8,0.3)' }}>SUPER ADMIN</span>
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
        <div style={{ position: 'fixed', top: '80px', right: '28px', zIndex: 300, background: 'rgba(16,185,129,0.9)', color: '#fff', padding: '12px 20px', borderRadius: '10px', fontWeight: 700, fontSize: '0.85rem', boxShadow: '0 10px 30px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={16} />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Workspace */}
      <main className="main-content">
        
        {/* System Traffic Overview Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={22} color="#6366f1" />
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL USER TERDAFTAR</span>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '2px 0 0 0', color: 'var(--text-primary)' }}>{traffic?.totalUsers || 0} <small style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>User</small></h3>
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
                <Activity size={22} color="#f59e0b" />
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>ESTIMASI TRAFFIC BANDWIDTH</span>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '2px 0 0 0', color: '#f59e0b' }}>{traffic?.estimatedBitrateMbps || 0} <small style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Mbps</small></h3>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'rgba(236,72,153,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart3 size={22} color="#ec4899" />
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>DISTRIBUSI MEMBERSHIP</span>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', gap: '8px' }}>
                  <span>Free: <strong>{traffic?.freeUsers}</strong></span> | <span>Pro: <strong>{traffic?.proUsers}</strong></span> | <span>VIP: <strong>{traffic?.ultimateUsers}</strong></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Database & User Management Section */}
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
            <div className="card-title">
              <Users size={18} color="var(--primary)" />
              <span>Database Pengguna & Pengaturan Plan Membership</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                  <th style={{ padding: '12px 16px' }}>USER</th>
                  <th style={{ padding: '12px 16px' }}>ROLE</th>
                  <th style={{ padding: '12px 16px' }}>STATUS LIVE</th>
                  <th style={{ padding: '12px 16px' }}>PLAN MEMBERSHIP (1-CLICK OVERRIDE)</th>
                  <th style={{ padding: '12px 16px' }}>INGEST STREAM KEY</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>AKSI CONTROL</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const isLive = u.destinations?.some((d) => d.status === 'broadcasting');

                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }}>
                      {/* Name & Email */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: u.role === 'admin' ? '#eab308' : 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', color: '#fff' }}>
                            {u.name ? u.name[0].toUpperCase() : 'U'}
                          </div>
                          <div>
                            <span style={{ fontWeight: 700, display: 'block' }}>{u.name || 'No Name'}</span>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{u.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', backgroundColor: u.role === 'admin' ? 'rgba(234,179,8,0.15)' : 'rgba(255,255,255,0.05)', color: u.role === 'admin' ? '#eab308' : 'var(--text-secondary)', textTransform: 'uppercase' }}>
                          {u.role}
                        </span>
                      </td>

                      {/* Live Status */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: isLive ? '#10b981' : 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isLive ? '#10b981' : '#64748b' }}></span>
                          {isLive ? 'LIVE BROADCAST' : 'OFFLINE'}
                        </span>
                      </td>

                      {/* Plan Dropdown Selector */}
                      <td style={{ padding: '14px 16px' }}>
                        <select
                          className="input-text"
                          style={{ padding: '6px 12px', fontSize: '0.82rem', fontWeight: 700, color: u.plan === 'ultimate' ? '#eab308' : u.plan === 'pro' ? '#6366f1' : 'var(--text-primary)' }}
                          value={u.plan}
                          disabled={actionLoadingId === u.id}
                          onChange={(e) => handlePlanChange(u.id, e.target.value)}
                        >
                          <option value="free">⚡ FREE PLAN</option>
                          <option value="pro">💎 PRO MEMBER</option>
                          <option value="ultimate">👑 ULTIMATE VIP</option>
                        </select>
                      </td>

                      {/* Ingest Stream Key */}
                      <td style={{ padding: '14px 16px' }}>
                        <code style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--text-terminal)', background: 'var(--bg-input)', padding: '4px 8px', borderRadius: '6px' }}>
                          {u.ingestKey}
                        </code>
                      </td>

                      {/* Action Buttons */}
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <button
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '6px 10px', borderRadius: '6px', fontSize: '0.78rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => handleResetStreamKey(u.id)}
                          disabled={actionLoadingId === u.id}
                          title="Acak Paksa Stream Key User Ini"
                        >
                          <RotateCw size={12} />
                          <span>Reset Key</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
