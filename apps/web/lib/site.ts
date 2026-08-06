import { createElement } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bolt,
  Car,
  Droplets,
  Flower2,
  Hammer,
  Leaf,
  Move,
  Paintbrush,
  PawPrint,
  Scissors,
  Sparkles,
  CarFront,
  Users,
  Wrench,
  Wind,
} from "lucide-react";

/** Map API SF Symbol-style names to Lucide icons for the web UI. */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  home_repair: Hammer,
  plumbing: Droplets,
  electrical: Bolt,
  cleaning: Sparkles,
  gardening: Leaf,
  painting: Paintbrush,
  hvac: Wind,
  moving: Move,
  pet_care: PawPrint,
  beauty: Scissors,
  handyman: Wrench,
  automotive: Car,
  designated_driver: CarFront,
  carpool: Users,
};

export function categoryIcon(categoryId: string): LucideIcon {
  return CATEGORY_ICONS[categoryId] ?? Flower2;
}

export function CategoryIcon({
  categoryId,
  className,
}: {
  categoryId: string;
  className?: string;
}) {
  return createElement(categoryIcon(categoryId), {
    className,
    "aria-hidden": true,
  });
}

export const SITE_NAME = "Gobid";
export const SITE_TAGLINE = "Local help, when you need it";
export const SITE_DESCRIPTION =
  "Gobid connects neighbors across Estonia with trusted local service providers — post a request, get offers, get it done.";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3002";
