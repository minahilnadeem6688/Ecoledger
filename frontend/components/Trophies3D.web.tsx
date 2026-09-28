/**
 * The leaderboard podium in 3D (web): green podium blocks rise in turn, then gold, silver and bronze
 * trophies land on them. The winner's trophy gets a soft glow and a few sparkles. Same lighting and
 * materials as the CCT token, pauses off-screen, and stays still for reduced motion.
 */
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import FlatPodium from './PodiumFlat';

export { PODIUM_COLORS } from './PodiumFlat';

const METALS = [0xd9ac3c, 0xc5ccd3, 0xc27f4e]; // gold, silver, bronze
const HEIGHTS = [0.95, 0.66, 0.46];            // by rank
const X = { 1: 0, 2: -1.66, 3: 1.66 } as Record<number, number>; // one third of the frame apart, so the names line up

function numberTexture(n: number) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#337357'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(255,219,229,0.95)';
  g.font = '800 132px Inter, "Segoe UI", Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(n), 128, 138);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function trophy(color: number) {
  const metal = new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const dark = new THREE.MeshPhysicalMaterial({ color: 0x23513d, metalness: 0.3, roughness: 0.45, clearcoat: 0.8 });
  const g = new THREE.Group();
  // cup, stem and foot turned from one profile
  const pts = [
    [0.0, 0.0], [0.22, 0.0], [0.22, 0.05], [0.12, 0.08], [0.06, 0.12], [0.05, 0.3], [0.08, 0.36],
    [0.16, 0.42], [0.26, 0.54], [0.3, 0.68], [0.31, 0.8], [0.29, 0.8], [0.27, 0.69], [0.0, 0.6],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 64), metal);
  body.position.y = 0.16;
  g.add(body);
  // handles
  [-1, 1].forEach((sgn) => {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 12, 32, Math.PI * 1.15), metal);
    h.position.set(sgn * 0.3, 0.16 + 0.62, 0);
    h.rotation.z = sgn > 0 ? -Math.PI * 0.55 : Math.PI * 1.55;
    g.add(h);
  });
  // plinth
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.16, 48), dark);
  plinth.position.y = 0.08;
  g.add(plinth);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.03, 48), metal);
  band.position.y = 0.12;
  g.add(band);
  return g;
}

