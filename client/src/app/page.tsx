'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect, useRef } from 'react';
import {
  Zap, ArrowRight, RefreshCw, Users, Monitor, Play,
  Search, LayoutTemplate, Link2, Cpu
} from 'lucide-react';

// Animated counter hook
function useCounter(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const counted = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !counted.current) {
        counted.current = true;
        const start = 0;
        const increment = end / (duration / 16);
        let current = start;
        const timer = setInterval(() => {
          current += increment;
          if (current >= end) {
            setCount(end);
            clearInterval(timer);
          } else {
            setCount(Math.floor(current));
          }
        }, 16);
      }
    }, { threshold: 0.3 });

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  return { count, ref };
}

export default function LandingPage() {
  const { user } = useAuth();
  const stat1 = useCounter(10000);
  const stat2 = useCounter(5000);
  const stat3 = useCounter(850);

  // Typewriter effect for code mockup
  const [typedCode, setTypedCode] = useState('');
  const fullCode = `function collaborate() {
  const room = createRoom("My App");
  room.invite(["alex", "sarah"]);
  
  room.onEdit((change) => {
    // Real-time CRDT sync ⚡
    broadcast(change);
  });
}`;

  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      if (i <= fullCode.length) {
        setTypedCode(fullCode.slice(0, i));
        i++;
      } else {
        clearInterval(timer);
      }
    }, 35);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="landing">
      <div className="landing-bg" />

      {/* Navigation */}
      <nav className="landing-nav">
        <div className="landing-logo">
          <div className="landing-logo-icon"><Zap size={18} /></div>
          CodeSync
        </div>
        <div className="landing-nav-links">
          {user ? (
            <Link href="/dashboard" className="btn btn-primary">Dashboard</Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-secondary">Log In</Link>
              <Link href="/signup" className="btn btn-primary">Get Started</Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-badge">
          <span className="landing-badge-dot" />
          Real-time Collaboration Powered by CRDTs
        </div>

        <h1 className="landing-title">
          Code Together.<br />
          <span>Build Faster.</span>
        </h1>

        <p className="landing-subtitle">
          The collaborative code editor your team actually wants to use — real-time sync,
          multi-language support, instant code execution, and built-in chat.
        </p>

        <div className="landing-cta">
          <Link href="/signup" className="btn btn-primary btn-lg">
            <ArrowRight size={16} /> Start Coding Now
          </Link>
          <Link href="/login" className="btn btn-secondary btn-lg">
            View Demo
          </Link>
        </div>

        {/* Animated Code Mockup */}
        <div className="code-mockup">
          <div className="code-mockup-header">
            <div className="code-mockup-dot red" />
            <div className="code-mockup-dot yellow" />
            <div className="code-mockup-dot green" />
            <div className="code-mockup-tabs">
              <div className="code-mockup-tab active">app.js</div>
              <div className="code-mockup-tab">style.css</div>
              <div className="code-mockup-tab">index.html</div>
            </div>
          </div>
          <div className="code-mockup-body">
            {typedCode.split('\n').map((line, i) => (
              <div key={i} className="code-line">
                <span className="code-line-number">{i + 1}</span>
                <span>
                  {colorize(line)}
                  {i === typedCode.split('\n').length - 1 && typedCode.length < fullCode.length && (
                    <span className="code-cursor" />
                  )}
                </span>
              </div>
            ))}
            {/* Remote cursor mockup */}
            {typedCode.length >= fullCode.length && (
              <div className="code-line" style={{ marginTop: 4 }}>
                <span className="code-line-number" />
                <span className="code-remote-cursor" data-user="sarah" style={{ marginLeft: 40 }} />
              </div>
            )}
          </div>
        </div>

        {/* Feature highlights */}
        <div className="tech-stack">
          <div className="tech-badge"><Play size={14} /> 10+ Languages</div>
          <div className="tech-badge"><Users size={14} /> Team Collaboration</div>
          <div className="tech-badge"><RefreshCw size={14} /> Real-time Sync</div>
          <div className="tech-badge"><Monitor size={14} /> No Install Needed</div>
          <div className="tech-badge"><Search size={14} /> Smart Search</div>
          <div className="tech-badge"><Cpu size={14} /> Secure Sandbox</div>
        </div>
      </section>

      {/* Stats */}
      <section style={{ maxWidth: 600, margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 1 }}>
        <div className="stats-bar" ref={stat1.ref}>
          <div className="stat-item">
            <div className="stat-number">{stat1.count.toLocaleString()}+</div>
            <div className="stat-label">Lines Written</div>
          </div>
          <div className="stat-item" ref={stat2.ref}>
            <div className="stat-number">{stat2.count.toLocaleString()}+</div>
            <div className="stat-label">Files Created</div>
          </div>
          <div className="stat-item" ref={stat3.ref}>
            <div className="stat-number">{stat3.count.toLocaleString()}+</div>
            <div className="stat-label">Rooms Active</div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="landing-features">
        <h2 className="landing-features-title">
          Everything You Need to <span style={{
            background: 'var(--accent-gradient)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>Collaborate</span>
        </h2>

        <div className="landing-features-grid stagger-in">
          <div className="feature-card">
            <div className="feature-icon"><RefreshCw size={24} /></div>
            <h3>Seamless Real-time Editing</h3>
            <p>
              Everyone types at once — no lag, no conflicts. Changes appear
              instantly across all connected editors.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon"><Users size={24} /></div>
            <h3>Multi-Cursor Presence</h3>
            <p>
              See everyone&apos;s cursors and selections in real-time with
              color-coded indicators and name labels.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon"><Monitor size={24} /></div>
            <h3>Live Preview</h3>
            <p>
              Instant split-pane preview for HTML/CSS/JS projects.
              See changes in real-time as you type.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon"><Play size={24} /></div>
            <h3>Run Code Instantly</h3>
            <p>
              Execute code in a secure sandbox — JavaScript, Python,
              C++, Java, Go, Rust, and more. Results appear in seconds.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon"><Search size={24} /></div>
            <h3>Quick Search &amp; Commands</h3>
            <p>
              Find any file or action instantly with the search palette.
              Navigate large projects without losing your flow.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon"><LayoutTemplate size={24} /></div>
            <h3>Project Templates</h3>
            <p>
              Start from pre-built templates — Web Apps, Algorithm Practice,
              Python Data Science, and more.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="how-it-works">
        <h2 className="how-it-works-title">
          How It <span style={{
            background: 'var(--accent-gradient)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>Works</span>
        </h2>
        <div className="steps-grid">
          <div className="step-item">
            <div className="step-number">1</div>
            <h3>Create a Room</h3>
            <p>Pick a template or start blank. Choose your language and name your workspace.</p>
          </div>
          <div className="step-item">
            <div className="step-number">2</div>
            <h3>Share the Link</h3>
            <p>Invite collaborators with a single link. No downloads, no installs — just open and code.</p>
          </div>
          <div className="step-item">
            <div className="step-number">3</div>
            <h3>Code Together</h3>
            <p>Edit in real-time with multi-cursor presence, chat, and instant code execution.</p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="landing-section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="section-label">PRICING</div>
        <h2 className="section-title">Choose Your <span>Plan</span></h2>
        <p className="section-subtitle">Start free, upgrade when you need more power.</p>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 24, maxWidth: 960, margin: '0 auto', padding: '0 20px'
        }}>
          {/* Free Tier */}
          <div style={{
            background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 12,
            padding: 32, display: 'flex', flexDirection: 'column'
          }}>
            <h3 style={{ fontSize: 20, marginBottom: 8 }}>Free</h3>
            <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 4 }}>
              $0<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)' }}>/month</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
              Perfect for personal projects
            </p>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {['Up to 3 rooms', '2 collaborators per room', '5 languages', 'Live preview', 'Basic chat'].map((f, i) => (
                <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#22c55e', fontSize: 14 }}>✓</span> {f}
                </div>
              ))}
            </div>
            <Link href="/signup" className="btn btn-secondary" style={{ textDecoration: 'none', textAlign: 'center', width: '100%' }}>
              Get Started
            </Link>
          </div>

          {/* Pro Tier */}
          <div style={{
            background: 'var(--bg-glass)', border: '2px solid var(--accent)', borderRadius: 12,
            padding: 32, display: 'flex', flexDirection: 'column', position: 'relative'
          }}>
            <div style={{
              position: 'absolute', top: -12, right: 20, background: 'var(--accent)',
              padding: '4px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600
            }}>
              MOST POPULAR
            </div>
            <h3 style={{ fontSize: 20, marginBottom: 8 }}>Pro</h3>
            <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 4 }}>
              $12<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)' }}>/month</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
              For power users &amp; small teams
            </p>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {['Unlimited rooms', '10 collaborators per room', 'All 8+ languages', 'Custom themes', 'Priority support', 'File export (ZIP)', 'Room forking'].map((f, i) => (
                <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--accent)', fontSize: 14 }}>✓</span> {f}
                </div>
              ))}
            </div>
            <Link href="/signup" className="btn btn-primary" style={{ textDecoration: 'none', textAlign: 'center', width: '100%' }}>
              Start Free Trial
            </Link>
          </div>

          {/* Team Tier */}
          <div style={{
            background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 12,
            padding: 32, display: 'flex', flexDirection: 'column'
          }}>
            <h3 style={{ fontSize: 20, marginBottom: 8 }}>Team</h3>
            <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 4 }}>
              $29<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)' }}>/month</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
              For organizations &amp; large teams
            </p>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {['Everything in Pro', '50 collaborators per room', 'Admin dashboard', 'SSO / SAML', 'Audit logs', 'Custom branding', 'Dedicated support'].map((f, i) => (
                <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#a855f7', fontSize: 14 }}>✓</span> {f}
                </div>
              ))}
            </div>
            <Link href="/signup" className="btn btn-secondary" style={{ textDecoration: 'none', textAlign: 'center', width: '100%' }}>
              Contact Sales
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-links">
          <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href="#">Documentation</a>
          <a href="#">Status</a>
          <a href="#">Privacy</a>
        </div>
        <p>Built by Kratik Jain — © 2026 CodeSync</p>
      </footer>
    </div>
  );
}

