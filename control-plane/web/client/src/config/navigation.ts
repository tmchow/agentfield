import {
  LayoutDashboard,
  Play,
  Bot,
  FlaskConical,
  Settings,
} from "lucide-react";

export const navigation = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    path: "/dashboard",
  },
  {
    title: "Runs",
    icon: Play,
    path: "/runs",
  },
  {
    title: "Agents",
    icon: Bot,
    path: "/agents",
  },
  {
    title: "Playground",
    icon: FlaskConical,
    path: "/playground",
  },
  {
    title: "Settings",
    icon: Settings,
    path: "/settings",
  },
];