export default function Trophies3D({ width, count = 3 }: { width: number; count?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const height = Math.round(width * 0.5);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      setFailed(true);
      return;
    }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.9;

    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 60);
    camera.position.set(0, 2.25, 5.45);
    camera.lookAt(0, 1.14, 0);

    scene.add(new THREE.HemisphereLight(0xfff3f6, 0x337357, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(-3, 5, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffdbe5, 1.0);
    rim.position.set(3, 3, -4);
    scene.add(rim);

    const root = new THREE.Group();
    scene.add(root);

    const blockMat = new THREE.MeshPhysicalMaterial({ color: 0x337357, roughness: 0.42, clearcoat: 0.9, clearcoatRoughness: 0.25 });
    const trimMat = new THREE.MeshPhysicalMaterial({ color: 0xe8a3b8, metalness: 1, roughness: 0.28 });
    const ranks = [1, 2, 3].filter((r) => r <= count);
    const cols = ranks.map((rank) => {
      const h = HEIGHTS[rank - 1];
      const col = new THREE.Group();
      col.position.x = X[rank];
      const numMat = new THREE.MeshPhysicalMaterial({ map: numberTexture(rank), roughness: 0.42, clearcoat: 0.9 });
      // front face carries the number; other faces are plain
      const block = new THREE.Mesh(new THREE.BoxGeometry(1.4, h, 1.1), [blockMat, blockMat, blockMat, blockMat, numMat, blockMat]);
      block.position.y = h / 2;
      const blockPivot = new THREE.Group();
      blockPivot.add(block);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.025, 1.12), trimMat);
      trim.position.y = h;
      blockPivot.add(trim);
      col.add(blockPivot);
      const cup = trophy(METALS[rank - 1]);
      const s = rank === 1 ? 1.2 : 1.0;
      cup.scale.setScalar(s);
      cup.position.y = h;
      col.add(cup);
      root.add(col);
      return { rank, h, blockPivot, cup, s, delay: rank === 3 ? 0 : rank === 2 ? 0.18 : 0.36 };
    });

    // winner's glow and sparkles
    const glowTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d')!;
      const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,214,120,0.55)');
      grad.addColorStop(1, 'rgba(255,214,120,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false }));
    glow.scale.set(1.6, 1.6, 1);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfff1c9, toneMapped: false });
    const sparks = Array.from({ length: 6 }, (_, i) => {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), sparkMat);
      m.userData.a = (i / 6) * Math.PI * 2;
      return m;
    });
    const winner = cols.find((c) => c.rank === 1);
    if (winner) {
      glow.position.set(0, winner.h + 0.62, -0.2);
      root.add(glow, ...sparks);
    }

    const shadowTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const g = c.getContext('2d')!;
      const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0, 'rgba(51,115,87,0.28)');
      grad.addColorStop(1, 'rgba(51,115,87,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
      return new THREE.CanvasTexture(c);
    })();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(7, 2.6), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.001;
    root.add(floor);

    const resize = () => {
      const w = el.clientWidth || width, h = el.clientHeight || height;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(() => { resize(); if (reduce) renderer.render(scene, camera); });
    ro.observe(el);

    const target = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      target.x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / r.width));
      target.y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height * 2)));
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    const outBack = (t: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
    const clamp = (t: number) => Math.min(1, Math.max(0, t));
    const pose = (time: number) => {
      cols.forEach((c) => {
        const grow = clamp((time - c.delay) / 0.7);
        c.blockPivot.scale.y = Math.max(0.001, 1 - Math.pow(1 - grow, 3));
        const land = clamp((time - c.delay - 0.55) / 0.6);
        c.cup.position.y = c.h * c.blockPivot.scale.y + (1 - land) * 1.2;
        c.cup.scale.setScalar(c.s * (land > 0 ? Math.max(0.001, outBack(land)) : 0.001));
      });
    };

    let raf = 0, last = performance.now(), time = 0, visible = true;
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      time += dt;
      pose(time);
      cols.forEach((c, i) => { c.cup.rotation.y = Math.sin(time * 0.7 + i * 1.3) * 0.5 + (c.rank === 1 ? time * 0.4 : 0); });
      if (winner) {
        const on = clamp((time - 1.4) / 0.6);
        (glow.material as THREE.SpriteMaterial).opacity = on * (0.75 + 0.25 * Math.sin(time * 2.2));
        sparks.forEach((m, i) => {
          const a = m.userData.a + time * 0.9;
          m.position.set(Math.cos(a) * 0.55, winner.h + 0.55 + Math.sin(time * 1.6 + i) * 0.18, Math.sin(a) * 0.55);
          m.rotation.y = time * 2;
          m.scale.setScalar(on * (0.7 + 0.3 * Math.sin(time * 3 + i)));
        });
      }
      root.rotation.y += (target.x * 0.25 - root.rotation.y) * 0.06;
      root.rotation.x += (target.y * 0.12 - root.rotation.x) * 0.06;
      renderer.render(scene, camera);
      if (visible) raf = requestAnimationFrame(frame);
    };
    const start = () => { if (!raf && !reduce) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };

    if (reduce) {
      pose(10);
      if (winner) sparks.forEach((m) => (m.visible = false));
      renderer.render(scene, camera);
    } else start();

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting && !document.hidden; if (visible) start(); else stop(); });
    io.observe(el);
    const onVis = () => { visible = !document.hidden; if (visible) start(); else stop(); };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('visibilitychange', onVis);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => { (x as any).map?.dispose?.(); x.dispose(); });
      });
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [width, height, count]);

  if (failed) return <FlatPodium width={width} count={count} />;
  return <div ref={host} aria-hidden="true" style={{ width, height, alignSelf: 'center', flexShrink: 0 }} />;
}
