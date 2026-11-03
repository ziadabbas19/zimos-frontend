"use client";

import dynamic from "next/dynamic";

/**
 * The immersive client components, each split into its own chunk. The page
 * renderer (page-renderer/immersive.tsx) uses these instead of importing the
 * components directly, so a store page without a shader hero, a 3D product, a
 * turning carousel or a scroll story never downloads their code — and a page
 * with one downloads only that one. They still render on the server (the
 * default for next/dynamic), so nothing pops in after load; the heaviest
 * piece, three.js behind the 3D viewer, is loaded later still, only when a
 * shopper opens the model (Product3D → ModelViewer).
 */
export const ShaderHero = dynamic(() => import("./ShaderHero").then((m) => m.ShaderHero));
export const ScrollStory = dynamic(() => import("./ScrollStory").then((m) => m.ScrollStory));
export const OrbitStage = dynamic(() => import("./OrbitStage").then((m) => m.OrbitStage));
export const Product3D = dynamic(() => import("./Product3D").then((m) => m.Product3D));
export const ClothingRail = dynamic(() => import("./ClothingRail").then((m) => m.ClothingRail));
