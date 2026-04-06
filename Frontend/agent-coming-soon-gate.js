/**
 * Full-page "coming soon" for standalone agent routes (login, register, dashboard, etc.).
 * Loads before page UI so users never hit broken agent flows.
 */
(function () {
  'use strict';
  if (window.__AGENT_GATE_INSTALLED__) return;
  window.__AGENT_GATE_INSTALLED__ = true;

  var css =
    '#agent-cs-gate{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:1.25rem;' +
    'background:rgba(6,16,24,0.94);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);font-family:Inter,system-ui,sans-serif;}' +
    '#agent-cs-gate *{box-sizing:border-box;}' +
    '#agent-cs-gate .cs-card{max-width:24rem;width:100%;background:rgba(10,12,15,0.78);border:1px solid rgba(0,224,122,0.18);' +
    'border-radius:1.25rem;padding:1.75rem 1.5rem;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,0.5);}' +
    '#agent-cs-gate .cs-bars{display:flex;align-items:flex-end;justify-content:center;gap:0.4rem;height:3rem;margin:0 auto 1.25rem;}' +
    '#agent-cs-gate .cs-bar{width:7px;border-radius:4px;background:linear-gradient(180deg,#00e07a,#008f5a);' +
    'animation:agentCsBar 1.05s ease-in-out infinite;transform-origin:bottom center;}' +
    '#agent-cs-gate .cs-bar:nth-child(2){animation-delay:0.12s;}' +
    '#agent-cs-gate .cs-bar:nth-child(3){animation-delay:0.24s;}' +
    '#agent-cs-gate .cs-bar:nth-child(4){animation-delay:0.36s;}' +
    '@keyframes agentCsBar{0%,100%{height:22%;opacity:0.45;}50%{height:100%;opacity:1;}}' +
    '#agent-cs-gate h1{font-size:1.3rem;font-weight:800;color:#e6eef6;margin:0 0 0.5rem;letter-spacing:-0.02em;line-height:1.25;}' +
    '#agent-cs-gate p{color:#94a3b8;font-size:0.9rem;line-height:1.55;margin:0 0 1.25rem;}' +
    '#agent-cs-gate .cs-orbit{width:3.25rem;height:3.25rem;margin:0 auto 0.75rem;border:2px solid rgba(0,224,122,0.2);' +
    'border-top-color:#00e07a;border-radius:50%;animation:agentCsSpin 2s linear infinite;}' +
    '@keyframes agentCsSpin{to{transform:rotate(360deg);}}' +
    '#agent-cs-gate a.cs-btn{display:inline-block;padding:0.7rem 1.35rem;border-radius:0.75rem;font-weight:700;font-size:0.9rem;' +
    'text-decoration:none;background:linear-gradient(90deg,#00e07a,#00c86b);color:#041017;}' +
    '#agent-cs-gate .cs-muted{font-size:0.72rem;color:#64748b;margin-top:1rem;line-height:1.4;}' +
    '#agent-cs-gate .cs-shimmer{background:linear-gradient(90deg,transparent,rgba(0,224,122,0.12),transparent);' +
    'background-size:200% 100%;animation:agentCsShimmer 2.5s ease-in-out infinite;margin-bottom:1rem;height:2px;border-radius:2px;}' +
    '@keyframes agentCsShimmer{0%{background-position:100% 0;}100%{background-position:-100% 0;}}';

  function run() {
    if (document.getElementById('agent-cs-gate')) return;
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
    var el = document.createElement('div');
    el.id = 'agent-cs-gate';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Agent portal coming soon');
    el.innerHTML =
      '<div class="cs-card">' +
      '<div class="cs-shimmer"></div>' +
      '<div class="cs-orbit"></div>' +
      '<div class="cs-bars"><div class="cs-bar"></div><div class="cs-bar"></div><div class="cs-bar"></div><div class="cs-bar"></div></div>' +
      '<h1>Your agent portal is coming</h1>' +
      '<p>Agent portal under construction — stay tuned.<br>' +
      '<strong style="color:#cbd5e1;">Agents launching soon 🚀</strong><br>' +
      'Want to become an agent? Launching soon!</p>' +
      '<a class="cs-btn" href="index.html">← Back to bundle shop</a>' +
      '<div class="cs-muted" title="Launching Q2 2026 — get ready!">Launching Q2 2026 — get ready!</div>' +
      '</div>';
    el.addEventListener('contextmenu', function (e) {
      e.preventDefault();
    });
    document.body.insertBefore(el, document.body.firstChild);
    document.documentElement.style.overflow = 'hidden';
    try {
      document.body.style.overflow = 'hidden';
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
