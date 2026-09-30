'use client';

import { useState, useEffect } from 'react';
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { custom, createPublicClient, http, formatGwei } from 'viem';
import { mainnet, arbitrum, base } from 'viem/chains';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, Shield, Globe, CheckCircle2, MapPin, Dices, 
  AlertCircle, RefreshCw, Waypoints, Zap, Cpu, Target, 
  Shuffle, BarChart3, Network, Database, Clock, Radio, ArrowRight, Lock
} from 'lucide-react';

// ⚠️ DEPLOY V2.2 PYTHON CONTRACT AND PASTE ADDRESS HERE:
const CONTRACT_ADDRESS = "0xAe0E22F1964fb56b59c77a4a8C77B8b31dce5EB4";

const ASSETS = ["USDC"]; // CCTP focus
const SOURCE_CHAINS = ["SEPOLIA", "BASE_SEPOLIA", "ARBITRUM_SEPOLIA", "SOLANA_DEVNET", "NEAR_TESTNET"];

const ASSET_DEFAULTS: Record<string, string> = {
  "USDC": "1000.000000"
};

const ALL_PRESETS = [
  { label: "Spot Grid Arbitrage", prompt: "Route this asset to whichever chain provides the deepest liquidity and highest 24h volume to optimize spot grid trading boundaries." },
  { label: "Maximum Security", prompt: "Prioritize bridge security above all else. Route to the chain with the highest bridge_security_score, strictly ignoring gas costs." },
  { label: "Micro-Tx (Lowest Gas)", prompt: "Find the absolute cheapest target chain by avg_gas_usd for high-frequency micro-transactions." }
];

const RealTimeAnalytics = ({ userAddress }: { userAddress: string }) => {
  const [stats, setStats] = useState({ intents: '0', volume: '$0', topChain: 'N/A', isFresh: true });
  
  useEffect(() => {
    const fetchOnChainStats = async () => {
      if (!userAddress || typeof window === 'undefined' || !(window as any).ethereum) return;
      try {
        const client = createClient({
          chain: studionet,
          account: userAddress as `0x${string}`,
          transport: custom((window as any).ethereum)
        } as any);

        const result = await client.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          functionName: 'get_protocol_overview',
          args: []
        });
        
        if (result) {
          const parsed = typeof result === 'string' ? JSON.parse(result) : result;
          const intentsNum = Number(parsed.total_intents_routed || 0);
          
          let top = 'N/A';
          if (parsed.historical_metrics) {
             const metricsObj = typeof parsed.historical_metrics === 'string' ? JSON.parse(parsed.historical_metrics) : parsed.historical_metrics;
             const activeChains = Object.entries(metricsObj).filter(([_, count]) => Number(count) > 0);
             if (activeChains.length > 0) {
                 top = activeChains.sort((a, b) => Number(b[1]) - Number(a[1]))[0][0];
             }
          }

          setStats({ 
            intents: intentsNum.toString(), 
            volume: `$${(Number(parsed.total_volume_scaled || 0) / 1000000).toLocaleString()}`, 
            topChain: top,
            isFresh: intentsNum === 0
          });
        }
      } catch (err) {
        console.warn("Stats fetch failed", err);
      }
    };

    fetchOnChainStats();
    const interval = setInterval(fetchOnChainStats, 15000);
    return () => clearInterval(interval);
  }, [userAddress]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-3 gap-4 mb-6">
      <div className="p-4 border border-white/5 bg-[#0f0f13] rounded-2xl shadow-xl relative overflow-hidden">
        {stats.isFresh && <div className="absolute top-0 right-0 bg-blue-500/20 text-blue-400 text-[8px] px-2 py-1 font-bold uppercase rounded-bl-lg">Genesis Block</div>}
        <div className="text-neutral-500 text-[10px] uppercase tracking-widest font-bold mb-1 flex items-center gap-1.5"><Activity className="h-3 w-3 text-indigo-400" /> Total Intents</div>
        <div className="text-xl font-black text-indigo-400">{stats.intents}</div>
      </div>
      <div className="p-4 border border-white/5 bg-[#0f0f13] rounded-2xl shadow-xl relative overflow-hidden">
        {stats.isFresh && <div className="absolute top-0 right-0 bg-blue-500/20 text-blue-400 text-[8px] px-2 py-1 font-bold uppercase rounded-bl-lg">0.00 Volume</div>}
        <div className="text-neutral-500 text-[10px] uppercase tracking-widest font-bold mb-1 flex items-center gap-1.5"><Database className="h-3 w-3 text-emerald-400" /> Vol Processed</div>
        <div className="text-xl font-black text-emerald-400">{stats.volume}</div>
      </div>
      <div className="p-4 border border-white/5 bg-[#0f0f13] rounded-2xl shadow-xl">
        <div className="text-neutral-500 text-[10px] uppercase tracking-widest font-bold mb-1 flex items-center gap-1.5"><Network className="h-3 w-3 text-purple-400" /> Top Chain</div>
        <div className="text-xl font-black text-purple-400">{stats.topChain}</div>
      </div>
    </motion.div>
  );
};

