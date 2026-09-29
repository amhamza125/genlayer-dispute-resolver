"use client";

import dynamic from "next/dynamic";
import type { config } from "@wormhole-foundation/wormhole-connect";

const WormholeConnect = dynamic(
  () =>
    import("@wormhole-foundation/wormhole-connect").then(
      (module) => module.default
    ),
  {
    ssr: false,
    loading: () => (
      <div className="widget-loading" role="status">
        <span className="spinner" />
        <span>Loading the testnet bridge…</span>
      </div>
    ),
  }
);

const rpcOverrides = {
  ...(process.env.NEXT_PUBLIC_SEPOLIA_RPC
    ? { Sepolia: process.env.NEXT_PUBLIC_SEPOLIA_RPC }
    : {}),
  ...(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC
    ? { BaseSepolia: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC }
    : {}),
};

const bridgeConfig = {
  network: "Testnet",
  chains: ["Sepolia", "BaseSepolia"],
  tokens: ["USDC"],
  ...(Object.keys(rpcOverrides).length > 0
    ? { rpcs: rpcOverrides }
    : {}),
  ui: {
    title: "Nexus Testnet Bridge",
    defaultInputs: {
      fromChain: "Sepolia",
      toChain: "BaseSepolia",
      tokenKey: "USDC",
    },
    disableUserInputtedTokens: true,
    showHamburgerMenu: false,
  },
} satisfies config.WormholeConnectConfig;

