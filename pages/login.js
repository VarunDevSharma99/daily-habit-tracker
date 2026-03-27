import { useState } from 'react';
import Head from 'next/head';

export default function Login() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDigit = (d) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setError('');
    if (next.length === 4) submitPin(next);
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    setError('');
  };

  const submitPin = async (code) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: code }),
      });
      if (res.ok) {
        window.location.href = '/';
      } else {
        setError('Wrong PIN');
        setPin('');
      }
    } catch {
      setError('Network error');
      setPin('');
    }
    setLoading(false);
  };

  return (
    <>
      <Head>
        <title>Life Score</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>\ud83c\udfaf</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Life Score</h1>
        <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 32 }}>Enter your PIN</p>
        <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              width: 16, height: 16, borderRadius: '50%',
              background: i < pin.length ? '#3b82f6' : '#334155',
              transition: 'background 0.15s',
            }} />
          ))}
        </div>
        {error && (
          <div style={{ color: '#ef4444', fontSize: 14, marginBottom: 16, fontWeight: 600 }}>{error}</div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 280, width: '100%' }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((d, i) => {
            if (d === null) return <div key={i} />;
            if (d === 'del') {
              return (
                <button key={i} onClick={handleDelete} disabled={loading} style={{
                  padding: 16, borderRadius: 12, border: 'none',
                  background: 'transparent', color: '#94a3b8', fontSize: 16,
                  cursor: 'pointer', fontWeight: 600,
                }}>\u2190</button>
              );
            }
            return (
              <button key={i} onClick={() => handleDigit(String(d))} disabled={loading} style={{
                padding: 16, borderRadius: 12, border: 'none',
                background: '#1e293b', color: '#f1f5f9', fontSize: 20,
                cursor: 'pointer', fontWeight: 600, transition: 'background 0.15s',
              }}>{d}</button>
            );
          })}
        </div>
      </div>
    </>
  );
}
