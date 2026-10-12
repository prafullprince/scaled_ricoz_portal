"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  innovationFrame,
  innovationPathPoint,
  innovationVideoFocus,
} from "@/lib/products/innovation-story";

type Props = {
  active: boolean;
  video: RefObject<HTMLVideoElement | null>;
};

export function FactoryThreeScene({ active, video }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const running = useRef(active);
  const playback = useRef<((enabled: boolean) => void) | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    running.current = active;
    playback.current?.(active);
  }, [active]);

  useEffect(() => {
    const element = container.current;
    const media = video.current;
    if (!element || !media) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;

    async function initialize() {
      const THREE = await import("three");
      if (disposed) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: "low-power",
        });
      } catch (reason) {
        console.warn("Ricoz Three.js storytelling unavailable.", reason);
        setError(
          "3D effects unavailable. The video continues without the 3D overlay.",
        );
        return;
      }
      const resources: { dispose: () => void }[] = [];
      const release = () => {
        renderer.setAnimationLoop(null);
        for (const resource of resources) resource.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
      cleanup = release;
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      element!.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.z = 8;
      const group = new THREE.Group();
      scene.add(group);
      const palette = getComputedStyle(element!);
      const red = palette.getPropertyValue("--brand-red").trim();
      const soft = palette.getPropertyValue("--brand-red-soft").trim();
      // const white = palette.getPropertyValue("--brand-background").trim();
      // const navy = palette.getPropertyValue("--brand-navy-dark").trim();
      const markerGeometry = new THREE.BufferGeometry();
      const ring = new Float32Array(64 * 3);
      for (let step = 0; step < 64; step++) {
        const angle = (step / 64) * Math.PI * 2;
        ring[step * 3] = Math.cos(angle);
        ring[step * 3 + 1] = Math.sin(angle) * 0.62;
      }
      markerGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(ring, 3),
      );
      const markerMaterial = new THREE.LineBasicMaterial({
        color: red,
        transparent: true,
        opacity: 0.9,
      });
      const echoMaterial = new THREE.LineBasicMaterial({
        color: soft,
        transparent: true,
        opacity: 0.5,
      });
      resources.push(markerGeometry, markerMaterial, echoMaterial);
      const marker = new THREE.LineLoop(markerGeometry, markerMaterial);
      const echo = new THREE.LineLoop(markerGeometry, echoMaterial);
      scene.add(marker, echo);
      // This connector belongs to the disabled text callout.
      /*
      const leaderGeometry = new THREE.BufferGeometry();
      const leaderPositions = new Float32Array(6);
      leaderGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(leaderPositions, 3),
      );
      const leaderMaterial = new THREE.LineBasicMaterial({
        color: soft,
        transparent: true,
        opacity: 0.7,
      });
      resources.push(leaderGeometry, leaderMaterial);
      const leader = new THREE.Line(leaderGeometry, leaderMaterial);
      scene.add(leader);
      */
      const dustGeometry = new THREE.BufferGeometry();
      const dust = new Float32Array(100 * 3);
      for (let index = 0; index < 100; index++) {
        const angle = index * 2.399963;
        const radius = 0.25 + (index % 17) / 20;
        dust[index * 3] = Math.cos(angle) * radius;
        dust[index * 3 + 1] = Math.sin(angle) * radius * 0.7;
        dust[index * 3 + 2] = Math.sin(angle * 2) * 0.4;
      }
      dustGeometry.setAttribute("position", new THREE.BufferAttribute(dust, 3));
      const dustMaterial = new THREE.PointsMaterial({
        color: soft,
        size: 0.027,
        transparent: true,
        opacity: 0.5,
      });
      resources.push(dustGeometry, dustMaterial);
      group.add(new THREE.Points(dustGeometry, dustMaterial));
      // Temporarily disabled: the animated canvas text callout.
      /*
      const sprites: InstanceType<typeof THREE.Sprite>[] = [];
      for (const thought of innovationStory) {
        const canvas = document.createElement("canvas");
        canvas.width = 1600;
        canvas.height = 640;
        const context = canvas.getContext("2d");
        if (!context)
          throw new Error("Unable to create innovation text textures.");
        const font = getComputedStyle(element!).fontFamily;
        context.textAlign = "right";
        context.fillStyle = soft;
        context.font = `600 30px ${font}`;
        context.fillText(thought.label.toUpperCase(), 1560, 100);
        context.shadowColor = navy;
        context.shadowBlur = 28;
        context.fillStyle = white;
        context.font = `800 86px ${font}`;
        thought.lines.forEach((line, index) =>
          context.fillText(line, 1560, 245 + index * 105),
        );
        context.font = `400 50px ${font}`;
        const thoughtLines: string[] = [];
        let line = "";
        for (const word of thought.thought.split(" ")) {
          const next = line ? `${line} ${word}` : word;
          if (line && context.measureText(next).width > 1400) {
            thoughtLines.push(line);
            line = word;
          } else line = next;
        }
        thoughtLines.push(line);
        thoughtLines.forEach((text, index) =>
          context.fillText(text, 1560, 455 + index * 60),
        );
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
          }),
        );
        resources.push(texture, sprite.material);
        sprite.renderOrder = 2;
        scene.add(sprite);
        sprites.push(sprite);
      }
      */
      const pointer = new THREE.Vector2();
      const host = element!.parentElement!;
      const move = (event: PointerEvent) => {
        const bounds = element!.getBoundingClientRect();
        pointer.set(
          (event.clientX - bounds.left) / bounds.width - 0.5,
          (event.clientY - bounds.top) / bounds.height - 0.5,
        );
      };
      const resetPointer = () => pointer.set(0, 0);
      host.addEventListener("pointermove", move);
      host.addEventListener("pointerleave", resetPointer);
      const render = () => {
        const { index, progress } = innovationFrame(
          media!.currentTime,
          media!.duration,
        );
        element!.dataset.storyPhase = String(index);
        const width = element!.clientWidth || 1;
        const height = element!.clientHeight || 1;
        const viewHeight =
          2 * Math.tan(THREE.MathUtils.degToRad(45 / 2)) * camera.position.z;
        const viewWidth = viewHeight * camera.aspect;
        const toWorld = (x: number, y: number) =>
          new THREE.Vector3(
            (x / width - 0.5) * viewWidth,
            (0.5 - y / height) * viewHeight,
            0,
          );
        // The video playhead drives the anchor and text, so the thought sits on the path change being shown.
        const sourceWidth = media!.videoWidth || 736;
        const sourceHeight = media!.videoHeight || 414;
        const cover = Math.max(width / sourceWidth, height / sourceHeight);
        const point = innovationPathPoint(media!.currentTime, media!.duration);
        const overflowX = sourceWidth * cover - width;
        // On narrow screens the cropped video pans with the light so each path change stays in view.
        const focusX =
          overflowX > 1
            ? Math.min(
                1,
                Math.max(
                  0,
                  (point.x * sourceWidth * cover - width * 0.64) / overflowX,
                ),
              )
            : innovationVideoFocus.x;
        media!.style.objectPosition = `${focusX * 100}% ${innovationVideoFocus.y * 100}%`;
        const anchorX = point.x * sourceWidth * cover - overflowX * focusX;
        const anchorY =
          point.y * sourceHeight * cover -
          (sourceHeight * cover - height) * innovationVideoFocus.y;
        const anchor = toWorld(anchorX, anchorY);
        const reveal = running.current
          ? Math.min(1, progress / 0.12, (1 - progress) / 0.1)
          : 1;
        const ease =
          1 - Math.pow(1 - Math.max(0, Math.min(1, progress / 0.18)), 3);
        const pixel = viewWidth / width;
        const ringSize = (14 + ease * 8) * pixel;
        marker.position.copy(anchor);
        marker.scale.set(ringSize, ringSize, 1);
        markerMaterial.opacity = 0.9 * reveal;
        const pulse = (progress * 3) % 1;
        echo.position.copy(anchor);
        echo.scale.set(
          ringSize * (1 + pulse * 1.6),
          ringSize * (1 + pulse * 1.6),
          1,
        );
        echoMaterial.opacity = 0.55 * (1 - pulse) * reveal;
        group.position.copy(anchor);
        group.rotation.z = progress * 0.6;
        group.rotation.y = pointer.x * 0.25;
        group.rotation.x = -pointer.y * 0.12;
        dustMaterial.opacity = 0.5 * reveal;
        // Temporarily disabled: positioning and animating the text callout.
        /*
        const margin = 16;
        const blockWidth =
          width < 640
            ? width - margin * 2
            : Math.min(660, Math.max(380, width * 0.44));
        const blockHeight = blockWidth * 0.4;
        const gap = 48 + (1 - ease) * 18;
        const left = Math.min(
          Math.max(anchorX + 28 - blockWidth, margin),
          width - margin - blockWidth,
        );
        let top = anchorY - gap - blockHeight;
        let edgeY = top + blockHeight * 0.92;
        if (top < 76) {
          top = Math.min(anchorY + gap, height - blockHeight - 96);
          edgeY = top + blockHeight * 0.08;
        }
        const center = toWorld(left + blockWidth / 2, top + blockHeight / 2);
        const end = toWorld(
          Math.min(Math.max(anchorX, left + 24), left + blockWidth - 24),
          edgeY,
        );
        const start = anchor
          .clone()
          .lerp(end, ringSize / Math.max(anchor.distanceTo(end), ringSize));
        const reach = start.clone().lerp(end, ease);
        leaderPositions.set([start.x, start.y, 0, reach.x, reach.y, 0]);
        leaderGeometry.attributes.position.needsUpdate = true;
        leaderMaterial.opacity = 0.7 * reveal;
        sprites.forEach((sprite, thoughtIndex) => {
          sprite.visible = thoughtIndex === index;
          sprite.scale.set(blockWidth * pixel, blockHeight * pixel, 1);
          sprite.position.copy(center);
          sprite.material.opacity = reveal;
        });
        */
        renderer.render(scene, camera);
      };
      const resize = new ResizeObserver(() => {
        const width = element!.clientWidth;
        const height = element!.clientHeight;
        if (!width || !height) return;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        render();
      });
      resize.observe(element!);
      let last = 0;
      let contextAvailable = true;
      const frame = (time: number) => {
        if (time - last < 1000 / 30) return;
        last = time;
        render();
      };
      const updatePausedFrame = () => {
        if (!running.current && contextAvailable) render();
      };
      media!.addEventListener("seeked", updatePausedFrame);
      media!.addEventListener("timeupdate", updatePausedFrame);
      playback.current = (enabled) => {
        if (!contextAvailable) return;
        renderer.setAnimationLoop(enabled ? frame : null);
        render();
      };
      const contextLost = (event: Event) => {
        event.preventDefault();
        contextAvailable = false;
        renderer.setAnimationLoop(null);
        console.error("Ricoz storytelling WebGL context was lost.");
        setError(
          "3D effects were interrupted. The video continues without the 3D overlay.",
        );
      };
      const contextRestored = () => {
        contextAvailable = true;
        setError(null);
        playback.current?.(running.current);
      };
      renderer.domElement.addEventListener("webglcontextlost", contextLost);
      renderer.domElement.addEventListener(
        "webglcontextrestored",
        contextRestored,
      );
      playback.current(running.current);
      cleanup = () => {
        playback.current = null;
        renderer.setAnimationLoop(null);
        resize.disconnect();
        host.removeEventListener("pointermove", move);
        host.removeEventListener("pointerleave", resetPointer);
        media!.removeEventListener("seeked", updatePausedFrame);
        media!.removeEventListener("timeupdate", updatePausedFrame);
        renderer.domElement.removeEventListener(
          "webglcontextlost",
          contextLost,
        );
        renderer.domElement.removeEventListener(
          "webglcontextrestored",
          contextRestored,
        );
        media!.style.objectPosition = `${innovationVideoFocus.x * 100}% ${innovationVideoFocus.y * 100}%`;
        release();
      };
    }
    void initialize().catch((reason: unknown) => {
      console.error("Unable to load Ricoz Three.js storytelling", reason);
      cleanup?.();
      cleanup = undefined;
      if (!disposed) {
        setError(
          "3D storytelling could not load. The video continues without the 3D overlay.",
        );
      }
    });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [video]);

  return (
    <>
      <div
        ref={container}
        aria-hidden="true"
        data-factory-scene
        className="pointer-events-none absolute inset-0"
      />
      {error ? (
        <p
          role="status"
          className="absolute bottom-2 left-4 right-16 text-center text-[10px] text-white/70"
        >
          {error}
        </p>
      ) : null}
    </>
  );
}
