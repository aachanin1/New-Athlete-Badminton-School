import { Card, CardContent } from '@/components/ui/card'
import { Construction } from 'lucide-react'

interface PagePlaceholderProps {
  title: string
  description?: string
}

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">{title}</h1>
        {description && <p className="text-gray-500 text-sm mt-1">{description}</p>}
      </div>
      <Card>
        <CardContent className="py-16">
          <div className="text-center text-gray-400">
            <Construction className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">กำลังพัฒนา</p>
            <p className="text-sm mt-1">ฟีเจอร์นี้กำลังอยู่ระหว่างการพัฒนา</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
