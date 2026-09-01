"use client"

import { useIsMobile } from "@govblock/ui/hooks/use-mobile"
import { Button } from "@govblock/ui/components/nova/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@govblock/ui/components/nova/drawer"
import { TypesetDocsContent } from "@/app/(typeset)/components/docs-panel"

export function TypesetGetCodeDrawer({ className }: { className?: string }) {
  const isMobile = useIsMobile()

  return (
    <Drawer swipeDirection={isMobile ? "down" : "right"}>
      <DrawerTrigger
        render={
          <Button variant="outline" className={className}>
            Get Code
          </Button>
        }
      />
      <DrawerContent
        data-mobile={isMobile}
        className="data-[mobile=true]:max-h-[85svh]"
      >
        <DrawerHeader>
          <DrawerTitle>Get Code</DrawerTitle>
          <DrawerDescription>
            Install typeset with the values you picked.
          </DrawerDescription>
        </DrawerHeader>
        <TypesetDocsContent />
        <DrawerFooter>
          <DrawerClose render={<Button variant="outline" />}>Done</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
