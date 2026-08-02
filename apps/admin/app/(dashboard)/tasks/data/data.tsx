import {
  Ban,
  CheckCircle2,
  Circle,
  PlayCircle,
} from "lucide-react";

export const labels = [
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature" },
  { value: "documentation", label: "Docs" },
  { value: "improvement", label: "Improvement" },
  { value: "refactor", label: "Refactor" },
];

export const statuses = [
  { value: "TODO", label: "Todo", icon: Circle },
  { value: "IN_PROGRESS", label: "In Progress", icon: PlayCircle },
  { value: "DONE", label: "Done", icon: CheckCircle2 },
  { value: "CANCELLED", label: "Cancelled", icon: Ban },
] as const;

export const priorities = [
  { label: "Low", value: "LOW" },
  { label: "Medium", value: "MEDIUM" },
  { label: "High", value: "HIGH" },
  { label: "Urgent", value: "URGENT" },
] as const;
