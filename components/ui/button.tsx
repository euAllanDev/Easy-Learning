import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger"; size?: "default" | "small" };

export function Button({ variant = "primary", size = "default", className = "", ...props }: Props) {
  return <button className={`ui-button ${variant} ${size} ${className}`} {...props} />;
}
