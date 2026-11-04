"use client";

import dynamic from "next/dynamic";

/**
 * The imported templates' (xs) interactive parts — their sliders, product
 * grid, quotes, countdown and forms — each split into its own chunk, the way
 * the immersive ones are (components/immersive/lazy.tsx): a store page that
 * draws none of them downloads none of their code. They still render on the
 * server (next/dynamic's default), so nothing pops in after load.
 */
export const XsSlider = dynamic(() => import("./xs/XsSlider").then((m) => m.XsSlider));
export const XsProductGrid = dynamic(() => import("./xs/XsProductGrid").then((m) => m.XsProductGrid));
export const XsQuotes = dynamic(() => import("./xs/XsQuotes").then((m) => m.XsQuotes));
export const XsCountdown = dynamic(() => import("./xs/XsCountdown").then((m) => m.XsCountdown));
export const XsNewsletterForm = dynamic(() => import("./xs/XsNewsletterForm").then((m) => m.XsNewsletterForm));
export const XsContactForm = dynamic(() => import("./xs/XsContactForm").then((m) => m.XsContactForm));
export const XsStack = dynamic(() => import("./xs/XsStack").then((m) => m.XsStack));
export const XsJourney = dynamic(() => import("./xs/XsJourney").then((m) => m.XsJourney));
export const XsReels = dynamic(() => import("./xs/XsReels").then((m) => m.XsReels));

/*
 * The same for the interactive parts of the website editor's other elements:
 * the page renderer imports them all, so without this every store page carries
 * every one of them, even a home page that draws none.
 */
export const ProductLanding = dynamic(() => import("@/components/product/ProductLanding").then((m) => m.ProductLanding));
export const ProductReviews = dynamic(() => import("@/components/product/ProductReviews").then((m) => m.ProductReviews));
export const ShoppableImageView = dynamic(() => import("@/components/ShoppableImageView").then((m) => m.ShoppableImageView));
export const FunnelCodForm = dynamic(() => import("../funnel/FunnelCodForm").then((m) => m.FunnelCodForm));
export const CartSummary = dynamic(() => import("./CartSummary").then((m) => m.CartSummary));
export const GallerySlideshow = dynamic(() => import("./GallerySlideshow").then((m) => m.GallerySlideshow));
export const StoryGalleryElement = dynamic(() => import("./StoryGallery").then((m) => m.StoryGalleryElement));
export const PageForm = dynamic(() => import("./PageForm").then((m) => m.PageForm));
export const TabsBlock = dynamic(() => import("./builderClient").then((m) => m.TabsBlock));
export const CheckoutSummaryBlock = dynamic(() => import("./builderClient").then((m) => m.CheckoutSummaryBlock));
export const OrderSummaryBlock = dynamic(() => import("./builderClient").then((m) => m.OrderSummaryBlock));
export const FunnelActionButton = dynamic(() => import("./builderClient").then((m) => m.FunnelActionButton));
export const BundleChoice = dynamic(() => import("./builderExtrasClient").then((m) => m.BundleChoice));
export const GalleryWithThumbs = dynamic(() => import("./builderExtrasClient").then((m) => m.GalleryWithThumbs));
export const PopupBlock = dynamic(() => import("./builderExtrasClient").then((m) => m.PopupBlock));
export const VariantChips = dynamic(() => import("./builderExtrasClient").then((m) => m.VariantChips));
export const CartActionButton = dynamic(() => import("./builderMoreClient").then((m) => m.CartActionButton));
export const PickedPrice = dynamic(() => import("./builderMoreClient").then((m) => m.PickedPrice));
export const HeroSlider = dynamic(() => import("./showcase/HeroSlider").then((m) => m.HeroSlider));
export const NeedTabs = dynamic(() => import("./showcase/NeedTabs").then((m) => m.NeedTabs));
export const ProductTabs = dynamic(() => import("./showcase/ProductTabs").then((m) => m.ProductTabs));
export const RailTrack = dynamic(() => import("./showcase/RailTrack").then((m) => m.RailTrack));
export const ReelsTrack = dynamic(() => import("./showcase/ReelsTrack").then((m) => m.ReelsTrack));
export const ShelfRail = dynamic(() => import("./showcase/ShelfRail").then((m) => m.ShelfRail));
