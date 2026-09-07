import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Switch({
 className,
 size = "default",
 ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
 size?: "sm" | "default"
}) {
 return (
  <SwitchPrimitive.Root
   data-slot="switch"
   data-size={size}
   className={cn(
    "peer group/switch relative inline-flex size-11 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-slate-600 focus-visible:ring-offset-2 aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 data-disabled:cursor-not-allowed data-disabled:opacity-50",
    className
   )}
   {...props}
  >
   <span
    data-slot="switch-track"
    className="pointer-events-none inline-flex items-center rounded-full border border-transparent transition-colors group-data-[size=default]/switch:h-[18.4px] group-data-[size=default]/switch:w-8 group-data-[size=sm]/switch:h-3.5 group-data-[size=sm]/switch:w-6 group-data-[state=checked]/switch:bg-primary group-data-[state=unchecked]/switch:bg-input dark:group-data-[state=unchecked]/switch:bg-input/80"
   >
    <SwitchPrimitive.Thumb
     data-slot="switch-thumb"
     className="pointer-events-none block rounded-full bg-background ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0 dark:data-[state=checked]:bg-primary-foreground dark:data-[state=unchecked]:bg-foreground"
    />
   </span>
  </SwitchPrimitive.Root>
 )
}

export { Switch }
