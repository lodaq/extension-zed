import * as React from "react"
import { cn } from "@/lib/utils"
import { getStoredScrollPosition, saveStoredScrollPosition } from "@/lib/bootCache"

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional key (e.g. active tab ID) to track and restore distinct scroll locations */
  scrollKey?: string
  /** Whether to automatically preserve and restore scroll positions. Defaults to true */
  preserveScroll?: boolean
  /** Whether to persist scroll positions across popup opens. Defaults to true */
  persist?: boolean
  /** Additional CSS class for the viewport */
  viewportClassName?: string
  /** Callback fired whenever the scroll location changes */
  onScrollPositionChange?: (scrollTop: number, scrollKey?: string) => void
}

const memoryScrollCache = new Map<string, number>()

export const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  (
    {
      className,
      viewportClassName,
      scrollKey,
      preserveScroll = true,
      persist = true,
      onScrollPositionChange,
      children,
      onScroll,
      ...props
    },
    ref
  ) => {
    const internalRef = React.useRef<HTMLDivElement>(null)
    const activeKeyRef = React.useRef<string | undefined>(scrollKey)
    const targetPosRef = React.useRef<number>(0)
    const userScrolledRef = React.useRef<boolean>(false)
    const isRestoringRef = React.useRef(false)

    React.useImperativeHandle(ref, () => internalRef.current as HTMLDivElement)

    const getPosition = React.useCallback(
      (key: string): number => {
        if (memoryScrollCache.has(key)) {
          return memoryScrollCache.get(key) ?? 0
        }
        if (persist) {
          const stored = getStoredScrollPosition(key)
          memoryScrollCache.set(key, stored)
          return stored
        }
        return 0
      },
      [persist]
    )

    const savePosition = React.useCallback(
      (key: string, top: number) => {
        const rounded = Math.max(0, Math.round(top))
        memoryScrollCache.set(key, rounded)
        targetPosRef.current = rounded
        if (persist) {
          saveStoredScrollPosition(key, rounded)
        }
        onScrollPositionChange?.(rounded, key)
      },
      [persist, onScrollPositionChange]
    )

    const applyRestore = React.useCallback((target: number) => {
      const node = internalRef.current
      if (!node || !preserveScroll || target <= 0) return

      isRestoringRef.current = true
      node.scrollTop = target

      // Check on subsequent frames in case DOM content / images / lazy tabs are rendering
      if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(() => {
          if (node && !userScrolledRef.current && targetPosRef.current === target) {
            if (node.scrollTop < target && node.scrollHeight > node.clientHeight) {
              node.scrollTop = target
            }
          }
          window.requestAnimationFrame(() => {
            isRestoringRef.current = false
          })
        })
      } else {
        isRestoringRef.current = false
      }
    }, [preserveScroll])

    const restorePosition = React.useCallback(
      (key: string) => {
        const target = getPosition(key)
        targetPosRef.current = target
        userScrolledRef.current = false
        if (target > 0) {
          applyRestore(target)
        } else if (internalRef.current) {
          internalRef.current.scrollTop = 0
        }
      },
      [getPosition, applyRestore]
    )

    // Switch tabs / scrollKey changes
    React.useEffect(() => {
      const prevKey = activeKeyRef.current
      const node = internalRef.current

      // Save previous position before switching tabs if user had scrolled or position > 0
      if (prevKey !== undefined && prevKey !== scrollKey && node && preserveScroll) {
        if (userScrolledRef.current || node.scrollTop > 0) {
          savePosition(prevKey, node.scrollTop)
        }
      }

      activeKeyRef.current = scrollKey

      // Restore position for active tab
      if (scrollKey !== undefined && preserveScroll) {
        restorePosition(scrollKey)
      }
    }, [scrollKey, preserveScroll, restorePosition, savePosition])

    // Observe container and content resizing to ensure target scroll position is reached
    // once content (e.g. accordion sections or lazy components) expands to its full height
    React.useEffect(() => {
      const node = internalRef.current
      if (!node || !preserveScroll || typeof ResizeObserver === "undefined") return

      const observer = new ResizeObserver(() => {
        const target = targetPosRef.current
        if (!userScrolledRef.current && target > 0) {
          if (node.scrollTop < target && node.scrollHeight > node.clientHeight) {
            applyRestore(target)
          }
        }
      })

      observer.observe(node)
      if (node.firstElementChild) {
        observer.observe(node.firstElementChild)
      }

      return () => observer.disconnect()
    }, [preserveScroll, applyRestore])

    // Save position before unmounting or window close/pagehide
    React.useEffect(() => {
      const node = internalRef.current
      const handleSave = () => {
        const key = activeKeyRef.current
        if (node && key !== undefined && preserveScroll) {
          if (userScrolledRef.current || node.scrollTop > 0) {
            savePosition(key, node.scrollTop)
          }
        }
      }

      window.addEventListener("pagehide", handleSave)
      window.addEventListener("beforeunload", handleSave)

      return () => {
        handleSave()
        window.removeEventListener("pagehide", handleSave)
        window.removeEventListener("beforeunload", handleSave)
      }
    }, [preserveScroll, savePosition])

    const markUserInteraction = () => {
      userScrolledRef.current = true
    }

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      onScroll?.(e)
      if (isRestoringRef.current) return

      const top = e.currentTarget.scrollTop
      const currentKey = activeKeyRef.current
      const target = targetPosRef.current

      if (preserveScroll && currentKey !== undefined) {
        // If the user has explicitly interacted, save the new location
        if (userScrolledRef.current) {
          savePosition(currentKey, top)
        } else if (top > 0 && Math.abs(top - target) > 5) {
          // Native scrollbar thumb dragged by user
          userScrolledRef.current = true
          savePosition(currentKey, top)
        }
      }
    }

    return (
      <div
        ref={internalRef}
        onScroll={handleScroll}
        onWheel={markUserInteraction}
        onTouchMove={markUserInteraction}
        onPointerDown={markUserInteraction}
        onKeyDown={markUserInteraction}
        className={cn(
          "modular-scrollbar popup-scrollbar overflow-y-auto overflow-x-hidden",
          className,
          viewportClassName
        )}
        data-scroll-area="true"
        data-scroll-key={scrollKey}
        {...props}
      >
        {children}
      </div>
    )
  }
)
ScrollArea.displayName = "ScrollArea"

export interface ScrollBarProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "vertical" | "horizontal"
}

export const ScrollBar = React.forwardRef<HTMLDivElement, ScrollBarProps>(
  ({ className, orientation = "vertical", ...props }, ref) => (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn(
        "flex touch-none select-none",
        orientation === "vertical" && "h-full w-2 border-l border-l-transparent p-[1px]",
        orientation === "horizontal" && "h-2 flex-col border-t border-t-transparent p-[1px]",
        className
      )}
      {...props}
    />
  )
)
ScrollBar.displayName = "ScrollBar"
