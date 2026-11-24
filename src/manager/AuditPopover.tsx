import { Fragment, createElement, useId, type KeyboardEvent, type ReactNode } from 'react';

interface AuditPopoverProps {
  title: string;
  trigger?: string;
  label?: string;
  children?: ReactNode;
}

export function AuditPopover({ title, trigger, label, children }: AuditPopoverProps) {
  const id = useId();
  const titleId = `${id}-title`;

  if (typeof HTMLElement.prototype.showPopover !== 'function') {
    return createElement('details', {
      style: { display: 'inline-block', maxWidth: '100%' },
    },
      createElement('summary', { style: { cursor: 'pointer' } }, trigger ?? `About ${title.toLowerCase()}`),
      createElement('div', { style: { maxWidth: '320px', padding: '4px 0' } }, children),
    );
  }

  function closeOnEscape(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Escape') return;
    const popover = event.currentTarget.ownerDocument.getElementById(id);
    if (!popover?.matches(':popover-open')) return;
    event.preventDefault();
    event.stopPropagation();
    popover.hidePopover();
  }

  return createElement(Fragment, null,
    createElement('button', {
      type: 'button',
      popoverTarget: id,
      onKeyDown: closeOnEscape,
      'aria-label': label ?? `Explain ${title.toLowerCase()}`,
      style: {
        background: 'transparent',
        color: 'inherit',
        font: 'inherit',
        padding: 0,
        cursor: 'pointer',
        ...(trigger ? {
          border: 0,
          textDecoration: 'underline dotted',
          textUnderlineOffset: '2px',
          whiteSpace: 'nowrap',
        } : {
          border: '1px solid currentColor',
          borderRadius: '50%',
          width: '24px',
          height: '24px',
        }),
      },
    }, trigger ?? '?'),
    createElement('div', {
      id,
      popover: 'auto',
      onKeyDown: closeOnEscape,
      role: 'region',
      'aria-labelledby': titleId,
      style: {
        position: 'fixed',
        positionArea: 'bottom span-left',
        positionTryFallbacks: 'flip-block, flip-inline, flip-block flip-inline',
        ...(CSS.supports('position-area', 'bottom span-left') && { marginBlock: '6px' }),
        width: 'min(320px, calc(100vw - 32px))',
        maxHeight: 'calc(100vh - 32px)',
        boxSizing: 'border-box',
        overflow: 'auto',
        border: '1px solid GrayText',
        borderRadius: '8px',
        background: 'Canvas',
        color: 'CanvasText',
        padding: '12px 16px',
        lineHeight: 1.5,
      },
    },
      createElement('strong', { id: titleId }, title),
      children,
    ),
  );
}

