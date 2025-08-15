import ai1 from "@/assets/avatars/ai-vtuber-1.jpg";
import ai2 from "@/assets/avatars/ai-vtuber-2.jpg";
import ai3 from "@/assets/avatars/ai-vtuber-3.jpg";

export type Creator = {
  id: string;
  slug: string;
  name: string;
  type: "AI" | "Real";
  team?: string;
  avatar: string;
  floorPrice: number; // in CFN (CoreFans token)
  supply: number; // ticket supply
  description: string;
};

export const creators: Creator[] = [
  {
    id: "c-neo",
    slug: "neo-synth",
    name: "Neo Synth",
    type: "AI",
    team: "NeonVerse Studio",
    avatar: ai1,
    floorPrice: 12.4,
    supply: 5000,
    description:
      "Cyber idol streaming rhythm games and sci-fi talk shows. Ticket holders unlock backstage Q&A and monthly mini-concerts.",
  },
  {
    id: "c-lyra",
    slug: "lyra-aeon",
    name: "Lyra Aeon",
    type: "AI",
    team: "Prism Labs",
    avatar: ai2,
    floorPrice: 9.2,
    supply: 8000,
    description:
      "Dreamy VTuber hosting cozy coding streams and lo-fi sessions. Tickets unlock lo-fi packs and collab votes.",
  },
  {
    id: "c-kira",
    slug: "kira-quantum",
    name: "Kira Quantum",
    type: "AI",
    team: "Cosmo Collective",
    avatar: ai3,
    floorPrice: 15.1,
    supply: 4000,
    description:
      "High-energy esports caster with AI improv skits. Tickets include VIP scrims and voice-line airdrops.",
  },
  {
    id: "c-alex",
    slug: "alex-park",
    name: "Alex Park",
    type: "Real",
    team: "Solo Creator",
    avatar: ai1,
    floorPrice: 7.5,
    supply: 12000,
    description:
      "Indie filmmaker sharing behind-the-scenes and director commentary. Ticket holders vote on short film plots.",
  },
  {
    id: "c-maya",
    slug: "maya-lee",
    name: "Maya Lee",
    type: "Real",
    team: "ML Studio",
    avatar: ai2,
    floorPrice: 11.0,
    supply: 6000,
    description:
      "Fitness coach with weekly live classes. Tickets unlock program bundles and DM form checks.",
  },
  {
    id: "c-zoe",
    slug: "zoe-chang",
    name: "Zoe Chang",
    type: "Real",
    team: "ZC Music",
    avatar: ai3,
    floorPrice: 18.9,
    supply: 3000,
    description:
      "Singer-songwriter hosting intimate acoustic sessions. Tickets grant early releases and meetups.",
  },
];
