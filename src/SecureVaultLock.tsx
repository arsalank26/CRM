import React, { useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Lock, ShieldCheck, KeyRound, CheckCircle2, Sparkles, X, Play } from 'lucide-react';
import './SecureVaultLock.css';
import { verifyOwnerPin } from './securityService';

interface SecureVaultLockProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  isUnlocked: boolean;
  onUnlock: () => void;
  onLock: () => void;
}

// Crystalline Web Audio Synthesizer for Neon Mechanical Lock & Magical World Eruption
function playSound(type: 'type' | 'error' | 'keyTurn' | 'magicalBurst') {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (type === 'type') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(950 + Math.random() * 120, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } else if (type === 'error') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'keyTurn') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(640, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.07, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } else if (type === 'magicalBurst') {
      const chord = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
      chord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + 0.1 + idx * 0.07);
        gain.gain.setValueAtTime(0, ctx.currentTime + 0.1 + idx * 0.07);
        gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.12 + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1 + idx * 0.07 + 0.8);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + 0.1 + idx * 0.07);
        osc.stop(ctx.currentTime + 0.1 + idx * 0.07 + 0.85);
      });
    }
  } catch {
    // Ignore audio restrictions
  }
}

interface MagicalParticle {
  id: number;
  icon: string;
  tx: string;
  ty: string;
  scale: string;
  rot: string;
  color: string;
}

interface EruptingDataCard {
  id: number;
  label: string;
  sub: string;
  amount: string;
  tag: string;
  tagColor: string;
  tx: string;
  ty: string;
  rot: string;
}

