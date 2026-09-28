/**
 * One polished trophy (web): gold, silver or bronze by rank. It drops in with a small bounce, then
 * turns slowly; the winner's trophy also catches a soft glow and a few sparkles. Pauses off-screen,
 * still for reduced motion, flat icon when WebGL isn't available.
 */
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import TrophyFlat from './TrophyFlat';

export { MEDAL, MEDAL_TINT } from './TrophyFlat';

const METALS = [0xd9ac3c, 0xc5ccd3, 0xc27f4e];

function buildTrophy(color: number) {
  const metal = new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const dark = new THREE.MeshPhysicalMaterial({ color: 0x23513d, metalness: 0.3, roughness: 0.45, clearcoat: 0.8 });
  const g = new THREE.Group();
  const pts = [
    [0.0, 0.0], [0.22, 0.0], [0.22, 0.05], [0.12, 0.08], [0.06, 0.12], [0.05, 0.3], [0.08, 0.36],
    [0.16, 0.42], [0.26, 0.54], [0.3, 0.68], [0.31, 0.8], [0.29, 0.8], [0.27, 0.69], [0.0, 0.6],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 64), metal);
  body.position.y = 0.16;
  g.add(body);
  [-1, 1].forEach((sgn) => {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.022, 12, 32, Math.PI * 1.2), metal);
    h.position.set(sgn * 0.37, 0.8, 0);
    h.rotation.z = sgn > 0 ? -Math.PI * 0.55 : Math.PI * 1.55;
    g.add(h);
  });
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.16, 48), dark);
  plinth.position.y = 0.08;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.03, 48), metal);
  band.position.y = 0.12;
  g.add(plinth, band);
  return g;
}

function radialTexture(inner: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export default function TrophyCup3D({ size = 96, rank = 1, delay = 0 }: { size?: number; rank?: number; delay?: number }) {
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
    renderer.setSize(size, size, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    Object.assign(renderer.domElement.style, { width: '100%', height: '100%', display: 'block' });
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.95;
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 30);
    camera.position.set(0, 1.0, 3.55);
    camera.lookAt(0, 0.56, 0);
    const key = new THREE.DirectionalLight(0xffffff, 1.3);
    key.position.set(-2, 3, 3);
    scene.add(key, new THREE.HemisphereLight(0xfff3f6, 0x337357, 0.5));

    const cup = buildTrophy(METALS[rank - 1]);
    scene.add(cup);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: radialTexture('rgba(27,43,36,0.28)'), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    scene.add(shadow);

    let glow: THREE.Sprite | null = null;
    const sparks: THREE.Mesh[] = [];
    if (rank === 1) {
      glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture('rgba(255,214,120,0.6)'), transparent: true, depthWrite: false }));
      glow.scale.set(1.5, 1.5, 1);
      glow.position.set(0, 0.7, -0.35);
      scene.add(glow);
      const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfff1c9, toneMapped: false });
      for (let i = 0; i < 5; i++) {
        const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.025, 0), sparkMat);
        m.userData.a = (i / 5) * Math.PI * 2;
        sparks.push(m);
        scene.add(m);
      }
    }

    const outBack = (t: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
    const clamp = (t: number) => Math.min(1, Math.max(0, t));
    const pose = (t: number) => {
      const land = clamp((t - delay) / 0.7);
      cup.position.y = (1 - land) * 0.7;
      cup.scale.setScalar(Math.max(0.001, land > 0 ? outBack(land) : 0));
      (shadow.material as THREE.MeshBasicMaterial).opacity = land;
      cup.rotation.y = -0.5 + t * 0.5;
      if (glow) (glow.material as THREE.SpriteMaterial).opacity = clamp((t - delay - 0.6) / 0.6) * (0.75 + 0.25 * Math.sin(t * 2.2));
      sparks.forEach((m, i) => {
        const a = m.userData.a + t * 0.9;
        m.position.set(Math.cos(a) * 0.46, 0.72 + Math.sin(t * 1.6 + i) * 0.16, Math.sin(a) * 0.46);
        m.rotation.y = t * 2;
        m.scale.setScalar(clamp((t - delay - 0.6) / 0.6) * (0.7 + 0.3 * Math.sin(t * 3 + i)));
      });
    };

    let raf = 0, last = performance.now(), time = 0, visible = true;
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      time += dt;
      pose(time);
      renderer.render(scene, camera);
      if (visible) raf = requestAnimationFrame(frame);
    };
    const start = () => { if (!raf && !reduce) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    if (reduce) {
      pose(delay + 5);
      sparks.forEach((m) => (m.visible = false));
      renderer.render(scene, camera);
    } else start();

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting && !document.hidden; if (visible) start(); else stop(); });
    io.observe(el);
    const onVis = () => { visible = !document.hidden; if (visible) start(); else stop(); };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      stop();
      io.disconnect();
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
  }, [size, rank, delay]);

  if (failed) return <TrophyFlat size={size} rank={rank} />;
  return <div ref={host} aria-hidden="true" style={{ width: size, height: size, flexShrink: 0 }} />;
}
