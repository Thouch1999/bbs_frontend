import type { ReactNode } from "react";

interface MainSidebarProps {
  brand: ReactNode;
  userPanel?: ReactNode;
  search?: ReactNode;
  nav: ReactNode;
}

export function MainSidebar({ brand, userPanel, search, nav }: MainSidebarProps) {
  return (
    <aside className="main-sidebar sidebar-dark-primary elevation-4">
      {brand}
      <div className="sidebar">
        {userPanel}
        {search}
        {nav}
      </div>
    </aside>
  );
}
