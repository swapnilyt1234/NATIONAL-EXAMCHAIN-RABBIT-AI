import * as React from "react";
import { cn } from "@/lib/utils";

type ProgressProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: number;
};

function Progress({ value = 0, className, ...props }: ProgressProps) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-white/10", className)} {...props}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-400 transition-all duration-300"
        style={{ width: `${safe}%` }}
      />
    </div>
  );
}

export { Progress };