const RouteVisualizer = ({ source, target, asset }: { source: string, target: string, asset: string }) => {
  return (
    <div className="flex items-center justify-between bg-black/40 border border-white/5 rounded-2xl p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-emerald-500/5 opacity-50" />
      
      <div className="flex flex-col items-center relative z-10">
        <div className="h-12 w-12 rounded-full bg-indigo-500/20 border border-indigo-500/50 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.3)]">
          <MapPin className="h-5 w-5 text-indigo-400" />
        </div>
        <span className="text-[10px] font-bold text-neutral-400 mt-2 tracking-wider">{source}</span>
      </div>

      <div className="flex-1 px-4 flex flex-col items-center relative z-10">
        <span className="text-[9px] font-mono text-emerald-400 mb-2 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
          Routing {asset}
        </span>
        <div className="w-full flex items-center justify-center gap-1 relative">
           <div className="h-px bg-white/10 flex-1 relative overflow-hidden">
              <motion.div 
                initial={{ x: '-100%' }} 
                animate={{ x: '200%' }} 
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-indigo-500 to-transparent"
              />
           </div>
           <Shield className="h-4 w-4 text-purple-400 mx-2 animate-pulse" />
           <div className="h-px bg-white/10 flex-1 relative overflow-hidden">
              <motion.div 
                initial={{ x: '-100%' }} 
                animate={{ x: '200%' }} 
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear", delay: 0.5 }}
                className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-emerald-500 to-transparent"
              />
           </div>
        </div>
      </div>

      <div className="flex flex-col items-center relative z-10">
        <div className="h-12 w-12 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center shadow-[0_0_15px_rgba(52,211,153,0.3)]">
          <Target className="h-5 w-5 text-emerald-400" />
        </div>
        <span className="text-[10px] font-bold text-neutral-400 mt-2 tracking-wider">{target}</span>
      </div>
    </div>
  );
}

