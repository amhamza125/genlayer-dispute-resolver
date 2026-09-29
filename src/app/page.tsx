"use client";

import { useCallback, useState } from "react";
import { createClient } from "genlayer-js";

type Eip1193Provider = {
  request: (args: {
    method: string;
    params?: unknown[];
  }) => Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

type Dispute = {
  party_a: string;
  party_b: string;
  question: string;
  governing_terms: string;
  claim_a: string;
  claim_b: string;
  evidence_url_a: string;
  evidence_url_b: string;
  stake_a: string | number;
  stake_b: string | number;
  deadline: string | number;
  status: string;
  winner: string;
  ruling_explanation: string;
};

const genlayerStudio = {
  id: 61999,
  name: "GenLayer Studio",
  network: "local",
  nativeCurrency: {
    decimals: 18,
    name: "GEN",
    symbol: "GEN",
  },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
    public: { http: ["http://127.0.0.1:8545"] },
  },
};

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_DISPUTE_CONTRACT_ADDRESS || "0x3e669262db812047a4c05da184e7942150969c51";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function shortAddress(value: string) {
  if (!value || value.length < 12) return value || "—";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function genToWei(value: string): bigint {
  const trimmed = value.trim();

  if (!/^\d+(\.\d{1,18})?$/.test(trimmed)) {
    throw new Error("Enter a valid GEN amount with up to 18 decimal places.");
  }

  const [whole, fraction = ""] = trimmed.split(".");
  const wei =
    BigInt(whole) * 10n ** 18n +
    BigInt((fraction + "0".repeat(18)).slice(0, 18));

  if (wei <= 0n) {
    throw new Error("Stake must be greater than zero.");
  }

  return wei;
}

function formatGen(weiValue: string | number) {
  try {
    const wei = BigInt(String(weiValue));
    const whole = wei / 10n ** 18n;
    const fraction = (wei % 10n ** 18n)
      .toString()
      .padStart(18, "0")
      .slice(0, 5)
      .replace(/0+$/, "");

    return fraction ? `${whole}.${fraction}` : whole.toString();
  } catch {
    return String(weiValue);
  }
}

function formatDate(timestamp: string | number) {
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";

  return new Date(seconds * 1000).toLocaleString();
}

function getReadClient() {
  return createClient({ chain: genlayerStudio });
}

function getWriteClient(account: string) {
  if (!window.ethereum) {
    throw new Error("No browser wallet found. Install or enable MetaMask.");
  }

  return createClient({
    chain: genlayerStudio,
    account: account as `0x${string}`,
    provider: window.ethereum as any,
  });
}

export default function Page() {
  const [wallet, setWallet] = useState("");
  const [disputeId, setDisputeId] = useState("");
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [withdrawable, setWithdrawable] = useState("—");

  const [counterparty, setCounterparty] = useState("");
  const [question, setQuestion] = useState("");
  const [terms, setTerms] = useState("");
  const [claimA, setClaimA] = useState("");
  const [evidenceA, setEvidenceA] = useState("");
  const [stakeGen, setStakeGen] = useState("0.01");

  const [claimB, setClaimB] = useState("");
  const [evidenceB, setEvidenceB] = useState("");

  const [busy, setBusy] = useState("");
  const [loadingDispute, setLoadingDispute] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [lastTx, setLastTx] = useState("");

  const contractIsConfigured =
    /^0x[a-fA-F0-9]{40}$/.test(CONTRACT_ADDRESS);

  const connectWallet = useCallback(async () => {
    setError("");
    setNotice("");

    try {
      if (!window.ethereum) {
        throw new Error("No browser wallet found. Install or enable MetaMask.");
      }

      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0xf22f" }], 
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0xf22f",
                chainName: "GenLayer Studio",
                nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
                rpcUrls: ["http://127.0.0.1:8545"],
              },
            ],
          });
        } else {
          throw switchError;
        }
      }

      const result = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      const account = result?.[0];
      if (!account) throw new Error("Wallet did not return an account.");

      const client = getWriteClient(account);
      await client.connect("local" as any);

      setWallet(account);
      setNotice("Wallet connected to GenLayer Studio Local Chain.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const writeContract = useCallback(
    async (functionName: string, args: unknown[], value = 0n) => {
      if (!contractIsConfigured) {
        throw new Error(
          "Set NEXT_PUBLIC_DISPUTE_CONTRACT_ADDRESS to your deployed contract address."
        );
      }
      if (!wallet) {
        throw new Error("Connect your wallet before submitting a transaction.");
      }

      const client = getWriteClient(wallet);
      await client.connect("local" as any);

      const call = {
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName,
        args: args as any[],
        value,
      };

      const estimate = await client.estimateTransactionFeesForWrite(
        call as any
      );

      return client.writeContract({
        ...call,
        fees: {
          distribution: estimate.distribution,
          feeValue: estimate.feeValue,
        },
      } as any);
    },
    [contractIsConfigured, wallet]
  );

  const runWrite = useCallback(
    async (
      label: string,
      functionName: string,
      args: unknown[],
      value = 0n
    ) => {
      setError("");
      setNotice("");
      setBusy(label);

      try {
        const txId = await writeContract(functionName, args, value);
        const tx = String(txId);
        setLastTx(tx);
        setNotice(`${label} submitted. Wait for the transaction to complete.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy("");
      }
    },
    [writeContract]
  );

  const loadDispute = useCallback(async () => {
    setError("");
    setNotice("");

    if (!contractIsConfigured) {
      setError("Set NEXT_PUBLIC_DISPUTE_CONTRACT_ADDRESS first.");
      return;
    }

    const id = Number(disputeId);
    if (!Number.isSafeInteger(id) || id < 0) {
      setError("Enter a valid non-negative dispute ID.");
      return;
    }

    setLoadingDispute(true);

    try {
      const client = getReadClient();
      const result = await client.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: "get_dispute",
        args: [id],
      });

      const parsed =
        typeof result === "string"
          ? (JSON.parse(result) as Dispute)
          : (result as unknown as Dispute);

      setDispute(parsed);
      setNotice(`Loaded dispute #${id}.`);
    } catch (err) {
      setDispute(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingDispute(false);
    }
  }, [contractIsConfigured, disputeId]);

  const loadWithdrawable = useCallback(async () => {
    setError("");
    setNotice("");

    if (!contractIsConfigured) {
      setError("Set NEXT_PUBLIC_DISPUTE_CONTRACT_ADDRESS first.");
      return;
    }
    if (!wallet) {
      setError("Connect your wallet to check its withdrawable balance.");
      return;
    }

    setLoadingBalance(true);

    try {
      const client = getReadClient();
      const result = await client.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: "get_withdrawable_balance",
        args: [wallet],
      });

      setWithdrawable(formatGen(String(result)));
      setNotice("Withdrawable balance refreshed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingBalance(false);
    }
  }, [contractIsConfigured, wallet]);

  const openDispute = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const stakeWei = genToWei(stakeGen);
      await runWrite(
        "Opening dispute",
        "open_dispute",
        [counterparty.trim(), question.trim(), terms.trim(), claimA.trim(), evidenceA.trim()],
        stakeWei
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const respondToDispute = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!dispute) {
      setError("Load a dispute before responding.");
      return;
    }

    await runWrite(
      "Submitting response",
      "respond_dispute",
      [Number(disputeId), claimB.trim(), evidenceB.trim()],
      BigInt(String(dispute.stake_a))
    );
  };

  const canResolve = dispute?.status === "AWAITING_RESOLUTION";
  const canRespond = dispute?.status === "AWAITING_RESPONSE";
  const isAwaitingResponse = dispute?.status === "AWAITING_RESPONSE";

  return (
    <main className="page-shell">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />

      <header className="topbar">
        <a className="brand" href="#" aria-label="Dispute Resolver home">
          <span className="brand-mark">D</span>
          <span>Dispute<span className="brand-light">Resolver</span></span>
        </a>
        <div className="topbar-right">
          <span className="network-pill">
            <span className="live-dot" />
            GenLayer · Studio Local
          </span>
          <button className="wallet-button" onClick={connectWallet}>
            {wallet ? shortAddress(wallet) : "Connect wallet"}
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="eyebrow">
          <span className="eyebrow-line" />
          ON-CHAIN ARBITRATION
        </div>
        <h1>Resolve disputes.<br /><em>On the record.</em></h1>
        <p className="hero-copy">
          Frame the terms, submit evidence, and let GenLayer validators reach
          an outcome. Stakes stay in the contract until they can be claimed.
        </p>
        {!contractIsConfigured && (
          <div className="config-warning">
            Add <code>NEXT_PUBLIC_DISPUTE_CONTRACT_ADDRESS</code> in your
            environment before interacting with a deployed contract.
          </div>
        )}
      </section>

      {(error || notice) && (
        <section
          className={`toast ${error ? "toast-error" : "toast-success"}`}
          role={error ? "alert" : "status"}
        >
          <span>{error ? "!" : "✓"}</span>
          <div>{error || notice}</div>
          <button
            className="toast-close"
            aria-label="Dismiss notification"
            onClick={() => {
              setError("");
              setNotice("");
            }}
          >
            ×
          </button>
        </section>
      )}

      <section className="workspace">
        <div className="section-heading">
          <div>
            <span className="section-kicker">01 / NEW CASE</span>
            <h2>Open a dispute</h2>
          </div>
          <p>Party A stakes GEN to start. Party B must match the stake.</p>
        </div>

        <form className="panel form-panel" onSubmit={openDispute}>
          <div className="field-grid">
            <label className="field">
              <span>Counterparty wallet</span>
              <input
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder="0x…"
                required
                spellCheck={false}
                autoComplete="off"
              />
            </label>
            <label className="field">
              <span>Your stake <small>GEN</small></span>
              <input
                value={stakeGen}
                onChange={(e) => setStakeGen(e.target.value)}
                inputMode="decimal"
                placeholder="0.01"
                required
              />
            </label>
          </div>

          <label className="field">
            <span>Dispute proposition</span>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What specific question should the arbitrators decide?"
              required
            />
          </label>

          <label className="field">
            <span>Governing terms</span>
            <textarea
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="State the rules or agreement the decision should follow."
              rows={3}
              required
            />
          </label>

          <div className="field-grid">
            <label className="field">
              <span>Party A claim</span>
              <textarea
                value={claimA}
                onChange={(e) => setClaimA(e.target.value)}
                placeholder="Explain your position."
                rows={4}
                required
              />
            </label>
            <label className="field">
              <span>Party A evidence URL</span>
              <textarea
                value={evidenceA}
                onChange={(e) => setEvidenceA(e.target.value)}
                placeholder="https://…"
                rows={4}
                required
              />
            </label>
          </div>

          <div className="form-footer">
            <p>Submission sends your stake plus the network transaction fee.</p>
            <button
              className="primary-button"
              type="submit"
              disabled={Boolean(busy) || !contractIsConfigured}
            >
              {busy === "Opening dispute" ? "Submitting…" : "Open dispute"}
              <span aria-hidden="true">↗</span>
            </button>
          </div>
        </form>
      </section>

      <section className="workspace">
        <div className="section-heading">
          <div>
            <span className="section-kicker">02 / CASE DESK</span>
            <h2>Manage a dispute</h2>
          </div>
          <p>Load an existing case by its on-chain ID.</p>
        </div>

        <div className="panel lookup-panel">
          <div className="lookup-row">
            <label className="field lookup-field">
              <span>Dispute ID</span>
              <input
                value={disputeId}
                onChange={(e) => setDisputeId(e.target.value)}
                placeholder="e.g. 0"
                inputMode="numeric"
              />
            </label>
            <button
              className="secondary-button lookup-button"
              onClick={loadDispute}
              disabled={loadingDispute || !contractIsConfigured}
            >
              {loadingDispute ? "Loading…" : "Load case"}
              <span aria-hidden="true">→</span>
            </button>
          </div>

          {dispute && (
            <div className="case-content">
              <div className="case-topline">
                <div>
                  <span className="case-id">CASE #{disputeId}</span>
                  <h3>{dispute.question}</h3>
                </div>
                <span className={`status-badge status-${dispute.status.toLowerCase()}`}>
                  <span className="status-dot" />
                  {dispute.status.replaceAll("_", " ")}
                </span>
              </div>

              <div className="case-stats">
                <div className="stat">
                  <span>Party A</span>
                  <strong title={dispute.party_a}>{shortAddress(dispute.party_a)}</strong>
                </div>
                <div className="stat">
                  <span>Party B</span>
                  <strong title={dispute.party_b}>{shortAddress(dispute.party_b)}</strong>
                </div>
                <div className="stat">
                  <span>Party A stake</span>
                  <strong>{formatGen(dispute.stake_a)} <small>GEN</small></strong>
                </div>
                <div className="stat">
                  <span>Party B stake</span>
                  <strong>{formatGen(dispute.stake_b)} <small>GEN</small></strong>
                </div>
                <div className="stat stat-wide">
                  <span>Response deadline</span>
                  <strong>{formatDate(dispute.deadline)}</strong>
                </div>
              </div>

              <div className="terms-box">
                <span className="mini-label">GOVERNING TERMS</span>
                <p>{dispute.governing_terms}</p>
              </div>

              <div className="claims-grid">
                <article className="claim-card">
                  <span className="mini-label">PARTY A CLAIM</span>
                  <p>{dispute.claim_a}</p>
                  {dispute.evidence_url_a && (
                    <a href={dispute.evidence_url_a} target="_blank" rel="noreferrer">
                      View A evidence ↗
                    </a>
                  )}
                </article>
                <article className="claim-card">
                  <span className="mini-label">PARTY B CLAIM</span>
                  <p>{dispute.claim_b || "No response submitted yet."}</p>
                  {dispute.evidence_url_b && (
                    <a href={dispute.evidence_url_b} target="_blank" rel="noreferrer">
                      View B evidence ↗
                    </a>
                  )}
                </article>
              </div>

              {dispute.winner &&
                dispute.winner.toLowerCase() !== ZERO_ADDRESS.toLowerCase() && (
                  <div className="ruling-box">
                    <span className="mini-label">WINNER</span>
                    <strong>{shortAddress(dispute.winner)}</strong>
                  </div>
                )}

              {dispute.ruling_explanation && (
                <div className="ruling-box">
                  <span className="mini-label">RULING NOTE</span>
                  <p>{dispute.ruling_explanation}</p>
                </div>
              )}

              <div className="actions-area">
                {canRespond && (
                  <form
                    className="action-card response-card"
                    onSubmit={respondToDispute}
                  >
                    <div>
                      <span className="mini-label">PARTY B RESPONSE</span>
                      <h4>Submit your claim and matching stake</h4>
                      <p>
                        The response sends exactly {formatGen(dispute.stake_a)} GEN
                        as the matching stake, plus the network fee.
                      </p>
                    </div>
                    <label className="field">
                      <span>Party B claim</span>
                      <textarea
                        value={claimB}
                        onChange={(e) => setClaimB(e.target.value)}
                        placeholder="Explain your position."
                        rows={3}
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Party B evidence URL</span>
                      <input
                        value={evidenceB}
                        onChange={(e) => setEvidenceB(e.target.value)}
                        placeholder="https://…"
                        required
                      />
                    </label>
                    <button
                      className="primary-button"
                      type="submit"
                      disabled={Boolean(busy)}
                    >
                      {busy === "Submitting response" ? "Submitting…" : "Submit response"}
                      <span aria-hidden="true">↗</span>
                    </button>
                  </form>
                )}

                <div className="action-buttons">
                  {isAwaitingResponse && (
                    <button
                      className="secondary-button"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        runWrite("Claiming non-response", "claim_non_response", [
                          Number(disputeId),
                        ])
                      }
                    >
                      Claim non-response
                    </button>
                  )}

                  {canResolve && (
                    <button
                      className="primary-button"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        runWrite("Resolving dispute", "resolve_dispute", [
                          Number(disputeId),
                        ])
                      }
                    >
                      {busy === "Resolving dispute" ? "Submitting…" : "Resolve dispute"}
                      <span aria-hidden="true">↗</span>
                    </button>
                  )}

                  {canResolve && (
                    <button
                      className="secondary-button"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        runWrite("Requesting stuck-dispute refund", "refund_stuck_dispute", [
                          Number(disputeId),
                        ])
                      }
                    >
                      Refund stuck dispute
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="workspace wallet-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">03 / FUNDS</span>
            <h2>Your withdrawable balance</h2>
          </div>
          <p>Withdrawable funds are credited by the contract after a case outcome.</p>
        </div>

        <div className="panel balance-panel">
          <div>
            <span className="mini-label">AVAILABLE TO WITHDRAW</span>
            <div className="balance-number">{withdrawable} <small>GEN</small></div>
            <p>Connected wallet: {wallet ? shortAddress(wallet) : "Not connected"}</p>
          </div>
          <div className="balance-actions">
            <button
              className="secondary-button"
              onClick={loadWithdrawable}
              disabled={loadingBalance || !wallet || !contractIsConfigured}
            >
              {loadingBalance ? "Checking…" : "Refresh balance"}
            </button>
            <button
              className="primary-button"
              onClick={() => runWrite("Withdrawing funds", "withdraw", [])}
              disabled={Boolean(busy) || !wallet || !contractIsConfigured}
            >
              {busy === "Withdrawing funds" ? "Submitting…" : "Withdraw"}
              <span aria-hidden="true">↗</span>
            </button>
          </div>
        </div>
      </section>

      {lastTx && (
        <section className="tx-note" role="status">
          <span className="live-dot" />
          <div>
            <strong>Latest transaction submitted</strong>
            <code>{lastTx}</code>
          </div>
        </section>
      )}

      <footer className="footer">
        <span>DISPUTE RESOLVER · LOCAL UI</span>
        <span>Review contract state and transaction status before relying on an outcome.</span>
      </footer>

      <style jsx>{`
        :global(*) { box-sizing: border-box; }
        :global(html) { background: #0c1010; }
        :global(body) { margin: 0; background: #0c1010; }
        :global(button), :global(input), :global(textarea) { font: inherit; }

        .page-shell {
          min-height: 100vh;
          overflow: hidden;
          position: relative;
          padding: 0 7.1vw 42px;
          color: #e8eee9;
          background:
            radial-gradient(ellipse at 50% -20%, rgba(72, 112, 81, .15), transparent 54%),
            #0c1010;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .ambient {
          position: absolute;
          width: 420px;
          height: 420px;
          border-radius: 50%;
          filter: blur(120px);
          opacity: .11;
          pointer-events: none;
        }
        .ambient-one { top: 200px; left: -340px; background: #91d49d; }
        .ambient-two { top: 730px; right: -360px; background: #dca46a; }
        .topbar, .hero, .workspace, .footer, .tx-note, .toast {
          position: relative;
          z-index: 1;
        }
        .topbar {
          height: 82px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #222a26;
        }
        .brand {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: #eef3ef;
          text-decoration: none;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: -.03em;
        }
        .brand-light { color: #8a978e; font-weight: 500; }
        .brand-mark {
          width: 28px; height: 28px;
          display: grid; place-items: center;
          border: 1px solid #78947e;
          border-radius: 9px;
          color: #b3d7b9;
          font-family: Georgia, serif;
          font-size: 17px;
        }
        .topbar-right { display: flex; align-items: center; gap: 14px; }
        .network-pill {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 11px;
          border: 1px solid #28332c;
          border-radius: 999px;
          color: #aebbb1;
          font-size: 11px;
        }
        .live-dot {
          width: 7px; height: 7px; display: inline-block;
          border-radius: 50%; background: #8fda9b;
          box-shadow: 0 0 11px rgba(143, 218, 155, .65);
        }
        button { cursor: pointer; }
        button:disabled { cursor: not-allowed; opacity: .48; }
        .wallet-button, .secondary-button, .primary-button {
          min-height: 42px;
          border-radius: 8px;
          padding: 0 16px;
          font-size: 12px;
          font-weight: 650;
          transition: transform .16s ease, background .16s ease, border-color .16s ease;
        }
        .wallet-button:hover, .secondary-button:hover, .primary-button:hover {
          transform: translateY(-1px);
        }
        .wallet-button {
          color: #cce8d0; background: #17221a;
          border: 1px solid #34493a;
        }
        .hero { max-width: 810px; padding: 76px 0 64px; }
        .eyebrow, .section-kicker, .mini-label, .case-id {
          color: #8fa694;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .15em;
        }
        .eyebrow { display: flex; align-items: center; gap: 10px; }
        .eyebrow-line { width: 25px; height: 1px; background: #92c69b; }
        h1 {
          margin: 22px 0 15px;
          color: #eef2ee;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(48px, 7.2vw, 86px);
          font-weight: 400;
          letter-spacing: -.065em;
          line-height: .98;
        }
        h1 em { color: #9fc6a4; font-weight: 400; }
        .hero-copy {
          max-width: 520px;
          margin: 0;
          color: #9ba79e;
          font-size: 14px;
          line-height: 1.8;
        }
        .config-warning {
          display: inline-block;
          margin-top: 22px;
          padding: 11px 14px;
          border: 1px solid #493e2b;
          border-radius: 8px;
          background: rgba(67, 51, 30, .26);
          color: #d2b987;
          font-size: 12px;
          line-height: 1.6;
        }
        code {
          color: #c8d8cc;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          overflow-wrap: anywhere;
        }
        .toast {
          display: flex; align-items: flex-start; gap: 12px;
          max-width: 900px; margin: -30px 0 36px; padding: 13px 15px;
          border-radius: 9px; font-size: 12px; line-height: 1.6;
        }
        .toast > span { font-weight: 800; }
        .toast-success { color: #c6e5cb; background: #14241a; border: 1px solid #2d4933; }
        .toast-error { color: #f0b8a8; background: #2a1917; border: 1px solid #59362f; }
        .toast-close { margin-left: auto; border: 0; color: inherit; background: transparent; font-size: 20px; line-height: 1; }
        .workspace { max-width: 1050px; margin: 0 auto 66px; }
        .section-heading {
          display: flex; justify-content: space-between; align-items: end;
          gap: 24px; margin-bottom: 17px;
        }
        .section-kicker { display: block; margin-bottom: 9px; color: #79877d; }
        h2 {
          margin: 0; color: #e9eee9;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 30px; font-weight: 400; letter-spacing: -.035em;
        }
        .section-heading > p {
          max-width: 300px; margin: 0 0 3px; color: #78847b;
          font-size: 11px; line-height: 1.6; text-align: right;
        }
        .panel {
          border: 1px solid #28312c;
          border-radius: 12px;
          background: linear-gradient(145deg, rgba(23, 30, 26, .96), rgba(17, 22, 20, .96));
          box-shadow: 0 18px 60px rgba(0, 0, 0, .12);
        }
        .form-panel { padding: 25px; }
        .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        .field { display: flex; flex-direction: column; gap: 8px; margin-bottom: 17px; }
        .field > span {
          color: #b2beb4; font-size: 11px; font-weight: 650;
        }
        .field small { margin-left: 5px; color: #77877b; font-size: 9px; letter-spacing: .08em; }
        input, textarea {
          width: 100%;
          border: 1px solid #303a33;
          border-radius: 7px;
          outline: none;
          background: #111715;
          color: #e5ece6;
          padding: 12px 13px;
          font-size: 12px;
          line-height: 1.6;
          transition: border-color .15s ease, box-shadow .15s ease;
        }
        input:focus, textarea:focus {
          border-color: #76987b;
          box-shadow: 0 0 0 3px rgba(118, 152, 123, .1);
        }
        input::placeholder, textarea::placeholder { color: #59655d; }
        textarea { resize: vertical; min-height: 76px; }
        .form-footer {
          display: flex; justify-content: space-between; align-items: center;
          gap: 18px; padding-top: 2px;
        }
        .form-footer p { margin: 0; color: #738077; font-size: 10px; line-height: 1.6; }
        .primary-button {
          display: inline-flex; align-items: center; justify-content: center; gap: 18px;
          flex-shrink: 0; color: #112016; background: #a3cba8; border: 1px solid #a3cba8;
        }
        .primary-button:hover { background: #b5d9b9; border-color: #b5d9b9; }
        .primary-button span { font-size: 15px; }
        .secondary-button {
          display: inline-flex; align-items: center; justify-content: center; gap: 14px;
          color: #c4d0c7; background: #1b231e; border: 1px solid #354239;
        }
        .secondary-button:hover { background: #222e26; border-color: #536d58; }
        .lookup-panel { padding: 22px 25px; }
        .lookup-row { display: flex; align-items: end; gap: 12px; }
        .lookup-field { width: min(100%, 350px); margin: 0; }
        .lookup-button { min-width: 125px; }
        .case-content { margin-top: 25px; padding-top: 25px; border-top: 1px solid #29332c; }
        .case-topline { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
        .case-id { color: #7f9184; font-size: 9px; }
        h3 {
          max-width: 720px; margin: 9px 0 0;
          color: #e6ece7; font-family: Georgia, "Times New Roman", serif;
          font-size: 23px; font-weight: 400; line-height: 1.35;
        }
        .status-badge {
          display: inline-flex; align-items: center; gap: 7px;
          flex-shrink: 0; padding: 7px 10px; border: 1px solid #39473d;
          border-radius: 99px; color: #b8c9bb; background: #1a241d;
          font-size: 9px; font-weight: 700; letter-spacing: .08em;
        }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; background: #a5c9a9; }
        .status-resolved, .status-default_a { color: #c7dfad; border-color: #4b603b; background: #20291a; }
        .status-inconclusive, .status-canceled_refunded { color: #d5c096; border-color: #54472d; background: #282318; }
        .case-stats {
          display: grid; grid-template-columns: repeat(4, 1fr);
          margin: 22px 0 18px; border: 1px solid #2a342d; border-radius: 8px;
          background: rgba(12, 16, 14, .55);
        }
        .stat { min-width: 0; padding: 13px 15px; border-right: 1px solid #2a342d; }
        .stat:nth-child(4) { border-right: 0; }
        .stat span { display: block; margin-bottom: 7px; color: #748178; font-size: 9px; }
        .stat strong { color: #d4ded6; font-size: 12px; font-weight: 600; overflow-wrap: anywhere; }
        .stat strong small { color: #7f9283; font-size: 9px; }
        .stat-wide { grid-column: 1 / -1; border-top: 1px solid #2a342d; border-right: 0; }
        .terms-box, .ruling-box {
          padding: 15px 16px; border: 1px solid #2b352e; border-radius: 8px;
          background: rgba(12, 16, 14, .4);
        }
        .terms-box p, .ruling-box p, .claim-card p {
          margin: 8px 0 0; color: #a7b3aa; font-size: 11px; line-height: 1.75;
          white-space: pre-wrap; overflow-wrap: anywhere;
        }
        .mini-label { color: #7f9184; font-size: 9px; }
        .claims-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
        .claim-card { padding: 15px 16px; border: 1px solid #2a342d; border-radius: 8px; background: rgba(12, 16, 14, .28); }
        .claim-card a { display: inline-block; margin-top: 12px; color: #a9d0ae; font-size: 10px; text-decoration: none; }
        .claim-card a:hover { text-decoration: underline; }
        .ruling-box { margin-top: 12px; }
        .ruling-box strong { display: block; margin-top: 7px; color: #d1dfd3; font-size: 12px; }
        .actions-area { margin-top: 18px; }
        .response-card {
          display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px;
          margin-bottom: 14px; padding: 18px; border: 1px solid #34473a;
          border-radius: 9px; background: rgba(24, 36, 27, .45);
        }
        .response-card > div:first-child { grid-column: 1 / -1; margin-bottom: 13px; }
        h4 { margin: 7px 0 5px; color: #dce8dd; font-size: 13px; font-weight: 600; }
        .response-card > div:first-child p { margin: 0; color: #87968a; font-size: 10px; line-height: 1.6; }
        .response-card .primary-button { grid-column: 1 / -1; justify-self: end; }
        .action-buttons { display: flex; flex-wrap: wrap; gap: 10px; }
        .wallet-section { margin-top: 4px; }
        .balance-panel {
          display: flex; justify-content: space-between; align-items: center;
          gap: 24px; padding: 22px 25px;
        }
        .balance-number {
          margin-top: 8px; color: #e2ebe3;
          font-family: Georgia, "Times New Roman", serif; font-size: 35px; letter-spacing: -.04em;
        }
        .balance-number small { color: #92a395; font-family: inherit; font-size: 13px; letter-spacing: 0; }
        .balance-panel p { margin: 7px 0 0; color: #748178; font-size: 10px; }
        .balance-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 9px; }
        .tx-note {
          display: flex; align-items: center; gap: 13px;
          max-width: 1050px; margin: -35px auto 35px; padding: 13px 15px;
          border: 1px solid #2c3930; border-radius: 8px; background: #121915;
        }
        .tx-note strong { display: block; margin-bottom: 5px; color: #b9c7bc; font-size: 10px; }
        .tx-note code { display: block; color: #87988b; font-size: 10px; }
        .footer {
          max-width: 1050px; margin: 0 auto; padding-top: 20px;
          display: flex; justify-content: space-between; gap: 15px;
          border-top: 1px solid #222a26; color: #5e6b61; font-size: 9px; line-height: 1.6;
        }
        .footer span:first-child { color: #758379; font-weight: 700; letter-spacing: .1em; }

        @media (max-width: 700px) {
          .page-shell { padding: 0 20px 30px; }
          .topbar { height: 70px; }
          .network-pill { display: none; }
          .hero { padding: 58px 0 50px; }
          .section-heading { align-items: flex-start; flex-direction: column; gap: 8px; }
          .section-heading > p { text-align: left; }
          .form-panel, .lookup-panel { padding: 18px; }
          .field-grid, .claims-grid, .response-card { grid-template-columns: 1fr; }
          .response-card > div:first-child, .response-card .primary-button { grid-column: auto; }
          .form-footer, .balance-panel { align-items: flex-start; flex-direction: column; }
          .lookup-row { align-items: stretch; flex-direction: column; }
          .lookup-field, .lookup-button { width: 100%; }
          .case-topline { flex-direction: column; }
          .case-stats { grid-template-columns: 1fr 1fr; }
          .stat:nth-child(2) { border-right: 0; }
          .stat:nth-child(3), .stat:nth-child(4) { border-top: 1px solid #2a342d; }
          .stat:nth-child(4) { border-right: 0; }
          .stat-wide { grid-column: 1 / -1; }
          .balance-actions { justify-content: flex-start; }
          .footer { flex-direction: column; }
        }
      `}</style>
    </main>
  );
}
