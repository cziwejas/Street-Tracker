import type { ReactNode, SVGProps } from 'react'

export type IconName = 'workouts' | 'exercises' | 'progress' | 'settings'

const paths: Record<IconName, ReactNode> = {
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
