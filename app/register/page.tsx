'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Radio, UserPlus, Lock, Mail, User, AlertCircle, CheckCircle, RotateCw } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Gagal mendaftar.');
        setLoading(false);
      } else {
        setSuccess('Registrasi berhasil! Mengalihkan ke halaman login...');
        setTimeout(() => {
          router.push('/login');
        }, 1500);
      }
    } catch (err: any) {
      setError('Terjadi kesalahan koneksi. Silakan coba lagi.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-app)',
      padding: '24px',
    }}>
      <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '36px 32px' }}>
        {/* Header Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
          <div className="logo-icon-wrapper" style={{ width: '48px', height: '48px', borderRadius: '12px' }}>
            <Radio size={28} style={{ color: '#fff' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              Daftar Akun MyStream
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Buat akun untuk mengelola stream key & destinasi platform Anda
            </p>
          </div>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            background: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--danger)',
            fontSize: '0.85rem',
            marginTop: '16px',
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--secondary)',
            fontSize: '0.85rem',
            marginTop: '16px',
          }}>
            <CheckCircle size={18} style={{ flexShrink: 0 }} />
            <span>{success}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '24px' }}>
          <div className="form-group">
            <label className="form-label">Nama Lengkap / Username</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                required
                className="input-text"
                style={{ width: '100%', paddingLeft: '40px' }}
                placeholder="Nama Anda"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email Studio</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="email"
                required
                className="input-text"
                style={{ width: '100%', paddingLeft: '40px' }}
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password (Minimal 6 karakter)</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="password"
                required
                minLength={6}
                className="input-text"
                style={{ width: '100%', paddingLeft: '40px' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '14px', marginTop: '8px', fontSize: '0.95rem' }}
          >
            {loading ? (
              <>
                <RotateCw className="animate-spin" size={16} style={{ animation: 'spin 1.5s linear infinite' }} /> Memproses...
              </>
            ) : (
              <>
                <UserPlus size={18} /> Buat Akun Sekarang
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Sudah punya akun?{' '}
          <Link href="/login" style={{ color: 'var(--primary)', fontWeight: '700', textDecoration: 'none' }}>
            Masuk Di Sini
          </Link>
        </div>
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
