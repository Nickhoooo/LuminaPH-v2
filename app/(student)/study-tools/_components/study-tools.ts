import {
  BookOpen,
  Layers,
  ClipboardCheck,
  Route,
  Sparkles,
} from "lucide-react";

// Put your images in public/images/dashboard-tools, then set image below.
// Example: image: "/images/dashboard-tools/flashcards.jpg"
export const studyTools = [
  {
    id: "guides",
    href: "/study-tools/study-guides",
    name: "Study Guides",
    description: "Make sense of a topic, one idea at a time.",
    label: "Understand",
    icon: BookOpen,
    image: "",
    background: "bg-[#dfe8d7] dark:bg-stone-800",
  },
  {
    id: "flashcards",
    href: "/study-tools/flashcards",
    name: "Flashcards",
    description: "A little recall. A stronger memory.",
    label: "Remember",
    icon: Layers,
    image: "",
    background: "bg-[#eee6d5] dark:bg-stone-800",
  },
  {
    id: "quizzes",
    href: "/study-tools/quizzes",
    name: "Quizzes",
    description: "Find out what you know and what to revisit.",
    label: "Practice",
    icon: ClipboardCheck,
    image: "",
    background: "bg-[#e6e3ee] dark:bg-stone-800",
  },
  {
    id: "paths",
    href: "/study-tools/learning-paths",
    name: "Learning Paths",
    description: "Give your next learning goal a direction.",
    label: "Build a habit",
    icon: Route,
    image: "",
    background: "bg-[#dce7e9] dark:bg-stone-800",
  },
  {
    id: "tutor",
    href: "/study-tools/ai-tutor",
    name: "AI Tutor",
    description: "Work through the why behind a question.",
    label: "Ask & learn",
    icon: Sparkles,
    image: "",
    background: "bg-[#eddfdf] dark:bg-stone-800",
  },
] as const;