export function SecureVaultLock({
  children,
  title = 'Confidential Financial & Reports Vault',
  subtitle = 'Enter 6-digit Security PIN',
  isUnlocked,
  onUnlock,
  onLock,
}: SecureVaultLockProps) {
  const [pin, setPin] = useState('');
  const [isError, setIsError] = useState(false);
  const [isPlayingVideoAnimation, setIsPlayingVideoAnimation] = useState(false);
  const [particles, setParticles] = useState<MagicalParticle[]>([]);
  const [dataCards, setDataCards] = useState<EruptingDataCard[]>([]);
  const [showPortalGlow, setShowPortalGlow] = useState(false);
  const [isExpandingToDashboard, setIsExpandingToDashboard] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Focus input automatically on mount
  useEffect(() => {
    if (!isUnlocked && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isUnlocked]);

  // Trigger the Magical Neon Video Animation & Seamless Dashboard Blend
  const triggerMagicalWorldEruption = useCallback(() => {
    setIsPlayingVideoAnimation(true);
    setShowPortalGlow(true);
    playSound('keyTurn');

    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => { });
    }

    // Stage 1: Keyhole Eruption particles + holographic dossier cards bursting outward
    setTimeout(() => {
      playSound('magicalBurst');

      const icons = ['✨', '💎', '📈', '📊', '₹', '🪙', '🧾', '👑', '⚡', '🌟', '💼', '📁', '🟢'];
      const colors = ['#00ff88', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#ffffff', '#fbbf24'];
      const newParticles: MagicalParticle[] = [];

      for (let i = 0; i < 65; i++) {
        const angle = (Math.PI * 2 * i) / 65 + (Math.random() - 0.5) * 0.4;
        const velocity = 200 + Math.random() * 360;
        newParticles.push({
          id: i,
          icon: icons[Math.floor(Math.random() * icons.length)],
          tx: `${Math.cos(angle) * velocity}px`,
          ty: `${Math.sin(angle) * velocity}px`,
          scale: `${0.9 + Math.random() * 1.5}`,
          rot: `${(Math.random() - 0.5) * 1080}deg`,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }

      const sampleBurstCards = [
        { label: 'NEW CUSTOMER', sub: 'Service', amount: 'INR 0', tag: 'NEW', tagColor: '#10b981' },
        { label: 'PAYMENT RECEIVED', sub: 'Recent payment', amount: 'INR 0', tag: 'PAID', tagColor: '#10b981' },
        { label: 'MONTHLY REVENUE', sub: 'Gross income', amount: 'INR 0', tag: 'CURRENT', tagColor: '#10b981' },
        { label: 'NEW INVOICE', sub: 'Service receipt', amount: 'INR 0', tag: 'READY', tagColor: '#10b981' },
        { label: 'CUSTOMER BALANCE', sub: 'Pending amount', amount: 'INR 0', tag: 'OPEN', tagColor: '#f59e0b' },
        { label: 'PROFIT MARGIN', sub: 'Total income', amount: 'INR 0', tag: 'CURRENT', tagColor: '#00ff88' },
      ];

      const newBurstCards: EruptingDataCard[] = sampleBurstCards.map((card, idx) => {
        const angle = -Math.PI / 2 + ((idx - (sampleBurstCards.length - 1) / 2) * 0.5);
        const dist = 200 + Math.random() * 140;
        return {
          id: idx,
          label: card.label,
          sub: card.sub,
          amount: card.amount,
          tag: card.tag,
          tagColor: card.tagColor,
          tx: `${Math.cos(angle) * dist}px`,
          ty: `${Math.sin(angle) * dist}px`,
          rot: `${(Math.random() - 0.5) * 30}deg`,
        };
      });

      setParticles(newParticles);
      setDataCards(newBurstCards);
    }, 600);

    // Stage 2: Seamless Dashboard Morph & Blend into live CRM
    setTimeout(() => {
      setIsExpandingToDashboard(true);
    }, 1800);

    // Stage 3: Complete transition to Unlocked CRM View
    setTimeout(() => {
      setIsPlayingVideoAnimation(false);
      setShowPortalGlow(false);
      setIsExpandingToDashboard(false);
      setParticles([]);
      setDataCards([]);
      onUnlock();
    }, 2400);
  }, [onUnlock]);

  const verifyPin = useCallback((currentPin: string) => {
    if (verifyOwnerPin(currentPin)) {
      triggerMagicalWorldEruption();
    } else {
      setIsError(true);
      playSound('error');
      setTimeout(() => {
        setPin('');
        setIsError(false);
        if (inputRef.current) inputRef.current.focus();
      }, 700);
    }
  }, [triggerMagicalWorldEruption]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isPlayingVideoAnimation) return;
    const clean = e.target.value.replace(/\D/g, '').slice(0, 6);
    playSound('type');
    setPin(clean);
    if (clean.length === 6) {
      verifyPin(clean);
    }
  };

  if (isUnlocked) {
    return (
      <div className="unlocked-vault-wrapper">
        <div className="unlocked-banner">
          <div className="banner-left">
            <span className="live-emerald-dot" />
            <span className="banner-title">
              👑 OWNER MODE ACTIVE • ALL CONFIDENTIAL METRICS UNLOCKED
            </span>
          </div>
          <button
            className="vault-exit-btn"
            onClick={onLock}
            title="Lock back into restricted Employee Mode"
          >
            <Lock size={13} />
            <span>Exit Owner Mode</span>
          </button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className={`secure-vault-container ${isExpandingToDashboard ? 'morphing-to-crm' : ''}`}>
      {/* Expanding Holographic Portal Shockwave */}
      {showPortalGlow && <div className="neon-emerald-shockwave" />}

      {/* Main Glassmorphic Security Card */}
      <div className={`secure-vault-card ${isError ? 'shake' : ''} ${isPlayingVideoAnimation ? 'erupting' : ''}`}>

        {/* Neon Emerald Themed Video & 3D Padlock Container */}
        <div className="padlock-3d-wrapper">

          {/* Custom Theme Color-Shifted Video Animation */}
          <div className="video-animation-container">
            <video
              ref={videoRef}
              src="/lock_animation.mp4"
              playsInline
              muted
              loop={!isPlayingVideoAnimation}
              autoPlay={false}
              className={`neon-emerald-vault-video ${isPlayingVideoAnimation ? 'playing-burst' : 'idle-preview'}`}
            />
            <div className="video-color-filter-overlay" />
          </div>

          {/* Central Laser Beam shooting upward from Keyhole during unlock */}
          {showPortalGlow && <div className="neon-laser-geyser" />}

          {/* Magical Particles Bursting Outward */}
          {particles.length > 0 && (
            <div className="volcano-particle-layer">
              {particles.map((p) => (
                <div
                  key={p.id}
                  className="volcano-particle"
                  style={
                    {
                      '--tx': p.tx,
                      '--ty': p.ty,
                      '--scale': p.scale,
                      '--rot': p.rot,
                      color: p.color,
                      filter: `drop-shadow(0 0 12px ${p.color}) drop-shadow(0 0 24px #00ff88)`,
                    } as React.CSSProperties
                  }
                >
                  {p.icon}
                </div>
              ))}
            </div>
          )}

          {/* Holographic CRM Dossiers & Charts Erupting out */}
          {dataCards.length > 0 && (
            <div className="volcano-particle-layer">
              {dataCards.map((card) => (
                <div
                  key={card.id}
                  className="holographic-data-card"
                  style={
                    {
                      '--tx': card.tx,
                      '--ty': card.ty,
                      '--rot': card.rot,
                    } as React.CSSProperties
                  }
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontWeight: 700 }}>{card.label}</span>
                    <span
                      style={{
                        fontSize: '9px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: card.tagColor,
                        color: '#091811',
                        fontWeight: 800,
                      }}
                    >
                      {card.tag}
                    </span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '3px' }}>
                    {card.sub} • <strong style={{ color: '#00ff88' }}>{card.amount}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Header Titles */}
        <div className="vault-header-text">
          <div className="vault-shield-badge">
            <ShieldCheck size={14} />
            <span>EXECUTIVE OWNER VAULT</span>
          </div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>

        {/* Minimalist 6-Digit Neon PIN Indicator (No Bulky Keypad) */}
        <div className="pin-input-section" onClick={() => inputRef.current?.focus()}>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={pin}
            onChange={handleInputChange}
            className="hidden-pin-input"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            data-form-type="other"
            name="security_vault_pin_field"
            id="security_vault_pin_field"
            autoFocus
          />

          <div className="pin-dots-display">
            {[0, 1, 2, 3, 4, 5].map((idx) => {
              const isFilled = idx < pin.length;
              return (
                <div
                  key={idx}
                  className={`pin-dot ${isFilled ? 'filled' : ''} ${idx === pin.length ? 'current' : ''}`}
                >
                  {isFilled && <span className="pin-dot-glow" />}
                </div>
              );
            })}
          </div>

          <div className="pin-hint">
            <KeyRound size={14} />
            <span>Type 6-digit Owner PIN to trigger lock animation</span>
          </div>
        </div>

      </div>
    </div>
  );
}

// Modal Gate Wrapper for Triggering Owner Mode
export function SecureReportGateModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="secure-modal-overlay">
      <button className="secure-modal-close-btn" onClick={onClose} title="Cancel">
        <X size={22} />
      </button>
      <div className="secure-modal-content">
        <SecureVaultLock
          isUnlocked={false}
          onUnlock={onSuccess}
          onLock={onClose}
          title="Owner Security Gate"
          subtitle="Enter 6-digit PIN"
        >
          <div />
        </SecureVaultLock>
      </div>
    </div>
  );
}
