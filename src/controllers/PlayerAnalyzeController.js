// src/controllers/PlayerAnalyzeController.js
// Comprehensive Chess.com player analytics — mirrors ChessAnalytics.py

import { bind, bindClick, escapeAttr, escapeHtml } from '../utils/dom.js';

const CHESS_API = 'https://api.chess.com/pub/player';
const CHESS_PROXY = '/api/chesscom/player';
const PLAYER_ANALYZE_MONTHS = 12;
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const LOSS_SET = new Set([
  'checkmated', 'resigned', 'timeout', 'abandoned', 'lose',
  'kingofthehill', 'threecheck', 'bughousepartnerlose',
]);
const DRAW_SET = new Set([
  'agreed', 'repetition', 'stalemate', 'insufficient',
  'timevsinsufficient', '50move', 'drawbyrepetition',
]);

const _state = {
  username: '',
  profile: null,
  stats: null,
  allProcessed: [],
  selectedTC: 'rapid',
  selectedPeriod: 30,
};
let uiInitialized = false;
let controlsWired = false;
let _currentAbort = null;

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CACHE_KEY_PREFIX = 'pa_v1_';

const _renderCache = { key: null, filtered: null, tcOnly: null, allPeriod: null };

function getCachedAnalysis(username) {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY_PREFIX + username);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_TTL) return null;
    return cached;
  } catch { return null; }
}

function setCachedAnalysis(username, data) {
  try {
    sessionStorage.setItem(CACHE_KEY_PREFIX + username, JSON.stringify({ timestamp: Date.now(), ...data }));
  } catch { /* storage full */ }
}

// ─── API ─────────────────────────────────────────────────────────────────────

function getChessComProxyUrl(url) {
  const prefix = CHESS_API + '/';
  if (!String(url || '').startsWith(prefix)) return '';
  return CHESS_PROXY + '/' + String(url).slice(prefix.length);
}

async function fetchJson(url, signal) {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal });
  if (res.status === 404) {
    const err = new Error('Player not found');
    err.status = 404;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`API error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function apiGet(url, signal) {
  const proxyUrl = getChessComProxyUrl(url);
  if (proxyUrl) {
    try {
      return await fetchJson(proxyUrl, signal);
    } catch (err) {
      if (err && (err.status === 404 || err.name === 'AbortError')) throw err;
    }
  }
  return fetchJson(url, signal);
}

// ─── PROCESS RAW GAME ────────────────────────────────────────────────────────

function openingFromEcoUrl(url) {
  if (!url) return null;
  return (url.split('/').pop() || '').replace(/-/g, ' ');
}

function countPgnMoves(pgn) {
  if (!pgn) return 0;
  const moveText = pgn
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/;[^\n\r]*/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\$\d+/g, ' ');
  const tokens = moveText.split(/\s+/).filter(Boolean).filter(token => {
    return !/^\d+\.(\.\.)?$/.test(token)
      && !/^\d+\.\.\./.test(token)
      && !['1-0', '0-1', '1/2-1/2', '*'].includes(token);
  });
  return Math.ceil(tokens.length / 2);
}

function processRawGame(game, lowerUsername) {
  const isWhite = game.white.username.toLowerCase() === lowerUsername;
  const me = isWhite ? game.white : game.black;
  const opp = isWhite ? game.black : game.white;
  const result = me.result;
  const won = result === 'win';
  const lost = LOSS_SET.has(result);
  const drew = !won && !lost;

  const endMs = (game.end_time || 0) * 1000;
  const d = new Date(endMs);

  let opening = null, eco = '';
  if (game.pgn) {
    const om = game.pgn.match(/\[Opening "([^"]+)"\]/);
    if (om) opening = om[1];
    const em = game.pgn.match(/\[ECO "([^"]+)"\]/);
    if (em) eco = em[1];
  }
  if (!opening && game.eco) opening = openingFromEcoUrl(game.eco);

  return {
    won, lost, drew, result,
    oppResult: opp.result || '',
    color: isWhite ? 'white' : 'black',
    rating: me.rating || 0,
    oppRating: opp.rating || 0,
    oppUsername: (opp.username || '').toLowerCase(),
    ratingDiff: (me.rating || 0) - (opp.rating || 0),
    timeClass: game.time_class || 'rapid',
    endTime: endMs,
    dayOfWeek: d.getDay(),
    month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    opening,
    eco,
    moveCount: countPgnMoves(game.pgn),
    accuracy: game.accuracies ? game.accuracies[isWhite ? 'white' : 'black'] : null,
    oppAccuracy: game.accuracies ? game.accuracies[isWhite ? 'black' : 'white'] : null,
  };
}

// ─── FILTERS ─────────────────────────────────────────────────────────────────

function filterByTC(games, tc) {
  if (tc === 'all') return games;
  return games.filter(g => g.timeClass === tc);
}

function filterByPeriod(games, days) {
  if (days >= 365) return games;
  const cut = Date.now() - days * 86400000;
  return games.filter(g => g.endTime >= cut);
}

// ─── AGGREGATIONS ────────────────────────────────────────────────────────────

function aggWLD(games) {
  const wins = games.filter(g => g.won).length;
  const losses = games.filter(g => g.lost).length;
  const draws = games.filter(g => g.drew).length;
  const total = games.length;
  return { wins, losses, draws, total, winPct: total ? wins / total * 100 : 0 };
}

function aggByTC(allGames) {
  const tcs = ['rapid', 'blitz', 'bullet', 'daily'];
  return tcs.map(tc => {
    const g = allGames.filter(x => x.timeClass === tc);
    if (!g.length) return null;
    const wins = g.filter(x => x.won).length;
    return { tc, games: g.length, wins, losses: g.filter(x=>x.lost).length, draws: g.filter(x=>x.drew).length, winRate: wins/g.length*100 };
  }).filter(Boolean);
}

function aggMonthly(games) {
  const m = {};
  games.forEach(g => {
    if (!m[g.month]) m[g.month] = { wins: 0, total: 0, ratings: [] };
    m[g.month].total++;
    if (g.won) m[g.month].wins++;
    if (g.rating) m[g.month].ratings.push(g.rating);
  });
  return Object.entries(m).sort().map(([k, v]) => ({
    month: k,
    winRate: v.total ? v.wins / v.total * 100 : 0,
    games: v.total,
    avgRating: v.ratings.length ? Math.round(v.ratings.reduce((s,r)=>s+r,0)/v.ratings.length) : 0,
  }));
}

function aggByDOW(games) {
  const d = Array.from({length:7}, (_,i) => ({ day: DOW[i], games:0, wins:0 }));
  games.forEach(g => { d[g.dayOfWeek].games++; if (g.won) d[g.dayOfWeek].wins++; });
  return d.map(x => ({ ...x, winRate: x.games ? x.wins/x.games*100 : 0 }));
}

function aggRatingDiff(games) {
  const bins = [
    { label: '< -200', min:-Infinity, max:-200 },
    { label: '-200 to -100', min:-200, max:-100 },
    { label: '-100 to 0', min:-100, max:0 },
    { label: '0 to +100', min:0, max:100 },
    { label: '+100 to +200', min:100, max:200 },
    { label: '> +200', min:200, max:Infinity },
  ];
  return bins.map(b => {
    const g = games.filter(x => x.ratingDiff >= b.min && x.ratingDiff < b.max);
    if (!g.length) return null;
    return { label: b.label, games: g.length, winRate: g.filter(x=>x.won).length/g.length*100 };
  }).filter(Boolean);
}

function aggOppStrength(games) {
  const bins = [
    { label: '< 1000',    min:0,     max:1000  },
    { label: '1000–1200', min:1000,  max:1200  },
    { label: '1200–1400', min:1200,  max:1400  },
    { label: '1400–1600', min:1400,  max:1600  },
    { label: '1600–1800', min:1600,  max:1800  },
    { label: '> 1800',    min:1800,  max:Infinity },
  ];
  return bins.map(b => {
    const g = games.filter(x => x.oppRating >= b.min && x.oppRating < b.max && x.oppRating > 0);
    if (!g.length) return null;
    return { label: b.label, games: g.length, winRate: g.filter(x=>x.won).length/g.length*100 };
  }).filter(Boolean);
}

function aggHeadToHead(games) {
  const m = {};
  games.forEach(g => {
    if (!g.oppUsername) return;
    if (!m[g.oppUsername]) m[g.oppUsername] = { username: g.oppUsername, games:0, wins:0, losses:0, draws:0, oppRatingSum:0 };
    m[g.oppUsername].games++;
    if (g.won) m[g.oppUsername].wins++;
    else if (g.lost) m[g.oppUsername].losses++;
    else m[g.oppUsername].draws++;
    m[g.oppUsername].oppRatingSum += g.oppRating || 0;
  });
  return Object.values(m).map(r => ({
    username: r.username, games: r.games, wins: r.wins, losses: r.losses, draws: r.draws,
    oppRating: r.games ? Math.round(r.oppRatingSum / r.games) : 0,
  })).sort((a,b)=>b.games-a.games).slice(0,8);
}

function aggStreaks(games) {
  if (!games.length) {
    return { current: 0, currentType: '', best: 0, distribution: {}, minRating: 0, maxRating: 0 };
  }
  const sorted = [...games].sort((a,b)=>a.endTime-b.endTime);
  let cur=0, sType='', best=0, tmp=0;
  const hist = {};

  // Best win streak + distribution
  sorted.forEach(g => {
    if (g.won) { tmp++; best=Math.max(best,tmp); } else tmp=0;
  });

  // Win streak distribution
  let streak=0;
  sorted.forEach(g => {
    if (g.won) streak++;
    else {
      if (streak>0) hist[Math.min(streak,10)]=(hist[Math.min(streak,10)]||0)+1;
      streak=0;
    }
  });
  if (streak>0) hist[Math.min(streak,10)]=(hist[Math.min(streak,10)]||0)+1;

  // Current streak
  for (let i=sorted.length-1; i>=0; i--) {
    const g=sorted[i];
    const t = g.won?'win':g.drew?'draw':'loss';
    if (i===sorted.length-1) { sType=t; cur=1; }
    else if (t===sType) cur++;
    else break;
  }

  const ratings = games.map(g=>g.rating).filter(Boolean);
  const minR = ratings.length ? Math.min(...ratings) : 0;
  const maxR = ratings.length ? Math.max(...ratings) : 0;

  return { current:cur, currentType:sType, best, distribution:hist, minRating:minR, maxRating:maxR };
}

function aggRadar(games) {
  if (!games.length) return null;
  const wld = aggWLD(games);

  // 1. Win Rate (0-100)
  const winRate = wld.winPct;

  // 2. Performance vs Higher Rated
  const vsHigher = games.filter(g=>g.ratingDiff<0);
  const vsHigherWin = vsHigher.length ? vsHigher.filter(g=>g.won).length/vsHigher.length*100 : 50;

  // 3. Consistency: lower std dev of monthly winrates = higher score
  const monthly = aggMonthly(games);
  let consistency=50;
  if (monthly.length>1) {
    const rates = monthly.map(m=>m.winRate);
    const avg = rates.reduce((s,r)=>s+r,0)/rates.length;
    const variance = rates.reduce((s,r)=>s+(r-avg)**2,0)/rates.length;
    const std = Math.sqrt(variance);
    consistency = Math.max(0, Math.min(100, 100 - std));
  }

  // 4. Activity Score: games per week relative to 10/week = 100
  const sorted = [...games].sort((a,b)=>a.endTime-b.endTime);
  const periods = sorted.length && (sorted[sorted.length-1].endTime - sorted[0].endTime);
  const weeks = periods ? periods/604800000 : 1;
  const activity = Math.min(100, (games.length/Math.max(weeks,1))*10);

  // 5. Opening Diversity — absolute unique opening count, scaled: ~15 distinct openings = 100
  const withOpening = games.filter(g=>g.opening);
  const uniqueOp = new Set(withOpening.map(g=>g.opening)).size;
  const diversity = Math.min(100, Math.round(uniqueOp / 15 * 100));

  return [
    { label: 'Win Rate', value: Math.round(winRate) },
    { label: 'vs Higher', value: Math.round(vsHigherWin) },
    { label: 'Consistency', value: Math.round(consistency) },
    { label: 'Activity', value: Math.round(activity) },
    { label: 'Opening\nDiversity', value: Math.round(diversity) },
  ];
}

function aggRatingProgression(games) {
  const sorted = [...games].filter(g=>g.rating>0).sort((a,b)=>a.endTime-b.endTime);
  if (!sorted.length) return [];
  const step = Math.max(1, Math.floor(sorted.length/200));
  const pts = sorted.filter((_,i)=>i%step===0);
  if (pts[pts.length-1]!==sorted[sorted.length-1]) pts.push(sorted[sorted.length-1]);
  return pts.map((g,i,arr) => {
    const w5 = arr.slice(Math.max(0,i-4),i+1).map(x=>x.rating);
    const w10 = arr.slice(Math.max(0,i-9),i+1).map(x=>x.rating);
    return {
      endTime: g.endTime,
      rating: g.rating,
      ma5: Math.round(w5.reduce((s,r)=>s+r,0)/w5.length),
      ma10: Math.round(w10.reduce((s,r)=>s+r,0)/w10.length),
    };
  });
}

function aggResultBreakdown(games) {
  const m = {};
  games.forEach(g => {
    const k = g.result;
    m[k]=(m[k]||0)+1;
  });
  const total = games.length;
  return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v])=>({
    label: k.charAt(0).toUpperCase()+k.slice(1),
    count: v,
    pct: total?Math.round(v/total*100):0,
  }));
}

function aggKeyMetrics(games, stats) {
  if (!games.length) return null;
  const sorted = [...games].sort((a,b)=>a.endTime-b.endTime);
  const wld = aggWLD(games);
  const ratings = games.map(g=>g.rating).filter(Boolean);
  const avgRating = ratings.length ? Math.round(ratings.reduce((s,r)=>s+r,0)/ratings.length) : 0;
  const first = sorted[0]?.rating||0;
  const last = sorted[sorted.length-1]?.rating||0;
  const ratingChange = last-first;
  const streaks = aggStreaks(games);

  return {
    totalGames: wld.total,
    winRate: Math.round(wld.winPct),
    avgRating,
    bestStreak: streaks.best,
    ratingChange,
    currentRating: last,
  };
}

// ─── SVG CHART HELPERS ───────────────────────────────────────────────────────

function smoothPath(pts, t=0.35) {
  if (pts.length<2) return pts.length?`M${pts[0].x},${pts[0].y}`:'';
  let d=`M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i=0;i<pts.length-1;i++) {
    const p0=pts[Math.max(0,i-1)], p1=pts[i], p2=pts[i+1], p3=pts[Math.min(pts.length-1,i+2)];
    const c1x=p1.x+(p2.x-p0.x)*t, c1y=p1.y+(p2.y-p0.y)*t;
    const c2x=p2.x-(p3.x-p1.x)*t, c2y=p2.y-(p3.y-p1.y)*t;
    d+=` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

// Simple vertical bar chart → returns SVG string
// showPctGrid=false omits the 0/25/50/75/100% grid lines (use for count-based charts)
// valueFormat overrides the top-of-bar label; default shows "N%" for pct charts, "N" for count charts
function barChartSVG(data, opts={}) {
  const { W=400, H=160, color='#4caf7d', PL=10, PB=24, showLabels=true, showPctGrid=true, valueFormat } = opts;
  const PR=10, PT=8;
  const cW=W-PL-PR, cH=H-PT-PB;
  const max=Math.max(...data.map(d=>d.value),1);
  const gap=cW/data.length;
  const bw=Math.max(4,Math.min(30,gap*0.6));
  const fmtVal = valueFormat || (showPctGrid ? v => v>0?Math.round(v)+'%':'' : v => v>0?String(Math.round(v)):'');
  const bars=data.map((d,i)=>{
    const x=PL+i*gap+gap/2;
    const h=Math.max(0,(d.value/max)*cH);
    const c=d.color||color;
    const valStr=fmtVal(d.value);
    const label=showLabels?`<text x="${x.toFixed(1)}" y="${H-3}" text-anchor="middle" fill="#9e8350" font-size="9">${escapeHtml(d.label)}</text>`:'';
    return `<rect x="${(x-bw/2).toFixed(1)}" y="${(PT+cH-h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${c}" rx="2.5"/>
      ${valStr?`<text x="${x.toFixed(1)}" y="${(PT+cH-h-3).toFixed(1)}" text-anchor="middle" fill="#f6e7bf" font-size="8.5">${valStr}</text>`:''}
      ${label}`;
  }).join('');
  const grid=showPctGrid?[0,25,50,75,100].map(v=>`<line x1="${PL}" y1="${(PT+cH*(1-v/100)).toFixed(1)}" x2="${W-PR}" y2="${(PT+cH*(1-v/100)).toFixed(1)}" stroke="#1e1e1e" stroke-dasharray="3,4"/><text x="${PL-2}" y="${(PT+cH*(1-v/100)+3).toFixed(1)}" text-anchor="end" fill="#555" font-size="8">${v}%</text>`).join(''):'';
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" style="display:block">
    <line x1="${PL}" y1="${PT+cH}" x2="${W-PR}" y2="${PT+cH}" stroke="#2a2a2a"/>
    ${grid}
    ${bars}
  </svg>`;
}

