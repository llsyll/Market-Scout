'use client';

import { useState, useEffect } from 'react';
import { WatchlistItem } from '@/lib/watchlist';

export default function Home() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [newSymbol, setNewSymbol] = useState('');
  const [newType, setNewType] = useState<'stock' | 'crypto'>('stock');
  const [indicators, setIndicators] = useState({
    ma10: true,
    ma14: false,
    macd: true,
    kdj: true,
  });
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [nextCheckTime, setNextCheckTime] = useState<string>('');

  // Search state
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (newSymbol.length >= 2) {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(newSymbol)}`);
          const data = await res.json();
          setSearchResults(data.results || []);
          setShowResults(true);
        } catch (e) {
          console.error(e);
        }
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [newSymbol]);

  const selectSymbol = (item: any) => {
    // Strip exchange prefix if present (e.g., BINANCE:BTCUSDT -> BTCUSDT)
    // accessible UI should probably show the prefix, but for storage we might want clean?
    // Actually, keeping prefix helps identify source, but our backend expects specific formats.
    // Our Binance US fetcher expects 'BTCUSD' or 'BTC-USD'. 
    // Let's strip the prefix for the Input value.
    const cleanSymbol = item.symbol.includes(':') ? item.symbol.split(':')[1] : item.symbol;

    setNewSymbol(cleanSymbol);

    // Auto-detect type
    // Finnhub returns 'CRYPTO', Yahoo returned 'CRYPTOCURRENCY'
    if (item.quoteType?.includes('CRYPTO') || item.exchange === 'CCC') {
      setNewType('crypto');
    } else {
      setNewType('stock');
    }
    setShowResults(false);
  };

  const updateCountdown = () => {
    // Target: Weekdays 21:00 UTC
    // Logic: Find next occurrence
    const now = new Date();
    // const utcNow = now.getTime() + (now.getTimezoneOffset() * 60000);
    const targetHour = 21;

    let nextConnect = new Date();
    // Reset to today 21:00 UTC
    nextConnect.setUTCHours(targetHour, 0, 0, 0);

    // If already passed today, or today is weekend, move forward
    if (nextConnect.getTime() <= now.getTime()) {
      nextConnect.setUTCDate(nextConnect.getUTCDate() + 1);
    }

    // Skip weekends (Sat=6, Sun=0)
    while (nextConnect.getUTCDay() === 6 || nextConnect.getUTCDay() === 0) {
      nextConnect.setUTCDate(nextConnect.getUTCDate() + 1);
    }

    const diff = nextConnect.getTime() - now.getTime();
    if (diff <= 0) {
      setNextCheckTime('正在检查...');
      return;
    }

    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    setNextCheckTime(`${hours}小时 ${minutes}分 ${seconds}秒`);
  };

  const fetchWatchlist = async () => {
    try {
      const res = await fetch('/api/watchlist');
      const data = await res.json();
      setWatchlist(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchWatchlist();
    const timer = setInterval(updateCountdown, 1000);
    updateCountdown();
    return () => clearInterval(timer);
  }, []);

  const showStatus = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 3000);
  }

  const handleAdd = async () => {
    if (!newSymbol) return;
    setLoading(true);
    try {
      await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: newSymbol.toUpperCase(),
          type: newType,
          indicators,
        }),
      });
      setNewSymbol('');
      setSearchResults([]);
      await fetchWatchlist();
      showStatus('添加成功');
    } catch (e) {
      console.error(e);
      showStatus('添加失败');
    }
    setLoading(false);
  };

  const handleRemove = async (symbol: string) => {
    if (!confirm(`确定要移除 ${symbol} 吗?`)) return;
    try {
      await fetch(`/api/watchlist?symbol=${symbol}`, { method: 'DELETE' });
      await fetchWatchlist();
      showStatus('已移除');
    } catch (e) { console.error(e); }
  };

  const handleManualCheck = async () => {
    showStatus('正在执行检查...');
    try {
      const res = await fetch('/api/monitor/check', { method: 'POST' });
      const data = await res.json();
      showStatus(`检查完成，已发送 ${data.messagesSent} 条通知`);
    } catch (e) {
      showStatus('执行失败');
    }
  };

  const handleTestMessage = async () => {
    showStatus('正在发送测试消息...');
    try {
      await fetch('/api/monitor/test', { method: 'POST' });
      showStatus('测试消息已发送');
    } catch (e) {
      showStatus('发送失败');
    }
  };

  const toggleIndicator = async (symbol: string, indicator: string, currentVal: boolean) => {
    // Optimistic update
    const updatedList = watchlist.map(item => {
      if (item.symbol === symbol) {
        return {
          ...item,
          indicators: {
            ...item.indicators,
            [indicator]: !currentVal
          }
        };
      }
      return item;
    });
    setWatchlist(updatedList);

    try {
      const item = updatedList.find(i => i.symbol === symbol);
      if (!item) return;

      await fetch('/api/watchlist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: item.symbol,
          indicators: item.indicators
        })
      });
    } catch (e) {
      console.error("Failed to update indicator", e);
      // Revert on failure (could be implemented if needed, but simple fetchWatchlist is easier)
      fetchWatchlist();
    }
  };

  return (
    <main className="container">
      <header className="header">
        <div>
          <h1 className="title">Market Scout</h1>
          <div className="subtitle">美股 & 加密货币 机会监控哨兵</div>
          {nextCheckTime && <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '0.5rem' }}>
            距离下次自动检查: {nextCheckTime}
          </div>}
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={handleTestMessage}>
            🔔 测试通知
          </button>
          <button className="btn btn-primary" onClick={handleManualCheck}>
            🚀 立即检查
          </button>
        </div>
      </header>

      {statusMsg && (
        <div className="status-toast">
          {statusMsg}
        </div>
      )}

      <div className="input-panel" style={{ position: 'relative' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flex: 1, position: 'relative' }}>
          <input
            className="input"
            placeholder="输入代码 (如 NVDA, BTC-USD)"
            value={newSymbol}
            onChange={(e) => { setNewSymbol(e.target.value); if (e.target.value.length < 2) setShowResults(false); }}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            style={{ width: '100%' }}
            onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
            onBlur={() => setTimeout(() => setShowResults(false), 200)} // Delay to allow click
          />

          {showResults && searchResults.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              backgroundColor: 'rgba(30,30,35,0.95)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '0.5rem',
              zIndex: 100,
              maxHeight: '300px',
              overflowY: 'auto',
              marginTop: '4px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
            }}>
              {searchResults.map((item, idx) => (
                <div
                  key={idx + item.symbol}
                  onClick={() => selectSymbol(item)}
                  style={{
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  className="search-result-item"
                >
                  <div style={{ fontWeight: 600, color: 'white' }}>{item.symbol}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{item.shortname}</span>
                    <span>{item.exchange} - {item.quoteType}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <select
          className="select"
          value={newType}
          onChange={(e) => setNewType(e.target.value as any)}
          style={{ width: 'auto' }}
        >
          <option value="stock">股票 (Stock)</option>
          <option value="crypto">加密币 (Crypto)</option>
        </select>

        <div className="checkbox-group">
          <label className="checkbox-label" title="价格突破10日均线">
            <input type="checkbox" checked={indicators.ma10} onChange={e => setIndicators({ ...indicators, ma10: e.target.checked })} />
            MA10突破
          </label>
          <label className="checkbox-label" title="价格突破14日均线">
            <input type="checkbox" checked={indicators.ma14} onChange={e => setIndicators({ ...indicators, ma14: e.target.checked })} />
            MA14突破
          </label>
          <label className="checkbox-label" title="MACD在0轴下方金叉">
            <input type="checkbox" checked={indicators.macd} onChange={e => setIndicators({ ...indicators, macd: e.target.checked })} />
            MACD低位金叉
          </label>
          <label className="checkbox-label" title="KDJ低位金叉">
            <input type="checkbox" checked={indicators.kdj} onChange={e => setIndicators({ ...indicators, kdj: e.target.checked })} />
            KDJ金叉
          </label>
        </div>

        <button className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', flex: '0 0 auto' }} onClick={handleAdd} disabled={loading}>
          {loading ? '处理中...' : '添加监控'}
        </button>
      </div>

      <div className="grid">
        {watchlist.map((item) => (
          <div key={item.symbol} className="card">
            <button
              className="delete-btn"
              onClick={() => handleRemove(item.symbol)}
              title="移除"
            >
              ✕
            </button>
            <div className="card-header">
              <div>
                <div className="symbol">{item.symbol}</div>
                <div style={{ marginTop: '0.5rem' }}>
                  <span className={`type-tag ${item.type === 'crypto' ? 'type-crypto' : 'type-stock'}`}>
                    {item.type === 'crypto' ? 'CRYPTO' : 'STOCK'}
                  </span>
                </div>
              </div>

              {(item as any).data ? (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                    ${(item as any).data.price?.toFixed(2)}
                  </div>
                  <div style={{
                    color: ((item as any).data.change >= 0) ? '#34d399' : '#f87171',
                    fontSize: '0.85rem',
                    display: 'flex',
                    gap: '0.5rem',
                    justifyContent: 'flex-end',
                    alignItems: 'center'
                  }}>
                    <span>{(item as any).data.change > 0 ? '+' : ''}{(item as any).data.change?.toFixed(2)}</span>
                    <span>({(item as any).data.changePercent?.toFixed(2)}%)</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.2rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    {(item as any).isStale && (
                      <span title="数据使用缓存，可能不是实时价格" style={{ color: '#fbbf24', cursor: 'help' }}>
                        ⚠️ 缓存数据
                      </span>
                    )}
                    <span>{(item as any).data.name}</span>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'right', color: 'var(--muted)', fontSize: '0.9rem' }}>
                  <div>{(item as any).error ? '获取失败' : '暂无数据'}</div>
                  <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>
                    {(item as any).error || '请检查代码'}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span
                className={`badge ${item.indicators.ma10 ? 'active' : ''}`}
                onClick={() => toggleIndicator(item.symbol, 'ma10', item.indicators.ma10)}
                style={{ cursor: 'pointer', userSelect: 'none' }}
                title="点击切换 MA10 检测"
              >
                MA10
              </span>
              <span
                className={`badge ${item.indicators.ma14 ? 'active' : ''}`}
                onClick={() => toggleIndicator(item.symbol, 'ma14', item.indicators.ma14)}
                style={{ cursor: 'pointer', userSelect: 'none' }}
                title="点击切换 MA14 检测"
              >
                MA14
              </span>
              <span
                className={`badge ${item.indicators.macd ? 'active' : ''}`}
                onClick={() => toggleIndicator(item.symbol, 'macd', item.indicators.macd)}
                style={{ cursor: 'pointer', userSelect: 'none' }}
                title="点击切换 MACD 检测"
              >
                MACD
              </span>
              <span
                className={`badge ${item.indicators.kdj ? 'active' : ''}`}
                onClick={() => toggleIndicator(item.symbol, 'kdj', item.indicators.kdj)}
                style={{ cursor: 'pointer', userSelect: 'none' }}
                title="点击切换 KDJ 检测"
              >
                KDJ
              </span>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
