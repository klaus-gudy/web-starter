"use client"

import { useEffect } from "react"
import { RotateCw, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

/** Fallback for error.tsx boundaries: what went wrong and a way to retry. */
export function ErrorState({
  error,
  retry,
  className,
}: {
  error: Error & { digest?: string }
  retry: () => void
  className?: string
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <Empty className={className}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlert />
        </EmptyMedia>
        <EmptyTitle>Something went wrong</EmptyTitle>
        <EmptyDescription>
          This page couldn&apos;t load. It&apos;s usually a brief connection
          problem, so try again in a moment.
          {error.digest && (
            <span className="mt-2 block font-mono text-xs">
              Reference: {error.digest}
            </span>
          )}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={() => retry()}>
          <RotateCw data-icon="inline-start" />
          Try again
        </Button>
      </EmptyContent>
    </Empty>
  )
}