export default function Page() {
  return (
    <main className="shell">
      <div className="glow glow-a" aria-hidden="true" />
      <div className="glow glow-b" aria-hidden="true" />

      <header className="nav">
        <a className="brand" href="/" aria-label="Nexus home">
          <span className="brand-icon">N</span>
          <span>NEXUS<span className="brand-muted"> / TRANSFER</span></span>
        </a>
        <span className="network-tag">
          <span className="pulse" />
          TESTNET ONLY
        </span>
      </header>

      <section className="hero">
        <div className="eyebrow">
          <span className="eyebrow-rule" />
          CROSS-CHAIN USDC
        </div>
        <h1>Move test USDC<br /><em>across chains.</em></h1>
        <p className="lead">
          Bridge between Ethereum Sepolia and Base Sepolia using the routes
          available for your selected transfer. Connect a wallet, review the
          route and fees, then approve the transaction in your wallet.
        </p>
      </section>

      <section className="bridge-layout" aria-label="Testnet bridge">
        <div className="bridge-heading">
          <div>
            <span className="eyebrow small">TRANSFER DESK</span>
            <h2>Bridge assets</h2>
          </div>
          <div className="pair-tag">
            <span>Sepolia</span>
            <span className="pair-arrow">↔</span>
            <span>Base Sepolia</span>
          </div>
        </div>

        <div className="widget-frame">
          <WormholeConnect config={bridgeConfig} />
        </div>

        <div className="safety-note">
          <span className="note-icon">i</span>
          <p>
            This page is configured for <strong>testnet</strong>. Use test
            tokens only. Before approving, confirm the source, destination,
            token, recipient, route, and fees in the bridge widget and wallet.
          </p>
        </div>
      </section>

      <section className="steps" aria-label="How to test">
        <div className="step">
          <span className="step-number">01</span>
          <div>
            <h3>Connect a wallet</h3>
            <p>Use a wallet with Sepolia test ETH for source-chain gas.</p>
          </div>
        </div>
        <div className="step">
          <span className="step-number">02</span>
          <div>
            <h3>Review the quote</h3>
            <p>Check the displayed route, amount, destination, and fees.</p>
          </div>
        </div>
        <div className="step">
          <span className="step-number">03</span>
          <div>
            <h3>Track completion</h3>
            <p>Use the bridge widget’s transfer status and transaction links.</p>
          </div>
        </div>
      </section>

      <footer className="footer">
        <span>NEXUS · TESTNET BRIDGE</span>
        <span>
          No private keys are collected by this page. Wallet approvals are
          required for transfers.
        </span>
      </footer>

      <style jsx>{`
        :global(*) {
          box-sizing: border-box;
        }

        :global(html) {
          background: #0a0e0d;
        }

        :global(body) {
          margin: 0;
          background: #0a0e0d;
        }

        .shell {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          padding: 0 7vw 36px;
          color: #e9efeb;
          background:
            radial-gradient(ellipse at 48% 0%, rgba(86, 132, 96, 0.14), transparent 42%),
            #0a0e0d;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .glow {
          position: absolute;
          width: 390px;
          height: 390px;
          border-radius: 50%;
          filter: blur(125px);
          opacity: 0.12;
          pointer-events: none;
        }

        .glow-a {
          top: 350px;
          left: -300px;
          background: #8bd39a;
        }

        .glow-b {
          top: 760px;
          right: -320px;
          background: #77a6d7;
        }

        .nav,
        .hero,
        .bridge-layout,
        .steps,
        .footer {
          position: relative;
          z-index: 1;
        }

        .nav {
          height: 78px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #202925;
        }

        .brand {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: #e7eee9;
          text-decoration: none;
          font-size: 12px;
          font-weight: 750;
          letter-spacing: 0.1em;
        }

        .brand-icon {
          width: 29px;
          height: 29px;
          display: grid;
          place-items: center;
          border: 1px solid #698671;
          border-radius: 9px;
          color: #b7d5bd;
          font-family: Georgia, serif;
          font-size: 17px;
          letter-spacing: 0;
        }

        .brand-muted {
          color: #849188;
          font-weight: 500;
        }

        .network-tag {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 11px;
          border: 1px solid #374532;
          border-radius: 99px;
          background: #151d16;
          color: #c9d9be;
          font-size: 9px;
          font-weight: 750;
          letter-spacing: 0.12em;
        }

        .pulse {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #a6d67d;
          box-shadow: 0 0 12px rgba(166, 214, 125, 0.65);
        }

        .hero {
          max-width: 800px;
          padding: 67px 0 45px;
        }

        .eyebrow {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #91a497;
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.16em;
        }

        .eyebrow-rule {
          width: 26px;
          height: 1px;
          background: #9ac2a0;
        }

        .eyebrow.small {
          font-size: 9px;
          color: #819087;
        }

        h1 {
          margin: 19px 0 14px;
          color: #f0f3ef;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(48px, 7vw, 78px);
          font-weight: 400;
          line-height: 0.99;
          letter-spacing: -0.06em;
        }

        h1 em {
          color: #a4cda9;
          font-weight: 400;
        }

        .lead {
          max-width: 570px;
          margin: 0;
          color: #9ba79f;
          font-size: 13px;
          line-height: 1.8;
        }

        .bridge-layout {
          max-width: 960px;
          margin: 0 auto;
        }

        .bridge-heading {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 14px;
        }

        h2 {
          margin: 7px 0 0;
          color: #e8eee9;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 28px;
          font-weight: 400;
          letter-spacing: -0.035em;
        }

        .pair-tag {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border: 1px solid #28342d;
          border-radius: 8px;
          background: rgba(20, 27, 23, 0.78);
          color: #aab8ae;
          font-size: 10px;
        }

        .pair-arrow {
          color: #8fbd97;
          font-size: 15px;
        }

        .widget-frame {
          min-height: 600px;
          padding: 16px;
          overflow: hidden;
          border: 1px solid #28332d;
          border-radius: 15px;
          background: rgba(17, 23, 20, 0.92);
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.24);
        }

        .widget-loading {
          min-height: 540px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: #9aa79e;
          font-size: 12px;
        }

        .spinner {
          width: 17px;
          height: 17px;
          border: 2px solid #304136;
          border-top-color: #a4cda9;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .safety-note {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          margin-top: 13px;
          padding: 13px 15px;
          border: 1px solid #4a412b;
          border-radius: 9px;
          background: rgba(48, 39, 22, 0.42);
        }

        .note-icon {
          width: 17px;
          height: 17px;
          flex: 0 0 17px;
          display: grid;
          place-items: center;
          border: 1px solid #b9a26b;
          border-radius: 50%;
          color: #d7c48c;
          font-family: Georgia, serif;
          font-size: 11px;
          font-style: italic;
        }

        .safety-note p {
          margin: 0;
          color: #b6aa8b;
          font-size: 10px;
          line-height: 1.7;
        }

        .safety-note strong {
          color: #e2d2a7;
        }

        .steps {
          max-width: 960px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin: 33px auto 55px;
        }

        .step {
          display: flex;
          gap: 13px;
          padding: 16px;
          border: 1px solid #252f29;
          border-radius: 10px;
          background: rgba(18, 24, 21, 0.7);
        }

        .step-number {
          color: #91b699;
          font-family: Georgia, serif;
          font-size: 17px;
        }

        h3 {
          margin: 1px 0 6px;
          color: #d8e1da;
          font-size: 11px;
          font-weight: 650;
        }

        .step p {
          margin: 0;
          color: #7f8c82;
          font-size: 10px;
          line-height: 1.6;
        }

        .footer {
          max-width: 960px;
          display: flex;
          justify-content: space-between;
          gap: 16px;
          margin: 0 auto;
          padding-top: 17px;
          border-top: 1px solid #202925;
          color: #68766d;
          font-size: 9px;
          line-height: 1.6;
        }

        .footer span:first-child {
          flex: 0 0 auto;
          color: #89988d;
          font-weight: 750;
          letter-spacing: 0.12em;
        }

        @media (max-width: 700px) {
          .shell {
            padding: 0 17px 26px;
          }

          .nav {
            height: 68px;
          }

          .hero {
            padding: 52px 0 36px;
          }

          .bridge-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .widget-frame {
            min-height: 640px;
            padding: 8px;
          }

          .steps {
            grid-template-columns: 1fr;
            margin-top: 22px;
          }

          .footer {
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}
