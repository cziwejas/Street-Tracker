import type { ReactNode, SVGProps } from 'react'

export type IconName = 'workouts' | 'exercises' | 'progress' | 'settings' | 'edit' | 'trash' | 'timer'

const paths: Record<IconName, ReactNode> = {
  edit: <path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z" />,
  trash: <><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" /></>,
  timer: <><circle cx="12" cy="14" r="8" /><path d="M12 10v4l3 2M9 2h6M12 2v4M18 7l2-2" /></>,
  workouts: (
    <>
      <path d="M6 5v14M3 8v8M18 5v14M21 8v8M6 12h12" />
    </>
  ),
  exercises: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="3" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  progress: <path d="M4 4v16h16M8 15l4-5 4 2 4-6" />,
  settings: (
    <>
      <path d="M4 7h16M4 17h16M8 4v6M16 14v6" />
    </>
  ),
}

type IconProps = SVGProps<SVGSVGElement> & { name: IconName }

export function Icon({ name, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {paths[name]}
    </svg>
  )
}
