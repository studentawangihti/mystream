'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Radio, LogIn, Lock, Mail, AlertCircle, RotateCw, KeyRound, X, CheckCircle, ExternalLink } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot password modal state
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState('');
  const [forgotResetUrl, setForgotResetUrl] = useState('');
  const [forgotErrorMsg, setForgotErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError(res.error);
        setLoading(false);
      } else if (res?.ok) {
        router.push('/');
        router.refresh();
      }
    } catch (err: any) {
      setError('Terjadi kesalahan sistem. Silakan coba lagi.');
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotErrorMsg('');
    setForgotSuccessMsg('');
    setForgotResetUrl('');
    setForgotLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        setForgotErrorMsg(data.error || 'Gagal memproses lupa password.');
      } else {
        setForgotSuccessMsg(data.message);
        if (data.resetUrl) {
          setForgotResetUrl(data.resetUrl);
        }
      }
    } catch (err) {
      setForgotErrorMsg('Terjadi kesalahan koneksi.');
    } finally {
      setForgotLoading(false);
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
              Masuk Ke MyStream Studio
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Broadcast Command Center & Multistreaming Engine
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

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '24px' }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label">Password</label>
              <button
                type="button"
                style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                onClick={() => {
                  setForgotEmail(email);
                  setIsForgotModalOpen(true);
                }}
              >
                Lupa Password?
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="password"
                required
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
            style={{ width: '100%', padding: '14px', marginTop: '8px', fontSize: '0.95rem', borderRadius: '10px', border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            disabled={loading}
          >
            {loading ? (
              <>
                <RotateCw className="spin" size={16} /> Memproses...
              </>
            ) : (
              <>
                <LogIn size={18} /> Masuk Ke Dashboard
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Belum punya akun?{' '}
          <Link href="/register" style={{ color: 'var(--primary)', fontWeight: '700', textDecoration: 'none' }}>
            Daftar Sekarang
          </Link>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="modal-backdrop">
          <div className="plan-modal-card" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KeyRound size={20} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Reset Password Akun</h3>
              </div>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setIsForgotModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {forgotErrorMsg && (
              <div style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)', color: '#fb7185', padding: '12px 16px', borderRadius: '10px', fontSize: '0.85rem', marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} />
                <span>{forgotErrorMsg}</span>
              </div>
            )}

            {forgotSuccessMsg ? (
              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399', padding: '12px 16px', borderRadius: '10px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={16} />
                  <span>{forgotSuccessMsg}</span>
                </div>

                {forgotResetUrl && (
                  <div style={{ background: 'var(--bg-input)', border: '1px dashed var(--primary)', padding: '14px', borderRadius: '10px', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>1-Click Reset Link (Mode Lokal):</span>
                    <a href={forgotResetUrl} style={{ color: 'var(--primary)', textDecoration: 'underline', wordBreak: 'break-all', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span>Buka Halaman Reset Password</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                )}

                <button
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', marginTop: '10px' }}
                  onClick={() => setIsForgotModalOpen(false)}
                >
                  Tutup Modal
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
                <div className="form-group">
                  <label className="form-label">MASUKKAN EMAIL AKUN ANDA</label>
                  <input
                    type="email"
                    required
                    className="input-text"
                    placeholder="nama@email.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }}
                >
                  {forgotLoading ? 'Menerbitkan Link...' : 'Kirim Link Reset Password'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