// Horizontal bar chart → returns SVG string
function horizBarSVG(data, opts={}) {
  const { W=380, color='#4caf7d', rowH=26, labelW=110 } = opts;
  const PR=70, total=data.length;
  const H=total*rowH+10;
  const maxVal=Math.max(...data.map(d=>d.value),1);
  const trackW=W-labelW-PR;
  const rows=data.map((d,i)=>{
    const y=i*rowH+rowH/2;
    const bw=Math.max(0,(d.value/maxVal)*trackW);
    const c=d.color||color;
    return `<text x="${labelW-6}" y="${(y+4).toFixed(1)}" text-anchor="end" fill="#9e8350" font-size="10">${escapeHtml(d.label)}</text>
      <rect x="${labelW}" y="${(y-6).toFixed(1)}" width="${trackW.toFixed(1)}" height="12" fill="#1e1e1e" rx="2"/>
      <rect x="${labelW}" y="${(y-6).toFixed(1)}" width="${bw.toFixed(1)}" height="12" fill="${c}" rx="2"/>
      <text x="${(labelW+trackW+6).toFixed(1)}" y="${(y+4).toFixed(1)}" fill="#f6e7bf" font-size="10">${typeof d.value==='number'?d.value.toFixed(d.value%1?1:0):''}${d.suffix||''}</text>`;
  }).join('');
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" style="display:block">${rows}</svg>`;
}

// Line chart → returns SVG string
function lineChartSVG(points, opts={}) {
  const { W=580, H=180, color='#4caf7d', gradId='lg', PL=46, PR=12, PT=10, PB=28, yMin, yMax, showArea=true, extra=[] } = opts;
  if (!points.length) return '';
  const cW=W-PL-PR, cH=H-PT-PB;
  const allY = [...points.map(p=>p.y), ...extra.flatMap(s=>s.pts.map(p=>p.y))];
  const minY=(yMin!==undefined?yMin:Math.min(...allY))-5;
  const maxY=(yMax!==undefined?yMax:Math.max(...allY))+5;
  const rY=Math.max(maxY-minY,1);
  const minX=Math.min(...points.map(p=>p.x)), maxX=Math.max(...points.map(p=>p.x));
  const rX=Math.max(maxX-minX,1);
  const toSvg=pts=>pts.map(p=>({x:PL+(p.x-minX)/rX*cW, y:PT+cH-(p.y-minY)/rY*cH}));
  const svgPts=toSvg(points);
  const path=smoothPath(svgPts);
  const areaPath=path+` L${svgPts[svgPts.length-1].x.toFixed(1)},${PT+cH} L${svgPts[0].x.toFixed(1)},${PT+cH} Z`;
  const ySteps=[0,.25,.5,.75,1].map(f=>({val:(minY+f*rY).toFixed(0),y:PT+cH*(1-f)}));
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" style="display:block;overflow:visible">
    <defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0.02"/>
    </linearGradient></defs>
    ${ySteps.map(s=>`<line x1="${PL}" y1="${s.y.toFixed(1)}" x2="${W-PR}" y2="${s.y.toFixed(1)}" stroke="#1e1e1e" stroke-dasharray="3,4"/>
      <text x="${PL-3}" y="${(s.y+3).toFixed(1)}" text-anchor="end" fill="#555" font-size="9">${s.val}</text>`).join('')}
    ${showArea?`<path d="${areaPath}" fill="url(#${gradId})"/>`:''}
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${extra.map(s=>`<path d="${smoothPath(toSvg(s.pts))}" fill="none" stroke="${s.color}" stroke-width="${s.width||1.5}" stroke-dasharray="${s.dash||''}" stroke-linecap="round"/>`).join('')}
  </svg>`;
}

// Radar / Spider chart → returns SVG string
function radarSVG(metrics, size=200) {
  if (!metrics||!metrics.length) return '';
  const n=metrics.length, cx=size/2, cy=size/2, r=size/2-32;
  const ang=i=>(i/n*360-90)*Math.PI/180;
  const pt=(i,frac)=>({x:cx+r*frac*Math.cos(ang(i)),y:cy+r*frac*Math.sin(ang(i))});
  const axPts=metrics.map((_,i)=>pt(i,1));
  const refCircles=[.25,.5,.75,1].map(f=>`<polygon points="${metrics.map((_,i)=>{const p=pt(i,f);return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;}).join(' ')}" fill="none" stroke="#242424" stroke-width="1"/>`).join('');
  const axes=axPts.map(p=>`<line x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="#2a2a2a" stroke-width="1"/>`).join('');
  const dataPts=metrics.map((m,i)=>pt(i,Math.max(0,m.value)/100));
  const poly=`<polygon points="${dataPts.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" fill="rgba(76,175,125,0.18)" stroke="#4caf7d" stroke-width="2"/>`;
  const dots=dataPts.map(p=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="#4caf7d"/>`).join('');
  const labels=metrics.map((m,i)=>{
    const lp=pt(i,1.28);
    const lines=m.label.split('\n');
    return lines.map((l,li)=>`<text x="${lp.x.toFixed(1)}" y="${(lp.y+(li-Math.floor(lines.length/2))*11).toFixed(1)}" text-anchor="middle" fill="#9e8350" font-size="9.5">${escapeHtml(l)}</text>`).join('');
  }).join('');
  const vals=dataPts.map((p,i)=>`<text x="${p.x.toFixed(1)}" y="${(p.y-6).toFixed(1)}" text-anchor="middle" fill="#f6e7bf" font-size="9" font-weight="700">${metrics[i].value}</text>`).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${refCircles}${axes}${poly}${dots}${labels}${vals}</svg>`;
}

// Donut chart → returns SVG string
function donutSVG(slices, sz=140) {
  const cx=sz/2, cy=sz/2, r=sz/2-14, sw=14, C=2*Math.PI*r;
  let offset=C/4;
  const arcs=slices.map(s=>{
    const dash=s.frac*C, gap=C-dash;
    const el=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${sw}"
      stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
      stroke-dashoffset="${offset.toFixed(2)}" stroke-linecap="butt"/>`;
    offset-=s.frac*C;
    return el;
  });
  return `<svg width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#1e1e1e" stroke-width="${sw}"/>
    ${arcs.join('')}
  </svg>`;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function qs(id) { return document.getElementById(id); }
