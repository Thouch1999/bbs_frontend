import type { ReactNode } from "react";

interface MainFooterProps {
  children?: ReactNode;
}

export function MainFooter({ children }: MainFooterProps) {
  return (
    <footer className="main-footer">
      <strong>&copy; {new Date().getFullYear()} BBMS.</strong> {children}
    </footer>
  );
}