export default function NexusDashboard() {
  const [userAddress, setUserAddress] = useState('');
  const [activeTab, setActiveTab] = useState('terminal');
  const [terminalLogs, setTerminalLogs] = useState<{time: string, msg: string, type: string}[]>([]);
  
  const [intentId, setIntentId] = useState(`NEXUS-SEQ-${Math.floor(1000 + Math.random() * 9000)}`);
  const [selectedAsset, setSelectedAsset] = useState(ASSETS[0]);
  const [sourceChain, setSourceChain] = useState(SOURCE_CHAINS[0]);
  const [depositAmount, setDepositAmount] = useState(ASSET_DEFAULTS["USDC"]);
  const [destinationAddress, setDestinationAddress] = useState('');
  const [userIntent, setUserIntent] = useState(ALL_PRESETS[0].prompt);
  
  const [activePresets, setActivePresets] = useState(ALL_PRESETS.slice(0, 3));
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [parsedReceipt, setParsedReceipt] = useState<any>(null);

  // Phase 2 Binding State
  const [sourceTxHash, setSourceTxHash] = useState('');
  const [isBinding, setIsBinding] = useState(false);

  const [liveRPCGas, setLiveRPCGas] = useState({ SEPOLIA: "15", ARBITRUM_SEPOLIA: "0.1", BASE_SEPOLIA: "0.05", SOLANA_DEVNET: "0.005", NEAR_TESTNET: "0.002" });

  useEffect(() => {
    const fetchRealGas = async () => {
      try {
        const ethClient = createPublicClient({ chain: mainnet, transport: http() });
        const arbClient = createPublicClient({ chain: arbitrum, transport: http() });
        const baseClient = createPublicClient({ chain: base, transport: http() });

        const [ethGas, arbGas, baseGas] = await Promise.all([
          ethClient.getGasPrice().catch(() => BigInt(15000000000)),
          arbClient.getGasPrice().catch(() => BigInt(100000000)),
          baseClient.getGasPrice().catch(() => BigInt(5000000))
        ]);

        setLiveRPCGas(prev => ({
          ...prev,
          SEPOLIA: Number(formatGwei(ethGas)).toFixed(2),
          ARBITRUM_SEPOLIA: Number(formatGwei(arbGas)).toFixed(3),
          BASE_SEPOLIA: Number(formatGwei(baseGas)).toFixed(3)
        }));
      } catch (err) {
        console.error("Gas RPC Fetch Error", err);
      }
    };

    fetchRealGas();
    const interval = setInterval(fetchRealGas, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
      if (userAddress && !destinationAddress) setDestinationAddress(userAddress);
  }, [userAddress]);

  const handleAssetChange = (asset: string) => {
    setSelectedAsset(asset);
    setDepositAmount(ASSET_DEFAULTS[asset]);
  };

  const shufflePresets = () => {
    const shuffled = [...ALL_PRESETS].sort(() => 0.5 - Math.random());
    const newActive = shuffled.slice(0, 3);
    setActivePresets(newActive);
    setUserIntent(newActive[0].prompt);
    addLog("Rotated AI logic presets.", 'info');
  };

  const addLog = (msg: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setTerminalLogs(prev => [...prev, {
      time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' }),
      msg, type
    }]);
  };

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && typeof (window as any).ethereum !== 'undefined') {
      try {
        const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
        setUserAddress(accounts[0]);
        addLog(`Link Established: ${accounts[0].substring(0,6)}...${accounts[0].slice(-4)}`, 'success');
      } catch (err: any) {
        addLog(`Connection Failed: ${err.message}`, 'error');
      }
    } else {
      addLog("No Web3 wallet found. Please use MetaMask.", 'error');
    }
  };

  const executeNexusRoute = async () => {
    if (!userAddress) {
      addLog("Cannot execute: Wallet not connected.", 'error');
      return;
    }
    if (!destinationAddress) {
      addLog("Destination address is strictly required.", 'error');
      return;
    }

    setIsProcessing(true);
    setTerminalLogs([]);
    setEvalResult(null);
    setParsedReceipt(null);
    setActiveTab('terminal');
    
    const currentIntentId = `NEXUS-SEQ-${Math.floor(1000 + Math.random() * 9000)}`;
    setIntentId(currentIntentId);

    try {
      addLog(`Initializing Nexus Engine for ${depositAmount} ${selectedAsset}...`, 'info');
      
      const liveMetrics = {
        SEPOLIA: { avg_gas_gwei: liveRPCGas.SEPOLIA, bridge_security_score: "99", liquidity_depth_usd: "350000000" },
        ARBITRUM_SEPOLIA: { avg_gas_gwei: liveRPCGas.ARBITRUM_SEPOLIA, bridge_security_score: "95", liquidity_depth_usd: "85000000" },
        BASE_SEPOLIA: { avg_gas_gwei: liveRPCGas.BASE_SEPOLIA, bridge_security_score: "92", liquidity_depth_usd: "72000000" },
        NEAR_TESTNET: { avg_gas_gwei: liveRPCGas.NEAR_TESTNET, bridge_security_score: "88", liquidity_depth_usd: "38000000" },
        SOLANA_DEVNET: { avg_gas_gwei: liveRPCGas.SOLANA_DEVNET, bridge_security_score: "85", liquidity_depth_usd: "115000000" }
      };

      const nowTimestamp = Math.floor(Date.now() / 1000).toString();

      // V2.2 Flow: source_tx_hash is empty during initial routing request
      const payloadObj = {
        payload_timestamp: nowTimestamp,
        asset: selectedAsset,
        chain_metrics: liveMetrics,
        deposit_amount: depositAmount,
        destination_address: destinationAddress,
        source_chain: sourceChain,
        source_tx_hash: "", 
        user_intent: userIntent
      };

      const sortedKeys = Object.keys(payloadObj).sort();
      const canonicalObj: Record<string, any> = {};
      
      for (const key of sortedKeys) {
        if (key === 'chain_metrics') {
          const metrics = payloadObj[key];
          const sortedMetricsKeys = Object.keys(metrics).sort();
          const canonicalMetrics: Record<string, any> = {};
          for (const mKey of sortedMetricsKeys) {
            const innerMetrics = (metrics as any)[mKey];
            const sortedInner = Object.keys(innerMetrics).sort();
            const canonicalInner: Record<string, string> = {};
            for (const iKey of sortedInner) {
              canonicalInner[iKey] = String(innerMetrics[iKey]);
            }
            canonicalMetrics[mKey] = canonicalInner;
          }
          canonicalObj[key] = canonicalMetrics;
        } else {
          canonicalObj[key] = String((payloadObj as any)[key]);
        }
      }

      const deterministicString = JSON.stringify(canonicalObj);
      
      const msgBuffer = new TextEncoder().encode(deterministicString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      
      addLog(`Payload Locked with 60s TTL. Canonical Hash: ${hashHex.substring(0,16)}...`, 'success');

      const client = createClient({
        chain: studionet,
        account: userAddress as `0x${string}`,
        transport: custom((window as any).ethereum)
      } as any);

      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: 'route_cross_chain_intent',
        args: [currentIntentId, deterministicString, hashHex],
        value: BigInt(0)
      });

      addLog(`Routing transaction broadcasted: ${hash}`, 'info');

      if (typeof client.waitForTransactionReceipt === 'function') {
        try {
          const receipt = await client.waitForTransactionReceipt({ hash, interval: 3000, retries: 40 });
          setEvalResult(receipt);
          
          const traceError = (receipt as any).consensus_data?.leader_receipt?.[0]?.genvm_result?.stderr || "";
          if (traceError || (receipt as any).status === 5) {
            const errorMsg = traceError.split('\n').pop() || "Transaction reverted by contract.";
            addLog(`Execution Reverted: ${errorMsg}`, 'error');
            setIsProcessing(false);
            return;
          }
          
          addLog("Consensus verified. Delaying 4s for RPC state index...", 'warning');
          await new Promise(r => setTimeout(r, 4000));
          
          try {
            const finalIntentState = await client.readContract({
              address: CONTRACT_ADDRESS as `0x${string}`,
              functionName: 'get_intent',
              args: [currentIntentId]
            });
            
            let cleaned = typeof finalIntentState === 'string' ? JSON.parse(finalIntentState) : finalIntentState;
            setParsedReceipt(cleaned);
          } catch(e) {
            console.error("State Read error", e);
          }

          addLog("Route Approved. Awaiting Source Transaction Binding.", 'success');
          setActiveTab('receipt');
          setIsProcessing(false);

        } catch (receiptErr) {
          addLog("Execution reverted or timed out on-chain.", 'error');
          setIsProcessing(false);
        }
      }

    } catch (err: any) {
      addLog(`Execution Failed: ${err.message}`, 'error');
      setIsProcessing(false);
    }
  };

  const bindSourceTransaction = async () => {
    if (!sourceTxHash) {
      addLog("Please enter a valid CCTP Source Transaction Hash.", 'error');
      return;
    }
    
    setIsBinding(true);
    setActiveTab('terminal');
    addLog(`Binding CCTP Burn Hash ${sourceTxHash.substring(0,10)}... to Intent ${intentId}`, 'warning');

    try {
      const client = createClient({
        chain: studionet,
        account: userAddress as `0x${string}`,
        transport: custom((window as any).ethereum)
      } as any);

      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: 'bind_source_transaction',
        args: [intentId, sourceTxHash],
        value: BigInt(0)
      });

      addLog(`Bind transaction broadcasted: ${hash}`, 'info');

      if (typeof client.waitForTransactionReceipt === 'function') {
         await client.waitForTransactionReceipt({ hash, interval: 3000, retries: 40 });
         addLog("Source Hash successfully bound! GenLayer intent status updated to SOURCE_SUBMITTED.", 'success');
         addLog("Off-chain watcher will now verify CCTP logs before destination execution.", 'info');
         
         // Refresh receipt to show updated status
         const finalIntentState = await client.readContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            functionName: 'get_intent',
            args: [intentId]
         });
         let cleaned = typeof finalIntentState === 'string' ? JSON.parse(finalIntentState) : finalIntentState;
         setParsedReceipt(cleaned);
         setActiveTab('receipt');
      }

    } catch (err: any) {
      addLog(`Bind Failed: ${err.message}`, 'error');
    } finally {
      setIsBinding(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-neutral-300 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      <nav className="border-b border-white/5 bg-black/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-white/10">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight leading-tight">Nexus Omni-Chain</h1>
              <p className="text-[10px] text-indigo-400 font-mono tracking-widest uppercase">Intent Router v2.2</p>
            </div>
          </div>
          <div>
            {!userAddress ? (
              <button onClick={connectWallet} className="bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold px-6 py-2.5 rounded-full transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20">
                <Shield className="h-4 w-4" /> Connect Node
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-emerald-400 font-mono tracking-wider">GENLAYER NETWORK</span>
                </div>
                <div className="bg-black/50 border border-white/10 text-neutral-300 text-xs px-4 py-2 rounded-full font-mono">
                  {userAddress.substring(0, 6)}...{userAddress.slice(-4)}
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-[1400px] mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        
        <div className="lg:col-span-5 space-y-0">
          <RealTimeAnalytics userAddress={userAddress} />
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0f0f13] border border-white/5 rounded-3xl p-7 shadow-2xl backdrop-blur-sm"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <MapPin className="h-4 w-4 text-indigo-400" /> Route Configuration
              </h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[10px] font-bold px-2 py-1 rounded-md">
                  <Clock className="h-3 w-3" /> 60s TTL Active
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 block mb-2 uppercase tracking-wider">Deposit Asset</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ASSETS.map(asset => (
                      <button 
                        key={asset}
                        onClick={() => handleAssetChange(asset)}
                        className={`text-xs py-2 rounded-xl border transition-all font-mono font-semibold ${selectedAsset === asset ? 'bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-black/40 border-white/5 text-neutral-400 hover:border-white/10 hover:bg-black/60'}`}
                      >
                        {asset}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 block mb-2 uppercase tracking-wider">Source Origin</label>
                  <div className="grid grid-cols-2 gap-2">
                    {SOURCE_CHAINS.slice(0,4).map(chain => (
                      <button 
                        key={chain}
                        onClick={() => setSourceChain(chain)}
                        className={`text-[10px] py-2 rounded-xl border transition-all font-mono font-semibold ${sourceChain === chain ? 'bg-purple-500/20 border-purple-500/50 text-purple-300' : 'bg-black/40 border-white/5 text-neutral-400 hover:border-white/10'}`}
                      >
                        {chain}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-neutral-500 block mb-2 uppercase tracking-wider">Destination EVM Address</label>
                <div className="relative group">
                  <input 
                    type="text" 
                    value={destinationAddress} 
                    onChange={e => setDestinationAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-xs text-white font-mono focus:border-indigo-500 outline-none transition-all focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-xl p-3 flex items-center justify-between shadow-inner">
                <div className="flex items-center gap-3">
                  <Waypoints className="h-4 w-4 text-indigo-400" />
                  <div>
                    <p className="text-[9px] font-bold text-indigo-300/70 uppercase tracking-widest">Target Chain</p>
                    <p className="text-xs text-indigo-200 font-mono mt-0.5">
                      Determined by Multi-LLM Consensus
                    </p>
                  </div>
                </div>
                <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
              </div>

              <div>
                <label className="text-[10px] font-bold text-neutral-500 block mb-2 uppercase tracking-wider">Transaction Volume</label>
                <div className="relative group">
                  <input 
                    type="text" 
                    value={depositAmount} 
                    onChange={e => setDepositAmount(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono focus:border-indigo-500 outline-none transition-all focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/5 px-2 py-1 rounded-md border border-white/10">
                    <span className="text-[10px] font-mono text-indigo-300 font-bold">{selectedAsset}</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
                    <Cpu className="h-3.5 w-3.5 text-emerald-400" /> Intent Resolution Logic
                  </label>
                  <button onClick={shufflePresets} className="flex items-center gap-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-400 text-[10px] font-bold px-4 py-1.5 rounded-lg transition-all">
                    <RefreshCw className="h-3.5 w-3.5" /> SHUFFLE AI PARAMS
                  </button>
                </div>
                <div className="flex flex-col gap-1.5 mb-3">
                  {activePresets.map(preset => (
                    <button
                      key={preset.label}
                      onClick={() => setUserIntent(preset.prompt)}
                      className={`text-left text-xs px-3 py-2 rounded-xl border transition-all flex justify-between items-center ${userIntent === preset.prompt ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-black/30 border-white/5 text-neutral-400 hover:border-white/10 hover:bg-black/50'}`}
                    >
                      <span className="font-semibold">{preset.label}</span>
                      {userIntent === preset.prompt && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                    </button>
                  ))}
                </div>
                <textarea 
                  rows={3} 
                  value={userIntent}
                  onChange={e => setUserIntent(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[11px] text-neutral-300 focus:border-emerald-500 outline-none transition-all leading-relaxed resize-none font-mono focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <button 
                onClick={() => executeNexusRoute()}
                disabled={isProcessing || !userAddress || !destinationAddress}
                className="w-full relative group overflow-hidden rounded-xl font-extrabold text-sm py-3.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] bg-white text-black"
              >
                <div className="absolute inset-0 w-full h-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 mix-blend-multiply bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400" />
                <span className="relative flex items-center justify-center gap-2">
                  {isProcessing ? (
                    <><Activity className="h-4 w-4 animate-spin" /> Routing Intelligence...</>
                  ) : (
                    <><Zap className="h-4 w-4" /> Request Route Approval</>
                  )}
                </span>
              </button>
            </div>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-[#0f0f13] border border-white/5 rounded-3xl p-7 shadow-2xl backdrop-blur-sm mt-6">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-emerald-400" /> Testnet Telemetry (RPC)
            </h2>
            <p className="text-[10px] text-neutral-500 mb-5">Advisory metrics injected into AI execution payload</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="text-neutral-500 border-b border-white/5">
                    <th className="pb-3 font-medium uppercase tracking-wider">Network</th>
                    <th className="pb-3 font-medium uppercase tracking-wider">Gas (Gwei)</th>
                  </tr>
                </thead>
                <tbody className="text-neutral-300">
                  {Object.entries(liveRPCGas).map(([chain, gas]) => (
                    <tr key={chain} className="border-b border-white/5 last:border-0">
                      <td className="py-3 flex items-center gap-2">
                        <div className={`h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse`} />
                        {chain}
                      </td>
                      <td className="py-3 text-emerald-400 font-bold">{gas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

        </div>

        <div className="lg:col-span-7 space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#0f0f13] border border-white/5 rounded-3xl overflow-hidden flex flex-col h-[880px] shadow-2xl backdrop-blur-sm"
          >
            <div className="bg-black/60 border-b border-white/5 px-6 flex items-center gap-6">
              <div className="flex gap-2 py-5">
                <div className="w-3 h-3 rounded-full bg-red-500/80 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80 shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                <div className="w-3 h-3 rounded-full bg-green-500/80 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
              </div>
              <div className="flex gap-6">
                <button onClick={() => setActiveTab('terminal')} className={`text-xs font-bold py-5 border-b-2 transition-colors uppercase tracking-wider ${activeTab === 'terminal' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-neutral-500 hover:text-neutral-300'}`}>
                  System Terminal
                </button>
                <button onClick={() => setActiveTab('receipt')} className={`text-xs font-bold py-5 border-b-2 transition-colors uppercase tracking-wider ${activeTab === 'receipt' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-neutral-500 hover:text-neutral-300'}`}>
                  Execution Status
                </button>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto bg-[#050508] relative">
              <AnimatePresence mode="wait">
                {activeTab === 'terminal' ? (
                  <motion.div 
                    key="terminal"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4 font-mono text-[11px]"
                  >
                    <div className="text-neutral-500 mb-6 border-b border-white/5 pb-4">
                      <p className="text-indigo-400 font-bold mb-1">Nexus Node Architecture v2.2</p>
                      <p>Status: Awaiting Instructions</p>
                    </div>
                    {terminalLogs.map((log, idx) => (
                      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} key={idx} className="flex gap-4 p-2 rounded-lg hover:bg-white/5 transition-colors">
                        <span className="text-neutral-600 shrink-0">[{log.time}]</span>
                        <span className={`${log.type === 'error' ? 'text-red-400 font-bold' : log.type === 'success' ? 'text-emerald-400 font-bold' : log.type === 'warning' ? 'text-yellow-400' : 'text-indigo-300'}`}>{log.msg}</span>
                      </motion.div>
                    ))}
                    {(isProcessing || isBinding) && (
                      <div className="flex gap-4 p-2 mt-4 text-neutral-500 items-center">
                        <span className="shrink-0">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                        <span className="flex gap-2 items-center text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                          <div className="h-1.5 w-1.5 bg-indigo-400 rounded-full animate-ping" /> Synchronizing GenVM State...
                        </span>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div key="receipt" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                    {parsedReceipt ? (
                      <div className="space-y-6 h-full flex flex-col">
                        
                        <div className={`p-6 rounded-3xl border flex items-center justify-between ${parsedReceipt.status === 'APPROVED' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                          <div className="flex items-center gap-4">
                            {parsedReceipt.status === 'APPROVED' ? <CheckCircle2 className="h-10 w-10 text-emerald-400" /> : <AlertCircle className="h-10 w-10 text-red-400" />}
                            <div>
                              <h3 className={`font-black text-2xl tracking-wide ${parsedReceipt.status === 'APPROVED' ? 'text-emerald-400' : 'text-red-400'}`}>
                                INTENT {parsedReceipt.status}
                              </h3>
                              <p className="text-neutral-400 text-xs mt-1">
                                {parsedReceipt.source_tx_hash ? 'Bridge CCTP Hash Bound' : 'Awaiting Source Bridge Transaction'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-neutral-500 uppercase tracking-widest">Intent ID</p>
                            <p className="font-mono text-sm text-neutral-300">{parsedReceipt.intent_id}</p>
                          </div>
                        </div>

                        {parsedReceipt.status === 'APPROVED' && (
                           <RouteVisualizer 
                              source={parsedReceipt.source_chain} 
                              target={parsedReceipt.target_chain} 
                              asset={parsedReceipt.asset} 
                           />
                        )}

                        {parsedReceipt.status === 'APPROVED' && !parsedReceipt.source_tx_hash && (
                          <div className="bg-indigo-900/20 border border-indigo-500/40 p-6 rounded-2xl">
                             <h4 className="text-indigo-300 font-bold mb-2 flex items-center gap-2"><Lock className="h-4 w-4" /> Step 2: Bind CCTP Transaction</h4>
                             <p className="text-xs text-neutral-400 mb-4">
                               The route has been approved. Execute your <code className="text-indigo-300">DepositForBurn</code> transaction on the source chain via CCTP, then paste the transaction hash below to finalize the intent.
                             </p>
                             <div className="flex gap-3">
                                <input 
                                  type="text" 
                                  value={sourceTxHash}
                                  onChange={e => setSourceTxHash(e.target.value)}
                                  placeholder="0x..." 
                                  className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white font-mono outline-none focus:border-indigo-500"
                                />
                                <button 
                                  onClick={bindSourceTransaction}
                                  disabled={isBinding || !sourceTxHash}
                                  className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                                >
                                  {isBinding ? 'Binding...' : 'Bind Hash'}
                                </button>
                             </div>
                             {parsedReceipt.expires_at && (
                                <p className="text-[10px] text-neutral-500 mt-3 font-mono">
                                  Approval Expires: {new Date(Number(parsedReceipt.expires_at) * 1000).toLocaleString()}
                                </p>
                             )}
                          </div>
                        )}

                        {parsedReceipt.status === 'APPROVED' && (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-black/40 border border-white/5 p-4 rounded-2xl">
                              <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1">Bridge Security Score</p>
                              <p className="font-bold text-lg text-emerald-300">{parsedReceipt.safety_score} / 100</p>
                            </div>
                            <div className="bg-black/40 border border-white/5 p-4 rounded-2xl">
                              <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1">Deposit Volume</p>
                              <p className="font-bold text-lg text-indigo-300">{parsedReceipt.deposit_amount} {parsedReceipt.asset}</p>
                            </div>
                            <div className="col-span-2 bg-black/40 border border-white/5 p-5 rounded-2xl relative overflow-hidden">
                              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                              <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                <Cpu className="h-3 w-3 text-indigo-400" /> AI Execution Reasoning
                              </p>
                              <p className="text-sm leading-relaxed text-neutral-300 font-medium">{parsedReceipt.ai_reasoning || parsedReceipt.reason}</p>
                            </div>
                          </div>
                        )}

                        <div className="mt-4 pt-4 border-t border-white/5">
                           <p className="text-[10px] text-neutral-600 uppercase tracking-widest mb-3">Raw State Verification</p>
                           <pre className="text-[10px] text-neutral-500 bg-[#0a0a0f] p-4 rounded-xl overflow-x-auto shadow-inner custom-scrollbar">
                             {JSON.stringify(parsedReceipt, null, 2)}
                           </pre>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-neutral-600 space-y-4">
                        <Target className="h-12 w-12 text-neutral-800" />
                        <p className="italic">Awaiting routing execution to generate intent status.</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
}