// Simple syntax colorizer for the mockup
function colorize(line: string): React.ReactElement {
  const keywords = ['function', 'const', 'return', 'if', 'else', 'for', 'while'];
  const parts: React.ReactElement[] = [];

  // Handle comments
  if (line.trim().startsWith('//')) {
    return <span className="code-comment">{line}</span>;
  }

  let remaining = line;
  let key = 0;

  // Very simple tokenizer
  while (remaining.length > 0) {
    // Check for strings
    const strMatch = remaining.match(/^("[^"]*"|'[^']*')/);
    if (strMatch) {
      parts.push(<span key={key++} className="code-string">{strMatch[0]}</span>);
      remaining = remaining.slice(strMatch[0].length);
      continue;
    }

    // Check for keywords
    const kwMatch = remaining.match(new RegExp(`^(${keywords.join('|')})\\b`));
    if (kwMatch) {
      parts.push(<span key={key++} className="code-keyword">{kwMatch[0]}</span>);
      remaining = remaining.slice(kwMatch[0].length);
      continue;
    }

    // Check for function calls
    const fnMatch = remaining.match(/^(\w+)\(/);
    if (fnMatch) {
      parts.push(<span key={key++} className="code-function">{fnMatch[1]}</span>);
      remaining = remaining.slice(fnMatch[1].length);
      continue;
    }

    // Check for brackets/parens
    const bracketMatch = remaining.match(/^[{}()\[\];,]/);
    if (bracketMatch) {
      parts.push(<span key={key++} className="code-bracket">{bracketMatch[0]}</span>);
      remaining = remaining.slice(1);
      continue;
    }

    // Check for operators
    const opMatch = remaining.match(/^(=>|===|!==|&&|\|\||[+\-*/=<>!])/);
    if (opMatch) {
      parts.push(<span key={key++} className="code-operator">{opMatch[0]}</span>);
      remaining = remaining.slice(opMatch[0].length);
      continue;
    }

    // Default: take one char
    parts.push(<span key={key++}>{remaining[0]}</span>);
    remaining = remaining.slice(1);
  }

  return <>{parts}</>;
}
