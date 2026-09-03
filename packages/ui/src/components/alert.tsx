import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const alertVariants = cva("rounded-[0.5rem] border px-4 py-3 text-sm leading-relaxed", {
  variants: {
    variant: {
      danger: "border-danger/30 bg-danger-soft text-danger",
      success: "border-success/30 bg-success-soft text-success",
      info: "border-primary/30 bg-primary-soft text-primary-dark",
    },
  },
  defaultVariants: {
    variant: "info",
  },
});

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

export function Alert({ className, variant, role, ...props }: AlertProps) {
  return (
    <div
      role={role ?? (variant === "danger" ? "alert" : "status")}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}
