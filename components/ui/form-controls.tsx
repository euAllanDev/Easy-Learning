import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`ui-input ${className}`} {...props} />;
}

export function TimeInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <Input type="time" step={300} {...props} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`ui-input ${className}`} {...props} />;
}
