import type { ImageTextBlock as ImageTextBlockProps } from '@/payload-types'

import { Media } from '@/components/Media'
import { RichText } from '@/components/RichText'
import { cn } from '@/utilities/cn'

export const ImageTextBlock: React.FC<ImageTextBlockProps> = ({
  image,
  imageFirst = true,
  richText,
}) => {
  return (
    <div className="container">
      <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12 lg:gap-16">
        <div
          className={cn('md:row-start-1', imageFirst ? 'order-2 md:order-1' : 'order-1 md:order-2')}
        >
          <RichText data={richText} enableGutter={false} />
        </div>

        <Media
          className={cn('md:row-start-1', imageFirst ? 'order-1 md:order-2' : 'order-2 md:order-1')}
          imgClassName="h-auto w-full rounded-[0.8rem] object-cover"
          resource={image}
        />
      </div>
    </div>
  )
}