function el(id) { return qs(id) || { innerHTML:'', style:{} }; }
function renderInto(id, fn) { const e = qs(id); if (e) fn(e); }

function showState(s) {
  ['paLoading','paError','paContent'].forEach(id=>{ const e=qs(id); if(e) e.style.display='none'; });
  const t=s==='loading'?'paLoading':s==='error'?'paError':'paContent';
  const e=qs(t); if(e) e.style.display='';
}

function winColor(pct) { return pct>=55?'#4caf7d':pct>=45?'#d4af37':'#ef5350'; }
function clamp(num, min, max) { return Math.max(min, Math.min(max, num)); }
function toFiniteNumber(value) {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}
function isFiniteNumber(value) { return toFiniteNumber(value) !== null; }
function meanNumber(values) {
  const nums = values.map(toFiniteNumber).filter(value => value !== null);
  return nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : null;
}

function safeImageUrl(value) {
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const url = new URL(String(value || ''), base);
    if (url.protocol === 'http:' || url.protocol === 'https:') return escapeAttr(url.href);
  } catch { /* invalid URL – return empty */ }
  return '';
}

// ─── RENDER: PROFILE ─────────────────────────────────────────────────────────

function renderProfile(profile, stats) {
  renderInto('paProfileHeader', e => {
  const badge=(lbl,so,icon)=>{
    if(!so) return '';
    const cur=so.last?.rating??'–', peak=so.best?.rating??so.last?.rating??'–';
    return `<div class="pa-rating-badge"><div class="pa-rating-icon">${icon}</div><div>
      <div class="pa-rating-label">${lbl}</div>
      <div class="pa-rating-val">${cur} <span class="pa-rating-peak">peak ${peak}</span></div>
    </div></div>`;
  };
  const joined=profile.joined?new Date(profile.joined*1000).toLocaleDateString('en-US',{month:'short',year:'numeric'}):'–';
  const username = escapeHtml(profile.username || _state.username || 'Player');
  const usernameAttr = escapeAttr(profile.username || _state.username || 'Player');
  const avatar = safeImageUrl(profile.avatar);
  e.innerHTML=`<div class="pa-profile-card">
    <div class="pa-profile-left">
      ${avatar?`<img class="pa-avatar" src="${avatar}" alt="${usernameAttr}" onerror="this.style.display='none'">`:`<div class="pa-avatar-ph">&#9822;</div>`}
      <div class="pa-profile-info">
        <h2 class="pa-username">${username}'s Dashboard</h2>
        ${profile.name?`<p class="pa-realname">${escapeHtml(profile.name)}</p>`:''}
        <div class="pa-profile-meta">
          <span>Member since ${joined}</span>
          ${profile.followers?`<span>&#9829; ${profile.followers.toLocaleString()} followers</span>`:''}
          ${profile.title?`<span class="pa-title-badge">${escapeHtml(profile.title)}</span>`:''}
        </div>
      </div>
    </div>
    <div class="pa-ratings-row">
      ${badge('Rapid',stats.chess_rapid,'&#9201;')}
      ${badge('Blitz',stats.chess_blitz,'&#9889;')}
      ${badge('Bullet',stats.chess_bullet,'&#128248;')}
      ${badge('Daily',stats.chess_daily,'&#128197;')}
    </div>
  </div>`;
  });
}

// ─── RENDER: KEY METRICS ─────────────────────────────────────────────────────

function renderKeyMetrics(games, stats) {
  renderInto('paKeyMetrics', e => {
    const m=aggKeyMetrics(games,stats);
    if(!m){e.innerHTML='';return;}
    const rc=m.ratingChange;
    const rcColor=rc>0?'#4caf7d':rc<0?'#ef5350':'#888';
    const rcSign=rc>0?'+':'';
    const card=(icon,val,lbl,sub='',subColor='')=>`<div class="pa-metric-card">
      <div class="pa-metric-icon">${icon}</div>
      <div class="pa-metric-val">${val}</div>
      <div class="pa-metric-lbl">${lbl}</div>
      ${sub?`<div class="pa-metric-sub" style="color:${subColor}">${sub}</div>`:''}
    </div>`;
    e.innerHTML=`
      ${card('&#9823;',m.totalGames.toLocaleString(),'Total Games','in period','#9e8350')}
      ${card('&#9989;',m.winRate+'%','Win Rate',m.winRate>=50?'Above 50%':'Below 50%',m.winRate>=50?'#4caf7d':'#ef5350')}
      ${card('&#9733;',m.avgRating,'Avg Rating','')}
      ${card('&#127942;',m.bestStreak,'Best Win Streak','consecutive wins','#d4af37')}
      ${card('&#128200;',`${rcSign}${rc}`,'Rating Change',rc!==0?`${rcSign}${Math.round(Math.abs(rc)/Math.max(m.avgRating,1)*100)}%`:'',rcColor)}
      ${card('&#128280;',m.currentRating,'Current Rating','end of period','')}
    `;
  });
}

// ─── RENDER: SUMMARY BAR ─────────────────────────────────────────────────────

function renderSummaryBar(games) {
  renderInto('paSummaryBar', e => {
    if(!games.length){e.innerHTML='';return;}
    const {total,winPct}=aggWLD(games);
    const {current:streak,currentType:sType}=aggStreaks(games);
    const sc=sType==='win'?'#4caf7d':sType==='loss'?'#ef5350':'#888';
    const sl=sType==='win'?'WIN':sType==='loss'?'LOSS':'DRAW';
    e.innerHTML=`<span class="pa-sum-item">WIN RATE: <strong>${Math.round(winPct)}%</strong></span>
      <span class="pa-sum-sep">&#9679;</span>
      <span class="pa-sum-item">STREAK: <strong style="color:${sc}">${streak} ${sl}</strong></span>
      <span class="pa-sum-sep">&#9679;</span>
      <span class="pa-sum-item">GAMES: <strong>${total}</strong></span>`;
  });
}

// ─── RENDER: ACCURACY + QUALITY RECAP ────────────────────────────────────────

const PA_QUALITY_ROWS = [
  { key: 'brilliant', label: 'Brilliant', icon: '!!', className: 'pa-q-brilliant' },
  { key: 'great', label: 'Great', icon: '!', className: 'pa-q-great' },
  { key: 'book', label: 'Book', icon: '&#128214;', className: 'pa-q-book' },
  { key: 'best', label: 'Best', icon: '&#9733;', className: 'pa-q-best' },
  { key: 'excellent', label: 'Excellent', icon: '&#128077;', className: 'pa-q-excellent' },
  { key: 'good', label: 'Good', icon: '&#10003;', className: 'pa-q-good' },
  { key: 'inaccuracy', label: 'Inaccuracy', icon: '?!', className: 'pa-q-inaccuracy' },
  { key: 'mistake', label: 'Mistake', icon: '?', className: 'pa-q-mistake' },
  { key: 'miss', label: 'Miss', icon: '&#215;', className: 'pa-q-miss' },
  { key: 'blunder', label: 'Blunder', icon: '??', className: 'pa-q-blunder' },
];

function emptyQualityCounts() {
  return PA_QUALITY_ROWS.reduce((acc, row) => {
    acc[row.key] = 0;
    return acc;
  }, {});
}

function allocateQualityCounts(weights, total) {
  const keys = Object.keys(weights);
  const weightTotal = keys.reduce((sum, key) => sum + Math.max(weights[key], 0), 0) || 1;
  const raw = keys.map(key => {
    const exact = Math.max(total, 0) * Math.max(weights[key], 0) / weightTotal;
    return { key, floor: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let assigned = raw.reduce((sum, item) => sum + item.floor, 0);
  raw.sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; assigned < total && i < raw.length; i++, assigned++) {
    raw[i].floor += 1;
  }
  return raw.reduce((acc, item) => {
    acc[item.key] = item.floor;
    return acc;
  }, {});
}

function estimateQualityCounts(game, side) {
  const accuracy = toFiniteNumber(side === 'player' ? game.accuracy : game.oppAccuracy);
  if (accuracy === null) return null;

  const sideMoves = clamp(Math.round(game.moveCount || 28), 6, 90);
  const book = clamp(Math.round(sideMoves * 0.14), 1, 5);
  const remaining = Math.max(sideMoves - book, 0);
  const won = side === 'player' ? game.won : game.lost;
  const lost = side === 'player' ? game.lost : game.won;
  const error = clamp((100 - accuracy) / 100, 0.01, 0.6);
  const sharpBonus = clamp((accuracy - 88) / 18, 0, 1);
  const lowError = clamp((accuracy - 75) / 25, 0, 1);

  const weights = {
    brilliant: accuracy >= 94 ? 0.012 + (won ? 0.004 : 0) : accuracy >= 90 && won ? 0.005 : 0,
    great: 0.018 + sharpBonus * 0.028,
    best: 0.24 + (accuracy / 100) * 0.24,
    excellent: 0.18 + lowError * 0.09,
    good: 0.18 + lowError * 0.05,
    inaccuracy: 0.04 + error * 0.38,
    mistake: 0.012 + error * 0.24,
    miss: 0.006 + error * 0.09 + (lost ? 0.008 : 0),
    blunder: 0.006 + error * 0.12 + (lost ? 0.018 : 0),
  };

  if (won) {
    weights.mistake *= 0.75;
    weights.blunder *= 0.7;
    weights.best *= 1.08;
  }

  const counts = emptyQualityCounts();
  Object.assign(counts, allocateQualityCounts(weights, remaining));
  counts.book = book;
  return counts;
}

function buildQualitySummary(games, side) {
  const reviewed = games.filter(game => isFiniteNumber(side === 'player' ? game.accuracy : game.oppAccuracy));
  const counts = emptyQualityCounts();
  reviewed.forEach(game => {
    const next = estimateQualityCounts(game, side);
    if (!next) return;
    PA_QUALITY_ROWS.forEach(row => { counts[row.key] += next[row.key] || 0; });
  });
  const avgAccuracy = meanNumber(reviewed.map(game => side === 'player' ? game.accuracy : game.oppAccuracy));
  const avgRating = meanNumber(reviewed.map(game => side === 'player' ? game.rating : game.oppRating));
  const gameRating = avgAccuracy === null
    ? null
    : Math.round(clamp((avgAccuracy * 22.5) + 70 + (((avgRating || 1400) - 1400) * 0.08), 400, 3000));
  return {
    reviewed: reviewed.length,
    counts,
    avgAccuracy,
    avgRating,
    gameRating,
  };
}

function renderAccuracyRecap(games) {
  renderInto('paAccuracyRecap', e => {
    if (!games.length) {
      e.innerHTML = '';
      return;
    }

    const player = buildQualitySummary(games, 'player');
    const opponent = buildQualitySummary(games, 'opponent');
    if (!player.reviewed && !opponent.reviewed) {
      e.innerHTML = '<p class="pa-no-data">No Chess.com accuracy data is available for this filter.</p>';
      return;
    }

    const playerName = escapeHtml((_state.profile && _state.profile.username) || _state.username || 'Player');
    const playerAvg = player.avgRating === null ? '—' : Math.round(player.avgRating).toLocaleString();
    const opponentAvg = opponent.avgRating === null ? '—' : Math.round(opponent.avgRating).toLocaleString();
    const playerAcc = player.avgAccuracy === null ? '—' : player.avgAccuracy.toFixed(1) + '%';
    const opponentAcc = opponent.avgAccuracy === null ? '—' : opponent.avgAccuracy.toFixed(1) + '%';
    const playerRating = player.gameRating === null ? '—' : player.gameRating.toLocaleString();
    const opponentRating = opponent.gameRating === null ? '—' : opponent.gameRating.toLocaleString();

    const rows = PA_QUALITY_ROWS.map(row => `<div class="pa-quality-row">
      <div class="pa-quality-label">${row.label}</div>
      <div class="pa-quality-count">${player.counts[row.key] || 0}</div>
      <div class="pa-quality-icon ${row.className}">${row.icon}</div>
      <div class="pa-quality-count">${opponent.counts[row.key] || 0}</div>
    </div>`).join('');

    e.innerHTML = `<div class="pa-quality-players">
      <div class="pa-quality-player is-player">
        <div class="pa-quality-piece">&#9817;</div>
        <div class="pa-quality-player-main">
          <div class="pa-quality-side">Player</div>
          <div class="pa-quality-name">${playerName}</div>
          <div class="pa-quality-elo">${playerAvg} Elo</div>
        </div>
        <div class="pa-quality-accuracy">
          <span>Accuracy</span>
          <strong>${playerAcc}</strong>
        </div>
      </div>
      <div class="pa-quality-player">
        <div class="pa-quality-piece">&#9823;</div>
        <div class="pa-quality-player-main">
          <div class="pa-quality-side">Opponents</div>
          <div class="pa-quality-name">Field average</div>
          <div class="pa-quality-elo">${opponentAvg} Elo</div>
        </div>
        <div class="pa-quality-accuracy">
          <span>Accuracy</span>
          <strong>${opponentAcc}</strong>
        </div>
      </div>
    </div>
    <div class="pa-quality-table">${rows}</div>
    <div class="pa-quality-footer">
      <div class="pa-quality-rating">
        <span>Game Rating</span>
        <strong>${playerRating}</strong>
      </div>
      <div class="pa-quality-rating">
        <span>Opponent Rating</span>
        <strong>${opponentRating}</strong>
      </div>
    </div>`;
  });
}

// ─── RENDER: WIN/LOSS/DRAW ────────────────────────────────────────────────────

function renderWLD(games) {
  renderInto('paWLDCard', e => {
    const {wins,losses,draws,total,winPct}=aggWLD(games);
    if(!total){e.innerHTML='<p class="pa-no-data">No games in period</p>';return;}
    const wF=wins/total,lF=losses/total,dF=draws/total;
    const slices=[{frac:wF,color:'#4caf7d'},{frac:lF,color:'#ef5350'},{frac:dF,color:'#444'}];
    e.innerHTML=`<div class="pa-card-title">WIN / LOSS / DRAW <span class="pa-card-sub">${total} games in period</span></div>
  <div class="pa-wld-inner">
    <div class="pa-donut-wrap" style="position:relative">
      ${donutSVG(slices,161)}
      <div class="pa-donut-center">
        <div class="pa-donut-pct">${Math.round(winPct)}%</div>
        <div class="pa-donut-lbl">Win Rate</div>
      </div>
    </div>
    <div class="pa-wld-legend">
      <div class="pa-wld-row"><span class="pa-dot" style="background:#4caf7d"></span><span class="pa-wld-num">${wins}W</span><span class="pa-wld-pct">${Math.round(wF*100)}%</span></div>
      <div class="pa-wld-row"><span class="pa-dot" style="background:#ef5350"></span><span class="pa-wld-num">${losses}L</span><span class="pa-wld-pct">${Math.round(lF*100)}%</span></div>
      <div class="pa-wld-row"><span class="pa-dot" style="background:#444"></span><span class="pa-wld-num">${draws}D</span><span class="pa-wld-pct">${Math.round(dF*100)}%</span></div>
    </div>
  </div>`;
  });
}

// ─── RENDER: RATING HISTORY ──────────────────────────────────────────────────

function renderRatingHistory(games) {
  renderInto('paRatingCard', e => {
    const sorted=[...games].filter(g=>g.rating>0).sort((a,b)=>a.endTime-b.endTime);
    if(sorted.length<3){e.innerHTML='<p class="pa-no-data">Not enough data for rating history</p>';return;}
    const step=Math.max(1,Math.floor(sorted.length/150));
    const pts=sorted.filter((_,i)=>i%step===0||i===sorted.length-1);
    const data=pts.map(g=>({x:g.endTime,y:g.rating}));
    const cur=sorted[sorted.length-1].rating, first=sorted[0].rating;
    const diff=cur-first, sign=diff>=0?'+':'', dc=diff>=0?'#4caf7d':'#ef5350';
    e.innerHTML=`<div class="pa-card-title">RATING HISTORY <span style="float:right;color:#9e8350;font-size:10px">${first}\u2192${cur} Elo</span></div>
      ${lineChartSVG(data,{color:'#a78bfa',gradId:'rg1'})}
      <div class="pa-chart-footer">
        <span class="pa-chart-big" style="color:#a78bfa">${cur}</span>
        <span style="color:${dc};font-size:13px;margin-left:8px">(${sign}${diff} pts)</span>
        <span class="pa-chart-label"> over the period</span>
      </div>`;
  });
}

// ─── RENDER: WINS BY DAY ─────────────────────────────────────────────────────

function renderWinsByDay(games) {
  renderInto('paByDayCard', e => {
    const dayMap={};
    games.forEach(g=>{
      const d=new Date(g.endTime);
      const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if(!dayMap[k]) dayMap[k]={wins:0,losses:0,draws:0,d};
      if(g.won)dayMap[k].wins++;else if(g.lost)dayMap[k].losses++;else dayMap[k].draws++;
    });
    const days=Object.keys(dayMap).sort();
    if(!days.length){e.innerHTML='<p class="pa-no-data">No daily data</p>';return;}
    const maxG=Math.max(...days.map(dk=>dayMap[dk].wins+dayMap[dk].losses+dayMap[dk].draws));
    const W=580,H=140,PL=16,PR=10,PT=8,PB=32;
    const cW=W-PL-PR,cH=H-PT-PB,gapW=cW/days.length;
    const bw=Math.max(2,Math.min(10,gapW*0.38));
    const bars=days.map((dk,i)=>{
      const {wins,losses}=dayMap[dk];
      const x=PL+i*gapW+gapW/2;
      const wh=maxG?(wins/maxG)*cH:0, lh=maxG?(losses/maxG)*cH:0;
      return `<rect x="${(x-bw-1).toFixed(1)}" y="${(PT+cH-wh).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(wh,0).toFixed(1)}" fill="#4caf7d" rx="1.5"/>
        <rect x="${(x+1).toFixed(1)}" y="${(PT+cH-lh).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(lh,0).toFixed(1)}" fill="#ef5350" rx="1.5"/>`;
    }).join('');
    const evN=Math.max(1,Math.ceil(days.length/9));
    const xLbls=days.filter((_,i)=>i%evN===0).map(dk=>{
      const i=days.indexOf(dk),x=PL+i*gapW+gapW/2;
      const dt=dayMap[dk].d;
      return `<text x="${x.toFixed(1)}" y="${H-4}" text-anchor="middle" fill="#9e8350" font-size="8.5">${dt.toLocaleString('default',{month:'short'})} ${dt.getDate()}</text>`;
    }).join('');
    e.innerHTML=`<div class="pa-card-title">WINS / LOSSES BY DAY</div>
      <svg width="100%" viewBox="0 0 ${W} ${H}" style="display:block">
        <line x1="${PL}" y1="${PT+cH}" x2="${W-PR}" y2="${PT+cH}" stroke="#2a2a2a"/>
        ${bars}${xLbls}
      </svg>
      <div class="pa-legend-row">
        <span class="pa-leg-item"><span class="pa-dot" style="background:#4caf7d"></span>Wins</span>
        <span class="pa-leg-item"><span class="pa-dot" style="background:#ef5350"></span>Losses</span>
      </div>`;
  });
}

// ─── RENDER: STREAKS ─────────────────────────────────────────────────────────

function renderStreaks(games) {
  renderInto('paStreaksCard', e => {
    if(!games.length){e.innerHTML='<p class="pa-no-data">No streak data in period</p>';return;}
    const {current,currentType,best,minRating,maxRating}=aggStreaks(games);
    const sColor=currentType==='win'?'#4caf7d':currentType==='loss'?'#ef5350':'#888';
    const sLbl=currentType==='win'?'Wins':currentType==='loss'?'Losses':'Draws';
    e.innerHTML=`<div class="pa-streaks-inner">
      <div class="pa-streak-box">
        <div class="pa-streak-icon" style="background:${currentType==='win'?'rgba(76,175,125,.15)':'rgba(239,83,80,.15)'}">&#9889;</div>
        <div><div class="pa-streak-num" style="color:${sColor}">${current}</div><div class="pa-streak-lbl">${sLbl}<br>Current Streak</div></div>
      </div>
      <div class="pa-streak-stats">
        <div class="pa-streak-row"><span>&#127942; Best Win Streak</span><strong>${best}</strong></div>
        <div class="pa-streak-row"><span>Elo range in period:</span><strong>${minRating}\u2013${maxRating} (${maxRating-minRating} pts)</strong></div>
      </div>
    </div>`;
  });
}

// ─── RENDER: WIN RATE BY TIME CONTROL ────────────────────────────────────────

function renderByTC(allGames) {
  renderInto('paByTCCard', e => {
    const data=aggByTC(allGames);
    if(!data.length){e.innerHTML='<p class="pa-no-data">No time control data</p>';return;}
    const tcColors={'rapid':'#4caf7d','blitz':'#d4af37','bullet':'#ef5350','daily':'#a78bfa'};
    const barData=data.map(d=>({label:`${d.tc.charAt(0).toUpperCase()+d.tc.slice(1)}\n${d.games}g`,value:d.winRate,color:tcColors[d.tc]||'#4caf7d'}));
    e.innerHTML=`<div class="pa-card-title">WIN RATE BY TIME CONTROL</div>
      ${barChartSVG(barData,{W:320,H:160,PL:28})}
      <div class="pa-tc-legend">
        ${data.map(d=>`<div class="pa-tc-row">
          <span class="pa-dot" style="background:${tcColors[d.tc]||'#4caf7d'}"></span>
          <span>${d.tc.charAt(0).toUpperCase()+d.tc.slice(1)}</span>
          <span class="pa-tc-games">${d.games} games</span>
          <span style="color:${winColor(d.winRate)};font-weight:700">${Math.round(d.winRate)}%</span>
        </div>`).join('')}
      </div>`;
  });
}

// ─── RENDER: GAME FREQUENCY BY DAY OF WEEK ───────────────────────────────────

function renderByDOW(games) {
  renderInto('paByDOWCard', e => {
    const data=aggByDOW(games);
    const barData=data.map(d=>({label:d.day,value:d.games,color:'#d4af37'}));
    e.innerHTML=`<div class="pa-card-title">GAMES BY DAY OF WEEK</div>
      ${barChartSVG(barData,{W:320,H:160,PL:28,PB:24,showPctGrid:false})}
      <div style="font-size:11px;color:#9e8350;margin-top:6px">Most active: <strong style="color:#d4af37">${data.reduce((a,b)=>b.games>a.games?b:a).day}</strong></div>`;
  });
}

// ─── RENDER: MONTHLY TREND ───────────────────────────────────────────────────

function renderMonthlyTrend(games) {
  renderInto('paMonthlyCard', e => {
    const monthly=aggMonthly(games);
    if(monthly.length<2){e.innerHTML='<p class="pa-no-data">Need more data for monthly trends</p>';return;}
    const pts=monthly.map((m,i)=>({x:i,y:m.winRate}));
    const n=pts.length, sumX=pts.reduce((s,_,i)=>s+i,0), sumY=pts.reduce((s,p)=>s+p.y,0);
    const sumXY=pts.reduce((s,p,i)=>s+i*p.y,0), sumX2=pts.reduce((s,_,i)=>s+i*i,0);
    const slope=(n*sumXY-sumX*sumY)/(n*sumX2-sumX**2)||0;
    const intercept=(sumY-slope*sumX)/n;
    const trendPts=[{x:0,y:intercept},{x:n-1,y:slope*(n-1)+intercept}];
    const slopeDir=slope>0.5?'&#8599; Improving':slope<-0.5?'&#8600; Declining':'&#8594; Stable';
    const slopeColor=slope>0.5?'#4caf7d':slope<-0.5?'#ef5350':'#d4af37';
    const W=580, extra=[{pts:trendPts,color:'rgba(212,175,55,.6)',width:1.5,dash:'6,4'}];
    e.innerHTML=`<div class="pa-card-title">MONTHLY WIN RATE TREND
      <span style="float:right;color:${slopeColor};font-size:11px">${slopeDir}</span>
    </div>
      ${lineChartSVG(pts,{W,color:'#4caf7d',gradId:'mg1',yMin:0,yMax:100,extra,PL:36})}
      <div class="pa-monthly-labels">
        ${monthly.map(m=>`<span class="pa-month-lbl">${m.month.slice(5)}</span>`).join('')}
      </div>
      <div style="font-size:11px;color:#9e8350;margin-top:4px">
        ${monthly.map(m=>`<span style="color:${winColor(m.winRate)}">${Math.round(m.winRate)}%</span>`).join(' \u2192 ')}
      </div>`;
  });
}

// ─── RENDER: RATING PROGRESSION ──────────────────────────────────────────────

function renderRatingProg(games) {
  renderInto('paRatingProgCard', e => {
    const prog=aggRatingProgression(games);
    if(prog.length<3){e.innerHTML='<p class="pa-no-data">Not enough data for rating progression</p>';return;}
    const pts=prog.map((p,i)=>({x:i,y:p.rating}));
    const extra=[
      {pts:prog.map((p,i)=>({x:i,y:p.ma5})),color:'#d4af37',width:1.5},
      {pts:prog.map((p,i)=>({x:i,y:p.ma10})),color:'#ef5350',width:1.5},
    ];
    e.innerHTML=`<div class="pa-card-title">RATING PROGRESSION WITH MOVING AVERAGES</div>
      ${lineChartSVG(pts,{W:580,H:200,color:'rgba(167,139,250,0.4)',gradId:'rp1',showArea:false,extra,PL:46})}
      <div class="pa-legend-row" style="margin-top:8px">
        <span class="pa-leg-item"><span class="pa-dot" style="background:rgba(167,139,250,0.7)"></span>Rating</span>
        <span class="pa-leg-item"><span class="pa-dot" style="background:#d4af37"></span>5-game MA</span>
        <span class="pa-leg-item"><span class="pa-dot" style="background:#ef5350"></span>10-game MA</span>
      </div>`;
  });
}

// ─── RENDER: RATING DIFF ANALYSIS ────────────────────────────────────────────

function renderRatingDiff(games) {
  renderInto('paRatingDiffCard', e => {
    const data=aggRatingDiff(games);
    if(!data.length){e.innerHTML='<p class="pa-no-data">No rating diff data</p>';return;}
    const barData=data.map(d=>({label:d.label,value:d.winRate,color:d.winRate>=50?'#4caf7d':'#ef5350'}));
    e.innerHTML=`<div class="pa-card-title">WIN RATE VS RATING DIFFERENCE
      <span class="pa-card-sub">(your rating \u2212 opponent)</span>
    </div>
      ${barChartSVG(barData,{W:340,H:165,PL:12})}
      <div style="font-size:10px;color:#9e8350;margin-top:4px">Green = you win more, Red = you lose more</div>`;
  });
}

// ─── RENDER: OPPONENT STRENGTH ────────────────────────────────────────────────

function renderOppStrength(games) {
  renderInto('paOppStrengthCard', e => {
    const data=aggOppStrength(games);
    if(!data.length){e.innerHTML='<p class="pa-no-data">No opponent data</p>';return;}
    e.innerHTML=`<div class="pa-card-title">PERFORMANCE VS OPPONENT STRENGTH</div>
      ${horizBarSVG(data.map(d=>({label:d.label,value:d.winRate,suffix:'%',color:winColor(d.winRate),games:d.games})),{W:360,labelW:110})}
      <div style="font-size:10px;color:#9e8350;margin-top:6px">Win rate against each opponent rating bracket</div>`;
  });
}

// ─── RENDER: RESULT BREAKDOWN ────────────────────────────────────────────────

function renderResultBreakdown(games) {
  renderInto('paResultBreakdown', e => {
    const data=aggResultBreakdown(games);
    if(!data.length){e.innerHTML='<p class="pa-no-data">No data</p>';return;}
    const resultColors={Win:'#4caf7d',Agreed:'#4caf7d',Checkmated:'#ef5350',Resigned:'#ef5350',Timeout:'#ef9350',Abandoned:'#888',Stalemate:'#d4af37',Repetition:'#d4af37',Insufficient:'#d4af37'};
    e.innerHTML=`<div class="pa-card-title">DETAILED RESULT BREAKDOWN</div>
      ${horizBarSVG(data.map(d=>({label:d.label,value:d.pct,suffix:'%',color:resultColors[d.label]||'#9e8350'})),{W:320,labelW:100,rowH:28})}`;
  });
}

// ─── RENDER: WIN STREAK DISTRIBUTION ─────────────────────────────────────────

function renderStreakDist(games) {
  renderInto('paStreakDist', e => {
    const {distribution}=aggStreaks(games);
    const entries=Object.entries(distribution).sort((a,b)=>Number(a[0])-Number(b[0]));
    if(!entries.length){e.innerHTML='<p class="pa-no-data">No streak data</p>';return;}
    const barData=entries.map(([k,v])=>({label:k==='10'?'10+':k,value:v,color:'#d4af37'}));
    e.innerHTML=`<div class="pa-card-title">WIN STREAK DISTRIBUTION</div>
      ${barChartSVG(barData,{W:320,H:155,PL:16,PB:24,showPctGrid:false})}
      <div style="font-size:10px;color:#9e8350;margin-top:4px;text-align:center">X-axis: win streak length (10 = 10+ in a row)</div>`;
  });
}

// ─── RENDER: HEAD TO HEAD ─────────────────────────────────────────────────────

function renderHeadToHead(games) {
  renderInto('paHeadToHead', e => {
    const data=aggHeadToHead(games);
    if(!data.length){e.innerHTML='<p class="pa-no-data">Not enough opponent data</p>';return;}
    const rows=data.map(d=>{
      const pct=Math.round(d.wins/d.games*100), c=winColor(pct);
      return `<div class="pa-h2h-row">
        <div class="pa-h2h-name">${escapeHtml(d.username)}</div>
        <div class="pa-h2h-record"><span style="color:#4caf7d">${d.wins}W</span> <span style="color:#555">${d.draws}D</span> <span style="color:#ef5350">${d.losses}L</span></div>
        <div class="pa-h2h-games">${d.games} games</div>
        <div class="pa-h2h-pct" style="color:${c}">${pct}%</div>
      </div>`;
    }).join('');
    e.innerHTML=`<div class="pa-card-title">HEAD-TO-HEAD RECORDS <span class="pa-card-sub">top opponents</span></div>
      <div class="pa-h2h-header">
        <span>Opponent</span><span>Record</span><span>Games</span><span>Win %</span>
      </div>
      ${rows}`;
  });
}

// ─── RENDER: PERFORMANCE RADAR ───────────────────────────────────────────────

function renderRadar(games) {
  renderInto('paRadarCard', e => {
    const metrics=aggRadar(games);
    if(!metrics){e.innerHTML='<p class="pa-no-data">Not enough data for radar</p>';return;}
    e.innerHTML=`<div class="pa-card-title">PERFORMANCE RADAR</div>
      <div class="pa-radar-wrap">
        ${radarSVG(metrics,200)}
      </div>
      <div class="pa-radar-legend">
        ${metrics.map(m=>`<div class="pa-radar-item">
          <span class="pa-radar-lbl">${escapeHtml(m.label.replace('\n',' '))}</span>
          <div class="pa-radar-bar"><div style="width:${m.value}%;background:#4caf7d;height:4px;border-radius:2px;transition:width .3s"></div></div>
          <span class="pa-radar-val">${m.value}</span>
        </div>`).join('')}
      </div>`;
  });
}

// ─── RENDER: OPENINGS ────────────────────────────────────────────────────────

function renderOpenings(games) {
  renderInto('paOpenings', e => {
  function topOpenings(arr){
    const m={};
    arr.forEach(g=>{
      if(!g.opening)return;
      if(!m[g.opening]) m[g.opening]={name:g.opening,eco:g.eco||'–',games:0,wins:0};
      m[g.opening].games++; if(g.won)m[g.opening].wins++;
    });
    return Object.values(m).sort((a,b)=>b.games-a.games).slice(0,5);
  }
  const white=topOpenings(games.filter(g=>g.color==='white'));
  const black=topOpenings(games.filter(g=>g.color==='black'));
  function table(arr){
    if(!arr.length) return '<p class="pa-no-data">No opening data</p>';
    return `<table class="pa-op-table"><thead><tr><th>Opening</th><th>ECO</th><th>Games</th><th>Win %</th></tr></thead><tbody>
      ${arr.map(o=>{const pct=Math.round(o.wins/o.games*100);return `<tr>
        <td class="pa-op-name">${escapeHtml(o.name)}</td>
        <td><span class="pa-eco">${escapeHtml(o.eco)}</span></td>
        <td>${o.games}</td>
        <td style="color:${winColor(pct)};font-weight:700">${pct}%</td>
      </tr>`;}).join('')}
    </tbody></table>`;
  }
  const all=games.filter(g=>g.opening);
  // Estimate book exit at ~25% of average game length, bounded to realistic opening depth
  const avgMove=all.length?all.reduce((s,g)=>s+(g.moveCount||16),0)/all.length:40;
  const avgBook=Math.max(4,Math.min(20,Math.round(avgMove*0.25)));
  const bookArc=Math.min(339.3,(avgBook/25)*339.3);
  e.innerHTML=`<div class="pa-section-hdr" style="margin:0 0 16px">
    <div class="pa-sec-icon">&#128218;</div>
    <div><h2 class="pa-sec-title">Opening Repertoire</h2><p class="pa-sec-sub">Your book knowledge &amp; theory gaps</p></div>
  </div>
  <div class="pa-op-grid">
    <div class="pa-op-main">
      <div class="pa-op-header">
        <span class="pa-sub-label">YOUR ARSENAL: TOP 5 OPENINGS</span>
        <div class="pa-color-tabs" id="paOpColorTabs">
          <button class="pa-ctab active" data-c="white">&#9823; White</button>
          <button class="pa-ctab" data-c="black">&#9823; Black</button>
        </div>
      </div>
      <div id="paOpWhite">${table(white)}</div>
      <div id="paOpBlack" style="display:none">${table(black)}</div>
    </div>
    <div class="pa-book-exit">
      <div class="pa-sub-label" style="margin-bottom:10px;text-align:center">BOOK EXIT POINT</div>
      <svg width="140" height="140" viewBox="0 0 140 140" style="display:block;margin:0 auto">
        <circle cx="70" cy="70" r="54" fill="none" stroke="#1e1e1e" stroke-width="10"/>
        <circle cx="70" cy="70" r="54" fill="none" stroke="#d4af37" stroke-width="10"
          stroke-dasharray="${bookArc.toFixed(1)} 339.3" stroke-dashoffset="84.8" stroke-linecap="round"/>
        <text x="70" y="64" text-anchor="middle" fill="#f6e7bf" font-size="30" font-weight="700">${avgBook}</text>
        <text x="70" y="82" text-anchor="middle" fill="#9e8350" font-size="11">avg. move</text>
      </svg>
      <p class="pa-book-desc">You leave main-line theory around move ${avgBook} and start improvising.</p>
    </div>
  </div>`;
  e.querySelectorAll('.pa-ctab').forEach(btn=>{
    bindClick(btn, ()=>{
      e.querySelectorAll('.pa-ctab').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const c=btn.dataset.c;
      qs('paOpWhite').style.display=c==='white'?'':'none';
      qs('paOpBlack').style.display=c==='black'?'':'none';
    });
  });
  });
}

// ─── RENDER: ANATOMY OF LOSS ──────────────────────────────────────────────────

function isSingleBlunderLoss(game) {
  if (!game || !game.lost) return false;
  if (typeof game.accuracy === 'number') {
    const closeGame = typeof game.oppAccuracy === 'number' ? game.oppAccuracy - game.accuracy <= 12 : true;
    if (game.accuracy >= 72 && closeGame) return true;
  }

  const moves = game.moveCount || 0;
  if (!moves) return game.result === 'checkmated';
  if (game.result === 'checkmated') return moves <= 45;
  if (game.result === 'resigned') return moves <= 32;
  if (game.result === 'timeout') return moves <= 30;
  return game.result === 'abandoned' && moves <= 20;
}

function lossRatioDonutSVG(single, gradual, sz = 170) {
  const total = Math.max(single + gradual, 1);
  return donutSVG([
    { frac: single / total, color: '#a15ce5' },
    { frac: gradual / total, color: '#969da9' },
  ], sz);
}

function calcLossBreakdown(games) {
  const losses=games.filter(g=>g.lost);
  const singleBlunder=losses.filter(isSingleBlunderLoss).length;
  const gradualLoss=Math.max(losses.length-singleBlunder,0);
  const lossTerms=[
    ['Resignation', losses.filter(g=>g.result==='resigned').length],
    ['Checkmate',   losses.filter(g=>g.result==='checkmated').length],
    ['Timeout',     losses.filter(g=>g.result==='timeout').length],
    ['Abandoned',   losses.filter(g=>g.result==='abandoned').length],
  ];
  const wh=games.filter(g=>g.color==='white'), bl=games.filter(g=>g.color==='black');
  const wWin=wh.filter(g=>g.won).length, bWin=bl.filter(g=>g.won).length;
  const wPct=wh.length?Math.round(wWin/wh.length*100):0;
  const bPct=bl.length?Math.round(bWin/bl.length*100):0;
  return {losses,singleBlunder,gradualLoss,lossTerms,wh,bl,wWin,bWin,wPct,bPct};
}

function blunderRatioCardHTML(singleBlunder, gradualLoss, losses) {
  return `<div class="pa-loss-card pa-loss-ratio-card">
    <div class="pa-loss-feature-title"><span class="pa-loss-title-icon">&#128202;</span> THE "BLUNDER-TO-WIN" RATIO</div>
    <div class="pa-loss-ratio-body">
      <div class="pa-loss-donut-wrap">${lossRatioDonutSVG(singleBlunder,gradualLoss)}</div>
      <div class="pa-loss-ratio-legend">
        <div class="pa-loss-ratio-item">
          <span class="pa-loss-legend-dot pa-loss-dot-single"></span>
          <div><strong>Single Blunder</strong><span>${singleBlunder} ${singleBlunder===1?'game':'games'} \u2014 one massive mistake</span></div>
        </div>
        <div class="pa-loss-ratio-item">
          <span class="pa-loss-legend-dot pa-loss-dot-gradual"></span>
          <div><strong>Gradual Loss</strong><span>${gradualLoss} ${gradualLoss===1?'game':'games'} \u2014 slowly outplayed</span></div>
        </div>
      </div>
    </div>
  </div>`;
}

function terminationCardHTML(lossTerms, lossCount) {
  return `<div class="pa-loss-card pa-loss-term-card">
    <div class="pa-loss-feature-title">GAME TERMINATIONS</div>
    <div class="pa-loss-term-bars">
      ${lossTerms.map(([lbl,cnt])=>{const pct=Math.round(cnt/lossCount*100);return `
        <div class="pa-loss-term-row">
          <div class="pa-loss-term-head"><span>${lbl}</span><strong>${cnt} (${pct}%)</strong></div>
          <div class="pa-loss-term-track"><div class="pa-loss-term-fill" style="width:${pct}%"></div></div>
        </div>`;}).join('')}
    </div>
  </div>`;
}

function colorPerfCardHTML(wh, bl, wWin, bWin, wPct, bPct) {
  const colorNote=Math.abs(wPct-bPct)<=5
    ?`<div class="pa-color-note pa-note-pos">You're consistent with both colors. Keep it up.</div>`
    :`<div class="pa-color-note pa-note-warn">You perform better as ${wPct>bPct?'White':'Black'}. Focus on your ${wPct>bPct?'Black':'White'} openings.</div>`;
  return `<div class="pa-loss-card pa-color-loss-card">
    <div class="pa-sub-label">&#128200; WHITE VS BLACK PERFORMANCE</div>
    <div class="pa-color-perf">
      <div class="pa-cp-col">
        <div class="pa-cp-piece">&#9823;</div><div class="pa-cp-name">White</div>
        <div class="pa-cp-pct" style="color:${wPct>=50?'#4caf7d':'#ef5350'}">${wPct}%</div>
        <div class="pa-cp-sub">win rate (${wh.length} games)</div>
        <div class="pa-cp-bar"><div style="width:${wPct}%;height:5px;background:#4caf7d;border-radius:3px"></div></div>
        <div class="pa-cp-rec">${wWin}W &nbsp;${wh.filter(g=>g.drew).length}D &nbsp;${wh.filter(g=>g.lost).length}L</div>
      </div>
      <div class="pa-cp-col">
        <div class="pa-cp-piece" style="opacity:.5">&#9823;</div><div class="pa-cp-name">Black</div>
        <div class="pa-cp-pct" style="color:${bPct>=50?'#4caf7d':'#ef5350'}">${bPct}%</div>
        <div class="pa-cp-sub">win rate (${bl.length} games)</div>
        <div class="pa-cp-bar"><div style="width:${bPct}%;height:5px;background:#4caf7d;border-radius:3px"></div></div>
        <div class="pa-cp-rec">${bWin}W &nbsp;${bl.filter(g=>g.drew).length}D &nbsp;${bl.filter(g=>g.lost).length}L</div>
      </div>
    </div>
    ${colorNote}
  </div>`;
}

function renderLossAnalysis(games) {
  renderInto('paLossAnalysis', e => {
    const {losses,singleBlunder,gradualLoss,lossTerms,wh,bl,wWin,bWin,wPct,bPct}=calcLossBreakdown(games);
    const lossFeature=losses.length
      ?`<div class="pa-loss-feature-grid">${blunderRatioCardHTML(singleBlunder,gradualLoss,losses)}${terminationCardHTML(lossTerms,losses.length)}</div>`
      :`<div class="pa-loss-empty">No losses in this filtered sample. Change the time control or period to inspect defeat patterns.</div>`;
    e.innerHTML=`<div class="pa-section-hdr" style="margin:0 0 16px">
      <div class="pa-sec-icon" style="background:rgba(239,83,80,.15)">&#128128;</div>
      <div><h2 class="pa-sec-title">Anatomy of a Loss</h2><p class="pa-sec-sub">Patterns in your defeats, from a coach's perspective</p></div>
    </div>
    ${lossFeature}
    <div class="pa-loss-grid">${colorPerfCardHTML(wh,bl,wWin,bWin,wPct,bPct)}</div>`;
  });
}

// ─── RENDER: PERFORMANCE INSIGHTS ───────────────────────────────────────────

function renderPerformanceSummary(filtered, allPeriod) {
  renderInto('paInsights', e => {
  if (!filtered.length) { e.innerHTML = ''; return; }

  const insights = [];

  // 1. Win rate
  const { winPct, total, wins } = aggWLD(filtered);
  const wr = Math.round(winPct);
  if (total >= 5) {
    const wColor = wr >= 55 ? '#4caf7d' : wr >= 45 ? '#d4af37' : '#ef5350';
    const wNote = wr >= 55 ? 'Strong result — keep the pressure up.' : wr >= 45 ? 'Hovering near 50/50 — small adjustments could tip the scale.' : 'Below break-even — focus on avoiding early blunders.';
    insights.push({ icon: '&#9989;', text: `You won <strong style="color:${wColor}">${wr}%</strong> of ${total} games in this period. ${wNote}` });
  }

  // 2. Best time control
  const tcData = aggByTC(allPeriod);
  if (tcData.length >= 2) {
    const best = tcData.reduce((a, b) => b.winRate > a.winRate ? b : a);
    const worst = tcData.reduce((a, b) => b.winRate < a.winRate ? b : a);
    const tcColors = { rapid: '#4caf7d', blitz: '#d4af37', bullet: '#ef5350', daily: '#a78bfa' };
    if (best.tc !== worst.tc) {
      insights.push({ icon: '&#9201;', text: `Your strongest format is <strong style="color:${tcColors[best.tc] || '#d4af37'}">${best.tc.charAt(0).toUpperCase() + best.tc.slice(1)}</strong> (${Math.round(best.winRate)}% wins). Consider playing more of it to grind rating.` });
    }
  }

  // 3. Rating trend
  const ratedGames = filtered.filter(g => g.rating > 0).sort((a, b) => a.endTime - b.endTime);
  if (ratedGames.length >= 4) {
    const first = ratedGames[0].rating;
    const last = ratedGames[ratedGames.length - 1].rating;
    const diff = last - first;
    const sign = diff >= 0 ? '+' : '';
    const rColor = diff > 0 ? '#4caf7d' : diff < 0 ? '#ef5350' : '#888';
    if (Math.abs(diff) >= 5) {
      const note = diff > 25 ? 'Excellent momentum — you\'re improving fast.' : diff > 0 ? 'Steady climb — consistency is paying off.' : diff < -25 ? 'Significant rating drop — review your most common loss patterns.' : 'Slight dip — a short break or opening study could help.';
      insights.push({ icon: '&#128200;', text: `Rating moved <strong style="color:${rColor}">${sign}${diff} pts</strong> (${first} → ${last}) in this period. ${note}` });
    }
  }

  // 4. Best day of week
  const dowData = aggByDOW(filtered).filter(d => d.games >= 3);
  if (dowData.length >= 3) {
    const bestDay = dowData.reduce((a, b) => b.winRate > a.winRate ? b : a);
    const worstDay = dowData.reduce((a, b) => b.winRate < a.winRate ? b : a);
    if (bestDay.day !== worstDay.day && bestDay.winRate - worstDay.winRate > 8) {
      insights.push({ icon: '&#128197;', text: `You play best on <strong style="color:#d4af37">${bestDay.day}</strong> (${Math.round(bestDay.winRate)}% win rate) and struggle most on <strong style="color:#ef5350">${worstDay.day}</strong> (${Math.round(worstDay.winRate)}%). Schedule your important games accordingly.` });
    }
  }

  // 5. Color imbalance
  const wh = filtered.filter(g => g.color === 'white');
  const bl = filtered.filter(g => g.color === 'black');
  const wPct = wh.length ? Math.round(wh.filter(g => g.won).length / wh.length * 100) : null;
  const bPct = bl.length ? Math.round(bl.filter(g => g.won).length / bl.length * 100) : null;
  if (wPct !== null && bPct !== null && wh.length >= 5 && bl.length >= 5) {
    const gap = Math.abs(wPct - bPct);
    if (gap >= 8) {
      const stronger = wPct > bPct ? 'White' : 'Black';
      const weaker = wPct > bPct ? 'Black' : 'White';
      const weakerPct = wPct > bPct ? bPct : wPct;
      insights.push({ icon: '&#9823;', text: `You win ${gap}% more often as <strong style="color:#d4af37">${stronger}</strong> than ${weaker} (${weakerPct}%). Study your ${weaker} repertoire to close the gap.` });
    }
  }

  if (!insights.length) { e.innerHTML = ''; return; }

  e.innerHTML = `
    <div class="pa-insights-header">
      <span class="pa-insights-icon">&#129504;</span>
      <div><div class="pa-insights-title">Performance Summary</div><div class="pa-insights-sub">Key takeaways from your games in this period</div></div>
    </div>
    <div class="pa-insights-list">
      ${insights.map(ins => `<div class="pa-insight-item"><span class="pa-insight-icon">${ins.icon}</span><span class="pa-insight-text">${ins.text}</span></div>`).join('')}
    </div>`;
  });
}

// ─── GAME RESULTS CHART: MODULE-LEVEL HELPERS ────────────────────────────────

const GR_W=700, GR_H=490, GR_CX=340, GR_CY=248;
const GR_IN1=90, GR_IN2=143, GR_OUT1=151, GR_OUT2=200, GR_SEG_GAP=1.5;

function grToXY(r, deg) {
  const rad = (deg - 90) * Math.PI / 180;
  return [GR_CX + r * Math.cos(rad), GR_CY + r * Math.sin(rad)];
}

function grMakeArc(r1, r2, a0, a1) {
  const span = a1 - a0;
  if (span <= 0.01) return '';
  const [x0,y0]=grToXY(r2,a0), [x1,y1]=grToXY(r2,a1);
  const [x2,y2]=grToXY(r1,a1), [x3,y3]=grToXY(r1,a0);
  const lg = span > 180 ? 1 : 0;
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r2},${r2} 0 ${lg} 1 ${x1.toFixed(2)},${y1.toFixed(2)} L${x2.toFixed(2)},${y2.toFixed(2)} A${r1},${r1} 0 ${lg} 0 ${x3.toFixed(2)},${y3.toFixed(2)} Z`;
}

function grSegLabel(midDeg, l1, l2, c1, c2) {
  const [x,y]=grToXY(54,midDeg);
  return `<text x="${x.toFixed(1)}" y="${(y-6).toFixed(1)}" text-anchor="middle" fill="${c1}" font-size="12" font-weight="700" font-family="ui-monospace,monospace">${l1}</text>
    <text x="${x.toFixed(1)}" y="${(y+9).toFixed(1)}" text-anchor="middle" fill="${c2}" font-size="10.5" font-family="ui-monospace,monospace">${l2}</text>`;
}

function grLeaderLine(midDeg, label, dotColor) {
  const cosA=Math.cos((midDeg-90)*Math.PI/180), sinA=Math.sin((midDeg-90)*Math.PI/180);
  const isRight=cosA>=0;
  const [ax,ay]=[GR_CX+(GR_OUT2+6)*cosA, GR_CY+(GR_OUT2+6)*sinA];
  const [bx,by]=[GR_CX+(GR_OUT2+26)*cosA, GR_CY+(GR_OUT2+26)*sinA];
  const hx=isRight?bx+30:bx-30, tx=isRight?hx+5:hx-5, anchor=isRight?'start':'end';
  return `<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="#555" stroke-width="0.8"/>
    <line x1="${bx.toFixed(1)}" y1="${by.toFixed(1)}" x2="${hx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="#555" stroke-width="0.8"/>
    <circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="2.5" fill="${dotColor}"/>
    <text x="${tx.toFixed(1)}" y="${(by+4).toFixed(1)}" text-anchor="${anchor}" fill="#c5c5c5" font-size="11.5" font-weight="500" font-family="ui-monospace,monospace">${escapeHtml(label)}</text>`;
}

function buildWinTypes(wins, total) {
  const types=[
    {label:'Resigned',   count:wins.filter(g=>g.oppResult==='resigned').length,   color:'#27ae60'},
    {label:'Timeout',    count:wins.filter(g=>g.oppResult==='timeout').length,    color:'#1a9141'},
    {label:'Checkmated', count:wins.filter(g=>g.oppResult==='checkmated').length, color:'#52be80'},
    {label:'Abandoned',  count:wins.filter(g=>g.oppResult==='abandoned').length,  color:'#0d7047'},
  ].filter(t=>t.count>0);
  const other=wins.length-types.reduce((s,t)=>s+t.count,0);
  if(other>0) types.push({label:'Other wins',count:other,color:'#145a32'});
  return types;
}

function buildLossTypes(losses) {
  const types=[
    {label:'Resigned',   count:losses.filter(g=>g.result==='resigned').length,   color:'#e74c3c'},
    {label:'Timeout',    count:losses.filter(g=>g.result==='timeout').length,    color:'#c0392b'},
    {label:'Checkmated', count:losses.filter(g=>g.result==='checkmated').length, color:'#a93226'},
    {label:'Abandoned',  count:losses.filter(g=>g.result==='abandoned').length,  color:'#d35400'},
  ].filter(t=>t.count>0);
  const other=losses.length-types.reduce((s,t)=>s+t.count,0);
  if(other>0) types.push({label:'Other losses',count:other,color:'#7b241c'});
  return types;
}

// ─── RENDER: GAME RESULTS DUAL-RING DONUT ────────────────────────────────────

function renderGameResults(games) {
  renderInto('paGameResults', e => {
    if (!games.length) { e.innerHTML = ''; return; }

    const total=games.length;
    const wins=games.filter(g=>g.won), losses=games.filter(g=>g.lost), draws=games.filter(g=>g.drew);
    const winTypes=buildWinTypes(wins,total);
    const lossTypes=buildLossTypes(losses);

    const sorted=[...games].sort((a,b)=>a.endTime-b.endTime);
    const fmt=t=>t?new Date(t).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'';
    const dateRange=sorted.length?`${fmt(sorted[0].endTime)} \u2013 ${fmt(sorted[sorted.length-1].endTime)}`:'';

    const wFrac=wins.length/total, dFrac=draws.length/total;
    const wDeg=wFrac*360, dDeg=dFrac*360;
    const parts=[], lbls=[];

    // Inner ring
    if(wDeg>GR_SEG_GAP)
      parts.push(`<path d="${grMakeArc(GR_IN1,GR_IN2,GR_SEG_GAP/2,wDeg-GR_SEG_GAP/2)}" fill="#2e7d4f" stroke="#0b0b0c" stroke-width="1.5"/>`);
    if(dDeg>2)
      parts.push(`<path d="${grMakeArc(GR_IN1,GR_IN2,wDeg+GR_SEG_GAP/2,wDeg+dDeg-GR_SEG_GAP/2)}" fill="#4a5568" stroke="#0b0b0c" stroke-width="1.5"/>`);
    if(360-wDeg-dDeg>GR_SEG_GAP)
      parts.push(`<path d="${grMakeArc(GR_IN1,GR_IN2,wDeg+dDeg+GR_SEG_GAP/2,360-GR_SEG_GAP/2)}" fill="#922b21" stroke="#0b0b0c" stroke-width="1.5"/>`);

    // Center labels
    lbls.push(grSegLabel(wDeg/2,'Wins',`${wins.length.toLocaleString()} (${(wFrac*100).toFixed(1)}%)`,'#86efac','#a3d9b5'));
    const lossMid=wDeg+dDeg+(360-wDeg-dDeg)/2;
    lbls.push(grSegLabel(lossMid,'Losses',`${losses.length.toLocaleString()} (${((1-wFrac-dFrac)*100).toFixed(1)}%)`,'#fca5a5','#e0b0b0'));
    if(dDeg>8){
      const [dx,dy]=grToXY(56,wDeg+dDeg/2);
      lbls.push(`<text x="${dx.toFixed(1)}" y="${dy.toFixed(1)}" text-anchor="middle" fill="#8899aa" font-size="9.5" font-family="ui-monospace,monospace">Draws ${draws.length} (${(dFrac*100).toFixed(1)}%)</text>`);
    }

    // Outer ring – wins
    let angle=GR_SEG_GAP/2;
    winTypes.forEach(seg=>{
      const segDeg=(seg.count/total)*360;
      if(segDeg<GR_SEG_GAP*2){angle+=segDeg;return;}
      const endA=angle+segDeg-GR_SEG_GAP;
      parts.push(`<path d="${grMakeArc(GR_OUT1,GR_OUT2,angle,endA)}" fill="${seg.color}" stroke="#0b0b0c" stroke-width="1"/>`);
      if(segDeg>6) lbls.push(grLeaderLine((angle+endA)/2,`${seg.label}: ${seg.count.toLocaleString()} (${(seg.count/total*100).toFixed(1)}%)`,seg.color));
      angle+=segDeg;
    });

    // Outer draws sliver
    if(dDeg>2){const ds=wDeg+GR_SEG_GAP,de=wDeg+dDeg-GR_SEG_GAP;if(de>ds)parts.push(`<path d="${grMakeArc(GR_OUT1,GR_OUT2,ds,de)}" fill="#5a6475" stroke="#0b0b0c" stroke-width="1"/>`);}

    // Outer ring – losses
    angle=wDeg+dDeg+GR_SEG_GAP/2;
    lossTypes.forEach(seg=>{
      const segDeg=(seg.count/total)*360;
      if(segDeg<GR_SEG_GAP*2){angle+=segDeg;return;}
      const endA=angle+segDeg-GR_SEG_GAP;
      parts.push(`<path d="${grMakeArc(GR_OUT1,GR_OUT2,angle,endA)}" fill="${seg.color}" stroke="#0b0b0c" stroke-width="1"/>`);
      if(segDeg>6) lbls.push(grLeaderLine((angle+endA)/2,`${seg.label}: ${seg.count.toLocaleString()} (${(seg.count/total*100).toFixed(1)}%)`,seg.color));
      angle+=segDeg;
    });

    const tcLabel=(_state.selectedTC||'all').toUpperCase();
    e.innerHTML=`<div style="padding:14px 18px 0;display:flex;align-items:center;gap:8px">
      <span style="font-size:12px;font-weight:700;letter-spacing:.08em;color:var(--text-primary)">GAME RESULTS</span>
      <span style="font-size:13px;color:#505a65;cursor:default" title="Outer ring shows win/loss subtypes; inner ring shows overall W/D/L">&#9432;</span>
    </div>
    <svg width="100%" viewBox="0 0 ${GR_W} ${GR_H}" style="display:block;overflow:visible">
      ${parts.join('\n      ')}
      ${lbls.join('\n      ')}
      <text x="16" y="${GR_H-16}" fill="#505a65" font-size="10.5" font-family="ui-monospace,monospace">${tcLabel} \u2022 ${dateRange}</text>
    </svg>`;
  });
}

// ─── WIRE CONTROLS ───────────────────────────────────────────────────────────

function wireControls() {
  if (controlsWired) return;
  controlsWired = true;
  document.querySelectorAll('.pa-tc-btn').forEach(btn=>{
    bindClick(btn, ()=>{
      document.querySelectorAll('.pa-tc-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      _state.selectedTC=btn.dataset.tc;
      refreshRender();
    });
  });
  document.querySelectorAll('.pa-period-btn').forEach(btn=>{
    bindClick(btn, ()=>{
      document.querySelectorAll('.pa-period-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      _state.selectedPeriod=parseInt(btn.dataset.period);
      refreshRender();
    });
  });
}

// ─── REFRESH ALL RENDERS ─────────────────────────────────────────────────────

function refreshRender() {
  const {allProcessed,selectedTC,selectedPeriod,profile,stats} = _state;
  const cacheKey = `${selectedTC}:${selectedPeriod}`;
  if (cacheKey !== _renderCache.key) {
    _renderCache.key = cacheKey;
    _renderCache.tcOnly = filterByTC(allProcessed, selectedTC);
    _renderCache.filtered = filterByPeriod(_renderCache.tcOnly, selectedPeriod);
    _renderCache.allPeriod = filterByPeriod(allProcessed, selectedPeriod);
  }
  const {filtered, tcOnly, allPeriod} = _renderCache;

  renderKeyMetrics(filtered, stats);
  renderSummaryBar(filtered);
  renderAccuracyRecap(filtered);
  renderPerformanceSummary(filtered, allPeriod);
  renderGameResults(filtered);

  // Performance Vitals
  renderWLD(filtered);
  renderRatingHistory(tcOnly);
  renderWinsByDay(filtered);
  renderStreaks(filtered);

  // Performance Breakdown
  renderByTC(allPeriod);
  renderByDOW(filtered);
  renderMonthlyTrend(tcOnly);

  // Rating Analysis
  renderRatingProg(tcOnly);
  renderRatingDiff(filtered);
  renderOppStrength(filtered);

  // Game Patterns
  renderResultBreakdown(filtered);
  renderStreakDist(filtered);

  // Pro Coaching
  renderHeadToHead(filtered);
  renderRadar(filtered);

  // Opening + Loss
  renderOpenings(filtered);
  renderLossAnalysis(filtered);
}

// ─── MAIN ANALYZE ────────────────────────────────────────────────────────────

async function analyze(username) {
  if (!username) return;
  const normalizedUser = username.trim().toLowerCase();

  // Cancel any in-flight request from a previous analyze call
  if (_currentAbort) _currentAbort.abort();
  _currentAbort = new AbortController();
  const { signal } = _currentAbort;

  _state.username = normalizedUser;
  _renderCache.key = null; // invalidate filter cache on new data
  showState('loading');

  try {
    // Serve from session cache if fresh (< 5 min old)
    const cached = getCachedAnalysis(normalizedUser);
    if (cached) {
      _state.profile = cached.profile;
      _state.stats = cached.stats;
      _state.allProcessed = cached.allProcessed;
      showState('content');
      renderProfile(cached.profile, cached.stats);
      wireControls();
      refreshRender();
      return;
    }

    const [profile, stats] = await Promise.all([
      apiGet(`${CHESS_API}/${normalizedUser}`, signal),
      apiGet(`${CHESS_API}/${normalizedUser}/stats`, signal),
    ]);
    _state.profile = profile;
    _state.stats = stats;

    const { archives = [] } = await apiGet(`${CHESS_API}/${normalizedUser}/games/archives`, signal);

    // Fetch enough history for the 12-month filter.
    const toFetch = archives.slice(-PLAYER_ANALYZE_MONTHS);
    const monthsData = await Promise.all(
      toFetch.map(url => apiGet(url, signal).then(d => d.games || []).catch(e => {
        if (e && e.name === 'AbortError') throw e;
        return [];
      }))
    );

    _state.allProcessed = monthsData.flat().map(g => processRawGame(g, normalizedUser));

    setCachedAnalysis(normalizedUser, {
      profile, stats, allProcessed: _state.allProcessed,
    });

    showState('content');
    renderProfile(profile, stats);
    wireControls();
    refreshRender();

  } catch (err) {
    if (err && err.name === 'AbortError') return; // superseded by a newer request
    showState('error');
    const msgEl = qs('paErrorMsg');
    if (msgEl) msgEl.textContent = err.message || 'Failed to load player data';
  }
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

function init() {
  if (uiInitialized) return;
  const input = qs('paUsernameInput');
  const btn = qs('paAnalyzeBtn');
  if (!input || !btn) return;
  uiInitialized = true;
  const go = () => { const u = input.value.trim(); if (u) analyze(u); };
  bindClick(btn, go);
  bind(input, 'keydown', e => { if (e.key === 'Enter') go(); });
}

export default { init, analyze };

// Named exports for unit testing (pure aggregation functions, no DOM deps)
export {
  filterByTC, filterByPeriod,
  aggWLD, aggByTC, aggMonthly, aggByDOW,
  aggRatingDiff, aggOppStrength, aggHeadToHead,
  aggStreaks, aggRadar, aggResultBreakdown, aggKeyMetrics,
};
