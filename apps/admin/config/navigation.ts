import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Handshake,
  Star,
  FolderTree,
  MessagesSquare,
  Shield,
  Settings,
  HeartPulse,
  type LucideIcon,
} from "lucide-react";
import { PERMISSIONS, type PermissionName } from "@/lib/auth/permissions";

export type NavSubItem = {
  title: string;
  url: string;
  permission?: PermissionName;
};

export type NavItem = {
  title: string;
  url: string;
  icon?: LucideIcon;
  target?: string;
  permission?: PermissionName;
  items?: NavSubItem[];
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navigationGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: LayoutDashboard,
        permission: PERMISSIONS.DASHBOARD_READ,
      },
      {
        title: "System Status",
        url: "/settings/system",
        icon: HeartPulse,
        permission: PERMISSIONS.HEALTH_READ,
      },
    ],
  },
  {
    label: "Marketplace",
    items: [
      {
        title: "Users",
        url: "/users",
        icon: Users,
        permission: PERMISSIONS.USERS_READ,
      },
      {
        title: "Requests",
        url: "/requests",
        icon: ClipboardList,
        permission: PERMISSIONS.REQUESTS_READ,
      },
      {
        title: "Offers",
        url: "/offers",
        icon: Handshake,
        permission: PERMISSIONS.OFFERS_READ,
      },
      {
        title: "Reviews",
        url: "/reviews",
        icon: Star,
        permission: PERMISSIONS.REVIEWS_READ,
      },
      {
        title: "Categories",
        url: "/categories",
        icon: FolderTree,
        permission: PERMISSIONS.CATEGORIES_READ,
      },
      {
        title: "Conversations",
        url: "/conversations",
        icon: MessagesSquare,
        permission: PERMISSIONS.CONVERSATIONS_READ,
      },
    ],
  },
  {
    label: "Access",
    items: [
      {
        title: "Roles & Permissions",
        url: "/roles",
        icon: Shield,
        permission: PERMISSIONS.ROLES_READ,
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        title: "Settings",
        url: "#",
        icon: Settings,
        items: [
          {
            title: "Profile",
            url: "/settings/user",
            permission: PERMISSIONS.SETTINGS_READ,
          },
          {
            title: "Account",
            url: "/settings/account",
            permission: PERMISSIONS.SETTINGS_READ,
          },
          {
            title: "Appearance",
            url: "/settings/appearance",
            permission: PERMISSIONS.SETTINGS_READ,
          },
          {
            title: "Notifications",
            url: "/settings/notifications",
            permission: PERMISSIONS.NOTIFICATIONS_READ,
          },
        ],
      },
    ],
  },
];

export function filterNavigationGroups(
  groups: NavGroup[],
  permissions: string[],
): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.flatMap((item) => {
        if (item.permission && !permissions.includes(item.permission)) {
          return [];
        }
        if (item.items) {
          const items = item.items.filter(
            (sub) => !sub.permission || permissions.includes(sub.permission),
          );
          if (items.length === 0) return [];
          return [{ ...item, items }];
        }
        return [item];
      }),
    }))
    .filter((group) => group.items.length > 0);
}

export const searchItems = navigationGroups.flatMap((group) =>
  group.items.flatMap((item) => {
    if (item.items) {
      return item.items.map((sub) => ({
        title: sub.title,
        url: sub.url,
        category: group.label,
        permission: sub.permission ?? item.permission,
      }));
    }
    return [
      {
        title: item.title,
        url: item.url,
        category: group.label,
        permission: item.permission,
      },
    ];
  }),
);
