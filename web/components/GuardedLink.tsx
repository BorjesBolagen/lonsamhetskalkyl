"use client";

import Link, { LinkProps } from "next/link";
import { MouseEvent, ReactNode } from "react";

interface GuardedLinkProps extends LinkProps {
  hasUnsavedChanges?: boolean;
  confirmMessage?: string;
  className?: string;
  children: ReactNode;
}

export default function GuardedLink({
  hasUnsavedChanges = false,
  confirmMessage = "Du har osparade ändringar. Vill du verkligen lämna sidan?",
  children,
  ...props
}: GuardedLinkProps) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (hasUnsavedChanges) {
      const ok = confirm(confirmMessage);
      if (!ok) {
        e.preventDefault();
      }
    }
  };

  return (
    <Link {...props} onClick={handleClick}>
      {children}
    </Link>
  );
}