/**
 * The Campus Carbon Token in 3D (web). A glossy coin with a rose-gold rim spins slowly and follows
 * the pointer; every few seconds it flips as if freshly minted and the next block in the ledger ring
 * lights up. Pauses off-screen, stays still for reduced motion, and falls back to the flat coin
 * when WebGL isn't available.
 */
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import FlatToken from './Token3D';

const GREEN = '#337357';
const GREEN_DEEP = '#23513D';
const BLUSH = '#FFDBE5';
const ROSE = '#E27396';

function faceTexture() {
  const n = 1024, c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!;
  const m = n / 2;
  const grad = g.createRadialGradient(m * 0.8, m * 0.7, n * 0.05, m, m, m);
  grad.addColorStop(0, '#4E9474');
  grad.addColorStop(0.65, GREEN);
  grad.addColorStop(1, GREEN_DEEP);
  g.fillStyle = grad;
  g.fillRect(0, 0, n, n);

  g.strokeStyle = 'rgba(255,219,229,0.55)';
  g.lineWidth = 6;
  g.beginPath(); g.arc(m, m, n * 0.4, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2;
  g.beginPath(); g.arc(m, m, n * 0.375, 0, Math.PI * 2); g.stroke();

  // lettering around the edge
  const text = 'CAMPUS CARBON TOKEN  ·  ECOLEDGER  ·  ';
  g.fillStyle = 'rgba(255,219,229,0.9)';
  g.font = `600 ${n * 0.043}px Inter, "Segoe UI", Arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const chars = text.split('');
  chars.forEach((ch, i) => {
    const a = (i / chars.length) * Math.PI * 2 - Math.PI / 2;
    g.save();
    g.translate(m + Math.cos(a) * n * 0.445, m + Math.sin(a) * n * 0.445);
    g.rotate(a + Math.PI / 2);
    g.fillText(ch, 0, 0);
    g.restore();
  });

  // leaf emblem
  g.save();
  g.translate(m, m - n * 0.06);
  g.rotate(-0.55);
  g.fillStyle = BLUSH;
  g.beginPath();
  g.moveTo(0, -n * 0.17);
  g.bezierCurveTo(n * 0.14, -n * 0.1, n * 0.13, n * 0.1, 0, n * 0.16);
  g.bezierCurveTo(-n * 0.13, n * 0.1, -n * 0.14, -n * 0.1, 0, -n * 0.17);
  g.fill();
  g.strokeStyle = GREEN;
  g.lineWidth = n * 0.012;
  g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, -n * 0.12); g.lineTo(0, n * 0.2); g.stroke();
  g.lineWidth = n * 0.008;
  [[-0.06, 0.05], [0.0, 0.05], [0.06, 0.045]].forEach(([y, l]) => {
    g.beginPath(); g.moveTo(0, n * y); g.lineTo(n * l, n * (y - 0.045)); g.stroke();
    g.beginPath(); g.moveTo(0, n * y); g.lineTo(-n * l, n * (y - 0.045)); g.stroke();
  });
  g.restore();

  g.fillStyle = BLUSH;
  g.font = `800 ${n * 0.085}px Inter, "Segoe UI", Arial, sans-serif`;
  g.fillText('CCT', m, m + n * 0.2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(196,88,123,0.26)');
  grad.addColorStop(1, 'rgba(196,88,123,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export default function Token3D({ size = 220 }: { size?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

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
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0, 0.3, 6.6);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.HemisphereLight(0xfff3f6, 0x337357, 0.6));
    const key = new THREE.DirectionalLight(0xffe4ec, 1.6);
    key.position.set(-3, 4, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fd8b4, 1.1);
    rim.position.set(4, -1, -3);
    scene.add(rim);

    const root = new THREE.Group();
    scene.add(root);

    // coin
    const coin = new THREE.Group();
    const face = faceTexture();
    const faceMat = new THREE.MeshPhysicalMaterial({ map: face, metalness: 0.45, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.2 });
    const rimMat = new THREE.MeshPhysicalMaterial({ color: 0xe8a3b8, metalness: 1, roughness: 0.26, clearcoat: 0.6 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.16, 128, 1, true), rimMat);
    const band = new THREE.Mesh(new THREE.TorusGeometry(1, 0.085, 24, 128), rimMat);
    band.rotation.x = Math.PI / 2;
    const front = new THREE.Mesh(new THREE.CircleGeometry(0.965, 128), faceMat);
    front.rotation.x = -Math.PI / 2;
    front.position.y = 0.081;
    const back = front.clone();
    back.rotation.x = Math.PI / 2;
    back.rotation.z = Math.PI;
    back.position.y = -0.081;
    coin.add(body, band, front, back);
    coin.rotation.x = Math.PI / 2; // stand the coin up to face the camera
    const coinPivot = new THREE.Group();
    coinPivot.add(coin);
    root.add(coinPivot);

    // ledger ring: blocks on a tilted orbit
    const ring = new THREE.Group();
    ring.rotation.set(1.2, 0, -0.18);
    const COUNT = 12, R = 1.5;
    const blockGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
    const blocks = Array.from({ length: COUNT }, (_, i) => {
      const mat = new THREE.MeshPhysicalMaterial({ color: 0xffe9f0, roughness: 0.3, metalness: 0.1, clearcoat: 1, emissive: new THREE.Color(ROSE), emissiveIntensity: 0 });
      const b = new THREE.Mesh(blockGeo, mat);
      const a = (i / COUNT) * Math.PI * 2;
      b.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
      b.rotation.set(a, a * 0.7, 0);
      ring.add(b);
      return b;
    });
    const orbit = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(Array.from({ length: 128 }, (_, i) => {
        const a = (i / 128) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0);
      })),
      new THREE.LineBasicMaterial({ color: ROSE, transparent: true, opacity: 0.35 }),
    );
    ring.add(orbit);
    root.add(ring);

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -1.45;
    scene.add(shadow);

    // sizing
    const resize = () => {
      const w = el.clientWidth || size, h = el.clientHeight || size;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(() => { resize(); if (reduce) renderer.render(scene, camera); });
    ro.observe(el);

    // pointer tilt
    const target = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      target.x = Math.max(-1, Math.min(1, ((e.clientX - (r.left + r.width / 2)) / window.innerWidth) * 2.4));
      target.y = Math.max(-1, Math.min(1, ((e.clientY - (r.top + r.height / 2)) / window.innerHeight) * 2.4));
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    let raf = 0, visible = true, last = performance.now(), time = 0;
    let flipStart = -1, next = 0;
    const FLIP_EVERY = 6.5, FLIP_LEN = 1.2;
    const glow = new Array(COUNT).fill(0);

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      time += dt;

      // slow spin, plus a full flip every few seconds
      let flip = 0;
      if (flipStart < 0 && time % FLIP_EVERY < dt) { flipStart = time; }
      if (flipStart >= 0) {
        const p = Math.min(1, (time - flipStart) / FLIP_LEN);
        flip = ease(p) * Math.PI * 2;
        const pop = Math.sin(p * Math.PI);
        coinPivot.scale.setScalar(1 + pop * 0.06);
        if (p >= 0.5 && glow[next] < 0.5) glow[next] = 1;
        if (p >= 1) { flipStart = -1; next = (next + 1) % COUNT; coinPivot.scale.setScalar(1); }
      }
      coinPivot.rotation.y = Math.sin(time * 0.6) * 0.45 + flip;
      coinPivot.position.y = Math.sin(time * 1.1) * 0.06;

      ring.rotation.z = -0.18 + time * 0.12;
      blocks.forEach((b, i) => {
        glow[i] = Math.max(0, glow[i] - dt * 0.35);
        (b.material as THREE.MeshPhysicalMaterial).emissiveIntensity = glow[i] * 0.9;
        b.rotation.x += dt * 0.4;
      });

      root.rotation.y += (target.x * 0.35 - root.rotation.y) * 0.06;
      root.rotation.x += (target.y * 0.22 - root.rotation.x) * 0.06;
      (shadow.material as THREE.MeshBasicMaterial).opacity = 0.85 - coinPivot.position.y;

      renderer.render(scene, camera);
      if (visible) raf = requestAnimationFrame(frame);
    };

    const start = () => { if (!raf && !reduce) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };

    if (reduce) {
      coinPivot.rotation.y = -0.35;
      renderer.render(scene, camera);
    } else {
      start();
    }
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
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
      });
      face.dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [size]);

  if (failed) return <FlatToken size={size} />;
  return <div ref={host} aria-hidden="true" style={{ width: size, height: size, flexShrink: 0 }} />;
}
