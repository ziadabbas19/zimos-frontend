"use client";

import { useEffect, useRef, useState } from "react";
import { StoreLoader } from "@/components/StoreLoader";

/**
 * Turns a product's GLB file into something the shopper can spin with a finger.
 *
 * Nothing here loads until they ask for it: the page ships a still photo and a
 * button, and only on that click does three.js and the model download. That is
 * deliberate — the model is the heaviest thing on a product page, and most
 * shoppers decide from the photos.
 *
 * Drag rotates, the wheel or pinch zooms. The renderer stops on the last frame
 * when the viewer is closed, and everything it allocated is released.
 */
export function ModelViewer({
  src,
  alt,
  closeLabel,
  loadingLabel,
  errorLabel,
  onClose,
}: {
  src: string;
  alt: string;
  closeLabel: string;
  loadingLabel: string;
  errorLabel: string;
  onClose: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const THREE = await import("three");
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
        if (disposed) return;

        const width = host.clientWidth;
        const height = host.clientHeight;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height);
        host.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);

        // Plain three-point-ish lighting: enough to read the shape of a
        // product without shipping an environment map.
        scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 2.2));
        const key = new THREE.DirectionalLight(0xffffff, 2);
        key.position.set(2, 3, 4);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xffffff, 0.8);
        fill.position.set(-3, 1, -2);
        scene.add(fill);

        const pivot = new THREE.Group();
        scene.add(pivot);

        const gltf = await new GLTFLoader().loadAsync(src);
        if (disposed) {
          renderer.dispose();
          return;
        }

        // Centre the model and pull the camera back to fit whatever size it is.
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        pivot.add(model);
        const extent = Math.max(size.x, size.y, size.z) || 1;
        let distance = (extent / 2 / Math.tan((camera.fov * Math.PI) / 360)) * 1.6;
        camera.position.set(0, extent * 0.1, distance);
        camera.lookAt(0, 0, 0);

        setState("ready");

        // Hand-rolled orbit: two rotations and a distance, which is all a
        // product viewer needs — cheaper than pulling in OrbitControls.
        let rotY = 0.4;
        let rotX = 0.1;
        let dragging = false;
        let lastX = 0;
        let lastY = 0;
        const el = renderer.domElement;
        el.style.touchAction = "none";
        el.style.cursor = "grab";

        const down = (e: PointerEvent) => {
          dragging = true;
          lastX = e.clientX;
          lastY = e.clientY;
          el.setPointerCapture(e.pointerId);
          el.style.cursor = "grabbing";
        };
        const move = (e: PointerEvent) => {
          if (!dragging) return;
          rotY += (e.clientX - lastX) * 0.01;
          rotX = Math.max(-1.2, Math.min(1.2, rotX + (e.clientY - lastY) * 0.01));
          lastX = e.clientX;
          lastY = e.clientY;
        };
        const up = () => {
          dragging = false;
          el.style.cursor = "grab";
        };
        const wheel = (e: WheelEvent) => {
          e.preventDefault();
          distance = Math.max(extent * 0.8, Math.min(extent * 6, distance + e.deltaY * extent * 0.001));
        };
        el.addEventListener("pointerdown", down);
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerup", up);
        el.addEventListener("pointercancel", up);
        el.addEventListener("wheel", wheel, { passive: false });

        const resize = () => {
          const w = host.clientWidth;
          const h = host.clientHeight;
          if (w === 0 || h === 0) return;
          renderer.setSize(w, h);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        };
        const ro = new ResizeObserver(resize);
        ro.observe(host);

        let raf = 0;
        const frame = () => {
          raf = requestAnimationFrame(frame);
          // A slow idle turn while nobody is touching it, so the shopper can
          // see it is a real object without having to discover the drag.
          if (!dragging) rotY += 0.003;
          pivot.rotation.y = rotY;
          pivot.rotation.x = rotX;
          camera.position.set(0, extent * 0.1, distance);
          camera.lookAt(0, 0, 0);
          renderer.render(scene, camera);
        };
        raf = requestAnimationFrame(frame);

        cleanup = () => {
          cancelAnimationFrame(raf);
          ro.disconnect();
          el.removeEventListener("pointerdown", down);
          el.removeEventListener("pointermove", move);
          el.removeEventListener("pointerup", up);
          el.removeEventListener("pointercancel", up);
          el.removeEventListener("wheel", wheel);
          scene.traverse((obj) => {
            const mesh = obj as import("three").Mesh;
            if (mesh.geometry) mesh.geometry.dispose();
            const material = mesh.material;
            if (Array.isArray(material)) material.forEach((m) => m.dispose());
            else if (material) material.dispose();
          });
          renderer.dispose();
          el.remove();
        };
      } catch {
        if (!disposed) setState("error");
      }
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [src]);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-line bg-paper">
      <div ref={hostRef} className="absolute inset-0" aria-label={alt} role="img" />

      {state !== "ready" && (
        <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-ink-soft">
          {state === "loading" ? <StoreLoader label={loadingLabel} /> : errorLabel}
        </p>
      )}

      <button
        type="button"
        onClick={onClose}
        className="absolute end-3 top-3 cursor-pointer rounded-full border border-line bg-paper-raised px-3 py-1.5 text-sm text-ink hover:border-primary"
      >
        {closeLabel}
      </button>
    </div>
  );
}
