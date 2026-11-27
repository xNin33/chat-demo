import { useId, useLayoutEffect, useRef, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { IconChevronDownOutline14 } from '../base/icons.js'
import { IconButton } from '../base/IconButton.js'
import './messageFold.css'

export const MessageFold = ({
  children,
  expanded,
  onToggle,
}: {
  children: string
  expanded: boolean
  onToggle: () => void
}) => {
  const t = useTranslate()
  const id = useId()
  const content = useRef<HTMLDivElement>(null)
  const [long, setLong] = useState(false)
  const folded = long && !expanded
  useLayoutEffect(() => {
    const body = content.current
    if (!body) {
      return
    }
    const measure = () => {
      const limit = parseFloat(getComputedStyle(body).getPropertyValue('--fold-limit'))
      setLong(body.offsetHeight > limit + 2)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(body)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  return (
    <div className="message-fold" data-folded={folded}>
      <div id={id} className="message-fold-viewport">
        <div ref={content} className="message-fold-content">
          {children}
        </div>
      </div>
      {long && (
        <div className="message-fold-action">
          <IconButton
            icon={<IconChevronDownOutline14 />}
            tooltip={t(folded ? 'expandMessage' : 'collapseMessage')}
            aria-expanded={!folded}
            aria-controls={id}
            onClick={onToggle}
          />
        </div>
      )}
    </div>
  )
}
