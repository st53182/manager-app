// === edge-router.js ===
// Маршрутизация ребра по сетке с мягкими углами + защита от NaN

(function(){
  function routeEdge(a, b, allNodes, opts = {}) {
    const cell   = opts.cell ?? 24;
    const margin = opts.margin ?? 12;

    const nodes = Array.isArray(allNodes) ? allNodes : Object.values(allNodes || {});
    const bounds = opts.bounds ?? guessBounds(nodes, cell);
    const grid = buildGrid(bounds, cell, nodes, margin);

    const start = snapToGrid({ x: a.position.x, y: a.position.y }, bounds, cell);
    const goal  = snapToGrid({ x: b.position.x, y: b.position.y }, bounds, cell);

    const route = aStar(grid, start, goal);
    let pathPoints;

    if (!route || route.length === 0) {
      pathPoints = simpleCurve(a, b);
    } else {
      const rawPoints = route.map(p => gridToWorld(p, bounds, cell));
      const simplified = rdp(rawPoints, 2.5);
      const smoothed   = roundCorners(simplified, 22);

      const p1 = smoothed[1] ?? smoothed[0];
      const pn = smoothed[smoothed.length - 2] ?? smoothed[0];

      const ra = getRadius(a);
      const rb = getRadius(b);

      const startOnCircle = pointOnCircle({ x: a.position.x, y: a.position.y }, p1, ra + 1);
      const endOnCircle   = pointOnCircle({ x: b.position.x, y: b.position.y }, pn, rb + 1);

      pathPoints = [startOnCircle, ...smoothed.slice(1, -1), endOnCircle];
    }

    // Защита: если вдруг где-то появились нечисловые координаты — откатываемся на простую кривую
    if (!everyFinite(pathPoints)) {
      pathPoints = simpleCurve(a, b);
    }

    return { points: pathPoints, d: pointsToSvg(pathPoints) };
  }

  function everyFinite(pts) {
    return pts.every(p => Number.isFinite(p.x) && Number.isFinite(p.y));
  }

  function getRadius(n, fallback = 50) {
    const r = Number(n?.r);
    return Number.isFinite(r) ? r : fallback;
  }

  function guessBounds(nodes, cell) {
    const list = Array.isArray(nodes) ? nodes : Object.values(nodes || {});
    if (!list.length) return { x: -500, y: -500, w: 1000, h: 1000 };
    const xs = list.map(n => n.position.x);
    const ys = list.map(n => n.position.y);
    const minX = Math.min(...xs) - 200, maxX = Math.max(...xs) + 200;
    const minY = Math.min(...ys) - 200, maxY = Math.max(...ys) + 200;
    const w = Math.ceil((maxX - minX) / cell) * cell;
    const h = Math.ceil((maxY - minY) / cell) * cell;
    return { x: Math.floor(minX / cell) * cell, y: Math.floor(minY / cell) * cell, w, h };
  }

  function buildGrid(bounds, cell, nodes, margin) {
    const list = Array.isArray(nodes) ? nodes : Object.values(nodes || {});
    const cols = Math.max(1, Math.floor(bounds.w / cell));
    const rows = Math.max(1, Math.floor(bounds.h / cell));
    const grid = Array.from({ length: rows }, () => Array(cols).fill(0));
    for (const n of list) {
      if (!n?.position) continue;
      const R = getRadius(n) + margin;
      const minC = Math.max(0, Math.floor((n.position.x - R - bounds.x) / cell));
      const maxC = Math.min(cols - 1, Math.ceil ((n.position.x + R - bounds.x) / cell));
      const minR = Math.max(0, Math.floor((n.position.y - R - bounds.y) / cell));
      const maxR = Math.min(rows - 1, Math.ceil ((n.position.y + R - bounds.y) / cell));
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          const wx = bounds.x + c * cell + cell / 2;
          const wy = bounds.y + r * cell + cell / 2;
          const d2 = (wx - n.position.x) ** 2 + (wy - n.position.y) ** 2;
          if (d2 <= R ** 2) grid[r][c] = 1;
        }
      }
    }
    return { data: grid, cols, rows, bounds, cell };
  }

  function snapToGrid(p, bounds, cell) {
    const c = Math.round((p.x - bounds.x) / cell);
    const r = Math.round((p.y - bounds.y) / cell);
    return { c, r };
  }
  function gridToWorld(g, bounds, cell) {
    return { x: bounds.x + g.c * cell, y: bounds.y + g.r * cell };
  }

  function aStar(grid, start, goal) {
    const rows = grid.rows, cols = grid.cols, data = grid.data;
    const key = (c, r) => `${c},${r}`;
    const h = (c, r) => Math.hypot(c - goal.c, r - goal.r);

    const open = new MinHeap((a, b) => a.f - b.f);
    const gScore = new Map(), came = new Map();

    const push = (c, r, g, fromKey) => {
      const k = key(c, r);
      if (g >= (gScore.get(k) ?? Infinity)) return;
      gScore.set(k, g);
      open.push({ c, r, f: g + h(c, r) });
      if (fromKey) came.set(k, fromKey);
    };

    if (data[start.r]?.[start.c] === 1) return null;
    if (data[goal.r ]?.[goal.c ] === 1) return null;

    push(start.c, start.r, 0, null);

    const dirs = [[1,0],[0,1],[-1,0],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

    while (open.size()) {
      const cur = open.pop();
      if (cur.c === goal.c && cur.r === goal.r) {
        const path = [];
        let k = key(cur.c, cur.r);
        while (k) {
          const [c, r] = k.split(',').map(Number);
          path.push({ c, r });
          k = came.get(k) ?? null;
        }
        return path.reverse();
      }
      for (const [dc, dr] of dirs) {
        const nc = cur.c + dc, nr = cur.r + dr;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        if (!data[nr] || data[nr][nc] === undefined || data[nr][nc] === 1) continue;
        if (dc && dr && ((!data[cur.r] || data[cur.r][nc] === 1) || (!data[nr] || data[nr][cur.c] === 1))) continue;

        const step = (dc && dr) ? Math.SQRT2 : 1;
        const g = (gScore.get(key(cur.c, cur.r)) ?? 0) + step;
        push(nc, nr, g, key(cur.c, cur.r));
      }
    }
    return null;
  }

  // Упрощение полилинии (Рамера–Дугласа–Пекера)
  function rdp(points, epsilon) {
    if (points.length < 3) return points.slice();
    const { idx, maxD } = (() => {
      const a = points[0], b = points[points.length - 1];
      let maxD = 0, idx = 0;
      for (let i = 1; i < points.length - 1; i++) {
        const d = perpDistance(points[i], a, b);
        if (d > maxD) { maxD = d; idx = i; }
      }
      return { idx, maxD };
    })();
    if (maxD > epsilon) {
      const left = rdp(points.slice(0, idx + 1), epsilon);
      const right = rdp(points.slice(idx), epsilon);
      return left.slice(0, -1).concat(right);
    }
    return [points[0], points[points.length - 1]];
  }
  function perpDistance(p, a, b) {
    const A = p.x - a.x, B = p.y - a.y, C = b.x - a.x, D = b.y - a.y;
    const dot = A * C + B * D, len = C * C + D * D;
    const t = Math.max(0, Math.min(1, dot / len));
    const x = a.x + t * C, y = a.y + t * D;
    return Math.hypot(p.x - x, p.y - y);
  }

  function roundCorners(points, r = 18) {
    if (points.length <= 2) return points.slice();
    const out = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
      const p0 = out[out.length - 1], p1 = points[i], p2 = points[i + 1];
      const v1 = norm(vec(p1, p0)), v2 = norm(vec(p1, p2));
      const ang = Math.acos(clamp(dot(v1, v2), -1, 1));
      const cut = Math.min(r / Math.tan(ang / 2), dist(p1, p0), dist(p1, p2)) * 0.9;
      const entry = { x: p1.x + v1.x * cut, y: p1.y + v1.y * cut };
      const exit  = { x: p1.x + v2.x * cut, y: p1.y + v2.y * cut };
      out.push(entry, exit);
    }
    out.push(points[points.length - 1]);
    return out;
  }

  function pointsToSvg(pts) {
    if (pts.length < 2) return '';
    const parts = [`M ${pts[0].x} ${pts[0].y}`];
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1], cur = pts[i];
      const mx = (prev.x + cur.x) / 2, my = (prev.y + cur.y) / 2;
      parts.push(`Q ${prev.x} ${prev.y} ${mx} ${my}`, `T ${cur.x} ${cur.y}`);
    }
    return parts.join(' ');
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const vec = (a, b) => ({ x: b.x - a.x, y: b.y - a.y });
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const norm = (v) => { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; };

  function pointOnCircle(node, toward, r) {
    const v = norm({ x: toward.x - node.x, y: toward.y - node.y });
    return { x: node.x + v.x * r, y: node.y + v.y * r };
  }

  function simpleCurve(a, b) {
    const mid = { x: (a.position.x + b.position.x) / 2, y: (a.position.y + b.position.y) / 2 };
    const ra = getRadius(a);
    const rb = getRadius(b);
    return [
      pointOnCircle({ x: a.position.x, y: a.position.y }, mid, ra),
      mid,
      pointOnCircle({ x: b.position.x, y: b.position.y }, mid, rb)
    ];
  }

  class MinHeap {
    constructor(less) { this.a = []; this.less = less; }
    size() { return this.a.length; }
    push(x) { this.a.push(x); this._up(this.a.length - 1); }
    pop() { const a = this.a; if (!a.length) return null; const top = a[0]; const last = a.pop(); if (a.length) { a[0] = last; this._down(0); } return top; }
    _up(i){ const a=this.a, less=this.less; while(i){ const p=(i-1>>1); if(!less(a[i], a[p])) break; [a[i],a[p]]=[a[p],a[i]]; i=p; } }
    _down(i){ const a=this.a, less=this.less; for(;;){ let l=i*2+1, r=l+1, s=i; if(l<a.length && less(a[l],a[s])) s=l; if(r<a.length && less(a[r],a[s])) s=r; if(s===i) break; [a[i],a[s]]=[a[s],a[i]]; i=s; } }
  }

  // Экспорт в глобальный scope (скрипт подключён <script src>)
  window.routeEdge = routeEdge;
})();
