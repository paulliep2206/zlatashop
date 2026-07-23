import { CollectionConfig } from 'payload'
import { adminOnly } from '@/access/adminOnly'

export const Attributes: CollectionConfig = {
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  slug: 'attributes',
  admin: { useAsTitle: 'value' },
  fields: [
    {
      name: 'group',
      type: 'select',
      required: true,
      options: [
        { label: 'Історія', value: 'story' },
        { label: 'Фандом', value: 'fandom' },
        { label: 'Рік видання', value: 'year' },
        { label: 'Обкладинка', value: 'bookcover' },
        { label: 'Кількість сторінок', value: 'pages' },
        { label: 'Ілюстрації', value: 'images' },
        { label: 'ISBN', value: 'isbn' },
        { label: 'Жанр', value: 'genre' },
      ],
    },
    {
      name: 'value',
      type: 'text',
      required: true,
      admin: { placeholder: 'e.g., темне фентезі' },
    },
  ],
}
