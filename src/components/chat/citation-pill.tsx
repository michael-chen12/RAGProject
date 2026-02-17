'use client'

interface CitationPillProps {
  index: number
  onClick: () => void
}

/**
 * Renders a clickable [N] citation badge inline with text.
 * Hover state provides visual feedback before the drawer opens.
 */
export function CitationPill({ index, onClick }: CitationPillProps) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold
                 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white
                 transition-colors cursor-pointer mx-0.5 align-text-top"
      aria-label={`View source ${index}`}
    >
      {index}
    </button>
  )
}
