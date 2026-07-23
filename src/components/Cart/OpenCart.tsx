import { Button } from '@/components/ui/button'
import clsx from 'clsx'
import React from 'react'
import { ShoppingCart } from 'lucide-react'

export function OpenCartButton({
  className,
  quantity,
  ...rest
}: {
  className?: string
  quantity?: number
}) {
  return (
    <div
      className="relative items-end hover:cursor-pointer"
      {...rest}
    >
      <ShoppingCart size="40px" className="text-primary text-l" />

      {quantity ? (
        <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-black">
          <span>{quantity}</span>
        </div>
      ) : null}
    </div>
  )
}
