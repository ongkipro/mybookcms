import * as React from "react"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Tabs({
 className,
 ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
 return (
  <TabsPrimitive.Root
   data-slot="tabs"
   className={cn("flex flex-col gap-4", className)}
   {...props}
  />
 )
}

function TabsList({
 className,
 ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
 return (
  <TabsPrimitive.List
   data-slot="tabs-list"
   className={cn(
    "inline-flex w-full flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1",
    className
   )}
   {...props}
  />
 )
}

function TabsTrigger({
 className,
 ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
 return (
  <TabsPrimitive.Trigger
   data-slot="tabs-trigger"
   className={cn(
    // 44px floor, because this is a primary operator control on a phone.
    "inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-xs font-bold text-slate-600 transition",
    "hover:bg-slate-50 hover:text-slate-950",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
    // Selected state carries a border and weight as well as colour, so it does
    // not depend on hue alone.
    "data-[state=active]:border data-[state=active]:border-blue-600 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700",
    "disabled:pointer-events-none disabled:opacity-50",
    className
   )}
   {...props}
  />
 )
}

function TabsContent({
 className,
 ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
 return (
  <TabsPrimitive.Content
   data-slot="tabs-content"
   className={cn("outline-none", className)}
   {...props}
  />
 )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
