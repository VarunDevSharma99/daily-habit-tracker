export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { pin } = req.body;
  const correctPin = process.env.AUTH_PIN || '8055';

  if (String(pin) === String(correctPin)) {
    res.setHeader('Set-Cookie', [
      `life_score_auth=authenticated; Path=/; HttpOnly; SameSite=Strict; Max-Age=${30 * 24 * 60 * 60}; ${process.env.NODE_ENV === 'production' ? 'Secure;' : ''}`,
    ]);
    return res.status(200).json({ ok: true });
  }

  return res.status(401).json({ ok: false, error: 'Wrong PIN' });
}
